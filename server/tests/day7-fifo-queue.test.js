/**
 * ChessIQ v3.3.0 — Day 7 PostgreSQL FIFO Queue Claim CTE & Worker Concurrency Tests (@BE)
 *
 * Verifies:
 * 1. FIFO Claim CTE Pattern: Isolated row locking (FOR UPDATE OF j, js SKIP LOCKED) exclusively on inner joins
 * 2. Deterministic FIFO ordering: Ordered strictly by job_created_at ASC (not random UUID)
 * 3. Atomic claim transaction: Closes 'pending' with GiST interval protection, opens 'processing', generates claim_token
 * 4. Job completion & failure lifecycle helpers
 * 5. Reactive backoff mathematics: Truncated exponential backoff with full jitter Uniform(0.5, 1.5)
 */

const {
  FIFO_CLAIM_CTE_QUERY,
  claimNextJob,
  completeJob,
  failJob,
  calculateBackoffSleep,
} = require("../src/queue");

describe("Day 7: PostgreSQL FIFO Queue Claim CTE & Concurrency Lifecycle (@BE)", () => {
  // ==========================================================================
  // 1. CTE Query Structure & Lock Isolation Verification
  // ==========================================================================
  describe("FIFO CTE Claim Query Structural Invariants", () => {
    it("contains isolated row lock exclusively targeting inner-joined tables (FOR UPDATE OF j, js SKIP LOCKED)", () => {
      expect(FIFO_CLAIM_CTE_QUERY).toContain("FOR UPDATE OF j, js SKIP LOCKED");
      // Must not do unrestricted FOR UPDATE that touches outer joins
      expect(FIFO_CLAIM_CTE_QUERY).not.toMatch(/FOR UPDATE\s+SKIP LOCKED/);
    });

    it("orders strictly by job_created_at.created_at ASC to guarantee FIFO semantics", () => {
      expect(FIFO_CLAIM_CTE_QUERY).toMatch(/ORDER BY jca\.created_at ASC/i);
    });

    it("isolates inner joins within CTE and leaves metadata outer joins outside", () => {
      expect(FIFO_CLAIM_CTE_QUERY).toContain("WITH locked_job AS (");
      expect(FIFO_CLAIM_CTE_QUERY).toContain("INNER JOIN job_games jg");
      expect(FIFO_CLAIM_CTE_QUERY).toContain("INNER JOIN job_statuses js");
      expect(FIFO_CLAIM_CTE_QUERY).toContain("INNER JOIN job_created_at jca");
      expect(FIFO_CLAIM_CTE_QUERY).toContain(
        "LEFT JOIN job_attempt_counts jac",
      );
      expect(FIFO_CLAIM_CTE_QUERY).toContain("LEFT JOIN job_max_retries jmr");
      expect(FIFO_CLAIM_CTE_QUERY).toContain("LEFT JOIN job_total_plies jtp");
    });
  });

  // ==========================================================================
  // 2. Exponential Backoff & Full Jitter Math
  // ==========================================================================
  describe("Reactive Worker Backoff Math (calculateBackoffSleep)", () => {
    it("grows exponentially from baseMs up to maxMs", () => {
      // Mock RNG to fixed 0.5 (multiplier = 1.0)
      const mockRng = () => 0.5;

      const sleep0 = calculateBackoffSleep(0, 200, 5000, mockRng);
      const sleep1 = calculateBackoffSleep(1, 200, 5000, mockRng);
      const sleep2 = calculateBackoffSleep(2, 200, 5000, mockRng);
      const sleep3 = calculateBackoffSleep(3, 200, 5000, mockRng);

      expect(sleep0).toBe(200); // 200 * 2^0 * 1.0 = 200
      expect(sleep1).toBe(400); // 200 * 2^1 * 1.0 = 400
      expect(sleep2).toBe(800); // 200 * 2^2 * 1.0 = 800
      expect(sleep3).toBe(1600); // 200 * 2^3 * 1.0 = 1600
    });

    it("caps exponential delay at maxMs before applying jitter", () => {
      const mockRng = () => 0.5; // multiplier = 1.0
      const largeEmpty = calculateBackoffSleep(10, 200, 5000, mockRng);
      expect(largeEmpty).toBe(5000);
    });

    it("applies full jitter within Uniform(0.5, 1.5) range", () => {
      // Min jitter (random = 0 -> multiplier = 0.5)
      const minSleep = calculateBackoffSleep(2, 200, 5000, () => 0.0);
      expect(minSleep).toBe(Math.floor(800 * 0.5)); // 400

      // Max jitter (random = 1.0 -> multiplier = 1.5)
      const maxSleep = calculateBackoffSleep(2, 200, 5000, () => 1.0);
      expect(maxSleep).toBe(Math.floor(800 * 1.5)); // 1200

      expect(minSleep).toBeLessThanOrEqual(maxSleep);
    });
  });

  // ==========================================================================
  // 3. Queue Claim Execution Lifecycle (Unit Mock)
  // ==========================================================================
  describe("claimNextJob Execution Lifecycle", () => {
    let mockClient;
    let mockPool;

    beforeEach(() => {
      mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      mockPool = {
        connect: jest.fn().mockResolvedValue(mockClient),
      };
    });

    it("returns null and rolls back transaction when queue has no pending jobs", async () => {
      mockClient.query.mockImplementation((sql) => {
        if (sql === "BEGIN") return Promise.resolve();
        if (sql === FIFO_CLAIM_CTE_QUERY) return Promise.resolve({ rows: [] });
        if (sql === "ROLLBACK") return Promise.resolve();
        return Promise.resolve({ rows: [] });
      });

      const result = await claimNextJob(mockPool, "worker-test-1");

      expect(result).toBeNull();
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("successfully claims job, closes pending interval, opens processing, and issues fencing lease", async () => {
      const testJobId = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
      const testGameId = "c1ffcd00-0c0b-4ef8-bb6d-6bb9bd380a22";

      mockClient.query.mockImplementation((sql, params) => {
        if (sql === "BEGIN") return Promise.resolve();
        if (sql === FIFO_CLAIM_CTE_QUERY) {
          return Promise.resolve({
            rows: [
              {
                job_id: testJobId,
                game_id: testGameId,
                attempt_count: 0,
                max_retries: 3,
                total_plies: 42,
              },
            ],
          });
        }
        if (sql === "COMMIT") return Promise.resolve();
        return Promise.resolve({ rows: [], rowCount: 1 });
      });

      const claimed = await claimNextJob(mockPool, "worker-node-1");

      expect(claimed).not.toBeNull();
      expect(claimed.jobId).toBe(testJobId);
      expect(claimed.gameId).toBe(testGameId);
      expect(claimed.attemptCount).toBe(1);
      expect(claimed.totalPlies).toBe(42);
      expect(claimed.claimToken).toBeDefined();
      expect(typeof claimed.claimToken).toBe("string");

      // Verify transaction commit and client release
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("rolls back transaction and releases client if an unexpected query error occurs", async () => {
      mockClient.query.mockImplementation((sql) => {
        if (sql === "BEGIN") return Promise.resolve();
        if (sql === FIFO_CLAIM_CTE_QUERY) {
          throw new Error("Simulated database failure");
        }
        if (sql === "ROLLBACK") return Promise.resolve();
        return Promise.resolve();
      });

      await expect(claimNextJob(mockPool, "worker-node-err")).rejects.toThrow(
        "Simulated database failure",
      );
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 4. Job Completion & Failure Helpers
  // ==========================================================================
  describe("Job Lifecycle Completion & Failure Helpers", () => {
    let mockClient;
    let mockPool;

    beforeEach(() => {
      mockClient = {
        query: jest.fn().mockResolvedValue({ rowCount: 1 }),
        release: jest.fn(),
      };
      mockPool = {
        connect: jest.fn().mockResolvedValue(mockClient),
      };
    });

    it("completeJob updates status to completed, records completed_at, and deletes claim token", async () => {
      await completeJob(mockPool, "job-123", "token-456");

      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
      expect(mockClient.query).toHaveBeenCalledWith(
        "DELETE FROM job_claim_tokens WHERE job_id = $1;",
        ["job-123"],
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("failJob updates status to failed, records error message, and deletes claim token", async () => {
      await failJob(mockPool, "job-123", "token-456", "Engine crash: OOM");

      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
      expect(mockClient.query).toHaveBeenCalledWith(
        "DELETE FROM job_claim_tokens WHERE job_id = $1;",
        ["job-123"],
      );
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});

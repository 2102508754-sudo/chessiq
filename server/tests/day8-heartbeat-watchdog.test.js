/**
 * ChessIQ v3.3.0 — Day 8 Watchdog Heartbeat & SIGKILL Circuit Breaker Tests (@BE)
 *
 * Verifies:
 * 1. Heartbeat Query Integrity: Targets job_heartbeat_at with dual EXISTS subqueries
 * 2. Node-postgres Driver Invariant: Evaluates result.rowCount === 0 strictly
 * 3. Circuit Breaker Immediate SIGKILL: Uncatchable signal 9 sent to Stockfish child process
 * 4. Stale Lease Eviction: Immediately aborts analysis loop with Error('STALE_LEASE_EVICTION')
 * 5. HeartbeatWatchdog Timer Lifecycle: Periodic pinging, progress updates, and clean stoppage
 */

const {
  HEARTBEAT_QUERY,
  UPDATE_CURRENT_PLY_QUERY,
  sendHeartbeat,
  terminateStockfishWithSigkill,
  HeartbeatWatchdog,
} = require("../src/queue");

describe("Day 8: Watchdog Heartbeat & rowCount === 0 SIGKILL Circuit Breaker (@BE)", () => {
  // ==========================================================================
  // 1. Query Structure Invariants
  // ==========================================================================
  describe("Heartbeat Query Structure", () => {
    it("targets single physical table job_heartbeat_at to isolate row locks", () => {
      expect(HEARTBEAT_QUERY).toMatch(/UPDATE\s+job_heartbeat_at/i);
    });

    it("guards update with dual EXISTS subqueries for claim_token and active processing status", () => {
      expect(HEARTBEAT_QUERY).toContain("EXISTS (");
      expect(HEARTBEAT_QUERY).toContain("FROM job_claim_tokens");
      expect(HEARTBEAT_QUERY).toContain("status = 'processing'");
      expect(HEARTBEAT_QUERY).toContain("upper(valid_during) IS NULL");
    });

    it("updates job_current_plies on a separate non-blocking table", () => {
      expect(UPDATE_CURRENT_PLY_QUERY).toMatch(
        /INSERT INTO\s+job_current_plies/i,
      );
      expect(UPDATE_CURRENT_PLY_QUERY).toContain(
        "ON CONFLICT (job_id) DO UPDATE",
      );
    });
  });

  // ==========================================================================
  // 2. Lease Valid Case: rowCount > 0
  // ==========================================================================
  describe("sendHeartbeat with Valid Lease (rowCount > 0)", () => {
    let mockPool;
    let mockStockfish;

    beforeEach(() => {
      mockPool = {
        query: jest.fn().mockImplementation((sql) => {
          if (sql === HEARTBEAT_QUERY) {
            return Promise.resolve({ rowCount: 1 });
          }
          if (sql === UPDATE_CURRENT_PLY_QUERY) {
            return Promise.resolve({ rowCount: 1 });
          }
          return Promise.resolve({ rowCount: 1 });
        }),
      };

      mockStockfish = {
        kill: jest.fn(),
      };
    });

    it("successfully pings heartbeat and updates ply progress when lease is valid", async () => {
      const jobId = "job-valid-1";
      const claimToken = "token-valid-1";

      const res = await sendHeartbeat(
        mockPool,
        jobId,
        claimToken,
        12,
        mockStockfish,
      );

      expect(res.ok).toBe(true);
      expect(res.rowCount).toBe(1);

      // Verify heartbeat query executed with parameters
      expect(mockPool.query).toHaveBeenCalledWith(HEARTBEAT_QUERY, [
        jobId,
        claimToken,
      ]);

      // Verify current_plies update executed
      expect(mockPool.query).toHaveBeenCalledWith(UPDATE_CURRENT_PLY_QUERY, [
        jobId,
        12,
      ]);

      // Stockfish must NOT be killed
      expect(mockStockfish.kill).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 3. Circuit Breaker Trip: rowCount === 0
  // ==========================================================================
  describe("sendHeartbeat Circuit Breaker Trip (rowCount === 0)", () => {
    let mockPool;
    let mockStockfish;

    beforeEach(() => {
      mockPool = {
        query: jest.fn().mockImplementation((sql) => {
          if (sql === HEARTBEAT_QUERY) {
            // Evaluates to rowCount = 0 (token revoked or lease expired)
            return Promise.resolve({ rowCount: 0 });
          }
          return Promise.resolve({ rowCount: 0 });
        }),
      };

      mockStockfish = {
        kill: jest.fn(),
      };
    });

    it("trips circuit breaker, immediately issues uncatchable SIGKILL to Stockfish, and throws STALE_LEASE_EVICTION", async () => {
      const jobId = "job-stale-99";
      const claimToken = "token-revoked-99";

      await expect(
        sendHeartbeat(mockPool, jobId, claimToken, 24, mockStockfish),
      ).rejects.toThrow("STALE_LEASE_EVICTION");

      // Verify uncatchable SIGKILL was dispatched immediately
      expect(mockStockfish.kill).toHaveBeenCalledWith("SIGKILL");
      // Must NOT dispatch catchable SIGTERM
      expect(mockStockfish.kill).not.toHaveBeenCalledWith("SIGTERM");

      // Progress ply must NOT be updated when breaker trips
      expect(mockPool.query).not.toHaveBeenCalledWith(
        UPDATE_CURRENT_PLY_QUERY,
        expect.anything(),
      );
    });

    it("handles Stockfish process wrapped inside worker.process object", async () => {
      const workerWithProcess = {
        process: {
          kill: jest.fn(),
        },
      };

      await expect(
        sendHeartbeat(mockPool, "job-id", "token-id", 5, workerWithProcess),
      ).rejects.toThrow("STALE_LEASE_EVICTION");

      expect(workerWithProcess.process.kill).toHaveBeenCalledWith("SIGKILL");
    });
  });

  // ==========================================================================
  // 4. HeartbeatWatchdog Class Lifecycle
  // ==========================================================================
  describe("HeartbeatWatchdog Lifecycle & Timer Management", () => {
    let mockPool;
    let mockStockfish;

    beforeEach(() => {
      jest.useFakeTimers();

      mockPool = {
        query: jest.fn().mockImplementation((sql) => {
          if (sql === HEARTBEAT_QUERY) {
            return Promise.resolve({ rowCount: 1 });
          }
          return Promise.resolve({ rowCount: 1 });
        }),
      };

      mockStockfish = {
        kill: jest.fn(),
      };
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("starts background interval, pings periodically, and updates ply progress", async () => {
      const watchdog = new HeartbeatWatchdog({
        pool: mockPool,
        jobId: "watchdog-job-1",
        claimToken: "token-1",
        intervalMs: 3000,
        stockfishProcess: mockStockfish,
      });

      watchdog.start();
      expect(watchdog.isRunning).toBe(true);

      // Advance time by 3 seconds
      watchdog.updatePly(7);
      await jest.advanceTimersByTimeAsync(3000);

      expect(mockPool.query).toHaveBeenCalledWith(HEARTBEAT_QUERY, [
        "watchdog-job-1",
        "token-1",
      ]);
      expect(mockPool.query).toHaveBeenCalledWith(UPDATE_CURRENT_PLY_QUERY, [
        "watchdog-job-1",
        7,
      ]);

      // Stop watchdog
      watchdog.stop();
      expect(watchdog.isRunning).toBe(false);

      // Advance further — no more calls
      mockPool.query.mockClear();
      await jest.advanceTimersByTimeAsync(6000);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it("invokes onTrip callback and stops timer when circuit breaker trips during interval ping", async () => {
      mockPool.query.mockImplementation((sql) => {
        if (sql === HEARTBEAT_QUERY) {
          return Promise.resolve({ rowCount: 0 }); // Tripped
        }
        return Promise.resolve({ rowCount: 0 });
      });

      const onTrip = jest.fn();
      const watchdog = new HeartbeatWatchdog({
        pool: mockPool,
        jobId: "watchdog-job-trip",
        claimToken: "token-trip",
        intervalMs: 3000,
        stockfishProcess: mockStockfish,
        onTrip,
      });

      watchdog.start();

      await jest.advanceTimersByTimeAsync(3000);

      expect(watchdog.isTripped).toBe(true);
      expect(watchdog.isRunning).toBe(false);
      expect(mockStockfish.kill).toHaveBeenCalledWith("SIGKILL");
      expect(onTrip).toHaveBeenCalled();
    });
  });
});

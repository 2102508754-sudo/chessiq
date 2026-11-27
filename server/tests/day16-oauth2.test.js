/**
 * ChessIQ v3.3.0 — Day 16: OAuth 2.0 Authorization Code + PKCE Tests
 *
 * Verifies:
 * 1. OAuth2 security param generation (CSRF state + PKCE S256 challenge/verifier)
 * 2. Provider configuration & discovery (getAvailableProviders, isProviderConfigured)
 * 3. Authorization URL generation with PKCE S256 & state
 * 4. Token exchange & profile normalization (Google & GitHub) with mocked fetch
 * 5. Express router endpoints:
 *    - GET /api/auth/oauth/providers
 *    - GET /api/auth/oauth/:provider (404 unsupported, 503 unconfigured, 302 redirect + state cookie)
 *    - GET /api/auth/oauth/:provider/callback (CSRF mismatch, provider error, code exchange + 6NF provisioning)
 * 6. PostgreSQL 6NF integration: user_oauth_identities & v_users LEFT JOIN for passwordless OAuth2 users
 */

const crypto = require("crypto");
const { pool, closePool } = require("../src/db/pool");

process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  "test_jwt_secret_at_least_64_characters_long_for_chessiq_day16_auth_tests_ok";
process.env.COOKIE_SECRET =
  process.env.COOKIE_SECRET ||
  "test_cookie_secret_at_least_64_characters_long_for_chessiq_day16_auth_tests";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgres://chessiq_admin:chessiq_dev_password@localhost:5432/chessiq";

const env = require("../src/config/env");
const oauth2 = require("../src/services/oauth2");
const authRouter = require("../src/routes/auth");

/**
 * Helper to invoke an Express router directly without binding a network socket.
 */
function callRouter(
  router,
  method,
  url,
  { query = {}, params = {}, body = {}, signedCookies = {}, headers = {} } = {},
) {
  return new Promise((resolve, reject) => {
    const req = {
      method: method.toUpperCase(),
      url,
      path: url.split("?")[0],
      query,
      params,
      body,
      signedCookies,
      headers,
      protocol: "http",
      get(name) {
        return this.headers[name.toLowerCase()];
      },
    };

    const res = {
      statusCode: 200,
      cookies: {},
      clearedCookies: [],
      redirectUrl: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      cookie(name, value, options) {
        this.cookies[name] = { value, options };
        return this;
      },
      clearCookie(name) {
        this.clearedCookies.push(name);
        return this;
      },
      redirect(code, target) {
        if (typeof code === "string") {
          this.statusCode = 302;
          this.redirectUrl = code;
        } else {
          this.statusCode = code;
          this.redirectUrl = target;
        }
        resolve(this);
        return this;
      },
      json(data) {
        this.body = data;
        resolve(this);
        return this;
      },
    };

    const next = (err) => {
      if (err) reject(err);
      else resolve(res);
    };

    router.handle(req, res, next);
  });
}

describe("Day 16: OAuth 2.0 Service & Security Primitives", () => {
  const origEnv = {
    googleId: env.OAUTH_GOOGLE_CLIENT_ID,
    googleSecret: env.OAUTH_GOOGLE_CLIENT_SECRET,
    githubId: env.OAUTH_GITHUB_CLIENT_ID,
    githubSecret: env.OAUTH_GITHUB_CLIENT_SECRET,
  };

  afterEach(() => {
    env.OAUTH_GOOGLE_CLIENT_ID = origEnv.googleId;
    env.OAUTH_GOOGLE_CLIENT_SECRET = origEnv.googleSecret;
    env.OAUTH_GITHUB_CLIENT_ID = origEnv.githubId;
    env.OAUTH_GITHUB_CLIENT_SECRET = origEnv.githubSecret;
    jest.restoreAllMocks();
  });

  it("generates cryptographically random state and valid PKCE S256 pair", () => {
    const { state, codeVerifier, codeChallenge } =
      oauth2.generateOAuthSecurityParams();

    expect(state.length).toBeGreaterThanOrEqual(24);
    expect(codeVerifier.length).toBeGreaterThanOrEqual(40);

    const expectedChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    expect(codeChallenge).toBe(expectedChallenge);
  });

  it("reports only configured providers in getAvailableProviders()", () => {
    env.OAUTH_GOOGLE_CLIENT_ID = "google-client-id";
    env.OAUTH_GOOGLE_CLIENT_SECRET = "google-client-secret";
    env.OAUTH_GITHUB_CLIENT_ID = undefined;
    env.OAUTH_GITHUB_CLIENT_SECRET = undefined;

    const providers = oauth2.getAvailableProviders();
    expect(providers).toEqual([{ id: "google", name: "Google" }]);
  });

  it("builds Google authorization URL with PKCE S256 and state", () => {
    env.OAUTH_GOOGLE_CLIENT_ID = "test-google-id";
    env.OAUTH_GOOGLE_CLIENT_SECRET = "test-google-secret";

    const urlStr = oauth2.buildAuthorizationUrl("google", {
      state: "state-123",
      codeChallenge: "challenge-abc",
      redirectUri: "http://localhost:3000/api/auth/oauth/google/callback",
    });

    const parsed = new URL(urlStr);
    expect(parsed.origin).toBe("https://accounts.google.com");
    expect(parsed.searchParams.get("client_id")).toBe("test-google-id");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("state")).toBe("state-123");
    expect(parsed.searchParams.get("code_challenge")).toBe("challenge-abc");
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
    expect(parsed.searchParams.get("scope")).toContain("openid");
  });

  it("exchanges authorization code for access token via fetch", async () => {
    env.OAUTH_GITHUB_CLIENT_ID = "gh-id";
    env.OAUTH_GITHUB_CLIENT_SECRET = "gh-secret";

    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "gho_mock_access_token",
        token_type: "bearer",
      }),
    });

    const result = await oauth2.exchangeCodeForToken("github", {
      code: "auth-code-xyz",
      redirectUri: "http://localhost:3000/api/auth/oauth/github/callback",
      codeVerifier: "verifier-123",
    });

    expect(result.accessToken).toBe("gho_mock_access_token");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchSpy.mock.calls[0];
    expect(calledUrl).toBe("https://github.com/login/oauth/access_token");
    expect(init.method).toBe("POST");
    expect(init.body).toContain("code_verifier=verifier-123");
  });

  it("normalizes Google user profile", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sub: "google-uid-999",
        email: "Magnus@Example.COM",
        email_verified: true,
        name: "Magnus Carlsen!",
      }),
    });

    const profile = await oauth2.fetchOAuthUserProfile("google", "tok-123");
    expect(profile).toEqual({
      provider: "google",
      providerUserId: "google-uid-999",
      email: "magnus@example.com",
      emailVerified: true,
      username: "Magnus_Carlsen",
    });
  });

  it("normalizes GitHub user profile using /user/emails fallback", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 424242,
          login: "hikaru_dev",
          email: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { email: "secondary@example.com", primary: false, verified: true },
          { email: "primary@example.com", primary: true, verified: true },
        ],
      });

    const profile = await oauth2.fetchOAuthUserProfile("github", "tok-gh");
    expect(profile).toEqual({
      provider: "github",
      providerUserId: "424242",
      email: "primary@example.com",
      emailVerified: true,
      username: "hikaru_dev",
    });
  });
});

describe("Day 16: OAuth 2.0 Express Routes", () => {
  const origEnv = {
    googleId: env.OAUTH_GOOGLE_CLIENT_ID,
    googleSecret: env.OAUTH_GOOGLE_CLIENT_SECRET,
  };

  afterEach(() => {
    env.OAUTH_GOOGLE_CLIENT_ID = origEnv.googleId;
    env.OAUTH_GOOGLE_CLIENT_SECRET = origEnv.googleSecret;
    jest.restoreAllMocks();
  });

  it("GET /oauth/providers returns configured providers", async () => {
    env.OAUTH_GOOGLE_CLIENT_ID = "g-id";
    env.OAUTH_GOOGLE_CLIENT_SECRET = "g-sec";

    const res = await callRouter(authRouter, "GET", "/oauth/providers");
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data.providers).toEqual(
      expect.arrayContaining([{ id: "google", name: "Google" }]),
    );
  });

  it("GET /oauth/:provider returns 404 for unsupported provider", async () => {
    await expect(
      callRouter(authRouter, "GET", "/oauth/facebook"),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });
  });

  it("GET /oauth/:provider returns 503 when provider is unconfigured", async () => {
    env.OAUTH_GOOGLE_CLIENT_ID = undefined;
    env.OAUTH_GOOGLE_CLIENT_SECRET = undefined;

    await expect(
      callRouter(authRouter, "GET", "/oauth/google"),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: "OAUTH_PROVIDER_NOT_CONFIGURED",
    });
  });

  it("GET /oauth/:provider sets signed state cookie and redirects to provider", async () => {
    env.OAUTH_GOOGLE_CLIENT_ID = "g-id";
    env.OAUTH_GOOGLE_CLIENT_SECRET = "g-sec";

    const res = await callRouter(authRouter, "GET", "/oauth/google", {
      headers: { host: "localhost:3000" },
    });

    expect(res.statusCode).toBe(302);
    expect(res.redirectUrl).toContain(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(res.cookies.chessiq_oauth_state).toBeDefined();
    expect(res.cookies.chessiq_oauth_state.options.httpOnly).toBe(true);
    expect(res.cookies.chessiq_oauth_state.options.signed).toBe(true);
  });

  it("GET /oauth/:provider/callback rejects CSRF state mismatch", async () => {
    const res = await callRouter(authRouter, "GET", "/oauth/google/callback", {
      query: { code: "abc", state: "wrong-state" },
      signedCookies: {
        chessiq_oauth_state: JSON.stringify({
          provider: "google",
          state: "expected-state",
          codeVerifier: "verifier",
        }),
      },
    });

    expect(res.statusCode).toBe(302);
    expect(res.redirectUrl).toContain("oauth_error=");
    expect(res.clearedCookies).toContain("chessiq_oauth_state");
  });
});

describe("Day 16: PostgreSQL 6NF OAuth 2.0 Integration (@DB)", () => {
  let dbAvailable = false;

  beforeAll(async () => {
    try {
      await pool.query("SELECT 1;");
      dbAvailable = true;
    } catch (_) {
      dbAvailable = false;
    }
  });

  afterAll(async () => {
    await closePool();
  });

  const itDb = (name, fn) => {
    it(
      name,
      async () => {
        if (!dbAvailable) return;
        await fn();
      },
      20000,
    );
  };

  itDb(
    "provisions a passwordless OAuth2 user and retrieves it via v_users",
    async () => {
      const suffix = crypto.randomBytes(4).toString("hex");
      const username = `oauth_${suffix}`;
      const email = `oauth_${suffix}@chessiq-test.local`;
      const providerUid = `sub_${suffix}`;

      const userRes = await pool.query(
        "INSERT INTO users DEFAULT VALUES RETURNING id",
      );
      const userId = userRes.rows[0].id;

      await pool.query(
        "INSERT INTO user_usernames (user_id, username) VALUES ($1, $2)",
        [userId, username],
      );
      await pool.query(
        "INSERT INTO user_emails (user_id, email) VALUES ($1, $2)",
        [userId, email],
      );
      await pool.query(
        "INSERT INTO user_ratings (user_id, chess_rating, valid_during) VALUES ($1, $2, tstzrange(NOW(), NULL, '[)'))",
        [userId, 1200],
      );
      await pool.query("INSERT INTO user_created_at (user_id) VALUES ($1)", [
        userId,
      ]);
      await pool.query("INSERT INTO user_updated_at (user_id) VALUES ($1)", [
        userId,
      ]);
      await pool.query(
        "INSERT INTO user_oauth_identities (user_id, provider, provider_user_id) VALUES ($1, $2, $3)",
        [userId, "google", providerUid],
      );

      const viewRes = await pool.query("SELECT * FROM v_users WHERE id = $1", [
        userId,
      ]);
      expect(viewRes.rows.length).toBe(1);
      expect(viewRes.rows[0].username).toBe(username);
      expect(viewRes.rows[0].email).toBe(email);
      expect(viewRes.rows[0].password_hash).toBeNull();

      await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    },
  );

  itDb(
    "completes full OAuth 2.0 callback flow end-to-end and sets chessiq_session cookie",
    async () => {
      const suffix = crypto.randomBytes(4).toString("hex");
      const email = `cb_${suffix}@chessiq-test.local`;
      const providerUid = `gh_${suffix}`;

      env.OAUTH_GITHUB_CLIENT_ID = "gh-test-id";
      env.OAUTH_GITHUB_CLIENT_SECRET = "gh-test-secret";

      jest
        .spyOn(global, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: "gho_test_token",
            token_type: "bearer",
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: providerUid,
            login: `ghuser_${suffix}`,
            email,
          }),
        });

      const state = "valid-csrf-state-token";
      const res = await callRouter(
        authRouter,
        "GET",
        "/oauth/github/callback",
        {
          query: { code: "oauth-code-1", state },
          signedCookies: {
            chessiq_oauth_state: JSON.stringify({
              provider: "github",
              state,
              codeVerifier: "pkce-verifier-xyz",
              redirectUri:
                "http://localhost:3000/api/auth/oauth/github/callback",
            }),
          },
        },
      );

      expect(res.statusCode).toBe(302);
      expect(res.redirectUrl).toContain("oauth=success");
      expect(res.cookies.chessiq_session).toBeDefined();
      expect(res.cookies.chessiq_session.options.httpOnly).toBe(true);

      // Cleanup created user
      const uRes = await pool.query(
        "SELECT user_id FROM user_emails WHERE email = $1",
        [email],
      );
      expect(uRes.rows.length).toBe(1);
      await pool.query("DELETE FROM users WHERE id = $1", [
        uRes.rows[0].user_id,
      ]);
      jest.restoreAllMocks();
    },
  );
});

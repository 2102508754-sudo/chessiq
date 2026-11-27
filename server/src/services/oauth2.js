/**
 * ChessIQ v3.3.0 — OAuth 2.0 Service (Authorization Code + PKCE S256 + CSRF State)
 * Supports Google and GitHub OAuth 2.0 providers using Node built-in fetch & crypto.
 */

const crypto = require("crypto");
const env = require("../config/env");

/**
 * Provider registry defining standard OAuth 2.0 endpoints and scopes.
 */
const PROVIDERS = {
  google: {
    id: "google",
    name: "Google",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    scopes: ["openid", "email", "profile"],
    supportsPkce: true,
    getCredentials: () => ({
      clientId: env.OAUTH_GOOGLE_CLIENT_ID,
      clientSecret: env.OAUTH_GOOGLE_CLIENT_SECRET,
    }),
  },
  github: {
    id: "github",
    name: "GitHub",
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    userInfoUrl: "https://api.github.com/user",
    userEmailsUrl: "https://api.github.com/user/emails",
    scopes: ["read:user", "user:email"],
    supportsPkce: true,
    getCredentials: () => ({
      clientId: env.OAUTH_GITHUB_CLIENT_ID,
      clientSecret: env.OAUTH_GITHUB_CLIENT_SECRET,
    }),
  },
};

/**
 * Base64URL-encode a buffer without padding.
 * @param {Buffer} buf
 * @returns {string}
 */
function base64UrlEncode(buf) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Generates a cryptographic OAuth2 CSRF state token and PKCE S256 verifier/challenge pair.
 * @returns {{ state: string, codeVerifier: string, codeChallenge: string }}
 */
function generateOAuthSecurityParams() {
  const state = base64UrlEncode(crypto.randomBytes(24));
  const codeVerifier = base64UrlEncode(crypto.randomBytes(32));
  const codeChallenge = base64UrlEncode(
    crypto.createHash("sha256").update(codeVerifier).digest(),
  );
  return { state, codeVerifier, codeChallenge };
}

/**
 * Returns provider config if supported, or null.
 * @param {string} providerId
 */
function getProviderConfig(providerId) {
  if (!providerId || typeof providerId !== "string") return null;
  return PROVIDERS[providerId.toLowerCase()] || null;
}

/**
 * Checks whether a provider has both clientId and clientSecret configured.
 * @param {string} providerId
 * @returns {boolean}
 */
function isProviderConfigured(providerId) {
  const cfg = getProviderConfig(providerId);
  if (!cfg) return false;
  const { clientId, clientSecret } = cfg.getCredentials();
  return Boolean(clientId && clientSecret);
}

/**
 * Lists all configured OAuth 2.0 providers safe to expose to the frontend.
 * @returns {Array<{ id: string, name: string }>}
 */
function getAvailableProviders() {
  return Object.values(PROVIDERS)
    .filter((p) => isProviderConfigured(p.id))
    .map((p) => ({ id: p.id, name: p.name }));
}

/**
 * Resolves the OAuth callback URL for a provider.
 * Uses OAUTH_CALLBACK_BASE_URL if set, otherwise falls back to FRONTEND_URL
 * (which proxies /api/* to the backend in single-domain topology).
 * @param {string} providerId
 * @param {string} [originBase]
 * @returns {string}
 */
function buildRedirectUri(providerId, originBase) {
  const base = (
    env.OAUTH_CALLBACK_BASE_URL ||
    originBase ||
    env.FRONTEND_URL
  ).replace(/\/+$/, "");
  return `${base}/api/auth/oauth/${providerId}/callback`;
}

/**
 * Builds the provider's OAuth 2.0 authorization URL.
 * @param {string} providerId
 * @param {{ state: string, codeChallenge?: string, redirectUri: string }} params
 * @returns {string}
 */
function buildAuthorizationUrl(
  providerId,
  { state, codeChallenge, redirectUri },
) {
  const cfg = getProviderConfig(providerId);
  if (!cfg) {
    throw new Error(`Unsupported OAuth2 provider: ${providerId}`);
  }

  const { clientId } = cfg.getCredentials();
  if (!clientId) {
    throw new Error(`OAuth2 provider ${providerId} is not configured`);
  }

  const url = new URL(cfg.authorizeUrl);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", cfg.scopes.join(" "));
  url.searchParams.set("state", state);

  if (cfg.supportsPkce && codeChallenge) {
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
  }

  if (providerId === "google") {
    url.searchParams.set("access_type", "online");
    url.searchParams.set("prompt", "select_account");
  }

  return url.toString();
}

/**
 * Exchanges an authorization code for an access token at the provider's token endpoint.
 * @param {string} providerId
 * @param {{ code: string, redirectUri: string, codeVerifier?: string }} params
 * @returns {Promise<{ accessToken: string, tokenType: string }>}
 */
async function exchangeCodeForToken(
  providerId,
  { code, redirectUri, codeVerifier },
) {
  const cfg = getProviderConfig(providerId);
  if (!cfg) {
    throw new Error(`Unsupported OAuth2 provider: ${providerId}`);
  }

  const { clientId, clientSecret } = cfg.getCredentials();
  if (!clientId || !clientSecret) {
    throw new Error(`OAuth2 provider ${providerId} is not configured`);
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  if (cfg.supportsPkce && codeVerifier) {
    body.set("code_verifier", codeVerifier);
  }

  const response = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `OAuth2 token exchange failed (${response.status}): ${text}`,
    );
  }

  const data = await response.json();
  if (data.error || !data.access_token) {
    throw new Error(
      `OAuth2 token error: ${data.error_description || data.error || "Missing access_token"}`,
    );
  }

  return {
    accessToken: data.access_token,
    tokenType: data.token_type || "Bearer",
  };
}

/**
 * Fetches and normalizes the authenticated user's profile from the OAuth 2.0 provider.
 * @param {string} providerId
 * @param {string} accessToken
 * @returns {Promise<{ provider: string, providerUserId: string, email: string, emailVerified: boolean, username: string }>}
 */
async function fetchOAuthUserProfile(providerId, accessToken) {
  const cfg = getProviderConfig(providerId);
  if (!cfg) {
    throw new Error(`Unsupported OAuth2 provider: ${providerId}`);
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    "User-Agent": "ChessIQ-OAuth2-Client",
  };

  const userRes = await fetch(cfg.userInfoUrl, { headers });
  if (!userRes.ok) {
    throw new Error(
      `Failed to fetch ${cfg.name} user profile (${userRes.status})`,
    );
  }
  const profile = await userRes.json();

  if (providerId === "google") {
    if (!profile.sub || !profile.email) {
      throw new Error("Google user profile missing required sub or email");
    }
    return {
      provider: "google",
      providerUserId: String(profile.sub),
      email: String(profile.email).trim().toLowerCase(),
      emailVerified: Boolean(profile.email_verified),
      username: sanitizeUsername(
        profile.name || profile.email.split("@")[0] || "chessiq_user",
      ),
    };
  }

  if (providerId === "github") {
    let email = profile.email;
    let emailVerified = false;

    if (!email && cfg.userEmailsUrl) {
      const emailsRes = await fetch(cfg.userEmailsUrl, { headers });
      if (emailsRes.ok) {
        const emails = await emailsRes.json();
        if (Array.isArray(emails)) {
          const primaryVerified =
            emails.find((e) => e.primary && e.verified) ||
            emails.find((e) => e.verified) ||
            emails[0];
          if (primaryVerified) {
            email = primaryVerified.email;
            emailVerified = Boolean(primaryVerified.verified);
          }
        }
      }
    } else if (email) {
      emailVerified = true;
    }

    if (!profile.id || !email) {
      throw new Error("GitHub user profile missing required id or email");
    }

    return {
      provider: "github",
      providerUserId: String(profile.id),
      email: String(email).trim().toLowerCase(),
      emailVerified,
      username: sanitizeUsername(
        profile.login || email.split("@")[0] || "chessiq_user",
      ),
    };
  }

  throw new Error(`Unsupported OAuth2 provider: ${providerId}`);
}

/**
 * Sanitizes a raw OAuth display name or handle into a valid ChessIQ username (3-24 chars, [a-zA-Z0-9_-]).
 * @param {string} raw
 * @returns {string}
 */
function sanitizeUsername(raw) {
  const cleaned = String(raw || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  if (cleaned.length >= 3) return cleaned;
  return `player_${crypto.randomBytes(3).toString("hex")}`;
}

module.exports = {
  PROVIDERS,
  generateOAuthSecurityParams,
  getProviderConfig,
  isProviderConfigured,
  getAvailableProviders,
  buildRedirectUri,
  buildAuthorizationUrl,
  exchangeCodeForToken,
  fetchOAuthUserProfile,
  sanitizeUsername,
};

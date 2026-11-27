-- ============================================================================
-- ChessIQ v3.3.0 — Migration 007: OAuth 2.0 External Identity Linking
--
-- Adds 6NF-aligned OAuth 2.0 provider identity storage (`user_oauth_identities`)
-- and updates `v_users` to LEFT JOIN `user_password_hashes` so OAuth2-provisioned
-- accounts without a local password hash are reconstructed cleanly.
-- ============================================================================

-- External OAuth 2.0 Identity Link (Composite Key: provider + provider_user_id)
CREATE TABLE IF NOT EXISTS user_oauth_identities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(32) NOT NULL CHECK (provider IN ('google', 'github')),
    provider_user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (provider, provider_user_id),
    UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_oauth_identities_user_id
    ON user_oauth_identities(user_id);

CREATE INDEX IF NOT EXISTS idx_user_oauth_identities_lookup
    ON user_oauth_identities(provider, provider_user_id);

-- Update v_users 3NF reconstruction view to LEFT JOIN user_password_hashes
-- so OAuth2-only users (who have no local password_hash) are still returned.
CREATE OR REPLACE VIEW v_users AS
SELECT
    u.id,
    ue.email,
    uu.username,
    uph.password_hash,
    ur.chess_rating,
    uca.created_at,
    uua.updated_at
FROM users u
JOIN user_emails ue ON u.id = ue.user_id
JOIN user_usernames uu ON u.id = uu.user_id
LEFT JOIN user_password_hashes uph ON u.id = uph.user_id
LEFT JOIN LATERAL (
    SELECT chess_rating
    FROM user_ratings
    WHERE user_id = u.id AND upper(valid_during) IS NULL
    ORDER BY lower(valid_during) DESC
    LIMIT 1
) ur ON TRUE
JOIN user_created_at uca ON u.id = uca.user_id
JOIN user_updated_at uua ON u.id = uua.user_id;

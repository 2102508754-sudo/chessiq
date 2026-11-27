/**
 * ChessIQ — Grandmaster Editorial Game History (My Games)
 * Section 6.D: Elegant game registry with subtle row separators, search, filter,
 * opponent Elo, ECO code, result badges, ACPL, and direct Game Review inspection.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  History,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Inbox,
  Swords,
  CheckCircle2,
  Clock,
  ArrowRight,
  Search,
  Filter,
} from "lucide-react";
import api from "../../api/client";

export default function UserGameHistory({
  isAuthenticated,
  onLoadAnalyzedGame,
  onGoToUpload,
}) {
  const [games, setGames] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingGameId, setLoadingGameId] = useState(null);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL"); // "ALL" | "ANALYZED" | "QUEUED"

  const loadHistory = useCallback(
    async (signal) => {
      if (!isAuthenticated) return;
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.get("/api/games", { signal });
        const data = res?.data || res || {};
        const list = Array.isArray(data.games)
          ? data.games
          : Array.isArray(data)
            ? data
            : [];
        setGames(list);
      } catch (err) {
        if (signal?.aborted || err?.name === "AbortError") return;
        setError(err?.message || "Failed to fetch your game history.");
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [isAuthenticated],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadHistory(controller.signal);
    return () => controller.abort();
  }, [loadHistory]);

  const handleOpenGame = async (gameId) => {
    setLoadingGameId(gameId);
    try {
      const res = await api.get(`/api/games/${encodeURIComponent(gameId)}`);
      const data = res?.data || res;
      if (data?.game && onLoadAnalyzedGame) {
        onLoadAnalyzedGame(data.game, data.moves || []);
      }
    } catch (err) {
      setError(err?.message || "Unable to load selected game review.");
    } finally {
      setLoadingGameId(null);
    }
  };

  // Filter and search
  const filteredGames = useMemo(() => {
    return games.filter((g) => {
      if (statusFilter === "ANALYZED" && !g.analysis_completed) return false;
      if (statusFilter === "QUEUED" && g.analysis_completed) return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const white = (g.white_player || "").toLowerCase();
      const black = (g.black_player || "").toLowerCase();
      const eco = (g.eco_code || "").toLowerCase();
      return white.includes(q) || black.includes(q) || eco.includes(q);
    });
  }, [games, statusFilter, searchQuery]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Editorial Masthead & Filter Bar */}
      <div className="editorial-card" style={{ padding: "20px 24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "14px",
            marginBottom: "16px",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "4px",
              }}
            >
              <History size={18} color="var(--accent-gold)" />
              <h2
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "20px",
                  fontWeight: "600",
                }}
              >
                My Analyzed Encounters
              </h2>
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              Private relational 6NF repository of your submitted PGNs and
              Stockfish NNUE move telemetry (<code>v_games</code>).
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={() => loadHistory()}
              disabled={isLoading}
              className="btn-secondary"
              style={{ padding: "7px 14px", fontSize: "12px" }}
            >
              <RefreshCw
                size={13}
                className={isLoading ? "animate-spin" : ""}
              />
              <span>Refresh Archive</span>
            </button>
            {onGoToUpload && (
              <button
                type="button"
                onClick={onGoToUpload}
                className="btn-primary"
                style={{ padding: "7px 14px", fontSize: "12px" }}
              >
                <Swords size={13} />
                <span>Upload New PGN</span>
              </button>
            )}
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            paddingTop: "14px",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          <div
            style={{
              position: "relative",
              minWidth: "240px",
              flex: 1,
              maxWidth: "380px",
            }}
          >
            <Search
              size={14}
              color="var(--text-muted)"
              style={{
                position: "absolute",
                left: "10px",
                top: "50%",
                transform: "translateY(-50%)",
              }}
            />
            <input
              type="text"
              placeholder="Search opponent or ECO code (e.g. B90)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: "100%", paddingLeft: "30px", fontSize: "12px" }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {["ALL", "ANALYZED", "QUEUED"].map((tab) => {
              const isSelected = statusFilter === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatusFilter(tab)}
                  style={{
                    padding: "5px 10px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontWeight: isSelected ? "600" : "500",
                    border: isSelected
                      ? "1px solid var(--accent-gold)"
                      : "1px solid var(--border)",
                    backgroundColor: isSelected
                      ? "var(--accent-gold-light)"
                      : "var(--surface-primary)",
                    color: isSelected
                      ? "var(--accent-gold)"
                      : "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div
          className="editorial-card"
          style={{ padding: "48px 24px", textAlign: "center" }}
        >
          <Loader2
            size={24}
            color="var(--accent-gold)"
            className="animate-spin"
            style={{ margin: "0 auto 10px" }}
          />
          <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            Synchronizing game archive with backend views...
          </p>
        </div>
      )}

      {/* Error state */}
      {!isLoading && error && (
        <div
          className="editorial-card"
          role="alert"
          style={{
            padding: "16px 20px",
            borderLeft: "3px solid var(--accent-clay)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "var(--accent-clay)",
              fontSize: "13px",
            }}
          >
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => loadHistory()}
            className="btn-secondary"
            style={{ padding: "5px 12px", fontSize: "12px" }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredGames.length === 0 && (
        <div
          className="editorial-card"
          style={{ padding: "50px 24px", textAlign: "center" }}
        >
          <Inbox
            size={32}
            color="var(--accent-gold)"
            style={{ margin: "0 auto 12px" }}
          />
          <h3
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "18px",
              marginBottom: "6px",
            }}
          >
            {searchQuery
              ? "No Matching Encounters Found"
              : "No Analyzed Encounters In Archive"}
          </h3>
          <p
            style={{
              fontSize: "13px",
              color: "var(--text-secondary)",
              maxWidth: "420px",
              margin: "0 auto 16px",
            }}
          >
            {searchQuery
              ? "Try adjusting your search criteria or clearing filters."
              : "Upload a PGN from your matches to initiate automated Stockfish NNUE move evaluation and ACPL tracking."}
          </p>
          {onGoToUpload && !searchQuery && (
            <button
              type="button"
              onClick={onGoToUpload}
              className="btn-primary"
            >
              <Swords size={14} />
              <span>Submit PGN in Game Review</span>
            </button>
          )}
        </div>
      )}

      {/* Game List: Editorial Table with subtle row separators */}
      {!isLoading && !error && filteredGames.length > 0 && (
        <div className="editorial-card" style={{ overflow: "hidden" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(200px, 2fr) 90px 100px 110px 120px 110px",
              padding: "10px 18px",
              backgroundColor: "var(--surface-secondary)",
              borderBottom: "1px solid var(--border)",
              fontSize: "11px",
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--text-muted)",
            }}
            className="game-history-header"
          >
            <div>Matchup</div>
            <div>Result</div>
            <div>Opening</div>
            <div>Precision</div>
            <div>Status</div>
            <div style={{ textAlign: "right" }}>Action</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {filteredGames.map((g, index) => {
              const isWhite =
                (g.user_color || "WHITE").toUpperCase() === "WHITE";
              const userAcpl = isWhite ? g.white_acpl : g.black_acpl;

              return (
                <div
                  key={g.id || index}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "minmax(200px, 2fr) 90px 100px 110px 120px 110px",
                    alignItems: "center",
                    padding: "14px 18px",
                    borderBottom:
                      index < filteredGames.length - 1
                        ? "1px solid var(--border-subtle)"
                        : "none",
                    transition: "background-color 0.15s ease",
                  }}
                  className="game-history-row"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      "var(--surface-hover)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  {/* Matchup */}
                  <div>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: "600",
                        color: "var(--text-primary)",
                      }}
                    >
                      {g.white_player || "White"} vs {g.black_player || "Black"}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--text-muted)",
                        marginTop: "2px",
                      }}
                    >
                      Playing as {g.user_color || "White"}
                    </div>
                  </div>

                  {/* Result */}
                  <div>
                    <span
                      style={{
                        fontSize: "11px",
                        fontFamily: "var(--font-mono)",
                        fontWeight: "700",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        backgroundColor: "var(--surface-secondary)",
                        border: "1px solid var(--border)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {g.result || "*"}
                    </span>
                  </div>

                  {/* Opening */}
                  <div>
                    <span
                      style={{
                        fontSize: "11px",
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {g.eco_code || "A00"}
                    </span>
                  </div>

                  {/* Precision / ACPL */}
                  <div>
                    {userAcpl != null ? (
                      <span
                        style={{
                          fontSize: "12px",
                          fontFamily: "var(--font-mono)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {userAcpl}{" "}
                        <span
                          style={{
                            fontSize: "10px",
                            color: "var(--text-muted)",
                          }}
                        >
                          ACPL
                        </span>
                      </span>
                    ) : (
                      <span
                        style={{ fontSize: "11px", color: "var(--text-muted)" }}
                      >
                        —
                      </span>
                    )}
                  </div>

                  {/* Status */}
                  <div>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        fontSize: "11px",
                        color: g.analysis_completed
                          ? "var(--accent-sage)"
                          : "var(--accent-gold)",
                      }}
                    >
                      {g.analysis_completed ? (
                        <>
                          <CheckCircle2 size={13} />
                          <span>Analyzed</span>
                        </>
                      ) : (
                        <>
                          <Clock size={13} />
                          <span>Queued</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Action */}
                  <div style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={() => handleOpenGame(g.id)}
                      disabled={loadingGameId === g.id}
                      className="btn-secondary"
                      style={{ padding: "4px 10px", fontSize: "11px" }}
                    >
                      {loadingGameId === g.id ? (
                        "Loading..."
                      ) : (
                        <>
                          <span>Inspect</span>
                          <ArrowRight size={11} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

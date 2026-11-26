/**
 * ChessIQ v3.3.0 — Protected User Game History View
 * Day 16 (@FE): Fetches authenticated user's uploaded/analyzed games from GET /api/games
 * and hydrates full 6NF move analyses via GET /api/games/:id into Game Review.
 */

import React, { useState, useEffect, useCallback } from "react";
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div className="glass-panel" style={{ padding: "22px 24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
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
              <History size={20} color="var(--accent-cyan)" />
              <h2 style={{ fontSize: "19px", fontWeight: "700" }}>
                Your Analyzed Game History
              </h2>
            </div>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              Private session-protected repository of PGNs submitted under your
              account (<code>v_games</code>).
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadHistory()}
            disabled={isLoading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "8px",
              background: "rgba(56, 189, 248, 0.12)",
              border: "1px solid rgba(56, 189, 248, 0.35)",
              color: "var(--accent-cyan)",
              fontSize: "12px",
              fontWeight: "600",
              cursor: isLoading ? "wait" : "pointer",
            }}
          >
            <RefreshCw size={14} /> Refresh Games
          </button>
        </div>
      </div>

      {isLoading && (
        <div
          className="glass-panel"
          style={{ padding: "40px", textAlign: "center" }}
        >
          <Loader2
            size={26}
            color="var(--accent-cyan)"
            style={{ marginBottom: "10px" }}
          />
          <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            Loading your game history...
          </p>
        </div>
      )}

      {!isLoading && error && (
        <div
          className="glass-panel"
          role="alert"
          style={{
            padding: "20px",
            borderLeft: "4px solid var(--accent-rose)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              color: "#fb7185",
              fontSize: "13px",
            }}
          >
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => loadHistory()}
            className="btn-primary"
            style={{ padding: "6px 14px", fontSize: "12px" }}
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && games.length === 0 && (
        <div
          className="glass-panel"
          style={{ padding: "44px 24px", textAlign: "center" }}
        >
          <Inbox
            size={30}
            color="var(--accent-cyan)"
            style={{ marginBottom: "10px" }}
          />
          <h3
            style={{ fontSize: "16px", fontWeight: "700", marginBottom: "6px" }}
          >
            No Uploaded Games Found
          </h3>
          <p
            style={{
              fontSize: "13px",
              color: "var(--text-secondary)",
              marginBottom: "16px",
            }}
          >
            Upload a PGN in Game Review to queue it for Stockfish NNUE analysis.
          </p>
          {onGoToUpload && (
            <button
              type="button"
              onClick={onGoToUpload}
              className="btn-primary"
              style={{ padding: "8px 16px", fontSize: "12px" }}
            >
              <Swords size={14} /> Go to Game Review
            </button>
          )}
        </div>
      )}

      {!isLoading && !error && games.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "14px",
          }}
        >
          {games.map((g) => (
            <div
              key={g.id}
              className="glass-panel"
              style={{
                padding: "18px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: "700",
                    color: "var(--text-primary)",
                  }}
                >
                  {g.white_player || "White"} vs {g.black_player || "Black"}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    fontFamily: "var(--font-mono)",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: "rgba(99, 102, 241, 0.16)",
                    color: "#a5b4fc",
                  }}
                >
                  {g.result || "*"}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "10px",
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                }}
              >
                <span>ECO: {g.eco_code || "A00"}</span>
                <span>You: {g.user_color || "WHITE"}</span>
                {g.white_acpl !== null && g.white_acpl !== undefined && (
                  <span>W ACPL: {g.white_acpl}</span>
                )}
                {g.black_acpl !== null && g.black_acpl !== undefined && (
                  <span>B ACPL: {g.black_acpl}</span>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingTop: "8px",
                  borderTop: "1px solid var(--border-color)",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    fontSize: "11px",
                    color: g.analysis_completed
                      ? "var(--accent-emerald)"
                      : "var(--accent-amber)",
                  }}
                >
                  {g.analysis_completed ? (
                    <>
                      <CheckCircle2 size={13} /> Analyzed
                    </>
                  ) : (
                    <>
                      <Clock size={13} /> Queued / Pending
                    </>
                  )}
                </span>

                <button
                  type="button"
                  onClick={() => handleOpenGame(g.id)}
                  disabled={loadingGameId === g.id}
                  className="btn-primary"
                  style={{ padding: "5px 12px", fontSize: "12px" }}
                >
                  {loadingGameId === g.id ? "Opening..." : "Inspect"}{" "}
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

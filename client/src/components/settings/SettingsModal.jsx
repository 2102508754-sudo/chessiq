/**
 * ChessIQ — Studio Settings & Preferences Modal
 * Grandmaster Editorial preferences: Theme, Board Wood Finish, Audio, Engine Arrows, User Profile.
 */

import React from "react";
import {
  X,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Navigation,
  Palette,
  User,
  LogOut,
  ShieldCheck,
  Check,
} from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../hooks/useAuth";

export default function SettingsModal({
  isOpen,
  onClose,
  boardThemeKey = "grandmaster",
  onChangeBoardTheme,
  isSoundEnabled,
  onToggleSound,
  showEngineArrow,
  onToggleEngineArrow,
}) {
  const { theme, setTheme } = useTheme();
  const { isAuthenticated, user, logout } = useAuth();

  if (!isOpen) return null;

  const boardOptions = [
    {
      key: "grandmaster",
      name: "Grandmaster Wood",
      dark: "#9B8061",
      light: "#E9DFC9",
    },
    {
      key: "emerald",
      name: "Classic Emerald",
      dark: "#779556",
      light: "#eaebd0",
    },
    { key: "marine", name: "Ocean Marine", dark: "#4a75a0", light: "#cddbe8" },
    { key: "slate", name: "Slate Modern", dark: "#475569", light: "#cbd5e1" },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        className="editorial-card"
        style={{
          width: "100%",
          maxWidth: "480px",
          backgroundColor: "var(--surface-primary)",
          border: "1px solid var(--border)",
          borderRadius: "10px",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "19px",
                fontWeight: "600",
                color: "var(--text-primary)",
              }}
            >
              Studio Preferences
            </h2>
            <p
              style={{
                fontSize: "12px",
                color: "var(--text-secondary)",
                marginTop: "2px",
              }}
            >
              Configure your visual aesthetics, board finishes, and audio
              feedback.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost"
            style={{ padding: "6px" }}
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div
          style={{
            padding: "20px 22px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          {/* 1. Theme Selection */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "11px",
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--text-muted)",
                marginBottom: "8px",
              }}
            >
              Interface Theme
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
              }}
            >
              <button
                type="button"
                onClick={() => setTheme("light")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "12px 14px",
                  borderRadius: "8px",
                  backgroundColor:
                    theme === "light"
                      ? "var(--surface-secondary)"
                      : "var(--surface-primary)",
                  border:
                    theme === "light"
                      ? "2px solid var(--accent-gold)"
                      : "1px solid var(--border)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <Sun size={18} color="var(--accent-gold)" />
                <div>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "var(--text-primary)",
                    }}
                  >
                    Warm Parchment
                  </div>
                  <div
                    style={{ fontSize: "11px", color: "var(--text-secondary)" }}
                  >
                    Light Editorial
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTheme("dark")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "12px 14px",
                  borderRadius: "8px",
                  backgroundColor:
                    theme === "dark"
                      ? "var(--surface-secondary)"
                      : "var(--surface-primary)",
                  border:
                    theme === "dark"
                      ? "2px solid var(--accent-gold)"
                      : "1px solid var(--border)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <Moon size={18} color="var(--accent-gold)" />
                <div>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "var(--text-primary)",
                    }}
                  >
                    Vintage Obsidian
                  </div>
                  <div
                    style={{ fontSize: "11px", color: "var(--text-secondary)" }}
                  >
                    Dark Charcoal
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Board Wood Finish */}
          {onChangeBoardTheme && (
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--text-muted)",
                  marginBottom: "8px",
                }}
              >
                Board Finish & Squares
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                }}
              >
                {boardOptions.map((opt) => {
                  const isSelected = boardThemeKey === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => onChangeBoardTheme(opt.key)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        backgroundColor: isSelected
                          ? "var(--surface-secondary)"
                          : "var(--surface-primary)",
                        border: isSelected
                          ? "2px solid var(--accent-gold)"
                          : "1px solid var(--border)",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          width: "20px",
                          height: "20px",
                          borderRadius: "3px",
                          overflow: "hidden",
                          border: "1px solid var(--border)",
                          flexShrink: 0,
                        }}
                      >
                        <div style={{ backgroundColor: opt.light }} />
                        <div style={{ backgroundColor: opt.dark }} />
                        <div style={{ backgroundColor: opt.dark }} />
                        <div style={{ backgroundColor: opt.light }} />
                      </div>
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: isSelected ? "600" : "500",
                          color: "var(--text-primary)",
                        }}
                      >
                        {opt.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Toggles: Audio & Engine Arrows */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "11px",
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--text-muted)",
                marginBottom: "8px",
              }}
            >
              Interactive Feedback
            </label>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              {onToggleSound && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    backgroundColor: "var(--surface-secondary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    {isSoundEnabled ? (
                      <Volume2 size={16} color="var(--accent-gold)" />
                    ) : (
                      <VolumeX size={16} color="var(--text-muted)" />
                    )}
                    <div>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: "600",
                          color: "var(--text-primary)",
                        }}
                      >
                        Synthesized Chess Audio
                      </div>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "var(--text-secondary)",
                        }}
                      >
                        Zero-latency audio for moves, captures, checks, and
                        castles.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleSound}
                    className="btn-secondary"
                    style={{ padding: "4px 10px", fontSize: "12px" }}
                  >
                    {isSoundEnabled ? "Enabled" : "Muted"}
                  </button>
                </div>
              )}

              {onToggleEngineArrow && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    backgroundColor: "var(--surface-secondary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <Navigation size={16} color="var(--accent-sage)" />
                    <div>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: "600",
                          color: "var(--text-primary)",
                        }}
                      >
                        Engine Suggestion Arrows
                      </div>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "var(--text-secondary)",
                        }}
                      >
                        Highlight Stockfish NNUE's top move and blunder threats.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleEngineArrow}
                    className="btn-secondary"
                    style={{ padding: "4px 10px", fontSize: "12px" }}
                  >
                    {showEngineArrow ? "Visible" : "Hidden"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 4. User Profile & Account */}
          {isAuthenticated && user && (
            <div
              style={{
                paddingTop: "14px",
                borderTop: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "var(--text-primary)",
                  }}
                >
                  {user.username}
                </div>
                <div
                  style={{ fontSize: "11px", color: "var(--text-secondary)" }}
                >
                  {user.email || "Registered Master Account"} •{" "}
                  {user.chess_rating || 1500} Elo
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  logout();
                  onClose();
                }}
                className="btn-secondary"
                style={{
                  padding: "5px 12px",
                  fontSize: "12px",
                  color: "var(--accent-clay)",
                }}
              >
                <LogOut size={13} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "12px 22px",
            backgroundColor: "var(--surface-secondary)",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "11px",
              color: "var(--text-muted)",
            }}
          >
            <ShieldCheck size={13} color="var(--accent-sage)" />
            <span>Grandmaster Editorial • v3.3.0</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-primary"
            style={{ padding: "6px 16px", fontSize: "12px" }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

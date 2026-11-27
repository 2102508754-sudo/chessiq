/**
 * ChessIQ — Grandmaster Editorial Topbar
 * Studio header with view breadcrumbs, live Stockfish NNUE status,
 * and quick controls (PGN upload, board flip, sound toggle, theme switcher).
 */

import React from "react";
import {
  Menu,
  Upload,
  Volume2,
  VolumeX,
  ArrowLeftRight,
  Sun,
  Moon,
  Sliders,
  Cpu,
} from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

export default function Topbar({
  activeTab,
  onOpenMobileSidebar,
  onOpenUpload,
  boardOrientation,
  onFlipBoard,
  isSoundEnabled,
  onToggleSound,
  onOpenSettings,
  telemetry,
}) {
  const { theme, toggleTheme } = useTheme();

  const titles = {
    overview: {
      heading: "Overview",
      sub: "Player Performance Dossier & Longitudinal Trajectory",
    },
    analysis: {
      heading: "Game Review",
      sub: "Stockfish 16.1 NNUE Engine Analysis & Move Verification",
    },
    history: {
      heading: "My Games",
      sub: "Private Analyzed Game Archive & Reconstruction Telemetry",
    },
    insights: {
      heading: "Player Insights",
      sub: "Longitudinal 5-Axis Radar & Phase Deterioration Telemetry",
    },
    puzzles: {
      heading: "Tactical Training",
      sub: "Personalized Puzzles Sourced from Historical Game Weaknesses",
    },
    auth: {
      heading: "Authentication",
      sub: "Single-Domain Session Verification & First-Party Cookies",
    },
  };

  const current = titles[activeTab] || titles.analysis;

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 24px",
        backgroundColor: "var(--surface-primary)",
        borderBottom: "1px solid var(--border)",
        flexWrap: "wrap",
        gap: "12px",
        position: "sticky",
        top: 0,
        zIndex: 30,
      }}
    >
      {/* Left: Mobile Menu & Editorial Heading */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="btn-ghost mobile-menu-btn"
          style={{ padding: "6px" }}
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
        </button>

        <div>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "20px",
              fontWeight: "600",
              letterSpacing: "-0.01em",
              color: "var(--text-primary)",
              lineHeight: 1.2,
            }}
          >
            {current.heading}
          </h1>
          <p
            style={{
              fontSize: "11px",
              color: "var(--text-secondary)",
              display: "none",
              margin: 0,
            }}
            className="topbar-subtitle"
          >
            {current.sub}
          </p>
        </div>
      </div>

      {/* Right: Quick Action Strip */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        {/* Live Stockfish Engine Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "5px 10px",
            borderRadius: "6px",
            backgroundColor: "var(--surface-secondary)",
            border: "1px solid var(--border)",
            fontSize: "11px",
            color: "var(--text-secondary)",
          }}
          title={
            telemetry
              ? `Stockfish Status: ${telemetry.engine?.status || "Ready"} • DB Pool: ${telemetry.database?.status || "Connected"}`
              : "Stockfish 16.1 NNUE (64MB Hash)"
          }
        >
          <span
            style={{
              display: "inline-block",
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "var(--accent-sage)",
              boxShadow: "0 0 6px var(--accent-sage)",
            }}
          />
          <Cpu size={12} color="var(--accent-gold)" />
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: "600" }}>NNUE 16.1</span>
        </div>

        {/* PGN Upload Action */}
        <button
          type="button"
          onClick={onOpenUpload}
          className="btn-secondary"
          style={{ padding: "6px 12px", fontSize: "12px" }}
          title="Upload custom PGN for Stockfish analysis"
        >
          <Upload size={13} color="var(--accent-gold)" />
          <span>Upload PGN</span>
        </button>

        {/* Board Flip Quick Control (Only on Game Review / Puzzles) */}
        {(activeTab === "analysis" || activeTab === "puzzles") && onFlipBoard && (
          <button
            type="button"
            onClick={onFlipBoard}
            className="btn-ghost"
            style={{ padding: "6px 10px", fontSize: "12px" }}
            title={`Flip board to ${boardOrientation === "white" ? "Black" : "White"} (Shortcut: F)`}
          >
            <ArrowLeftRight size={13} />
            <span style={{ textTransform: "capitalize" }}>{boardOrientation}</span>
          </button>
        )}

        {/* Audio Synthesizer Toggle */}
        {onToggleSound && (
          <button
            type="button"
            onClick={onToggleSound}
            className="btn-ghost"
            style={{ padding: "6px 8px" }}
            title={isSoundEnabled ? "Sound enabled (Mute)" : "Sound muted (Enable)"}
          >
            {isSoundEnabled ? (
              <Volume2 size={15} color="var(--accent-gold)" />
            ) : (
              <VolumeX size={15} color="var(--text-muted)" />
            )}
          </button>
        )}

        {/* Theme Switcher Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="btn-ghost"
          style={{ padding: "6px 8px" }}
          title={`Switch to ${theme === "light" ? "Dark" : "Light"} theme`}
        >
          {theme === "light" ? <Moon size={15} /> : <Sun size={15} color="var(--accent-gold)" />}
        </button>

        {/* Studio Settings Trigger */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="btn-ghost"
          style={{ padding: "6px 8px" }}
          title="Studio Preferences"
        >
          <Sliders size={15} />
        </button>
      </div>
    </header>
  );
}

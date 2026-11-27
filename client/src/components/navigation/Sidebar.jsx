/**
 * ChessIQ — Grandmaster Editorial Sidebar Navigation
 * Desktop persistent sidebar & responsive mobile drawer navigation.
 * Preserves the official ChessIQ logo artwork and brand proportions.
 */

import React from "react";
import {
  Compass,
  Swords,
  History,
  BarChart3,
  Target,
  Settings,
  User,
  LogOut,
  LogIn,
  X,
  ShieldCheck,
  Moon,
  Sun,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../context/ThemeContext";

export default function Sidebar({
  activeTab,
  onSelectTab,
  isOpen = false,
  onCloseMobile,
  onOpenSettings,
}) {
  const { isAuthenticated, user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const navItems = [
    { key: "overview", label: "Overview", icon: Compass, badge: null },
    { key: "analysis", label: "Game Review", icon: Swords, badge: "Hero" },
    { key: "history", label: "My Games", icon: History, badge: null, protected: true },
    { key: "insights", label: "Player Insights", icon: BarChart3, badge: null, protected: true },
    { key: "puzzles", label: "Training", icon: Target, badge: "New", protected: true },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onCloseMobile}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.4)",
            backdropFilter: "blur(4px)",
            zIndex: 40,
          }}
        />
      )}

      {/* Sidebar Container */}
      <aside
        style={{
          width: "250px",
          backgroundColor: "var(--surface-primary)",
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          flexShrink: 0,
          zIndex: 50,
          transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          ...(isOpen
            ? {
                position: "fixed",
                top: 0,
                bottom: 0,
                left: 0,
                transform: "translateX(0)",
              }
            : {}),
        }}
        className={isOpen ? "sidebar-mobile-open" : "sidebar-desktop"}
      >
        {/* Top: Brand Masthead */}
        <div>
          <div
            style={{
              padding: "20px 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <img
                src="/logo.png"
                alt="ChessIQ Crest"
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "8px",
                  objectFit: "cover",
                  border: "1px solid var(--border)",
                  backgroundColor: "#000",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
                }}
              />
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: "19px",
                      fontWeight: "700",
                      letterSpacing: "-0.01em",
                      color: "var(--text-primary)",
                    }}
                  >
                    ChessIQ
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    fontWeight: "600",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--accent-gold)",
                  }}
                >
                  Grandmaster Editorial
                </div>
              </div>
            </div>

            {/* Mobile close button */}
            {isOpen && (
              <button
                type="button"
                onClick={onCloseMobile}
                className="btn-ghost"
                style={{ padding: "4px" }}
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Navigation Links */}
          <nav style={{ padding: "14px 10px", display: "flex", flexDirection: "column", gap: "3px" }}>
            <div
              style={{
                padding: "6px 10px 4px",
                fontSize: "10px",
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--text-muted)",
              }}
            >
              Studio Navigation
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    onSelectTab(item.key);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 12px",
                    borderRadius: "6px",
                    border: "none",
                    background: isActive ? "var(--surface-secondary)" : "transparent",
                    color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                    position: "relative",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = "var(--surface-hover)";
                      e.currentTarget.style.color = "var(--text-primary)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = "var(--text-secondary)";
                    }
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Icon
                      size={16}
                      color={isActive ? "var(--accent-gold)" : "var(--text-muted)"}
                    />
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: isActive ? "600" : "500",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {item.label}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    {item.badge && (
                      <span
                        style={{
                          fontSize: "9px",
                          fontFamily: "var(--font-mono)",
                          fontWeight: "700",
                          textTransform: "uppercase",
                          padding: "1px 5px",
                          borderRadius: "4px",
                          background: isActive
                            ? "var(--accent-gold-light)"
                            : "var(--surface-hover)",
                          color: "var(--accent-gold)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                    {isActive && (
                      <span
                        style={{
                          width: "4px",
                          height: "16px",
                          borderRadius: "2px",
                          backgroundColor: "var(--accent-gold)",
                          marginLeft: "4px",
                        }}
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Profile & System Controls */}
        <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "14px 12px" }}>
          {/* Quick Settings & Theme Row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "12px",
              padding: "0 4px",
            }}
          >
            <button
              type="button"
              onClick={onOpenSettings}
              className="btn-ghost"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 8px",
                fontSize: "12px",
                color: "var(--text-secondary)",
              }}
              title="Studio Settings & Board Styles"
            >
              <Settings size={14} />
              <span>Settings</span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className="btn-ghost"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 8px",
                fontSize: "12px",
                color: "var(--text-secondary)",
              }}
              title={`Switch to ${theme === "light" ? "Dark" : "Light"} theme`}
            >
              {theme === "light" ? <Moon size={14} /> : <Sun size={14} />}
              <span>{theme === "light" ? "Dark" : "Light"}</span>
            </button>
          </div>

          {/* User Account Pill */}
          {isAuthenticated && user ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 10px",
                borderRadius: "6px",
                background: "var(--surface-secondary)",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: "var(--accent-gold-light)",
                    border: "1px solid var(--accent-gold)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <User size={14} color="var(--accent-gold)" />
                </div>
                <div style={{ minWidth: 0, overflow: "hidden" }}>
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "var(--text-primary)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {user.username}
                  </div>
                  {user.chess_rating && (
                    <div
                      style={{
                        fontSize: "10px",
                        fontFamily: "var(--font-mono)",
                        color: "var(--accent-gold)",
                      }}
                    >
                      {user.chess_rating} Elo
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={logout}
                title="Sign Out"
                className="btn-ghost"
                style={{ padding: "4px", color: "var(--accent-clay)" }}
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onSelectTab("auth")}
              className="btn-secondary"
              style={{ width: "100%", justifyContent: "center", padding: "7px 12px" }}
            >
              <LogIn size={14} color="var(--accent-gold)" />
              <span>Sign In / Register</span>
            </button>
          )}

          {/* Single-domain verification pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              fontSize: "10px",
              color: "var(--text-muted)",
              marginTop: "10px",
            }}
          >
            <ShieldCheck size={11} color="var(--accent-sage)" />
            <span>Single-Domain • 6NF Relational</span>
          </div>
        </div>
      </aside>
    </>
  );
}

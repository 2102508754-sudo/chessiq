/**
 * ChessIQ v3.3.0 — Authentication Loading Skeleton
 * Day 16 (@FE): Accessible loading indicator rendered while probing first-party session cookies.
 */

import React from "react";
import { Shield, Loader2 } from "lucide-react";

export default function AuthLoading({
  title = "Verifying Session Security...",
  message = "Checking active first-party session cookie with ChessIQ API.",
}) {
  return (
    <div
      className="glass-panel"
      role="status"
      aria-busy="true"
      style={{
        padding: "48px 24px",
        textAlign: "center",
        maxWidth: "540px",
        margin: "24px auto",
      }}
    >
      <div style={{ display: "inline-flex", position: "relative", marginBottom: "14px" }}>
        <Shield size={32} color="var(--accent-cyan)" />
        <Loader2
          size={16}
          color="var(--accent-cyan)"
          style={{
            position: "absolute",
            bottom: "-4px",
            right: "-4px",
          }}
        />
      </div>
      <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "6px" }}>
        {title}
      </h3>
      <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
        {message}
      </p>
    </div>
  );
}

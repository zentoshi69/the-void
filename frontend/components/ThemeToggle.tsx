"use client";

import type { Theme } from "@/lib/theme";

interface ThemeToggleProps {
  mode: "dark" | "light";
  onToggle: () => void;
  theme: Theme;
}

export function ThemeToggle({ mode, onToggle, theme }: ThemeToggleProps) {
  return (
    <button
      onClick={onToggle}
      style={{
        background: "transparent",
        border: `1px solid ${theme.border}`,
        color: theme.textMid,
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: 14,
        cursor: "pointer",
        padding: "4px 10px",
        borderRadius: 2,
        transition: "color 0.2s, border-color 0.2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = theme.accent;
        e.currentTarget.style.borderColor = theme.accent;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = theme.textMid;
        e.currentTarget.style.borderColor = theme.border;
      }}
      title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {mode === "dark" ? "☀" : "☾"}
    </button>
  );
}

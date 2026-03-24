"use client";

import { useTheme } from "@/hooks/useTheme";
import { useVoidEngine } from "@/hooks/useVoidEngine";
import { TradePanel } from "./TradePanel";
import { ClearingSheet } from "./ClearingSheet";
import { SettlementFeed } from "./SettlementFeed";
import { ThemeToggle } from "./ThemeToggle";

function formatStatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

export function VoidApp() {
  const { theme, mode, toggle } = useTheme();
  const { sheet, batches, stats, timer, phase, connected } = useVoidEngine();

  const mono: React.CSSProperties = {
    fontFamily: "'Courier New', Courier, monospace",
  };

  const statItems = [
    { label: "TRADES ERASED", value: formatStatNumber(stats.totalErased) },
    { label: "LAST COMPRESSION", value: `${stats.avgCompression.toFixed(0)}%` },
    { label: "BATCHES CLEARED", value: formatStatNumber(stats.batchCount) },
    { label: "VOL CLEARED", value: `$${formatStatNumber(stats.totalVolumeUsd)}` },
  ];

  return (
    <div
      style={{
        ...mono,
        minHeight: "100vh",
        background: theme.bg,
        color: theme.text,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 24px",
          borderBottom: `1px solid ${theme.border}`,
          background: theme.bgPanel,
        }}
      >
        <div className="flex items-center gap-4">
          <span
            style={{
              ...mono,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "0.35em",
              color: theme.accent,
            }}
          >
            V O I D
          </span>
          <span
            style={{
              ...mono,
              fontSize: 9,
              letterSpacing: "0.12em",
              color: theme.textDim,
              textTransform: "uppercase" as const,
            }}
          >
            PRIVATE CLEARING PROTOCOL
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span
              style={{
                ...mono,
                fontSize: 11,
                color: theme.textMid,
                letterSpacing: "0.05em",
              }}
            >
              {String(timer).padStart(2, "0")}s
            </span>
            <span
              style={{
                ...mono,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: phase === "COLLECTING" ? theme.accent : theme.orange,
              }}
            >
              {phase}
            </span>
          </div>

          {/* Pulse dot */}
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: connected ? theme.accent : theme.red,
              display: "inline-block",
              boxShadow: connected
                ? `0 0 6px ${theme.accent}`
                : `0 0 6px ${theme.red}`,
              animation: connected ? undefined : undefined,
            }}
          />

          <ThemeToggle mode={mode} onToggle={toggle} theme={theme} />
        </div>
      </header>

      {/* Stats strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          borderBottom: `1px solid ${theme.border}`,
          background: theme.bgPanel,
        }}
      >
        {statItems.map((item, i) => (
          <div
            key={item.label}
            style={{
              padding: "10px 24px",
              borderRight: i < 3 ? `1px solid ${theme.border}` : "none",
            }}
          >
            <div
              style={{
                ...mono,
                fontSize: 9,
                letterSpacing: "0.1em",
                color: theme.textDim,
                marginBottom: 2,
              }}
            >
              {item.label}
            </div>
            <div
              style={{
                ...mono,
                fontSize: 16,
                fontWeight: 700,
                color: theme.statVal,
              }}
            >
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div
        className="flex"
        style={{
          flex: 1,
          padding: 16,
          gap: 16,
          overflow: "hidden",
        }}
      >
        {/* Left: Trade Panel */}
        <TradePanel theme={theme} />

        {/* Right: Clearing Sheet + Settlement Feed */}
        <div
          className="flex flex-col"
          style={{ flex: 1, gap: 16, overflow: "auto" }}
        >
          <ClearingSheet
            theme={theme}
            sheet={sheet}
            phase={phase}
            timer={timer}
            mode={mode}
          />
          <SettlementFeed theme={theme} batches={batches} />
        </div>
      </div>
    </div>
  );
}

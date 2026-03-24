"use client";

import type { Theme } from "@/lib/theme";
import type { LiveSheetEntry } from "@/hooks/useVoidEngine";
import { SUPPORTED_CHAINS, BATCH_WINDOW_SECONDS } from "@/lib/constants";
import { getCurrentBatchWindow } from "@/lib/commitment";

interface ClearingSheetProps {
  theme: Theme;
  sheet: LiveSheetEntry[];
  phase: string;
  timer: number;
  mode: "dark" | "light";
}

const STATUS_COLORS_DARK: Record<string, string> = {
  SEALED: "#3A3A4A",
  MATCHING: "#FFD740",
  NETTED: "#FF9100",
  PROVING: "#40C4FF",
  ERASED: "#FF4444",
};

const STATUS_COLORS_LIGHT: Record<string, string> = {
  SEALED: "#9A9DA8",
  MATCHING: "#886600",
  NETTED: "#C04800",
  PROVING: "#005E8A",
  ERASED: "#BB2020",
};

function getChainShort(chainId: number): string {
  const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId);
  return chain?.short ?? String(chainId);
}

function truncateHash(hash: string): string {
  if (hash.length <= 12) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-4)}`;
}

function getPairLabel(entry: LiveSheetEntry): string {
  const source = getChainShort(entry.sourceChain);
  const target = getChainShort(entry.targetChainId);
  if (source === "ETH" && target === "AVAX") return "ETH/USDC";
  if (source === "AVAX" && target === "ETH") return "AVAX/USDC";
  return `${source}/USDC`;
}

function getPhaseColor(phase: string, theme: Theme): string {
  switch (phase) {
    case "COLLECTING": return theme.accent;
    case "MATCHING": return theme.yellow;
    case "NETTING": return theme.orange;
    case "PROVING": return theme.blue;
    case "ERASING": return theme.red;
    default: return theme.textDim;
  }
}

export function ClearingSheet({ theme, sheet, phase, timer, mode }: ClearingSheetProps) {
  const statusColors = mode === "dark" ? STATUS_COLORS_DARK : STATUS_COLORS_LIGHT;
  const batchWindow = getCurrentBatchWindow();
  const meterPct = phase === "COLLECTING"
    ? ((BATCH_WINDOW_SECONDS - timer) / BATCH_WINDOW_SECONDS) * 100
    : 100;

  const labelStyle: React.CSSProperties = {
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: 10,
    letterSpacing: "0.08em",
    color: theme.textDim,
    textTransform: "uppercase" as const,
  };

  const cellStyle: React.CSSProperties = {
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: 11,
    padding: "6px 8px",
    borderBottom: `1px solid ${theme.border}`,
  };

  return (
    <div
      style={{
        background: theme.bgPanel,
        border: `1px solid ${theme.border}`,
        borderRadius: 2,
        padding: 16,
        fontFamily: "'Courier New', Courier, monospace",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <div className="flex items-center gap-3">
          <span style={{ ...labelStyle, fontSize: 11, color: theme.textMid }}>
            CLEARING SHEET
          </span>
          <span style={{ ...labelStyle, fontSize: 10, color: theme.textDim }}>
            BATCH #{batchWindow}
          </span>
        </div>
        <span
          style={{
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: 10,
            fontWeight: 700,
            color: getPhaseColor(phase, theme),
            letterSpacing: "0.1em",
          }}
        >
          {phase}
        </span>
      </div>

      {/* Compression meter */}
      <div
        style={{
          width: "100%",
          height: 3,
          background: theme.bgAccent,
          borderRadius: 1,
          marginBottom: 14,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${meterPct}%`,
            height: "100%",
            background: getPhaseColor(phase, theme),
            borderRadius: 1,
            transition: "width 1s linear",
            opacity: 0.7,
          }}
        />
      </div>

      {/* Table */}
      {sheet.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "32px 0",
            color: theme.textDim,
            fontSize: 11,
            fontFamily: "'Courier New', Courier, monospace",
          }}
        >
          Waiting for intents…
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["INTENT HASH", "PAIR", "CHAIN ROUTE", "STATUS"].map((header) => (
                <th
                  key={header}
                  style={{
                    ...cellStyle,
                    ...labelStyle,
                    textAlign: "left",
                    padding: "4px 8px 8px",
                    borderBottom: `1px solid ${theme.borderMid}`,
                  }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.map((entry) => {
              const isErased = entry.status === "ERASED";
              const statusColor = statusColors[entry.status] ?? theme.textDim;

              return (
                <tr
                  key={entry.id}
                  style={{
                    opacity: isErased ? 0.2 : 1,
                    transition: "opacity 0.6s ease",
                    background: theme.bgRow,
                  }}
                >
                  <td style={{ ...cellStyle, color: theme.text }}>
                    {isErased ? "████████" : truncateHash(entry.id)}
                  </td>
                  <td style={{ ...cellStyle, color: theme.text }}>
                    {isErased ? "████████" : getPairLabel(entry)}
                  </td>
                  <td style={{ ...cellStyle, color: theme.textMid }}>
                    {getChainShort(entry.sourceChain)} → {getChainShort(entry.targetChainId)}
                  </td>
                  <td style={{ ...cellStyle }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 2,
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        color: isErased ? theme.bg : theme.bg,
                        background: statusColor,
                        fontFamily: "'Courier New', Courier, monospace",
                      }}
                    >
                      {entry.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

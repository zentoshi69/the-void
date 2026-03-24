"use client";

import type { Theme } from "@/lib/theme";
import type { BatchResult } from "@/hooks/useVoidEngine";

interface SettlementFeedProps {
  theme: Theme;
  batches: BatchResult[];
}

function truncateHash(hash: string): string {
  if (hash.length <= 12) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-4)}`;
}

function formatUsd(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${amount.toFixed(2)}`;
}

export function SettlementFeed({ theme, batches }: SettlementFeedProps) {
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <span style={{ ...labelStyle, fontSize: 11, color: theme.textMid }}>
          SETTLEMENT FEED
        </span>
        <span style={{ ...labelStyle, fontSize: 10, color: theme.textDim }}>
          {batches.length} BATCHES
        </span>
      </div>

      {batches.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "24px 0",
            color: theme.textDim,
            fontSize: 11,
            fontFamily: "'Courier New', Courier, monospace",
          }}
        >
          No batches settled yet
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["BATCH", "COMPRESSION", "VOLUME", "PROOF"].map((header) => (
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
            {batches.map((batch, i) => (
              <tr
                key={batch.batchId}
                style={{
                  opacity: i === 0 ? 1 : 0.5,
                  transition: "opacity 0.3s",
                }}
              >
                <td style={{ ...cellStyle, color: theme.text }}>
                  {truncateHash(batch.batchId)}
                </td>
                <td style={{ ...cellStyle, color: theme.accent }}>
                  {batch.inputCount} → {batch.netCount} txs | {batch.compressionPct}%
                </td>
                <td style={{ ...cellStyle, color: theme.text }}>
                  {formatUsd(batch.timestamp)}
                </td>
                <td style={{ ...cellStyle, color: theme.textMid }}>
                  {truncateHash(batch.proofHash)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

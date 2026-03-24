"use client";

import { useState, useCallback } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import type { Theme } from "@/lib/theme";
import { SUPPORTED_CHAINS, SUPPORTED_TOKENS } from "@/lib/constants";
import { useSealIntent } from "@/hooks/useSealIntent";

interface TradePanelProps {
  theme: Theme;
}

const META_ROWS = [
  { key: "ON-CHAIN TRACE", val: "NONE" },
  { key: "SETTLEMENT TYPE", val: "PRIVATE NET" },
  { key: "FRONT-RUN SURFACE", val: "ZERO" },
  { key: "TRADE VISIBILITY", val: "SEALED" },
  { key: "NET COMPRESSION", val: "ACTIVE" },
];

export function TradePanel({ theme }: TradePanelProps) {
  const { address, isConnected } = useAccount();
  const { sealIntent, isPending } = useSealIntent();

  const [sourceIdx, setSourceIdx] = useState(0);
  const [targetIdx, setTargetIdx] = useState(1);
  const [amount, setAmount] = useState("");
  const [tokenIdx, setTokenIdx] = useState(0);

  const sourceChain = SUPPORTED_CHAINS[sourceIdx];
  const targetChain = SUPPORTED_CHAINS[targetIdx];
  const chainId = sourceChain.id as keyof typeof SUPPORTED_TOKENS;
  const tokens = SUPPORTED_TOKENS[chainId];
  const selectedToken = tokens[tokenIdx];

  const handleFlip = useCallback(() => {
    setSourceIdx(targetIdx);
    setTargetIdx(sourceIdx);
    setTokenIdx(0);
  }, [sourceIdx, targetIdx]);

  const handleSeal = useCallback(async () => {
    if (!address || !amount || isPending) return;
    try {
      await sealIntent({
        sourceChainId: sourceChain.id,
        targetChainId: targetChain.id,
        tokenSymbol: selectedToken.symbol,
        amount,
        recipientAddress: address,
      });
      setAmount("");
    } catch (err) {
      console.error("Seal failed:", err);
    }
  }, [address, amount, isPending, sealIntent, sourceChain.id, targetChain.id, selectedToken.symbol]);

  const mono: React.CSSProperties = {
    fontFamily: "'Courier New', Courier, monospace",
  };

  const cardStyle: React.CSSProperties = {
    ...mono,
    background: theme.bgInput,
    border: `1px solid ${theme.border}`,
    borderRadius: 2,
    padding: 12,
    marginBottom: 8,
  };

  const selectStyle: React.CSSProperties = {
    ...mono,
    background: theme.bgInput,
    border: `1px solid ${theme.border}`,
    borderRadius: 2,
    color: theme.text,
    fontSize: 12,
    padding: "6px 8px",
    cursor: "pointer",
    appearance: "none" as const,
    WebkitAppearance: "none" as const,
  };

  const labelStyle: React.CSSProperties = {
    ...mono,
    fontSize: 9,
    letterSpacing: "0.1em",
    color: theme.textDim,
    textTransform: "uppercase" as const,
    marginBottom: 6,
  };

  return (
    <div
      style={{
        ...mono,
        width: 320,
        minWidth: 320,
        background: theme.bgPanel,
        border: `1px solid ${theme.border}`,
        borderRadius: 2,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      {/* Bridge route */}
      <div style={labelStyle}>BRIDGE ROUTE</div>
      <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
        <div className="flex items-center gap-1" style={{ flex: 1 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: sourceChain.color,
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          <select
            value={sourceIdx}
            onChange={(e) => {
              const idx = Number(e.target.value);
              setSourceIdx(idx);
              if (idx === targetIdx) setTargetIdx(sourceIdx);
              setTokenIdx(0);
            }}
            style={{ ...selectStyle, flex: 1 }}
          >
            {SUPPORTED_CHAINS.map((c, i) => (
              <option key={c.id} value={i}>{c.name}</option>
            ))}
          </select>
        </div>

        <span style={{ color: theme.textDim, fontSize: 14, ...mono }}>→</span>

        <div className="flex items-center gap-1" style={{ flex: 1 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: targetChain.color,
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          <select
            value={targetIdx}
            onChange={(e) => {
              const idx = Number(e.target.value);
              setTargetIdx(idx);
              if (idx === sourceIdx) setSourceIdx(targetIdx);
            }}
            style={{ ...selectStyle, flex: 1 }}
          >
            {SUPPORTED_CHAINS.map((c, i) => (
              <option key={c.id} value={i}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* YOU SEND */}
      <div style={cardStyle}>
        <div style={labelStyle}>YOU SEND</div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => {
              const v = e.target.value;
              if (/^[0-9]*\.?[0-9]*$/.test(v)) setAmount(v);
            }}
            style={{
              ...mono,
              flex: 1,
              background: "transparent",
              border: "none",
              color: theme.text,
              fontSize: 22,
              fontWeight: 700,
            }}
          />
          <select
            value={tokenIdx}
            onChange={(e) => setTokenIdx(Number(e.target.value))}
            style={{
              ...selectStyle,
              fontSize: 13,
              fontWeight: 700,
              padding: "4px 8px",
            }}
          >
            {tokens.map((t, i) => (
              <option key={t.symbol} value={i}>{t.symbol}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Flip */}
      <div style={{ textAlign: "center" }}>
        <button
          onClick={handleFlip}
          style={{
            ...mono,
            background: "transparent",
            border: `1px solid ${theme.border}`,
            color: theme.textMid,
            fontSize: 16,
            cursor: "pointer",
            padding: "2px 12px",
            borderRadius: 2,
          }}
        >
          ⇅
        </button>
      </div>

      {/* YOU RECEIVE */}
      <div style={cardStyle}>
        <div style={labelStyle}>YOU RECEIVE</div>
        <div
          style={{
            ...mono,
            fontSize: 22,
            fontWeight: 700,
            color: theme.textDim,
            letterSpacing: "0.15em",
          }}
        >
          ─ ─ ─
        </div>
        <div
          style={{
            ...mono,
            fontSize: 9,
            color: theme.textDim,
            marginTop: 6,
          }}
        >
          Amount hidden until batch settles
        </div>
      </div>

      {/* Metadata */}
      <div style={{ ...cardStyle, padding: 10 }}>
        {META_ROWS.map((row) => (
          <div
            key={row.key}
            className="flex justify-between"
            style={{
              padding: "3px 0",
              borderBottom: `1px solid ${theme.border}`,
            }}
          >
            <span style={{ ...mono, fontSize: 9, color: theme.textDim }}>
              {row.key}
            </span>
            <span style={{ ...mono, fontSize: 9, color: theme.accent, fontWeight: 700 }}>
              {row.val}
            </span>
          </div>
        ))}
      </div>

      {/* Wallet / Seal */}
      {!isConnected ? (
        <div style={{ marginTop: 4 }}>
          <ConnectButton.Custom>
            {({ openConnectModal, mounted }) => {
              if (!mounted) return null;
              return (
                <button
                  onClick={openConnectModal}
                  style={{
                    ...mono,
                    width: "100%",
                    padding: "12px 0",
                    background: theme.bgAccent,
                    border: `1px solid ${theme.border}`,
                    borderRadius: 2,
                    color: theme.textMid,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    cursor: "pointer",
                  }}
                >
                  CONNECT WALLET
                </button>
              );
            }}
          </ConnectButton.Custom>
        </div>
      ) : (
        <button
          onClick={handleSeal}
          disabled={isPending || !amount}
          style={{
            ...mono,
            width: "100%",
            padding: "14px 0",
            marginTop: 4,
            background: isPending || !amount ? theme.bgAccent : theme.accent,
            border: "none",
            borderRadius: 2,
            color: isPending || !amount ? theme.textDim : theme.accentText,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.1em",
            cursor: isPending || !amount ? "not-allowed" : "pointer",
            transition: "background 0.2s, color 0.2s",
          }}
        >
          {isPending ? "SEALING…" : "SEAL INTENT →"}
        </button>
      )}

      {/* Footer */}
      <div
        style={{
          ...mono,
          fontSize: 9,
          color: theme.textDim,
          textAlign: "center",
          marginTop: 8,
          lineHeight: "1.5",
        }}
      >
        Intent sealed on-chain. Amount hidden in commitment hash.
      </div>
    </div>
  );
}

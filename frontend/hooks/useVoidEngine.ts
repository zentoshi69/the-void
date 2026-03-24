"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { BATCH_WINDOW_SECONDS } from "@/lib/constants";

export interface LiveSheetEntry {
  id: string;
  status: string;
  sourceChain: number;
  targetChainId: number;
}

export interface BatchResult {
  batchId: string;
  proofHash: string;
  inputCount: number;
  netCount: number;
  compressionPct: number;
  timestamp: number;
}

export interface PublicStats {
  totalErased: number;
  avgCompression: number;
  batchCount: number;
  totalVolumeUsd: number;
}

type Phase = "COLLECTING" | "MATCHING" | "NETTING" | "PROVING" | "ERASING";

interface InitPayload {
  sheet: LiveSheetEntry[];
  batches: BatchResult[];
  stats: PublicStats;
  window: { phase: Phase; secondsLeft: number };
}

interface SheetEvent {
  type: "INTENT_SEALED" | "STATUS_UPDATE";
  entry?: LiveSheetEntry;
  updates?: Array<{ id: string; status: string }>;
}

interface BatchEvent {
  type: "BATCH_SETTLED";
  batch: BatchResult;
  stats: PublicStats;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

export function useVoidEngine() {
  const [sheet, setSheet] = useState<LiveSheetEntry[]>([]);
  const [batches, setBatches] = useState<BatchResult[]>([]);
  const [stats, setStats] = useState<PublicStats>({
    totalErased: 0,
    avgCompression: 0,
    batchCount: 0,
    totalVolumeUsd: 0,
  });
  const [timer, setTimer] = useState<number>(BATCH_WINDOW_SECONDS);
  const [phase, setPhase] = useState<string>("COLLECTING");
  const [connected, setConnected] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback((secondsLeft: number) => {
    setTimer(secondsLeft);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    const socket = io(`${BACKEND_URL}/live`, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("init", (data: InitPayload) => {
      setSheet(data.sheet);
      setBatches(data.batches);
      setStats(data.stats);
      setPhase(data.window.phase);
      startTimer(data.window.secondsLeft);
    });

    socket.on("sheet", (event: SheetEvent & { phase?: string }) => {
      if (event.type === "INTENT_SEALED" && event.entry) {
        setSheet((prev) => [...prev, event.entry!]);
      } else if (event.type === "STATUS_UPDATE") {
        if (event.phase) setPhase(event.phase);
        if (event.updates) {
          setSheet((prev) =>
            prev.map((entry) => {
              const update = event.updates!.find((u) => u.id === entry.id);
              return update ? { ...entry, status: update.status } : entry;
            })
          );
        }
      }
    });

    socket.on("batch", (event: BatchEvent) => {
      if (event.type === "BATCH_SETTLED") {
        setBatches((prev) => [event.batch, ...prev].slice(0, 50));
        setStats(event.stats);
        setTimeout(() => {
          setSheet([]);
          setPhase("COLLECTING");
          startTimer(BATCH_WINDOW_SECONDS);
        }, 2000);
      }
    });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      socket.disconnect();
    };
  }, [startTimer]);

  return { sheet, batches, stats, timer, phase, connected };
}

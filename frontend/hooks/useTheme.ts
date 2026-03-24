"use client";

import { useState, useEffect, useCallback } from "react";
import { DARK, LIGHT, type Theme } from "@/lib/theme";

type ThemeMode = "dark" | "light";

const STORAGE_KEY = "void-theme-mode";

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (stored === "dark" || stored === "light") {
      setMode(stored);
    }
  }, []);

  const toggle = useCallback(() => {
    setMode((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const theme: Theme = mode === "dark" ? DARK : LIGHT;

  return { theme, mode, toggle };
}

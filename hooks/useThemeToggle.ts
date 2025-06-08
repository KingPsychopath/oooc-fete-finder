"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark" | "system";

interface UseThemeToggleReturn {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  isSystemDark: boolean;
  currentThemeIcon: string;
  currentThemeLabel: string;
  nextThemeLabel: string;
}

export const useThemeToggle = (): UseThemeToggleReturn => {
  const { theme, setTheme } = useTheme();
  const [isSystemDark, setIsSystemDark] = useState(false);

  // Check system theme preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setIsSystemDark(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsSystemDark(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const getNextTheme = (currentTheme: ThemeMode): ThemeMode => {
    switch (currentTheme) {
      case "system":
        return isSystemDark ? "light" : "dark";
      case "dark":
        return "light";
      case "light":
        return "dark";
      default:
        return "system";
    }
  };

  const toggleTheme = () => {
    const nextTheme = getNextTheme(theme as ThemeMode);
    setTheme(nextTheme);
  };

  const getThemeIcon = (theme: ThemeMode): string => {
    switch (theme) {
      case "system":
        return "🌓";
      case "dark":
        return "🌙";
      case "light":
        return "☀️";
      default:
        return "🌓";
    }
  };

  const getThemeLabel = (theme: ThemeMode): string => {
    switch (theme) {
      case "system":
        return "System";
      case "dark":
        return "Dark";
      case "light":
        return "Light";
      default:
        return "System";
    }
  };

  const nextTheme = getNextTheme(theme as ThemeMode);

  return {
    theme: theme as ThemeMode,
    setTheme: setTheme as (theme: ThemeMode) => void,
    toggleTheme,
    isSystemDark,
    currentThemeIcon: getThemeIcon(theme as ThemeMode),
    currentThemeLabel: getThemeLabel(theme as ThemeMode),
    nextThemeLabel: getThemeLabel(nextTheme),
  };
}; 
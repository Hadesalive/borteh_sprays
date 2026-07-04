"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { MoonStars, Sun } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  // Until mounted, theme is unknown on the server — keep label/icon stable to
  // avoid a hydration mismatch, then settle once the client knows the theme.
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={
        !mounted ? "Toggle theme" : isDark ? "Switch to light mode" : "Switch to dark mode"
      }
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {mounted && isDark ? <Sun /> : <MoonStars />}
    </Button>
  );
}

"use client";

import { IconContext } from "@phosphor-icons/react";

/**
 * Default every Phosphor icon to the duotone weight. Wraps the app so icons in
 * both client and server components inherit it without per-icon props.
 */
export function IconProvider({ children }: { children: React.ReactNode }) {
  return (
    <IconContext.Provider value={{ weight: "duotone" }}>
      {children}
    </IconContext.Provider>
  );
}

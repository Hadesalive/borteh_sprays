"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import Link, { type LinkProps } from "next/link";

type UnsavedChangesContextValue = {
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
};

const UnsavedChangesContext = createContext<UnsavedChangesContextValue>({
  isDirty: false,
  setIsDirty: () => {},
});

/** Reads the current page's "has unsaved changes?" flag. Safe to call
 * outside a UnsavedChangesProvider — falls back to a permanent `false`. */
export function useUnsavedChanges() {
  return useContext(UnsavedChangesContext);
}

/** Wrap a page's content in this once; a form inside calls
 * `useUnsavedChanges().setIsDirty(...)`, and any BlockableLink in the same
 * subtree (e.g. a "back to list" link) will confirm before leaving. */
export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [isDirty, setIsDirty] = useState(false);
  return (
    <UnsavedChangesContext.Provider value={{ isDirty, setIsDirty }}>
      {children}
    </UnsavedChangesContext.Provider>
  );
}

/** A next/link that confirms before leaving if the nearest
 * UnsavedChangesProvider reports unsaved changes. Only covers same-origin
 * client-side navigations (Link's `onNavigate` contract) — browser
 * back/refresh/tab-close are handled separately via `beforeunload`. */
export function BlockableLink(props: LinkProps & { children: ReactNode; className?: string }) {
  const { isDirty } = useUnsavedChanges();
  return (
    <Link
      {...props}
      onNavigate={(e) => {
        if (isDirty && !window.confirm("You have unsaved changes. Leave anyway?")) {
          e.preventDefault();
        }
      }}
    />
  );
}

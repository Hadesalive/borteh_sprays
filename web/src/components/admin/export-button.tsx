"use client";

import { DownloadSimple } from "@phosphor-icons/react";

// Client-side CSV export — no backend route needed. Escapes quotes/commas per RFC 4180.
function toCsv(headers: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}

export function ExportButton({
  filename,
  headers,
  rows,
  label = "Export",
}: {
  filename: string;
  headers: string[];
  rows: (string | number)[][];
  label?: string;
}) {
  function download() {
    const csv = toCsv(headers, rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={rows.length === 0}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-medium shadow-[0_1px_0_rgba(26,26,26,0.07)] transition-colors hover:bg-muted disabled:opacity-50"
    >
      <DownloadSimple weight="duotone" className="size-4" />
      {label}
    </button>
  );
}

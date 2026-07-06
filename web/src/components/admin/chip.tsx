import { cn } from "@/lib/utils";

// Borteh Admin v5 status vocabulary — squared soft chips (radius 4px), no dot.
export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const CHIP: Record<Tone, string> = {
  success: "bg-success-soft text-success-soft-foreground",
  warning: "bg-warning-soft text-warning-soft-foreground",
  danger: "bg-destructive-soft text-destructive-soft-foreground",
  info: "bg-info-soft text-info-soft-foreground",
  neutral: "bg-accent text-muted-foreground",
};

export const STATUS_TONE: Record<string, Tone> = {
  pending: "warning",
  cod_pending: "warning",
  confirmed: "info",
  preparing: "info",
  packing: "info",
  ready: "info",
  dispatched: "info",
  out_for_delivery: "info",
  delivered: "success",
  completed: "success",
  cancelled: "danger",
  returned: "danger",
};

export function statusTone(s: string): Tone {
  return STATUS_TONE[s] ?? "neutral";
}

export function humanize(s: string): string {
  return s.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export function Chip({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-1.5 py-px text-xs font-medium whitespace-nowrap",
        CHIP[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

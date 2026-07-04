import { cn } from "@/lib/utils";

export type PillTone = "success" | "warning" | "danger" | "info" | "neutral";

const tones: Record<PillTone, string> = {
  success: "bg-success-soft text-success-soft-foreground",
  warning: "bg-warning-soft text-warning-soft-foreground",
  danger: "bg-destructive-soft text-destructive-soft-foreground",
  info: "bg-info-soft text-info-soft-foreground",
  neutral: "bg-muted text-muted-foreground",
};

export function StatusPill({
  tone = "neutral",
  dot = false,
  className,
  children,
}: {
  tone?: PillTone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        tones[tone],
        className
      )}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current opacity-70" /> : null}
      {children}
    </span>
  );
}

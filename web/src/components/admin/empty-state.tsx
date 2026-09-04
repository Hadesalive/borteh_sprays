/**
 * The one "nothing here yet" pattern in the app — replaces ad hoc per-page
 * text (bare table rows, one-off sentences). Voice: short, plain, names the
 * obvious first action when there is one. Existing copy that already gets
 * this right ("No combos yet. Pair two fragrances to create your first.")
 * is the model to match when writing new instances.
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
      <p className="text-[13px] font-medium text-foreground">{title}</p>
      {description ? (
        <p className="max-w-sm text-[13px] text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

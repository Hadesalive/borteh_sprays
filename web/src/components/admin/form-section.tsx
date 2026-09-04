/**
 * One named, visually distinct group of fields — the building block every
 * form is assembled from instead of a flat input stack (separation of
 * concerns per docs/superpowers/specs/2026-09-02-admin-redesign-design.md,
 * "Forms UX"). Mirrors the mobile checkout screen's DELIVERY / PAYMENT
 * METHOD grouping convention — one house pattern across both apps.
 */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border pt-6 first:border-t-0 first:pt-0">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

import { cloneElement, isValidElement, useId } from "react";

/**
 * Wraps one input with an always-visible label, optional helper text, and
 * an inline error slot. Labels are never placeholder-only — see "Forms UX"
 * in docs/superpowers/specs/2026-09-02-admin-redesign-design.md for why.
 * Marks optional fields "Optional" rather than marking required fields, since
 * most fields in these forms are required.
 */
export function FormField({
  label,
  htmlFor,
  optional,
  helper,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  optional?: boolean;
  helper?: string;
  error?: string;
  children: React.ReactElement<{ "aria-describedby"?: string }>;
}) {
  const messageId = useId();
  const message = error ?? helper;

  const field = isValidElement(children)
    ? cloneElement(children, message ? { "aria-describedby": messageId } : {})
    : children;

  return (
    <div className="flex flex-col gap-1.5 sm:col-span-1">
      <label htmlFor={htmlFor} className="flex items-baseline justify-between text-xs font-medium text-foreground">
        <span>{label}</span>
        {optional ? <span className="font-normal text-muted-foreground">Optional</span> : null}
      </label>
      {field}
      {message ? (
        <p id={messageId} className={error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
          {message}
        </p>
      ) : null}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { ArrowCounterClockwise, Check } from "@phosphor-icons/react";

import { saveContent } from "@/app/(dashboard)/content/copy/actions";
import { contentGroups, type ContentField } from "@/lib/content-registry";

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none";

/** DB overrides keyed by content key (value_text). Missing key → app uses the bundled fallback. */
export type CopyValues = Record<string, string | null>;

function FieldRow({ field, initial }: { field: ContentField; initial: string | null }) {
  // The editor shows the current override; the fallback is the placeholder + reset target.
  const [value, setValue] = useState(initial ?? "");
  const [saved, setSaved] = useState<string | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const usingFallback = saved == null || saved === "";
  const dirty = value !== (saved ?? "");

  function commit(next: string) {
    setError(null);
    start(async () => {
      const res = await saveContent(field.key, next);
      if (res.ok) setSaved(next === "" ? null : next);
      else setError(res.error);
    });
  }

  return (
    <div className="py-4">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <label htmlFor={field.key} className="text-sm font-medium">{field.label}</label>
          {field.help ? <p className="text-xs text-muted-foreground">{field.help}</p> : null}
        </div>
        <code className="shrink-0 text-[0.7rem] text-muted-foreground/70">{field.key}</code>
      </div>

      <div className="flex items-start gap-2">
        {field.multiline ? (
          <textarea
            id={field.key}
            rows={2}
            className={`${inputClass} resize-y py-2`}
            value={value}
            placeholder={field.fallback}
            onChange={(e) => setValue(e.target.value)}
          />
        ) : (
          <input
            id={field.key}
            className={`${inputClass} h-9`}
            value={value}
            placeholder={field.fallback}
            onChange={(e) => setValue(e.target.value)}
          />
        )}
        <button
          type="button"
          onClick={() => commit(value)}
          disabled={!dirty || pending}
          className="inline-flex h-9 shrink-0 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="mt-1.5 flex items-center gap-3 text-xs">
        {error ? (
          <span className="text-destructive">{error}</span>
        ) : usingFallback ? (
          <span className="text-muted-foreground">Using the app default.</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-success-soft-foreground">
            <Check className="size-3.5" /> Custom copy live.
          </span>
        )}
        {!usingFallback ? (
          <button
            type="button"
            onClick={() => { setValue(""); commit(""); }}
            disabled={pending}
            className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            <ArrowCounterClockwise className="size-3.5" /> Reset to default
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function CopyEditor({ values }: { values: CopyValues }) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-8 lg:px-10">
      {contentGroups.map((group) => (
        <section key={group.title} className="mb-10">
          <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{group.title}</h2>
          {group.description ? <p className="mt-1 text-sm text-muted-foreground">{group.description}</p> : null}
          <div className="mt-2 divide-y divide-border border-t border-border">
            {group.fields.map((f) => (
              <FieldRow key={f.key} field={f} initial={values[f.key] ?? null} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

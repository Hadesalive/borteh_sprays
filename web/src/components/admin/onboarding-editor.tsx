"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ImageSquare, Plus, Trash } from "@phosphor-icons/react";

import {
  createSlide,
  deleteSlide,
  reorderSlides,
  setSlideActive,
  updateSlide,
} from "@/app/(dashboard)/content/onboarding/actions";
import { storageUrl } from "@/lib/supabase/storage";
import { cn } from "@/lib/utils";
import { Toggle } from "@/components/admin/toggle";

export type Slide = {
  id: string;
  title: string;
  body: string;
  imagePath: string | null;
  active: boolean;
};

const inputClass =
  "h-9 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none";

function SlideCard({
  slide,
  index,
  total,
  onMove,
  busy,
}: {
  slide: Slide;
  index: number;
  total: number;
  onMove: (dir: -1 | 1) => void;
  busy: boolean;
}) {
  const [title, setTitle] = useState(slide.title);
  const [body, setBody] = useState(slide.body);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = title !== slide.title || body !== slide.body;

  function save() {
    setError(null);
    start(async () => {
      const res = await updateSlide(slide.id, { title, body });
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex gap-4">
        {/* Slide art — image upload lands with media management; for now shows the current image or a placeholder. */}
        <div className="flex flex-col items-center gap-2">
          <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-dashed border-border bg-muted text-muted-foreground">
            {storageUrl(slide.imagePath) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={storageUrl(slide.imagePath)!} alt="" className="size-full object-cover" />
            ) : (
              <ImageSquare weight="duotone" className="size-5" />
            )}
          </span>
          <span className="text-[0.65rem] font-medium tabular-nums text-muted-foreground">#{index + 1}</span>
        </div>

        <div className="min-w-0 flex-1 space-y-2.5">
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Slide title"
          />
          <textarea
            rows={2}
            className={`${inputClass} h-auto resize-y py-2`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Slide body"
          />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Move up"
                disabled={index === 0 || busy}
                onClick={() => onMove(-1)}
                className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
              >
                <ArrowUp className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Move down"
                disabled={index === total - 1 || busy}
                onClick={() => onMove(1)}
                className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
              >
                <ArrowDown className="size-4" />
              </button>
              <span className="ml-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Toggle
                  defaultOn={slide.active}
                  label={`Show ${slide.title}`}
                  onChange={(on) => start(async () => { await setSlideActive(slide.id, on); })}
                />
                Visible
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Delete slide"
                onClick={() => {
                  if (confirm("Remove this slide?")) start(async () => { await deleteSlide(slide.id); });
                }}
                className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive-soft hover:text-destructive"
              >
                <Trash className="size-4" />
              </button>
              <button
                type="button"
                onClick={save}
                disabled={!dirty || pending}
                className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
              >
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

export function OnboardingEditor({ slides: initial }: { slides: Slide[] }) {
  const [slides, setSlides] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function move(index: number, dir: -1 | 1) {
    const next = [...slides];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setSlides(next);
    start(async () => { await reorderSlides(next.map((s) => s.id)); });
  }

  function add() {
    setError(null);
    start(async () => {
      const res = await createSlide({ title: newTitle, body: newBody });
      if (res.ok) {
        setNewTitle("");
        setNewBody("");
        setAdding(false);
        // Server revalidates the page; reload to pull the fresh list (incl. the new id).
        location.reload();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className={cn("mx-auto max-w-2xl px-6 py-8 lg:px-10", pending && "opacity-70 transition-opacity")}>
      <ul className="space-y-3">
        {slides.map((s, i) => (
          <SlideCard key={s.id} slide={s} index={i} total={slides.length} busy={pending} onMove={(dir) => move(i, dir)} />
        ))}
        {slides.length === 0 ? (
          <li className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            No slides yet — add the first one below.
          </li>
        ) : null}
      </ul>

      {adding ? (
        <div className="mt-4 space-y-2.5 rounded-xl border border-border bg-card p-4">
          <input className={inputClass} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Slide title" />
          <textarea
            rows={2}
            className={`${inputClass} h-auto resize-y py-2`}
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            placeholder="Slide body"
          />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => { setAdding(false); setError(null); }}
              className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={add}
              disabled={pending || !newTitle.trim() || !newBody.trim()}
              className="inline-flex h-9 items-center rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {pending ? "Adding…" : "Add slide"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-md border border-dashed border-border px-3.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
        >
          <Plus className="size-4" />
          Add slide
        </button>
      )}
    </div>
  );
}

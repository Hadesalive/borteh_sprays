"use client";

import { CheckCircle, PaperPlaneTilt } from "@phosphor-icons/react";
import { useState, useTransition } from "react";

import { sendNotice } from "@/app/(dashboard)/settings/notices/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Kind = "system" | "promo";

/** Compose + send a broadcast. Lands in every customer's in-app inbox instantly
 *  (and on lock screens once they've enabled push). Promos only push to
 *  marketing-opted-in customers — the DB trigger enforces it. */
export function NoticeComposer({ allCount, marketingCount }: { allCount: number; marketingCount: number }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<Kind>("system");
  const [sent, setSent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const audience = kind === "promo" ? "marketing" : "all";
  const reach = kind === "promo" ? marketingCount : allCount;
  const canSend = title.trim().length > 0 && body.trim().length > 0 && !pending;

  const submit = () => {
    if (!canSend) return;
    if (!window.confirm(`Send this to ${reach} ${reach === 1 ? "customer" : "customers"}? This can't be unsent.`)) return;
    setError(null);
    start(async () => {
      const res = await sendNotice({ title: title.trim(), body: body.trim(), kind, audience });
      if (res.ok) {
        setSent(res.recipients);
        setTitle("");
        setBody("");
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-6 lg:px-10">
      {/* kind */}
      <div className="flex gap-2">
        {(
          [
            { value: "system" as Kind, label: "Notice", hint: `All customers · ${allCount}` },
            { value: "promo" as Kind, label: "Promotion", hint: `Marketing opt-in · ${marketingCount}` },
          ]
        ).map((k) => (
          <button
            key={k.value}
            type="button"
            onClick={() => setKind(k.value)}
            className={`flex-1 rounded-lg border px-4 py-3 text-left transition-colors ${
              kind === k.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
            }`}
          >
            <span className="block text-sm font-medium">{k.label}</span>
            <span className="block text-xs text-muted-foreground">{k.hint}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="notice-title" className="mb-1.5 block text-sm font-medium">
            Title
          </label>
          <Input
            id="notice-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder={kind === "promo" ? "Two scents, one delivery fee — this weekend" : "Closed for the holiday on Monday"}
          />
        </div>
        <div>
          <label htmlFor="notice-body" className="mb-1.5 block text-sm font-medium">
            Message
          </label>
          <Textarea
            id="notice-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={240}
            rows={3}
            placeholder={kind === "promo" ? "Pair any two 50 ml bottles and the rider brings both for one fee." : "The counter rests Monday — orders placed after Sunday 6pm go out Tuesday morning."}
          />
          <p className="mt-1 text-right text-xs text-muted-foreground">{body.length}/240</p>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      {sent != null && !error ? (
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <CheckCircle weight="duotone" className="size-4 text-emerald-600" />
          Sent to {sent} {sent === 1 ? "customer" : "customers"}.
        </p>
      ) : null}

      <div className="mt-5 flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          Lands in the app inbox instantly; on lock screens for customers with push on.
        </p>
        <Button onClick={submit} disabled={!canSend}>
          <PaperPlaneTilt weight="duotone" className="size-4" />
          {pending ? "Sending…" : `Send to ${reach}`}
        </Button>
      </div>
    </div>
  );
}

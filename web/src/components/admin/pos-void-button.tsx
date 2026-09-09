"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { voidPosSale } from "@/app/(dashboard)/pos/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** Void a completed till sale. A reason is required — it lands on the receipt
 *  and in the stock ledger's return entry, so the day's history explains itself. */
export function PosVoidButton({ saleId, receipt }: { saleId: string; receipt: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    start(async () => {
      const res = await voidPosSale(saleId, reason);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" size="sm" />}>Void sale</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Void {receipt}?</DialogTitle>
          <DialogDescription>The bottles go back into stock and this receipt is excluded from today&apos;s takings. It stays on record, struck through.</DialogDescription>
        </DialogHeader>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Reason</span>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Rang up the wrong bottle"
            rows={3}
            className="mt-1"
            autoFocus
          />
        </label>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Keep sale
          </Button>
          <Button variant="destructive" onClick={submit} disabled={pending || !reason.trim()}>
            {pending ? "Voiding…" : "Void sale"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

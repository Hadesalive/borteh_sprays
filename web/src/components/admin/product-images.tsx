"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ChangeEvent } from "react";
import { Star, CaretLeft, CaretRight, Trash, UploadSimple, ImageSquare } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { uploadProductImage, setPrimaryImage, reorderImages, deleteProductImage } from "@/app/(dashboard)/products/actions";

export type ProductImage = { id: string; url: string; storagePath: string; isPrimary: boolean };

export function ProductImages({ productId, images }: { productId: string; images: ProductImage[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setErr(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setErr(res.error);
      else router.refresh();
    });
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("productId", productId);
    fd.set("file", file);
    run(() => uploadProductImage(fd));
    if (fileRef.current) fileRef.current.value = "";
  }

  function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= images.length) return;
    const order = images.map((i) => i.id);
    [order[index], order[j]] = [order[j], order[index]];
    run(() => reorderImages({ productId, orderedIds: order }));
  }

  return (
    <div className="overflow-hidden rounded-[12px] border border-border bg-card shadow-[0_1px_0_rgba(26,26,26,0.07)]">
      <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
        <div>
          <h2 className="text-[13px] font-[650] tracking-[-0.1px]">Images</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">The primary image (★) shows in the app catalog. Drag order sets the gallery sequence.</p>
        </div>
        <label className={cn(
          "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted",
          pending && "pointer-events-none opacity-60"
        )}>
          <UploadSimple weight="duotone" className="size-4" />
          Upload
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={onFile} disabled={pending} />
        </label>
      </div>

      <div className="px-5 py-4">
        {err ? <p className="mb-3 text-[12px] text-destructive-soft-foreground">{err}</p> : null}
        {images.length === 0 ? (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border py-10 text-center text-[13px] text-muted-foreground transition-colors hover:bg-muted">
            <ImageSquare weight="duotone" className="size-6" />
            No images yet — upload the bottle shot.
            <input type="file" accept="image/*" className="sr-only" onChange={onFile} disabled={pending} />
          </label>
        ) : (
          <div className={cn("flex flex-wrap gap-3", pending && "opacity-60")}>
            {images.map((img, i) => (
              <div key={img.id} className="group relative w-28">
                <div className="relative aspect-square overflow-hidden rounded-md border border-border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="size-full object-cover" />
                  {img.isPrimary ? (
                    <span className="absolute left-1 top-1 inline-flex items-center gap-0.5 rounded bg-primary/90 px-1 py-px text-[10px] font-medium text-primary-foreground">
                      <Star weight="fill" className="size-2.5" /> Primary
                    </span>
                  ) : null}
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-0.5">
                    <button type="button" disabled={pending || i === 0} onClick={() => move(i, -1)} aria-label="Move left"
                      className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30">
                      <CaretLeft className="size-3.5" />
                    </button>
                    <button type="button" disabled={pending || i === images.length - 1} onClick={() => move(i, 1)} aria-label="Move right"
                      className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30">
                      <CaretRight className="size-3.5" />
                    </button>
                  </span>
                  <span className="flex items-center gap-0.5">
                    {!img.isPrimary ? (
                      <button type="button" disabled={pending} onClick={() => run(() => setPrimaryImage({ imageId: img.id, productId }))} aria-label="Make primary"
                        className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-brand disabled:opacity-30">
                        <Star className="size-3.5" />
                      </button>
                    ) : null}
                    <button type="button" disabled={pending}
                      onClick={() => { if (confirm("Delete this image?")) run(() => deleteProductImage({ imageId: img.id, productId, storagePath: img.storagePath })); }}
                      aria-label="Delete image"
                      className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-30">
                      <Trash className="size-3.5" />
                    </button>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

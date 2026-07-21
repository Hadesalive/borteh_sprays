"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CashRegister,
  MagnifyingGlass,
  Package,
  Truck,
} from "@phosphor-icons/react";

import { allNavItems } from "@/lib/nav";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

const quickActions = [
  { title: "New point-of-sale sale", href: "/pos", icon: CashRegister },
  { title: "Receive stock", href: "/inventory/receive", icon: Package },
  { title: "Open dispatch board", href: "/dispatch", icon: Truck },
];

export function CommandMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  const navItems = allNavItems;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 w-full max-w-72 items-center gap-2 rounded-md border border-border bg-background px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <MagnifyingGlass className="size-4" />
        <span className="truncate">Search orders, products…</span>
        <kbd className="nums ml-auto hidden items-center gap-0.5 rounded border border-border bg-muted px-1.5 text-[0.7rem] font-medium text-muted-foreground sm:inline-flex">
          ⌘K
        </kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Command menu"
        description="Search and jump to any part of the admin"
      >
        <CommandInput placeholder="Search orders, products, pages…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Quick actions">
            {quickActions.map((a) => (
              <CommandItem
                key={a.href}
                value={`action ${a.title}`}
                onSelect={() => go(a.href)}
              >
                <a.icon />
                {a.title}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Go to">
            {navItems.map((item) => (
              <CommandItem
                key={item.href}
                value={`nav ${item.title}`}
                onSelect={() => go(item.href)}
              >
                <item.icon />
                {item.title}
                <CommandShortcut>page</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

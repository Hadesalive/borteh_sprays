"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CaretUpDown, SignOut } from "@phosphor-icons/react";

import { createAuthBrowserClient } from "@/lib/supabase/auth-browser";
import { primaryNav, catalogNav, contentNav, insightNav, settingsItem, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";

function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function NavItems({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            isActive={isActivePath(pathname, item.href)}
            tooltip={item.title}
            render={<Link href={item.href} />}
          >
            <item.icon />
            <span>{item.title}</span>
          </SidebarMenuButton>
          {item.badge ? (
            <SidebarMenuBadge className="text-sidebar-primary">
              {item.badge}
            </SidebarMenuBadge>
          ) : null}
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

export function AppSidebar({ user }: { user?: { name: string; role: string } }) {
  const pathname = usePathname();
  const router = useRouter();
  const name = user?.name ?? "Mr. Borteh";
  const role = user?.role ?? "owner";
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  async function signOut() {
    await createAuthBrowserClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <span
            aria-hidden
            className="grid size-7 shrink-0 place-items-center group-data-[collapsible=icon]:size-6"
          >
            <span className="size-4 rotate-45 rounded-[4px] bg-sidebar-primary" />
          </span>
          <span className="font-display text-lg leading-none text-sidebar-foreground group-data-[collapsible=icon]:hidden">
            Borteh
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <NavItems items={primaryNav} />
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator className="mx-2" />
        <SidebarGroup>
          <SidebarGroupContent>
            <NavItems items={catalogNav} />
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator className="mx-2" />
        <SidebarGroup>
          <SidebarGroupContent>
            <NavItems items={contentNav} />
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator className="mx-2" />
        <SidebarGroup>
          <SidebarGroupContent>
            <NavItems items={insightNav} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={isActivePath(pathname, settingsItem.href)}
              tooltip={settingsItem.title}
              render={<Link href={settingsItem.href} />}
            >
              <settingsItem.icon />
              <span>{settingsItem.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarSeparator className="mx-2" />

        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  "flex w-full items-center gap-2 rounded-md p-1.5 text-left text-sm text-sidebar-foreground outline-none transition-colors",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  "aria-expanded:bg-sidebar-accent aria-expanded:text-sidebar-accent-foreground",
                  "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-1"
                )}
              >
                <Avatar className="size-7 rounded-md">
                  <AvatarFallback className="nums rounded-md bg-sidebar-primary text-[0.7rem] font-medium text-sidebar-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="grid flex-1 leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-medium">{name}</span>
                  <span className="truncate text-xs capitalize text-sidebar-foreground/55">
                    {role}
                  </span>
                </span>
                <CaretUpDown className="ml-auto size-4 text-sidebar-foreground/55 group-data-[collapsible=icon]:hidden" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" sideOffset={8} className="min-w-56">
                <DropdownMenuLabel className="flex flex-col">
                  <span>{name}</span>
                  <span className="text-xs font-normal capitalize text-muted-foreground">
                    {role} · borteh sprays
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={signOut}>
                  <SignOut />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

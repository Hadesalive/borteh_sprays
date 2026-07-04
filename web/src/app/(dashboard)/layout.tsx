import { Bell } from "@phosphor-icons/react/dist/ssr";

import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { AppSidebar } from "@/components/app-sidebar";
import { IconProvider } from "@/components/icon-provider";
import { CommandMenu } from "@/components/command-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  const sidebarUser = user
    ? {
        name: (user.user_metadata?.display_name as string) ?? (user.phone as string) ?? "Staff",
        role: (user.app_metadata?.role as string) ?? "staff",
      }
    : undefined;

  return (
    <IconProvider>
      <TooltipProvider delay={200}>
      <SidebarProvider>
        <AppSidebar user={sidebarUser} />
        <SidebarInset>
          <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur-md sm:px-4">
            <SidebarTrigger className="text-muted-foreground" />
            <Separator orientation="vertical" className="mr-1 !h-5" />
            <CommandMenu />
            <div className="ml-auto flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Notifications"
                className="relative"
              >
                <Bell weight="duotone" />
                <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary ring-2 ring-background" />
              </Button>
              <ThemeToggle />
            </div>
          </header>
          <div className="flex-1 overflow-x-hidden">{children}</div>
        </SidebarInset>
      </SidebarProvider>
      </TooltipProvider>
    </IconProvider>
  );
}

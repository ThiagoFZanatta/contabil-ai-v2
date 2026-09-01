import type { ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  MessagesSquare,
  Users,
  CalendarDays,
  KanbanSquare,
  Settings,
  BarChart3,
  UserPlus,
  Bell,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentStaff } from "@/hooks/use-current-staff";
import { supabase } from "@/integrations/supabase/client";
import { conversations } from "@/lib/mock-data";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/conversas", label: "Conversas", icon: MessagesSquare },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/leads", label: "Funil de leads", icon: KanbanSquare },
];

const adminItems = [
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/equipe", label: "Equipe", icon: UserPlus },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "");
}

export function AppShell({
  children,
  title,
  description,
}: {
  children: ReactNode;
  title?: string;
  description?: string;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const session = useCurrentStaff();

  const queueCount =
    session.status === "ready"
      ? conversations.filter((c) => session.staff.departmentSlugs.includes(c.departamento)).length
      : 0;

  function isActive(to: string) {
    if (to === "/") return pathname === "/";
    return pathname.startsWith(to);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  if (session.status !== "ready") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Skeleton className="size-10 rounded-full" />
      </div>
    );
  }

  const { staff } = session;

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              N
            </div>
            <div className="group-data-[collapsible=icon]:hidden">
              <p className="text-sm font-semibold text-sidebar-foreground leading-none">Nara</p>
              <p className="text-xs text-sidebar-foreground/60">Atendimento IA</p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Operação</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={isActive(item.to)} tooltip={item.label}>
                      <Link to={item.to}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.to === "/conversas" && queueCount > 0 && (
                      <SidebarMenuBadge>{queueCount}</SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Gestão</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={isActive(item.to)} tooltip={item.label}>
                      <Link to={item.to}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-2 rounded-md p-2 text-left hover:bg-sidebar-accent cursor-pointer">
                <Avatar className="size-7">
                  <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                    {initialsOf(staff.name).toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                  <p className="truncate text-xs font-medium text-sidebar-foreground">
                    {staff.name}
                  </p>
                  <p className="truncate text-[11px] text-sidebar-foreground/60">{staff.email}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Minha conta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/equipe">
                  <UserPlus /> Gestão de equipe
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleSignOut}>
                <LogOut /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur">
          <SidebarTrigger />
          <div className="min-w-0 flex-1">
            {title && <h1 className="truncate text-sm font-semibold text-foreground">{title}</h1>}
            {description && <p className="truncate text-xs text-muted-foreground">{description}</p>}
          </div>
          <Button variant="ghost" size="icon" aria-label="Notificações" className="relative">
            <Bell className="size-4" />
            <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-destructive" />
          </Button>
        </header>
        <div className="flex-1 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

import { type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Camera,
  ShieldAlert,
  Users,
  Scan,
  LogOut,
  BookOpen,
  UserPlus,
  History,
  Activity,
  CalendarDays,
  CalendarPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { backendHealth } from "@/lib/api";

const ROLE_STYLE: Record<string, string> = {
  admin: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  lecturer:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  teacher: "bg-muted text-muted-foreground",
};

function AppSidebarContent({ role }: { role?: string | null }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (_) {
      // ignore signOut errors — clear local state regardless
    }
    navigate("/login", { replace: true });
  };

  const isAdmin = role === "admin";
  const isLecturer = role === "lecturer";
  const isTeacher = role === "teacher";

  const navItems = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
      show: true,
    },
    { title: "Curriculum", url: "/modules", icon: BookOpen, show: true },
    {
      title: "Add Module",
      url: "/modules/add",
      icon: BookOpen,
      show: isAdmin || isLecturer,
    },
    {
      title: "Register Student",
      url: "/students/register",
      icon: UserPlus,
      show: isAdmin || isLecturer || isTeacher,
    },
    { title: "Attendance", url: "/attendance", icon: Camera, show: !isAdmin },
    { title: "History", url: "/history", icon: History, show: true },
    { title: "Students", url: "/students", icon: Users, show: true },
    {
      title: "Teachers",
      url: "/teachers",
      icon: UserPlus,
      show: isAdmin || isLecturer,
    },
    { title: "Timetable", url: "/timetable", icon: CalendarDays, show: true },
    { title: "Schedule Session", url: "/schedule", icon: CalendarPlus, show: isTeacher && !isAdmin },
  ].filter((i) => i.show);

  const securityItems = [
    {
      title: "Assignments",
      url: "/assignments",
      icon: Activity,
      show: isAdmin || isLecturer,
    },
    { title: "Security", url: "/security", icon: ShieldAlert, show: false },
    {
      title: "Spoof log",
      url: "/security/spoof-log",
      icon: ShieldAlert,
      show: true,
    },
    {
      title: "Activity log",
      url: "/admin/activity",
      icon: Activity,
      show: isAdmin,
    },
  ].filter((i) => i.show);

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border transition-all duration-300"
    >
      <div className="p-4 flex items-center gap-2">
        {!collapsed && (
          <>
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
              <Scan className="w-5 h-5 text-primary" />
            </div>
            <span className="font-bold">FaceGuard</span>
          </>
        )}
      </div>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink
                      to={item.url}
                      activeClassName="bg-primary/10 text-primary"
                    >
                      <item.icon className="w-4 h-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Security & Admin</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {securityItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink
                      to={item.url}
                      activeClassName="bg-primary/10 text-primary"
                    >
                      <item.icon className="w-4 h-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <div className="mt-auto p-4">
        <Button
          variant="ghost"
          size="sm"
          className={`w-full gap-2 text-muted-foreground ${
            collapsed ? "justify-center" : "justify-start"
          }`}
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span>Logout</span>}
        </Button>
      </div>
    </Sidebar>
  );
}

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const rawFullName = user?.user_metadata?.full_name;
  const fullName =
    typeof rawFullName === "string" && rawFullName.trim() !== ""
      ? rawFullName
      : "Teacher";
  const initial = fullName.charAt(0).toUpperCase();

  const { data: teacher } = useQuery({
    queryKey: ["current-teacher-role", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("teachers")
        .select("role")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      return data as { role: string } | null;
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const {
    data: health,
    isError: healthError,
    status: healthStatus,
  } = useQuery({
    queryKey: ["healthz-badge"],
    queryFn: backendHealth,
    refetchInterval: 30_000,
    retry: false,
    staleTime: 25_000,
  });

  const healthLoaded = healthStatus !== "pending";
  const isHealthy = !healthError && health?.ok === true;
  const dotClass = healthLoaded
    ? isHealthy
      ? "bg-green-500 animate-pulse"
      : "bg-red-500"
    : "bg-muted";
  const healthTitle = healthLoaded
    ? isHealthy
      ? `AI backend online · face: ${health.face_service.mock ? "mock" : "real"} · spoof: ${health.anti_spoofing.mode}`
      : "AI backend offline or unreachable"
    : "Checking AI backend…";

  const role = teacher?.role;
  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : null;
  const roleClass = role ? (ROLE_STYLE[role] ?? ROLE_STYLE.teacher) : "";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebarContent role={role} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border px-4 gap-4">
            <SidebarTrigger />
            <div className="flex-1" />
            <div className="flex items-center gap-3">
              <div
                className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-default"
                title={healthTitle}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
                <span className="hidden md:inline">AI</span>
              </div>
              {roleLabel && (
                <span
                  className={`hidden md:inline-block text-xs px-2 py-0.5 rounded-full font-medium ${roleClass}`}
                >
                  {roleLabel}
                </span>
              )}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                  {initial}
                </div>
                <span className="text-sm hidden md:block">{fullName}</span>
              </div>
            </div>
          </header>
          <main className="flex-1 p-3 sm:p-6 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}

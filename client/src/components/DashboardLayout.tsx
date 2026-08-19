import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { cn } from "@/lib/utils";
import { AlertTriangle, CalendarClock, ClipboardCheck, FileBarChart, HeartPulse, LayoutDashboard, LogOut, PackageSearch, PanelLeft, Settings2, ShieldAlert, Wrench } from "lucide-react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const navigation = [
  { icon: LayoutDashboard, label: "Control Tower", path: "/", roles: ["super_admin", "hospital_admin", "department_head", "supervisor", "viewer"] },
  { icon: ClipboardCheck, label: "My Day", path: "/my-day", roles: ["super_admin", "hospital_admin", "department_head", "supervisor", "staff", "viewer"] },
  { icon: ShieldAlert, label: "Issues", path: "/issues", roles: ["super_admin", "hospital_admin", "department_head", "supervisor", "staff", "viewer"] },
  { icon: Wrench, label: "Equipment", path: "/equipment", roles: ["super_admin", "hospital_admin", "department_head", "supervisor", "viewer"] },
  { icon: PackageSearch, label: "Inventory & expiry", path: "/inventory", roles: ["super_admin", "hospital_admin", "department_head", "supervisor", "viewer"] },
  { icon: CalendarClock, label: "Roster", path: "/roster", roles: ["super_admin", "hospital_admin", "department_head", "supervisor", "viewer"] },
  { icon: CalendarClock, label: "Handover", path: "/handover", roles: ["super_admin", "hospital_admin", "department_head", "supervisor", "staff"] },
  { icon: CalendarClock, label: "Calendar", path: "/calendar", roles: ["super_admin", "hospital_admin", "department_head", "supervisor", "viewer"] },
  { icon: FileBarChart, label: "Reports", path: "/reports", roles: ["super_admin", "hospital_admin", "department_head", "supervisor", "viewer"] },
  { icon: Settings2, label: "Operations setup", path: "/settings", roles: ["super_admin", "hospital_admin"] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();
  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4"><div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-700 text-white"><HeartPulse className="h-6 w-6" /></div><h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">Hospital Operations</h1><p className="mt-2 text-sm leading-relaxed text-slate-500">Sign in to open your role-based operational workspace.</p><Button onClick={() => startLogin()} className="mt-6 w-full bg-teal-700 hover:bg-teal-800">Sign in securely</Button></div></div>;
  return <SidebarProvider><DashboardContent>{children}</DashboardContent></SidebarProvider>;
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isMobile = useIsMobile();
  const visibleItems = navigation.filter(item => item.roles.includes(user?.role ?? "staff"));
  const active = visibleItems.find(item => item.path === location) ?? (location.startsWith("/tasks") ? { label: "Task" } : { label: "Hospital Operations" });
  return <><Sidebar collapsible="icon" className="border-r border-slate-200"><SidebarHeader className="h-[72px] border-b border-slate-100 p-3"><div className="flex items-center gap-2.5"><button onClick={toggleSidebar} aria-label="Toggle navigation" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-white transition-transform duration-150 hover:bg-teal-800 active:scale-95"><HeartPulse className="h-4 w-4" /></button><div className="min-w-0 group-data-[collapsible=icon]:hidden"><p className="truncate text-sm font-semibold text-slate-900">Hospital Ops</p><p className="truncate text-xs text-slate-500">Operations management</p></div></div></SidebarHeader><SidebarContent className="pt-3"><SidebarMenu className="gap-1 px-2">{visibleItems.map(item => { const activeItem = item.path === location || (item.path === "/" && location === ""); return <SidebarMenuItem key={item.path}><SidebarMenuButton isActive={activeItem} onClick={() => setLocation(item.path)} tooltip={item.label} className={cn("h-10 rounded-lg text-slate-600 hover:bg-teal-50 hover:text-teal-800 data-[active=true]:bg-teal-50 data-[active=true]:font-semibold data-[active=true]:text-teal-800")}><item.icon className="h-4 w-4" /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>; })}</SidebarMenu></SidebarContent><SidebarFooter className="border-t border-slate-100 p-3"><DropdownMenu><DropdownMenuTrigger asChild><button className="flex w-full items-center gap-2.5 rounded-xl p-1.5 text-left hover:bg-slate-50"><Avatar className="h-8 w-8"><AvatarFallback className="bg-slate-100 text-xs font-semibold text-slate-700">{user?.name?.slice(0, 1).toUpperCase() || "U"}</AvatarFallback></Avatar><div className="min-w-0 group-data-[collapsible=icon]:hidden"><p className="truncate text-sm font-medium text-slate-800">{user?.name || "User"}</p><p className="truncate text-xs capitalize text-slate-500">{user?.role?.replaceAll("_", " ")}</p></div></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-52"><DropdownMenuItem onClick={logout} className="cursor-pointer text-rose-700 focus:text-rose-700"><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem></DropdownMenuContent></DropdownMenu></SidebarFooter></Sidebar><SidebarInset className="bg-[#f7fafb]"><header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200/80 bg-[#f7fafb]/90 px-4 backdrop-blur md:px-7"><div className="flex items-center gap-3">{isMobile && <SidebarTrigger className="rounded-lg" />}<div><p className="text-xs font-medium text-slate-500">Operations workspace</p><p className="text-sm font-semibold text-slate-900">{active.label}</p></div></div><div className="hidden items-center gap-2 sm:flex"><span className="h-2 w-2 rounded-full bg-emerald-500" /><span className="text-xs font-medium text-slate-500">System operational</span></div></header><main className="mx-auto w-full max-w-[1500px] flex-1 p-4 sm:p-6 lg:p-7">{children}</main></SidebarInset></>;
}

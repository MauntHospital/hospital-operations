import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import AppShell from "@/pages/AppShell";
import DashboardLayout from "@/components/DashboardLayout";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import StaffLogin from "./pages/StaffLogin";
import StaffAccounts from "./pages/StaffAccounts";
import DepartmentSchedules from "./pages/DepartmentSchedules";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/login"} component={StaffLogin} />
      <Route path={"/staff-accounts"}><DashboardLayout><StaffAccounts /></DashboardLayout></Route>
      <Route path={"/department-schedules"}><DashboardLayout><DepartmentSchedules /></DashboardLayout></Route>
      <Route path={"/"}><AppShell view="dashboard" /></Route>
      <Route path={"/my-day"}><AppShell view="my-day" /></Route>
      <Route path={"/tasks/:id"}><AppShell view="tasks" /></Route>
      <Route path={"/issues"}><AppShell view="issues" /></Route>
      <Route path={"/equipment"}><AppShell view="equipment" /></Route>
      <Route path={"/inventory"}><AppShell view="inventory" /></Route>
      <Route path={"/roster"}><AppShell view="roster" /></Route>
      <Route path={"/handover"}><AppShell view="handover" /></Route>
      <Route path={"/reports"}><AppShell view="reports" /></Route>
      <Route path={"/calendar"}><AppShell view="calendar" /></Route>
      <Route path={"/settings"}><AppShell view="settings" /></Route>
      <Route path={"/operations"}><AppShell view="overview" /></Route>
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

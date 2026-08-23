import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import AppShell from "@/pages/AppShell";
import { TaskCreate } from "@/pages/OperationsPage";
import DashboardLayout from "@/components/DashboardLayout";
import { Redirect, Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DepartmentSchedules from "./pages/DepartmentSchedules";
import ManagerSettings from "./pages/ManagerSettings";
import WhatsAppTaskRegister from "./pages/WhatsAppTaskRegister";
import RiskRegister from "./pages/RiskRegister";
import ManagementActions from "./pages/ManagementActions";
import ScoringRules from "./pages/ScoringRules";
import OperationalFollowUps from "./pages/OperationalFollowUps";
import CommandSearch from "./pages/CommandSearch";
import ReportsInsights from "./pages/ReportsInsights";
import CalendarEvents from "./pages/CalendarEvents";
import NotificationCenter from "./pages/NotificationCenter";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/department-schedules/new"}>
        <DashboardLayout>
          <TaskCreate />
        </DashboardLayout>
      </Route>
      <Route path={"/department-schedules"}>
        <DashboardLayout>
          <DepartmentSchedules />
        </DashboardLayout>
      </Route>
      <Route path={"/whatsapp-tasks"}>
        <DashboardLayout>
          <WhatsAppTaskRegister />
        </DashboardLayout>
      </Route>
      <Route path={"/"}>
        <AppShell view="dashboard" />
      </Route>
      <Route path={"/my-day"}>
        <Redirect to="/whatsapp-tasks" replace />
      </Route>
      <Route path={"/tasks/:id"}>
        <Redirect to="/whatsapp-tasks" replace />
      </Route>
      <Route path={"/issues"}>
        <AppShell view="issues" />
      </Route>
      <Route path={"/risks"}>
        <DashboardLayout>
          <RiskRegister />
        </DashboardLayout>
      </Route>
      <Route path={"/management-actions"}>
        <DashboardLayout>
          <ManagementActions />
        </DashboardLayout>
      </Route>
      <Route path={"/scoring-rules"}>
        <DashboardLayout>
          <ScoringRules />
        </DashboardLayout>
      </Route>
      <Route path={"/operational-follow-ups"}>
        <DashboardLayout>
          <OperationalFollowUps />
        </DashboardLayout>
      </Route>
      <Route path={"/search"}>
        <DashboardLayout>
          <CommandSearch />
        </DashboardLayout>
      </Route>
      <Route path={"/equipment"}>
        <AppShell view="equipment" />
      </Route>
      <Route path={"/inventory"}>
        <AppShell view="inventory" />
      </Route>
      <Route path={"/roster"}>
        <AppShell view="roster" />
      </Route>
      <Route path={"/handover"}>
        <AppShell view="handover" />
      </Route>
      <Route path={"/reports"}>
        <DashboardLayout>
          <ReportsInsights />
        </DashboardLayout>
      </Route>
      <Route path={"/calendar"}>
        <DashboardLayout>
          <CalendarEvents />
        </DashboardLayout>
      </Route>
      <Route path={"/notifications"}>
        <DashboardLayout>
          <NotificationCenter />
        </DashboardLayout>
      </Route>
      <Route path={"/settings"}>
        <DashboardLayout>
          <ManagerSettings />
        </DashboardLayout>
      </Route>
      <Route path={"/operations"}>
        <AppShell view="overview" />
      </Route>
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

import DashboardLayout from "@/components/DashboardLayout";
import OperationsPage from "@/pages/OperationsPage";

export default function AppShell({ view }: { view: React.ComponentProps<typeof OperationsPage>["view"] }) {
  return <DashboardLayout><OperationsPage view={view} /></DashboardLayout>;
}

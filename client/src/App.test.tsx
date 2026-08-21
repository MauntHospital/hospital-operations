import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("manager task route migration", () => {
  it("redirects retired My Day and task-detail URLs to the manager task register", () => {
    const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

    expect(appSource).toContain('<Route path={"/my-day"}><Redirect to="/whatsapp-tasks" replace /></Route>');
    expect(appSource).toContain('<Route path={"/tasks/:id"}><Redirect to="/whatsapp-tasks" replace /></Route>');
  });

  it("keeps reports hidden from viewer navigation and sends the operations overview to the manager task register", () => {
    const layoutSource = readFileSync(new URL("./components/DashboardLayout.tsx", import.meta.url), "utf8");
    const overviewSource = readFileSync(new URL("./pages/OperationsPage.tsx", import.meta.url), "utf8");

    expect(layoutSource).toContain('{ icon: FileBarChart, label: "Reports", path: "/reports", roles: ["super_admin", "hospital_admin", "department_head", "supervisor"] }');
    expect(overviewSource).toContain('title: "Manager task register"');
    expect(overviewSource).toContain('href: "/whatsapp-tasks"');
    expect(overviewSource).not.toContain('href: "/tasks/new"');
  });
});

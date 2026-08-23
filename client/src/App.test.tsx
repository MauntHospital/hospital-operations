import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const compact = (source: string) => source.replace(/\s+/g, "");

describe("manager task route migration", () => {
  it("redirects retired My Day and task-detail URLs to the manager task register", () => {
    const appSource = compact(
      readFileSync(new URL("./App.tsx", import.meta.url), "utf8")
    );

    expect(appSource).toContain(
      '<Routepath={"/my-day"}><Redirectto="/whatsapp-tasks"replace/></Route>'
    );
    expect(appSource).toContain(
      '<Routepath={"/tasks/:id"}><Redirectto="/whatsapp-tasks"replace/></Route>'
    );
  });

  it("removes Handover from manager navigation and redirects legacy Handover URLs to the roster", () => {
    const appSource = compact(
      readFileSync(new URL("./App.tsx", import.meta.url), "utf8")
    );
    const layoutSource = compact(
      readFileSync(
        new URL("./components/DashboardLayout.tsx", import.meta.url),
        "utf8"
      )
    );

    expect(appSource).toContain(
      '<Routepath={"/handover"}><Redirectto="/roster"replace/></Route>'
    );
    expect(layoutSource).not.toContain('label:"Handover"');
    expect(layoutSource).not.toContain('path:"/handover"');
  });

  it("keeps reports hidden from viewer navigation and sends the operations overview to the manager task register", () => {
    const layoutSource = compact(
      readFileSync(
        new URL("./components/DashboardLayout.tsx", import.meta.url),
        "utf8"
      )
    );
    const overviewSource = compact(
      readFileSync(
        new URL("./pages/OperationsPage.tsx", import.meta.url),
        "utf8"
      )
    );

    expect(layoutSource).toMatch(
      /\{icon:FileBarChart,label:"Reports",path:"\/reports",roles:\["super_admin","hospital_admin","department_head","supervisor"\],?\}/
    );
    expect(overviewSource).toContain('title:"Managertaskregister"');
    expect(overviewSource).toContain('href:"/whatsapp-tasks"');
    expect(overviewSource).not.toContain('href:"/tasks/new"');
  });

  it("retains live manager workspaces while excluding unreachable template pages", () => {
    const appSource = compact(
      readFileSync(new URL("./App.tsx", import.meta.url), "utf8")
    );

    expect(appSource).toContain(
      '<Routepath={"/whatsapp-tasks"}><DashboardLayout><WhatsAppTaskRegister/></DashboardLayout></Route>'
    );
    expect(appSource).toContain(
      '<Routepath={"/reports"}><DashboardLayout><ReportsInsights/></DashboardLayout></Route>'
    );
    expect(appSource).toContain(
      '<Routepath={"/notifications"}><DashboardLayout><NotificationCenter/></DashboardLayout></Route>'
    );
    expect(appSource).not.toContain("pages/Home");
    expect(appSource).not.toContain("ComponentShowcase");
  });
});

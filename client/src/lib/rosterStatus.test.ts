import { describe, expect, it } from "vitest";
import { getRosterAvailability } from "./rosterStatus";

describe("roster status indicators", () => {
  it("labels present, late, and absent staff with operationally meaningful availability states", () => {
    expect(getRosterAvailability("present", "Dr. Wong", "Day")).toMatchObject({
      label: "Available",
      tone: "success",
    });
    expect(getRosterAvailability("late", "Alex Morgan", "Day")).toMatchObject({
      label: "At risk",
      tone: "warning",
    });
    expect(
      getRosterAvailability("absent", "Priya Nair", "Night")
    ).toMatchObject({ label: "Unavailable", tone: "danger" });
  });
});

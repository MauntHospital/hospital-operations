import { TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";
import { COOKIE_NAME } from "../shared/const";
import type { User } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";

const state = vi.hoisted(() => ({
  authenticate: vi.fn(),
  changePassword: vi.fn(),
  passwordChangeRequired: vi.fn(),
  createSessionToken: vi.fn(),
}));

vi.mock("./operationsData", async importOriginal => ({
  ...(await importOriginal<typeof import("./operationsData")>()),
  authenticateStaffAccount: state.authenticate,
  changeStaffPassword: state.changePassword,
  passwordChangeRequired: state.passwordChangeRequired,
}));

vi.mock("./_core/sdk", () => ({
  sdk: { createSessionToken: state.createSessionToken },
}));

import { appRouter } from "./routers";

const localStaff: User = { id: 18, openId: "staff-local-18", name: "Priya Nair", email: null, loginMethod: "managed", role: "staff", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };

function context(user: User | null = null) {
  const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { cookie: (name: string, value: string, options: Record<string, unknown>) => cookies.push({ name, value, options }) } as TrpcContext["res"],
  };
  return { ctx, cookies };
}

describe("auth.localLogin", () => {
  it("authenticates a staff account and sets the secure application session cookie", async () => {
    state.authenticate.mockResolvedValue({ user: localStaff, mustChangePassword: true });
    state.createSessionToken.mockResolvedValue("signed-local-session");
    const { ctx, cookies } = context();

    const result = await appRouter.createCaller(ctx).auth.localLogin({ username: "priya.nair", password: "AValidPassword2026" });

    expect(result).toEqual({ success: true, mustChangePassword: true });
    expect(state.createSessionToken).toHaveBeenCalledWith(localStaff.openId, expect.objectContaining({ expiresInMs: 43_200_000 }));
    expect(cookies).toEqual([expect.objectContaining({ name: COOKIE_NAME, value: "signed-local-session", options: expect.objectContaining({ httpOnly: true, secure: true, sameSite: "none" }) })]);
  });

  it("keeps invalid account credentials as a local sign-in error", async () => {
    state.authenticate.mockRejectedValue(new TRPCError({ code: "UNAUTHORIZED", message: "Invalid account name or password." }));
    const { ctx, cookies } = context();

    await expect(appRouter.createCaller(ctx).auth.localLogin({ username: "priya.nair", password: "wrong" })).rejects.toMatchObject({ message: "Invalid account name or password." });
    expect(cookies).toHaveLength(0);
  });

  it("allows an authenticated staff member to submit their required first-login password change", async () => {
    state.changePassword.mockResolvedValue({ success: true });
    const { ctx } = context(localStaff);

    await expect(appRouter.createCaller(ctx).auth.changePassword({ currentPassword: "AValidPassword2026", newPassword: "AnotherValidPassword2026" })).resolves.toEqual({ success: true });
    expect(state.changePassword).toHaveBeenCalledWith(localStaff, expect.objectContaining({ newPassword: "AnotherValidPassword2026" }));
  });
});

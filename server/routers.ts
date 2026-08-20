import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { operationsRouter } from "./routers/operations";
import { authenticateStaffAccount, changeStaffPassword, passwordChangeRequired } from "./operationsData";
import { z } from "zod";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(async opts => opts.ctx.user ? { ...opts.ctx.user, mustChangePassword: await passwordChangeRequired(opts.ctx.user.id) } : null),
    localLogin: publicProcedure.input(z.object({ username: z.string().min(3).max(64), password: z.string().min(1).max(128) })).mutation(async ({ ctx, input }) => {
      const result = await authenticateStaffAccount(input);
      const token = await sdk.createSessionToken(result.user.openId, { name: result.user.name ?? "Staff", expiresInMs: 1000 * 60 * 60 * 12 });
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: 1000 * 60 * 60 * 12 });
      return { success: true, mustChangePassword: result.mustChangePassword };
    }),
    changePassword: protectedProcedure.input(z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(12).max(128) })).mutation(({ ctx, input }) => changeStaffPassword(ctx.user, input)),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  operations: operationsRouter,

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;

import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getEditorialRepository, getEditorialRepositoryMode } from "./data-access";
import { RepositoryConflictError } from "../backend/src/repositories/types";
import { analyzeLiteraryText, literaryAnalysisInputSchema } from "./literary-analysis";
import { listLLMModels } from "./_core/llm";
import { getSyncSnapshot, markSyncConflict, markSyncFailed, markSyncStarted, markSyncSucceeded } from "./sync-state";

const documentPath = z.string().regex(/^[a-z0-9][a-z0-9/_-]*\.json$/i, "Caminho de documento inválido.");
const scopedPath = (ownerId: number, path: string) => `authors/${ownerId}/${path}`;

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  literaryAssist: router({
    models: protectedProcedure.query(async () => {
      const result = await listLLMModels();
      return { models: result.data };
    }),
    analyze: protectedProcedure.input(literaryAnalysisInputSchema).mutation(async ({ input }) => {
      try {
        return await analyzeLiteraryText(input);
      } catch (error) {
        throw new TRPCError({ code: "BAD_GATEWAY", message: error instanceof Error ? `A assessoria literária não respondeu: ${error.message}` : "A assessoria literária não respondeu." });
      }
    }),
  }),
  data: router({
    status: protectedProcedure.query(() => ({ mode: getEditorialRepositoryMode(), versioned: true, ...getSyncSnapshot() })),
    get: protectedProcedure.input(z.object({ path: documentPath })).query(({ ctx, input }) =>
      getEditorialRepository().get(scopedPath(ctx.user.id, input.path)),
    ),
    put: protectedProcedure.input(z.object({
      path: documentPath,
      data: z.record(z.string(), z.unknown()),
      expectedSha: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      markSyncStarted();
      try {
        const result = await getEditorialRepository().put(scopedPath(ctx.user.id, input.path), input.data, input.expectedSha);
        markSyncSucceeded();
        return result;
      } catch (error) {
        if (error instanceof RepositoryConflictError) {
          markSyncConflict(input.path);
          throw new TRPCError({ code: "CONFLICT", message: "O documento foi alterado por outra sessão. Recarregue antes de salvar." });
        }
        markSyncFailed(error);
        throw error;
      }
    }),
  }),
});

export type AppRouter = typeof appRouter;

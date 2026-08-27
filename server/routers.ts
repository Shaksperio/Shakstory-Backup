import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getEditorialRepository, getEditorialRepositoryMode } from "./data-access";
import { RepositoryConflictError } from "../backend/src/repositories/types";
import { analyzeLiteraryText, listLiteraryModels, literaryAnalysisInputSchema } from "./literary-analysis";
import { getSyncSnapshot, markSyncConflict, markSyncFailed, markSyncStarted, markSyncSucceeded } from "./sync-state";
import { storagePut } from "./storage";

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
      const result = await listLiteraryModels();
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
  assets: router({
    uploadCover: protectedProcedure.input(z.object({ filename: z.string().regex(/^[a-zA-Z0-9._-]+$/).max(120), contentType: z.enum(["image/jpeg", "image/png", "image/webp"]), base64: z.string().min(1).max(12_000_000) })).mutation(async ({ ctx, input }) => {
      try {
        const bytes = Buffer.from(input.base64, "base64");
        if (bytes.length > 8 * 1024 * 1024) throw new Error("A capa deve ter no máximo 8 MB.");
        return await storagePut(`authors/${ctx.user.id}/covers/${input.filename}`, bytes, input.contentType);
      } catch (error) {
        throw new TRPCError({ code: "BAD_GATEWAY", message: error instanceof Error ? `Não foi possível armazenar a capa: ${error.message}` : "Não foi possível armazenar a capa." });
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

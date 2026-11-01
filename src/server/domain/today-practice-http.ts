import { z } from "zod";

import { TodayNextInputSchema } from "@/contracts/today-practice";
import type { PracticeMaterialView } from "@/features/practice/material-schema";
import { success, failure } from "@/server/api/respond";
import type { WebSessionResult } from "@/server/auth/web-session";
import { PracticeError, practiceErrorResponse, readPracticeMutation } from "./create-practice-task";
import type { createTodayPracticeService } from "./build-today-queue";

type Dependencies = {
  authenticate: (request: Request) => Promise<WebSessionResult>;
  appUrl: string;
  service: ReturnType<typeof createTodayPracticeService>;
  now: () => string;
  requestId: () => string;
  material: (userId: string, taskId: string) => Promise<PracticeMaterialView | null>;
};
type Session = { ok: true; userId: string } | { ok: false; response: Response };

export function createTodayPracticeHttpHandlers(deps: Dependencies) {
  const reply = (data: unknown, id: string) => Response.json(success(data, id), {
    headers: { "Cache-Control": "no-store" },
  });
  async function auth(request: Request, id: string): Promise<Session> {
    const session = await deps.authenticate(request);
    if (session.ok) return { ok: true, userId: session.userId };
    return {
      ok: false,
      response: Response.json(failure({
        code: session.reason === "missing" ? "AUTH_REQUIRED" : "SESSION_EXPIRED",
        message: "Sign in to practice.", retryable: false,
      }, id), { status: 401, headers: { "Cache-Control": "no-store" } }),
    };
  }
  return {
    async today(request: Request) {
      const id = deps.requestId();
      try {
        const session = await auth(request, id);
        if (!session.ok) return session.response;
        return reply(await deps.service.today(session.userId, deps.now()), id);
      } catch (error) {
        return practiceErrorResponse(error, id);
      }
    },
    async next(request: Request) {
      const id = deps.requestId();
      try {
        let userId: string;
        let raw: unknown;
        if (request.method === "POST") {
          const mutation = await readPracticeMutation(request, { ...deps, requestId: id });
          if (!mutation.ok) return mutation.response;
          userId = mutation.userId;
          raw = mutation.body;
        } else {
          const session = await auth(request, id);
          if (!session.ok) return session.response;
          userId = session.userId;
          const params = new URL(request.url).searchParams;
          if ([...params.keys()].some(key =>
            !["exclude", "currentItemId", "currentTaskId"].includes(key) || params.getAll(key).length !== 1,
          )) throw new PracticeError("VALIDATION_FAILED");
          const exclude = params.get("exclude");
          raw = {
            ...(params.has("exclude") ? { exclude: exclude ? exclude.split(",") : [] } : {}),
            ...(params.has("currentItemId") ? { currentItemId: params.get("currentItemId") } : {}),
            ...(params.has("currentTaskId") ? { currentTaskId: params.get("currentTaskId") } : {}),
          };
        }
        const input = TodayNextInputSchema.safeParse(raw);
        if (!input.success) throw new PracticeError("VALIDATION_FAILED");
        return reply(await deps.service.next(userId, deps.now(), input.data), id);
      } catch (error) {
        return practiceErrorResponse(error, id);
      }
    },
    async material(request: Request, taskId: string) {
      const id = deps.requestId();
      try {
        const session = await auth(request, id);
        if (!session.ok) return session.response;
        if (!z.string().uuid().safeParse(taskId).success) throw new PracticeError("VALIDATION_FAILED");
        const material = await deps.material(session.userId, taskId);
        if (!material) throw new PracticeError("NOT_FOUND");
        return reply(material, id);
      } catch (error) {
        return practiceErrorResponse(error, id);
      }
    },
  };
}

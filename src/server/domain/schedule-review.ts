const DAY_MS = 24 * 60 * 60 * 1_000;
const CANONICAL_UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export type ReviewScheduleInput =
  | { readonly kind: "first_tried"; readonly now: string }
  | {
      readonly kind: "failed_or_heavily_assisted_reuse";
      readonly now: string;
    }
  | { readonly kind: "successful_independent_reuse"; readonly now: string }
  | { readonly kind: "owned_maintenance"; readonly now: string };

export type ReviewSchedule = {
  readonly dueAt: string;
  readonly intervalDays: number;
};

function parseUtcClock(value: string): number {
  if (!CANONICAL_UTC_INSTANT.test(value)) {
    throw new RangeError("now must be a valid ISO 8601 UTC instant");
  }

  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    throw new RangeError("now must be a valid ISO 8601 UTC instant");
  }

  return milliseconds;
}

function intervalFor(kind: ReviewScheduleInput["kind"]): number {
  switch (kind) {
    case "first_tried":
    case "failed_or_heavily_assisted_reuse":
      return 1;
    case "successful_independent_reuse":
      return 7;
    case "owned_maintenance":
      return 30;
  }
}

export function scheduleReview(input: ReviewScheduleInput): ReviewSchedule {
  const nowMs = parseUtcClock(input.now);
  const intervalDays = intervalFor(input.kind);

  return {
    intervalDays,
    dueAt: new Date(nowMs + intervalDays * DAY_MS).toISOString(),
  };
}

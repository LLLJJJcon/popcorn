import { failure, success } from "./respond";

describe("API response helpers", () => {
  it("builds a stable success envelope", () => {
    expect(success({ savedItemId: "item-1" }, "request-1")).toEqual({
      ok: true,
      data: { savedItemId: "item-1" },
      requestId: "request-1",
    });
  });

  it("builds a stable failure envelope without inventing optional fields", () => {
    expect(
      failure(
        {
          code: "SYNC_RETRYING",
          message: "The save is queued for another attempt.",
          retryable: true,
        },
        "request-2",
      ),
    ).toEqual({
      ok: false,
      error: {
        code: "SYNC_RETRYING",
        message: "The save is queued for another attempt.",
        retryable: true,
      },
      requestId: "request-2",
    });
  });

  it("preserves validation field errors", () => {
    expect(
      failure(
        {
          code: "VALIDATION_FAILED",
          message: "The request is invalid.",
          retryable: false,
          fieldErrors: { exactQuote: ["Required"] },
        },
        "request-3",
      ).error.fieldErrors,
    ).toEqual({ exactQuote: ["Required"] });
  });
});

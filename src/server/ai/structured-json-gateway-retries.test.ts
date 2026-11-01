import { expect, test, vi } from "vitest";
import { completeWithFormatRetries } from "./structured-json-gateway";
import { ModelGatewayError } from "./provider";

test("format retries make four identical calls, without retrying transport failures", async () => {
  const complete = vi.fn().mockRejectedValue(new ModelGatewayError("PROVIDER_OUTPUT_INVALID", "wire_schema"));
  await expect(completeWithFormatRetries(complete)).rejects.toBeInstanceOf(ModelGatewayError);
  expect(complete).toHaveBeenCalledTimes(4);
  const transport = vi.fn().mockRejectedValue(new ModelGatewayError("PROVIDER_UNAVAILABLE", "transport"));
  await expect(completeWithFormatRetries(transport)).rejects.toBeInstanceOf(ModelGatewayError);
  expect(transport).toHaveBeenCalledTimes(1);
});

test("grounding checks participate in format retries", async () => {
  const complete = vi.fn().mockResolvedValue({ text: "missing" });
  await expect(completeWithFormatRetries(complete, () => { throw new ModelGatewayError("PROVIDER_OUTPUT_INVALID", "grounding"); })).rejects.toBeInstanceOf(ModelGatewayError);
  expect(complete).toHaveBeenCalledTimes(4);
});

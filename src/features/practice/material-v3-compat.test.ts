import { describe, expect, it } from "vitest";
import { CandidateSelectionSchema } from "@/server/domain/create-practice-task";
import { PracticeMaterialViewSchema } from "./material-schema";

describe("marked-expression practice compatibility", () => {
  it("accepts a learning card beyond the original three-candidate limit", () => {
    expect(CandidateSelectionSchema.safeParse({
      savedItemId: "00000000-0000-4000-8000-000000000001",
      candidateArtifactId: "00000000-0000-4000-8000-000000000002",
      candidateIndex: 7,
    }).success).toBe(true);
  });
  it("allows English learning explanations to mention their Chinese expression", () => {
    const result = PracticeMaterialViewSchema.shape.expression.safeParse({
      englishMeaning: "高得要命 means ridiculously high here.",
      englishExplanation: "Compared with 很高, this sounds exaggerated.",
      tone: "Casual; say it to friends.",
      communicativeFunction: "complain", register: "casual_chat",
    });
    expect(result.success).toBe(true);
  });
});

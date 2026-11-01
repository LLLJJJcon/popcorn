import { describe, expect, it } from "vitest";
import { selectTransferTarget } from "./transfer-target";

const base = { functionCategories: ["complain", "emphasize"], usageSettings: ["casual_chat", "online_social"] } as const;
describe("review target selection", () => {
  it.each([
    ["tried", null, "near", "complain", "casual_chat"],
    ["reused", null, "far", "emphasize", "online_social"],
    ["owned", null, "near", "complain", "casual_chat"],
    ["owned", "near", "far", "emphasize", "online_social"],
    ["owned", "far", "near", "complain", "casual_chat"],
  ] as const)("%s after %s selects %s", (masteryState, lastTransferType, transferType, targetFunction, targetSetting) => {
    const selected = selectTransferTarget({ ...base, masteryState, lastTransferType });
    expect(selected.transferType).toBe(transferType);
    expect(selected.targetFunction.value).toBe(targetFunction);
    expect(selected.targetSetting.value).toBe(targetSetting);
    expect(selected.targetFunction.rule).toMatch(/\S/);
    expect(selected.targetSetting.description).toMatch(/\S/);
  });
  it("uses the primary intention and first setting if no distinct alternative exists", () => {
    expect(selectTransferTarget({ masteryState: "reused", functionCategories: ["praise"], usageSettings: ["work_school", "work_school"] })).toMatchObject({ transferType: "far", targetFunction: { value: "praise" }, targetSetting: { value: "work_school" } });
  });
  it("applies the explicit empty-setting default to a validated modern card", () => {
    expect(selectTransferTarget({ masteryState: "tried", functionCategories: ["other"], usageSettings: [] })).toMatchObject({ targetSetting: { value: "casual_chat" } });
  });
  it.each([
    { ...base, functionCategories: [] }, { ...base, functionCategories: ["invented"] },
    { ...base, usageSettings: ["invented"] }, { ...base, masteryState: "invented" },
    { ...base, lastTransferType: "maintain" },
  ])("rejects missing or invalid modern metadata instead of inventing it", input => {
    expect(() => selectTransferTarget({ masteryState: "tried", ...input } as never)).toThrow();
  });
});

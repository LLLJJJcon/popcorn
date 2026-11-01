import { expect, test } from "vitest";
import * as rounds from "./practice-rounds";

const selection={savedItemId:"10000000-0000-4000-8000-000000000001",candidateArtifactId:"10000000-0000-4000-8000-000000000002",candidateIndex:0};
test("a retained mark has one candidate identity across replacement artifacts", () => {
  const a=rounds.practiceCandidateKey(selection,{highlightKey:"segment:0:4"});
  expect(rounds.practiceCandidateKey({...selection,candidateArtifactId:"10000000-0000-4000-8000-000000000003",candidateIndex:4},{highlightKey:"segment:0:4"})).toBe(a);
  expect(rounds.practiceCandidateKey(selection,{})).not.toBe(a);
});
test("client assistance is ignored and extra mutation data is rejected", () => {
  expect(rounds.parseOriginalRoundInput({taskId:selection.savedItemId,responseChinese:"这也太离谱了。",assistanceLevel:"invented"})).toEqual({taskId:selection.savedItemId,responseChinese:"这也太离谱了。"});
  expect(()=>rounds.parseOriginalRoundInput({taskId:selection.savedItemId,responseChinese:"hello"})).toThrow();
});
test("separate scenario fingerprint detects normalized repeats without changing mastery hashes", () => {
  expect(rounds.practiceSituationFingerprint("朋友说：六十元。" )).toBe(rounds.practiceSituationFingerprint(" 朋友说： 六十元。 "));
  expect(rounds.practiceSituationFingerprint("朋友说：六十元。" )).not.toBe(rounds.practiceSituationFingerprint("同事说：六十元。"));
  expect(rounds.practiceSituationFingerprint("朋友说：六十元。" )).toBe(rounds.practiceSituationFingerprint("朋友说，六十元！"));
});

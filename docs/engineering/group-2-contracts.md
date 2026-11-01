# Group 2 frozen contracts

Task 2A, 2026-11-01. Public contract tests: `tests/contract/practice-rounds.test.ts` (RED 6 missing/old-shape failures, then GREEN 6/6). Backend alone owns these schemas; UI/prompt implementers consume the names below. Existing legacy DTOs remain readable. New server responses always populate round state; optional fields in schemas admit pre-group-2 fixtures/old tasks.

## Exports and DTOs

`src/contracts/practice.ts`:

```ts
PracticeSituationSchema; type PracticeSituation = {
  situationZh:string; situationEn:string; interlocutor:string; taskEn:string;
  targetFunction:FunctionCategory; targetSetting:UsageSetting;
};
PracticeRoundStatusSchema; type PracticeRoundStatus =
  'open'|'retry_scheduled'|'promoted'|'superseded'|'removed';
PracticeRoundAnswerSchema; type PracticeRoundAnswer = {
  attemptId:string; revision:number; text:string;
  evaluation:EvaluationResult; naturalVersion:string|null;
};
PracticeRoundStateSchema; type PracticeRoundState = {
  roundNumber:number; status:PracticeRoundStatus;
  firstAnswer:PracticeRoundAnswer|null; latestRevision:PracticeRoundAnswer|null;
  examplesOpened:boolean;
  promotion:{userExpressionId:string;nextDueAt:string}|null;
  retryDueAt:string|null;
};
PracticeActivationResponseSchema; type PracticeActivationResponse = PracticeTask | {redirect:string};
PracticeNewRoundResponseSchema; // {taskId:string;roundNumber:number}
PracticeRemoveResponseSchema; // {roundState:PracticeRoundState;undoUntil:ISODateTime}
PracticeRestoreResponseSchema; // {roundState:PracticeRoundState}
PracticeExamplesOpenedResponseSchema; // {examplesOpened:true}
PracticeConflictResponseSchema; // typed failure union below
```

Existing `PracticeTaskSchema` adds `situation?:PracticeSituation|null`; legacy `promptChinese/instructionsEnglish/goalEnglish` remain. New situation maps situationZh=>promptChinese and taskEn=>instructionsEnglish. `PracticeAttemptResponseSchema` retains `{attempt,coaching}` and adds `roundState?:PracticeRoundState`; server new submissions/replays populate it. Coaching remains `{naturalRevisionChinese:string}|null`, persisted naturalVersion lives on each round answer. All-five feedback has coaching/naturalVersion null.

`src/features/practice/material-schema.ts`: `PracticeMaterialTaskSchema` gains same `situation`. `PracticeMaterialViewSchema` retains `{task,source,expression}`; masteryState is nullable (pre-Vault null), adds `roundState?:PracticeRoundState`, `learningCard?:LearningCardFields|null`, `examplesOpened?:boolean` (due marker). `learningCard` uses existing `LearningCardFieldsSchema` from knowledge: meaningHere/useItWhen/comparedWith/howItFits/toneAndWho/watchOut/examples/functionCategories/usageSettings/suitability/notExpressionReasonEn. Complete new cards populate it; legacy cards use null plus existing expression explanation fields. Due's canonical expression fields populate the same card view with sensible legacy null fallback. UI does not import server prompt constants; use targetSetting enum labels locally/shared client-safe mapping.

`src/contracts/knowledge.ts`: `SavedPracticeStateSchema`/`SavedPracticeState` discriminated union, attached as optional `candidate.practiceState`:

```ts
{status:'unpracticed'} |
{status:'practicing',taskId:string,roundNumber:number} |
{status:'removed',taskId:string,roundNumber:number} |
{status:'promoted',userExpressionId:string}
```

## API envelope and errors

All responses retain existing success envelope `{ok:true,data:<DTO>,requestId}`. Failure `{ok:false,error:{code,message,retryable,details?},requestId}`. `ApiErrorCodeSchema` includes FIRST_ANSWER_EXISTS/ALREADY_PROMOTED and generic schema admits details. Use **PracticeConflictResponseSchema** for exact typed 409 details:

- FIRST_ANSWER_EXISTS => `error.details = {roundState}`; contains original attempt/evaluation/natural version and latest revision. UI renders this authoritative state, no regrading.
- ALREADY_PROMOTED => `error.details = {userExpressionId}`.

| Endpoint | Request body | Success data/status |
| --- | --- | --- |
| POST `/api/v1/practice/tasks` | existing `{savedItemId,candidateArtifactId,candidateIndex}` | 201 PracticeActivationResponse (redirect detail if promoted, current open if available, otherwise new round) |
| POST `/api/v1/practice/tasks/[taskId]/rounds` | `{requestId:<UUID>}` stable for one user action/retry | 201 new or 200 current-open/idempotent replay, `{taskId,roundNumber}` |
| POST `/api/v1/practice/tasks/[taskId]/remove` | `{}` | 200 PracticeRemoveResponse; removed immediately, Undo until server UTC instant |
| POST `/api/v1/practice/tasks/[taskId]/restore` | `{}` | 200 PracticeRestoreResponse; expired/stale returns409 CONFLICT |
| POST `/api/v1/practice/tasks/[taskId]/examples-opened` | `{}` | 200 PracticeExamplesOpenedResponse; wait for success before disclosure |
| POST `/api/v1/practice/due/[reviewTaskId]/examples-opened` | `{}` | 200 PracticeExamplesOpenedResponse; same ordering |
| POST `/api/v1/practice/attempts` | `{taskId,responseChinese}` | 201 PracticeAttemptResponse with roundState |
| POST `/api/v1/practice/attempts/[attemptId]/revisions` | `{responseChinese}` | 201 PracticeAttemptResponse with roundState |

Caller assistanceLevel is ignored, including invalid/spoofed values; new submitted assistance is derived from server examples marker. Legacy persisted hint is unchanged on replay. New round receives new taskId, so answer storage key changes naturally. Default retry starts at original submission+24h; revisions never reset it. Remove five-second expiry is server-enforced, and UI navigates back at expiry. Use requestId replay rather than generating another ID for transport retry.

## Prompt interface handshake

2B's pure module contract: `activate.v2.ts` exports `ACTIVATE_PRACTICE_PROMPT_VERSION='activate-practice-v3'`, `ActivationOutputSchema/ActivationOutput`, `buildActivatePracticePrompt({card:{expression,meaningHere,useItWhen,toneAndWho},targetFunction,targetSetting,sourceLine,avoidSituations})`, `normalizeActivationWire`, `createActivationWireNormalizer({targetExpression,avoidSituations})`, `validateActivationOutput(output,{targetExpression,avoidSituations})`, `createActivationFixtureGateway()`. Output is four scenario text fields; backend adds targetFunction/targetSetting enum values. Shared `learning-intent-constants.ts` exports LEARNING_FUNCTIONS/LEARNING_SETTINGS keyed objects and getTargetFunction/getTargetSetting. `evaluate.v2.ts` exports same builder/normalizer/parser/fixture names as v1, with §8.5 enriched input; backend uses old v4 builder only for tasks missing complete new metadata. Format retry budget belongs backend (initial+3), not hidden inside pure modules.

## Ownership boundaries

2A owns schemas/server/routes/migration/types/Saved aggregate; 2B owns pure new prompt modules/constants/fallback content; 2C owns client API/components/page/return resolver/styles. 2A and 2C coordinate only through this document. New data fields will be persisted/read by 2A; UI can begin after this publication. Any field-name change must be sent to controller and consumer before edit.

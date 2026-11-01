# 组 2 UI / Prompt 只读预检与拆分建议

审计基线：`/private/tmp/popcorn-phase1-confirmed-base`，控制器指定的 `3a48862` 冻结 archive；未使用主工作区并发未提交内容。此报告不是实施结果。未改仓库、未提交、未运行数据库或测试、未派生 agent。

已读仓库 AGENTS.md；Next 16.3.1 本地指南 `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md` 与 `01-app/01-getting-started/15-route-handlers.md`。客户端边界保留于交互组件；路由继续采用异步 params/cookies，认证和所有权检查留服务端。已读方案 1/3/15/16.2、4.7–4.9、5 全文、8.0/8.3–8.5/8.7。

## 实施前需产品确认的真实冲突

1. **5.3 vs 8.7：重试后失败页或模板兜底。** 5.3 要求格式重试用完显示 `We couldn't prepare a situation.` + `Try again`；8.7 要求首次练习失败也共用模板，写 `scenario_source = 'fallback'`。控制器已向用户发起选择；此审计不决定。
2. **8.4 fixture 首模板 vs 新轮指纹去重。** 8.4 要求按意图取 8.7 第一个模板原样返回；第二轮 avoidSituations 含第一轮该模板后，原样首模板必然不合法。每意图只有两模板也无法保证无限轮次一直有未见兜底。需确定 fixture 是否可选未见模板、模板耗尽是否错误页；不得为了让 fixture 跑通放松真实去重。
3. 4.9 仍写旧 `Need a hint?` 打开即算辅助，但 5.2/5.6/16.2 明确只 `Show examples` 算 model_answer；16.2 是本组明确执行指令，后者覆盖，不需再自行二选一。
4. 控制器确认：三维按 5.9 显示分数+反馈；“点击解释”不是新增需求，不实现额外交互。

## 需求—现状—缺口映射

| 需求 | 冻结基线证据 / 现状 | 本组缺口 / 边界 |
| --- | --- | --- |
| 5.3/8.4 v3 情境输入 | `src/server/ai/prompts/activate.v1.ts` 实际导出 `activate-practice-v2`；只传 expression/englishMeaning/communicativeFunction/evidenceText | 新增 `activate.v2.ts` 导出 v3；按 8.4 原文，仅 card 四字段、主 function 与完整规则、首 setting 与说明、sourceLine、avoidSituations；不传 examples |
| 四字段情境输出 | 旧仅 promptChinese ≤160 且末尾问号；`create-practice-task.ts` 用固定两句英文；30s/250 tokens | 新 situationZh≤120 code points / situationEn≤60 words / interlocutor≤10 code points / taskEn≤30 words；20s/400 tokens；新任务存 targetFunction/Setting；英文忠实翻译、话题不同属真实模型人工评审，不能靠 fixture 声称已满足 |
| 泄露与去重校验 | `create-practice-task.ts` 仅完成后检查 promptChinese.includes(expression)；未包格式重试 | wire normalizer + task-aware validator检查 situationZh/En 及 taskEn 不含目标、必填、长度；taskEn 不翻译目标属语义评审；规范化情境指纹与全部历史比较，grounding 错误进入 `completeWithFormatRetries`；保留传输重试政策 |
| 场合与意图常量 | 枚举在 `contracts/knowledge.ts`；Saved 组件有本地标签对象，无共享 rule/description 文件 | 新 `learning-intent-constants.ts`，8.3 labels/rules/descriptions 逐字；非法/空意图 other，空场合 casual_chat；不把服务器目录的运行时代码引入客户端，可传 label/value 给 UI |
| 5.5 页头 | `practice-material.tsx` 显示 Focused Mandarin practice / Current mastery: tried | 删除小标题；新标签 New · Not in your Vault yet / Round n ·；表达+Meaning here；到期页保留原掌握度，不提前套 New |
| 题面翻译 | material/task contracts 只有 promptChinese/instructionsEnglish/goalEnglish | 新字段+对象/场合标签；中文/EN 分段，EN 在中文下显示对照；开关页会话保持，不记录辅助；旧题仍可读，缺新字段不编造翻译/对象 |
| 来源 | PracticeMaterial 内独立 Show original evidence，不记辅助 | 首次页只标题+时间+外链图标；原句移入 Show examples。共享提示用于 due，禁止旁路泄露原句 |
| About / examples 内容 | material-schema/repository 只投影旧 5 个解释字段，丢失组 1 新学习卡字段 | material 新增 howItFits/toneAndWho/watchOut/examples（缺失/null允许）等；About 默认收起、不影响独立性；examples 展开后保持；缺例句仅原句仍算辅助；旧卡保留可读的旧字段，不虚构新卡数据 |
| 服务端辅助 | PracticeSession / DuePractice 在本地 assistanceLevel=hint；API body发送该值；due schema当前强制接收 assistanceLevel | 新 examples-opened 路由即时持久化并返回服务端状态；UI不再传assistanceLevel；服务端忽略旧客户端传值，只据持久记录推导 none/model_answer；刷新必须重建已开状态。旧历史hint原样保留 |
| 暂存和提示 | Session只useState；textarea仅 required；异常统一字符串 | 首次练习 `popcorn:answer:{taskId}`、500ms防抖、try/catch、成功清除、恢复提示；先完成hydrate再写以免空初值覆盖；中文缺失阻止，目标缺失仅提醒；8s提示保留；gateway配置错误与provider/output错误区分。5.7也列due暂存键，但16.2把due共享限定为提示/记录/辅助/结果行，本组不扩大到due暂存及整页表单重做 |
| 8.5 v5评分 | `evaluate.v1.ts` 实际v4，rubric24行，scope从情境推断；parser coaching可null；attempt repository/due domain直接调v4 | 新 `evaluate.v2.ts` 实际v5，保持三维rubric除指定scope替换/C1追加外逐字，suffix只加指定句；新完整元数据任务用v5，任何必需新字段缺失的旧任务用v4，不能凭promptVersion标签强行当v5 |
| 评分纯程序派生 | derivePracticeDecision 已三项≥3与none决定独立，parse会拒不含目标改写 | 保持评分决策；v5及展示层三项5强制忽略改写；不可让model返回业务状态；readable finite allowlist扩v3/v5，v1–v4旧数据仍读 |
| 结果行 | EvaluationPanel 同时 Strong start / Practice recorded / evidenceMessage，日期硬编码UTC | 首次三类结果+未入库明天说明，promotion回执是唯一入库证据；revision通过专用Nice fix；due只替换独立通过/辅助通过/未通过三类行；用本地日期 |
| 三维/Focus | 三列 grid、<3高亮；全通过时Try next，仍叫rewrite | 保留维度顺序和分数+反馈；<3高亮；任一<5取最低Focus first，稳定tie；全5 Nothing to fix，不出现修订建议/改写 |
| 自然版本 | coaching直接展示；没有提交原文入参 | 默认收起Show a natural version + aria-expanded；最近提交原文与自然句两列，纯程序code-point diff高亮；输入正在编辑时不能拿未提交文本作Your answer；查看不影响辅助 |
| 修订 | result替换原反馈，revise只feedbackVisible=false；不限次数但不保留first | 首次摘要与分数保留；Check my revision；first/latest和分数箭头，First feedback默认收起；revision不晋升不重排retryDueAt；过后按钮按5.9 |
| 多轮 | create-practice-task返回existing草稿，taskId按候选稳定；status active/completed/abandoned | 新round接口与roundState；不同轮有不同taskId、递增roundNumber；Try a new situation保留returnTo；新round失败保留当前反馈，不清除已提交记录 |
| remove/undo | 无 | remove成功显Undo，5s内restore，窗口到期回白名单来源；返回/关闭默认retry由服务端完成，不依赖unload写入；Saved显示状态与Continue/Practice；已入库直接详情 |
| 返回 | task page仅允许带saved anchor的严格regex，无returnTo不显示返回 | 统一白名单helper，Saved详情可含合法anchor、/practice含允许会话query、/vault/UUID、/home；拒外域、//、编码绕过与非白名单；默认/saved标签Saved；本组只修已有入口，不创建组3Home/会话入口 |
| 刷新/冲突 | session所有结果在内存；material repository无attempt/promotion聚合 | 初始roundState直接render；首次回答存在不再POST首答；同文本幂等，不同文本409含服务端既有结果，UI恢复而非报通用失败 |
| 5.13共用样式 | practice-workspace module已主实心/次描边；hint/disclosure透明；Open in Vault在卡外；due共用同css | 提取可复用button/action-row/disclosure/segmented样式或组件，首次完整落地；移除首次多余Stop/Continue；页头左对齐卡片，actions卡内底部；避免通过修改共用EvaluationPanel把due按钮/评分/队列提前换成组4 |

## 建议先冻结的服务端—UI契约

以下是具体建议，供后端拥有者决定并冻结；不是擅自变更已实现接口。所有HTTP仍用现有 `{ok:true,data,requestId}`；错误保留 `{ok:false,error,requestId}`。

```ts
type TargetFunction = { value: FunctionCategory; label: string; rule: string };
type TargetSetting = { value: UsageSetting; label: string; description: string };
type RoundAnswer = {
  attemptId: string; // revision endpoint必需；不能只给text/evaluation
  revision: number;
  text: string;
  evaluation: EvaluationResult; //沿用三维/assistance/independentUse
  naturalVersion: string | null;
};
type RoundState = {
  roundNumber: number;
  status: 'open'|'retry_scheduled'|'promoted'|'superseded'|'removed';
  firstAnswer: RoundAnswer | null;
  latestRevision: RoundAnswer | null;
  examplesOpened: boolean;
  promotion: { userExpressionId: string; nextDueAt: string } | null;
  retryDueAt: string | null;
};
// 保留旧task字段，避免due和旧fixture全部被迫切换。新题字段建议一个可空
// structuredSituation整体，避免只存在半套字段也触发v5。若后端选择平铺也可，
// 必须一次冻结，UI不再独立解释缺字段策略。
type StructuredSituation = {
  situationZh: string;
  situationEn: string;
  interlocutor: string;
  taskEn: string;
  targetFunction: TargetFunction;
  targetSetting: TargetSetting;
};
type PracticeMaterialExtension = {
  structuredSituation: StructuredSituation | null; //旧题为null，继续v4
  roundState: RoundState | null; //due为null
  examplesOpened: boolean; //due同样需初始值
  // expression现有字段保留，追加组1新卡需要的字段；有新卡时用meaningHere
  learningCard: {
    meaningHere: string; useItWhen: string; howItFits: string;
    toneAndWho: string; watchOut: string | null;
    examples: readonly [{zh:string;en:string},{zh:string;en:string}] | null;
  } | null;
};
type PracticeAttemptResponseExtension = {
  attempt: AttemptRecorded; coaching: PracticeCoaching | null;
  roundState: RoundState; //所有首答/修订/replay均返回，UI不自己猜是否晋升
};
type ActivationResponse = PracticeTask | { redirect: `/vault/${string}` };
type NewRoundResponse = {taskId:string;roundNumber:number};
type ExamplesOpenedResponse = {examplesOpened:true};
type RemoveRestoreResponse = {taskId:string;roundState:RoundState};
type SavedPracticeState =
  | {status:'unpracticed'}
  | {status:'practicing';taskId:string;roundNumber:number}
  | {status:'removed'}
  | {status:'promoted';userExpressionId:string};
```

返回 `roundState` 的好处：UI不会从 `passed && independentUse` 猜晋升，revision通过也不会错误显示入库；coaching在刷新后来自持久记录，latestRevision与firstAnswer不会覆盖彼此。对 superseded 任务是跳最新轮还是保留历史只读，方案未定义；后端如要新增用户可见跳转应先向控制器报告。

**错误契约需同一拥有者处理**：现有 `contracts/api.ts` 是strict enum/strictObject，不接受 FIRST_ANSWER_EXISTS / ALREADY_PROMOTED 或error已有结果额外字段。建议新增明确业务码，错误payload允许 typed `details`：

```ts
{ ok:false, error:{code:'FIRST_ANSWER_EXISTS',message:string,retryable:false,
    details:{roundState:RoundState}}, requestId:string } // HTTP409
{ ok:false, error:{code:'ALREADY_PROMOTED',message:string,retryable:false,
    details:{userExpressionId:string}}, requestId:string } // HTTP409
```

其他错误保留现有码；MODEL_GATEWAY_CONFIGURATION_REQUIRED → Connect a model to continue + Set up model gateway（沿现有Settings实际路由）；PROVIDER_* → The model didn't respond. Your answer is still here + Try again。`FIRST_ANSWER_EXISTS` 直接渲染details.roundState并显示既定说明；ALREADY_PROMOTED引导详情。HTTP201/200语义依5.14，UI不能只判断201。

**examples-opened竞态契约**：点击应先发服务端记录，再揭示内容；持久化失败时不能先泄露例句再允许none提交；记录pending时阻止提交。接口按user+round/review归属鉴权，幂等写入不覆盖已存在时间。无可用网关不应阻止看已有卡片（此操作本身无模型调用）。due请求body忽略传来的assistanceLevel；idempotency key和已完成replay以服务端既有辅助状态为准，不能读客户端传值改变receipt身份。

**新轮请求**：body `{requestId}` UUID，一次按钮动作复用同一个requestId重试；服务器以receipt幂等保证并发新轮只出一个有效新round。未答open返回200原轮；已首答创建201；候选已晋升409提供id。`returnTo`属于页面导航，不给模型、不作为候选身份。

## 文件归属与并行边界

### 后端唯一拥有者先冻结，再负责全部接线

- 修改 `src/contracts/practice.ts`、`src/contracts/api.ts`、`src/features/practice/material-schema.ts`（属于共享契约；UI只消费）、`src/types/database.generated.ts`。
- 修改 `src/server/domain/create-practice-task.ts`、`src/server/repositories/attempt-repository.ts`、`src/server/domain/record-valid-attempt.ts`、`src/server/repositories/practice-material-repository.ts`、`src/server/domain/complete-due-practice.ts`、`src/server/domain/learning-config.ts`。
- 新增迁移与round/remove/restore/examples-opened路由；修改原tasks/attempts/revisions路由。due只接examples持久化/辅助推导，继续旧出题与旧任务v4，不提前造transfer-scenario或重新评分修订。
- Saved practice-state来源要经 `src/features/saved/api.ts` / candidates endpoint对应repository聚合；不要让UI逐卡N+1查库。
- 后端拥有prompt模块的import选择、version选择、options/retry接线；UI与prompt agent都不编辑上述文件。

### UI执行者（共享契约冻结后可独立）

- 修改 `src/features/practice/practice-material.tsx`、`practice-session.tsx`、`evaluation-panel.tsx`、`practice-workspace.module.css`、`api.ts`。
- 修改 `src/app/(app)/practice/[taskId]/page.tsx`；可新增 `src/features/practice/return-target.ts`（白名单）、`answer-draft.ts`（localStorage）、`answer-diff.ts`（code-point diff）及对应模块测试，具体命名可冻结。
- 修改 `src/features/practice/due-practice.tsx` 仅允许范围；共享EvaluationPanel应有first/due不同结果行和actions配置，不顺手改due队列3项上限、遮盖、换题、local revision逻辑。
- 修改 `src/features/saved/candidate-expression.tsx`、`candidate-list.tsx`、相关 Saved 样式，消费backend聚合practiceState及ActivationResponse.redirect。
- 可新增 `src/components/ui/action-controls.module.css` 或等价共享模块（不需新依赖），首次练习先完整接入；不全站重刷样式。

### Prompt执行者（可与UI独立）

- 新增 `src/server/ai/prompts/activate.v2.ts`（v3）、`evaluate.v2.ts`（v5）、`learning-intent-constants.ts`。
- 新增对应prompt test、`tests/prompt-golden/activate-practice-v3.json`（5例）、`evaluate-practice-v5.json`（6例）、`group-two.test.ts`。
- 修改 `scripts/try-prompts.ts` 与其测试，新增版本discriminated input/read/build/compare逻辑，保留组1旧case行为与 opt-in `--real --user`。
- 旧 `activate.v1.ts`/`evaluate.v1.ts`保持原builder与rubric；readable allowlist扩展需后端唯一拥有或约定prompt执行者仅修改有限allowlist（两者二选一，避免同时编辑）。新模块可以转导出共享registry，但不要破坏旧test的finite literal校验。
- `fallback-situations.ts`在确认5.3/8.7前禁止实施依赖逻辑；确认需要后由prompt拥有者起草模板并明确待产品审核，后端负责选择/持久化/失败分支。不能为不限round静默重复模板。

### 测试与文档/演示

- 独立测试agent不得与执行者相同；验收上述完成分支，运行命令/DB/浏览器；可以增补验收测试，修代码回交拥有者。
- `scripts/seed-demo.ts`、`docs/engineering/optimization-preflight.md`、`execution-ledger.md`由控制器或明确单一拥有者更新，避免三个执行者竞争；seed至少round2 promoted + entry_round2、retry_scheduled与due24h、removed、辅助刷新、修订保持排期。

## Prompt冻结细节

- 新激活systemPrompt必须等于共享prefix+空行+8.4原文。原文hash/全文锁定，JSON数据只在userPrompt，额外source/learner指令不入system。
- v5：旧24行rubric除scope指定一句替换、C1指定位置追加句外字节一致；suffix指定自然改写句后追加原文。golden测试把新旧rubric规范化回变更前比较，直接检验其他行不动，不只做contains。
- 新旧双路径都有fixture和readability测试。v5 parse忽略全5改写但不拒绝合法分数；mixed Chinese quoted English feedback、feedback别名、一位整数字符串等旧normalizer兼容继续存在，不因新增版本收窄旧输出。
- v3 task-aware校验应由prompt模块提供validator(factory/closure)给后端，避免后端复写长度逻辑；单纯wire normalizer无expression/avoid上下文不可能完成泄露/去重。
- `completeWithFormatRetries`当前为首次调用+最多3次格式重试（总4次），不是总3次；沿现成 helper 和 FORMAT_RETRY_MAX=3，勿各调用点另写不同计数。
- 评分 fixture一直返回预设4/4/4，不能证明Meaning here判错/场合评分/新话题语义。应另有可控测试gateway驱动2/5/assisted路径，golden真实试跑结果只作为人工产品审查，不用fake semantic断言偷渡验收。

## 独立测试计划（本报告尚未运行）

1. **Prompt单元/golden**：8.4原文与8.5最小diff锁定；8.3十个rule与五个description逐字；JSON新输入完全匹配、不含examples；maxTokens/timeout由service接线测试断言；合法边界120/60/10/30与超1、空字符串、无中文、任意mandatory缺失、zh/en/task泄露；avoid指纹重复拒绝；format malformed重试3与传输不被额外format重试；旧v4/v2仍构建/读取，unknown version拒绝；全5coaching null；fixture输出全通过wire+task-aware校验；round2 fixture冲突待确认后补对应测试。
2. **UI单元**：页头/labels/中英开关/About不发记录/Show examples成功后展开且refresh状态保持；接口失败不泄露；textarearestore500ms、storage异常、成功清除、目标提醒不拦截、无中文拦截、8s慢提示/网关与模型两种错误；result按promotion/assistance/score精确分支；全5无改写建议；自然版本默认隐藏/两列/插入删除替换/相同内容/emoji codepoint/最近提交文本；首答摘要、多次revision、First feedback、分数箭头；round2返回参数保持；remove timer与Undo取消导航；submit pending防重复；409恢复原结果；本地时区跨午夜；所有控件aria-expanded/focus/按钮主次/卡片底部。
3. **服务/集成/SQL**：组2轮内revision1晋升与候选全局幂等、双tab不同原答409+现存、same文本重放、首答+examples-opened竞态不可伪none；assistance body none/hint/model_answer均忽略；due例句后24h且不前进不降级；RLS跨用户读写；retryDueAt固定首次时间+24h（修订/新轮不延后）、newround继承、removed恢复原status、practicing/Saved状态聚合；backfill三种旧草稿；naturalVersion持久刷新一致。必须保留 `mastery.test.ts`、`schedule-review.test.ts`、`supabase/tests/promote_practice_attempt.sql` 原有断言。
4. **指定E2E `tests/e2e/saved-learning-loop.spec.ts`**：旧用例仍找Your Chinese response / Check my response / Show original evidence /旧返回，需按组2文案更新；从Saved学习卡到新题含returnTo，验证New、对象/场合/EN、原句不旁路、About后独立入库详情及24h；再加独立场景first fail→刷新恢复→revision成功但不入库→round2无辅助通过(entry_round2)；aux open→refresh→通过不入库；remove/Undo/Saved状态；409双标签页。第二次尝试组2只验证服务端状态与到期，不提前构造组3会话入口。
5. **指定E2E `tests/e2e/returning-learner.spec.ts`**：保留当前/practice旧due流程与队列不变，更新仅结果行与提示；独立due通过仍tried→reused / 7天、存量Saved不增加；辅助due查看examples刷新后通过不前进/1天，About不算；旧source/card学习卡可读，Progress只验原有不变量，不修改页面。不能把组4换题/遮盖/模型重评分revision放入此组验收。
6. **运行顺序**：独立测试agent先focused vitest（prompt/UI/domain/repository/integration），再SQL原有+新增、`pnpm lint`/`pnpm typecheck`/`pnpm test`/`pnpm test:provenance`/`pnpm build`；两指定E2E用 `pnpm exec playwright test --project=chromium-web tests/e2e/saved-learning-loop.spec.ts tests/e2e/returning-learner.spec.ts`。沿现有fixture provider、本地演示库隔离用户/cleanup，不对真实账户跑破坏性reset。截图桌面及窄屏检验布局。真实gateway golden是显式opt-in，输出人工检查，不凭fixture合格代替产品语义验收。

## 可执行结论

UI与prompt纯文件并行安全，前提是先冻结上述共享material/roundState/mutation/error契约，且所有service/repository/route接线后端唯一拥有。组2不得提前更改/practice首页/连续会话、Home、due出题/遮盖/换题/重评分修订、Vault或Progress。当前至少两个模板相关产品冲突待确认；可先冻结不依赖模板的契约与实施范围，不能擅自决定错误/兜底用户行为。

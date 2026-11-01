# 一期组 3 / 4 只读预检与依赖规划

日期：2026-11-01。只读基线：`/private/tmp/popcorn-phase1-confirmed-base`（父任务指定的 3a48862 archive；该目录无可解析 HEAD，因此本报告不声称在此用 Git 验证了提交号）。未将主工作区并发未提交内容当作基线。未写产品代码、未迁移、未提交、未调用真实模型、未执行初稿或二期。

已读《Popcorn 功能优化方案（执行版）》第 1/3/15/16 全文、第 5.2/5.13/5.14/5.17、第 6/7 全文、第 8.0/8.3/8.6/8.7，并补读相关 4.8/4.9、5.3/5.6–5.12。已读基线 AGENTS.md、Next 16.3.1 本地 `01-app/01-getting-started/15-route-handlers.md`、`05-server-and-client-components.md` 与 `03-api-reference/03-file-conventions/page.md`。后续路由 params/searchParams 必须 await；sessionStorage/localStorage 仅在客户端组件；认证数据不共享缓存。

## 先行结论与执行门禁

协调状态：父任务已向用户发起异步确认，等待首次失败fallback/报错、未答open首轮留在New并恢复同题、两条模板耗尽后保留状态报错+未来重试的决定；等待期间不做依赖这些决定的实施。指纹保留现有历史口径属于15.2不变量，另存去重新字段不改变mastery判定。以下建议均非已批准决策。

1. 固定顺序：组 1 在 main 验收合入 → 组 2 完整验收 → 组 3 完整验收 → 组 4 完整验收。当前报告仅预检，不授予提前实施组 3/4 的授权。
2. **8.7 fallback 是组 2 的契约与内容前置依赖，不能留到组 4 才准备。** 8.4 activation fixture 明确取 8.7 同类第一条；8.7 明确首次/到期共用并写 `scenario_source=fallback`。组 2 应冻结结构、选取、历史去重、来源标记与批准内容版本；组 4 复用。15.5 明确“兜底模板…需要产品方审核后合入”，故 8.7“标注待产品方审核后合入”和16.4 起草条款不能解释成允许未审核内容运行。
3. 存在产品可见冲突，执行前需决策，而非实现者自行兜底：
   - 5.3 写首次出题重试仍失败显示 `We couldn't prepare a situation.`，8.7 写首次失败共用 fallback。建议批准明确失败分层：何种失败可 fallback、何种无题/耗尽保留错误；批准前不得选一个默默实现。
   - 6.3 New 必须“无练习轮次”，6.5 却要求轮到时创建题目，且刷新从服务端队列继续。创建 `open round1` 后尚未作答，它不再是 New，也不是 Second try，刷新会消失。建议保留已认证的当前 item 恢复锚点，服务端验证并恢复已有 open 首轮；若改为把 open 首轮纳入 New，属于改变6.3入池规则须批准。
   - `not_expression` 仅点 Practice anyway 后入池，但该点击通常立即创建 open 首轮，与“New 无轮次”再次相交。批准明确仅即时进入练习/后续失败进入 Second try，还是另存 explicit opt-in 并允许未答首轮恢复；不要添加未定义自动 New 入口。
   - 6.9 新池“单次最多200”，6.3 New“不设上限”、6.4 完整列表。可用分页/游标按200一批获得完整列表与下一项，summary 用独立完整 count，不可把200当产品总上限；分页属保持原行为的工程实现。
   - 每意图2条模板且避开全历史重复，第三次同类 fallback 可能耗尽。需批准耗尽显示重试/换模型/扩大审核库等策略；不得回用重复题或无批准生成任意模板。
   - owned 对外分类 maintain 与 prompt near/far：8.6 明确模型仅收到 near/far。建议冻结 `transferType=near/far` 为实际迁移方向，若需 maintain 另做程序模式标记；7.6 枚举有 maintain，而7.2又要求owned交替，需要接口决策留痕。

## 6.11 逐项核对

| 核对项 | 结论与基线证据 | 对组3的影响 |
| --- | --- | --- |
| 学习卡存储/标识、新池高效查询 | 已确认卡片存 `generated_artifacts.content.candidates`（artifact_type=saved_item_analysis），带 highlightStates；`create-practice-task.ts:268–277` 以 `savedItemId + candidateArtifactId + candidateIndex` 精确读取。`:301–315` 新 v3 以 savedItemId + highlightKey 得到保留标注的稳定练习身份；artifact 会随增量 Analyze 改变，不能拿 artifact/index 作唯一长久业务身份。`marked-learning-cards.ts:20/37` 同时有 highlightId/highlightKey。组1新字段落在 expression_senses（迁移202611010020:228–233）仅代表已晋升，不能作 New 池。 | 新仓储应展开每个保存的有效聚合产物，按有效 highlightKey 去重、剔除失效标注/旧聚合版本、关联组2候选身份与任意历史轮次及removed状态。不能把所有artifact的所有candidate直接拼接。SQL视图/函数 security invoker 或显式owner约束+RLS；分页单批200；count与列表用相同谓词。具体“有效聚合产物”的选法须在组1最终验收快照再核。 |
| listDue 100上限的计数 | `review-task-repository.ts:334–349` pending/due_at查询 `.limit(100)`，相关expression/sense也100；`due-practice.tsx:75–76` 再取前3。现Home的 `saved/api.ts:587–596` 已用exact head count查询到期总量，不能误称Home也按100截断。 | 复用/抽出已有exact计数模式，today三个count独立完整计数，estimatedMinutes=(d+s+n)*2。列表分页，next在全量候选中排序并排除，不能从已截断100项数组找下一项；保留旧due接口兼容。nextPracticeAt从未来pending复习与retry_due_at取最早可用值。 |
| 首次组件会话复用 | `practice-session.tsx:14–20` 仅material、savedReturnTarget；`:77–79` 硬编码跳/practice；`:126–135` EvaluationPanel同时绑定Continue/Stop。`due-practice.tsx:79–98` 同时承担列表/队列/题目/本地修订，内存状态，不能直接嵌入通用会话。 | 基线不可直接复用；组2必须交付可注入navigation/action slot与完成/移除事件的首次练习组件。组3只组装会话，不重新实现评分/修订/辅助业务。Review先抽出单项组件，组4再增强出题/reveal等。组2最终形状需在其验收后再次核对。 |

## 组 3 具体边界与依赖

### 串行先冻结

1. 组2最终 CandidateKey、roundState、5态转换、同候选最多一个open/retry_scheduled、retry_due_at继承、移除/撤销、晋升回执与already promoted返回、examples-opened以及returnTo白名单。
2. `TodayItem`稳定排除标识。建议`review:{reviewTaskId}`、`candidate:{稳定CandidateKey}`，New→Second try/换轮时仍是同一候选项，不以taskId或roundId作为会话完成身份；此标识应是可验证的结构而非任意前端字符串。
3. `onCompleted`只在服务端确认首次回答已落盘/复习已完成后发布一次；包含结果标签、前后掌握度、promotion、nextDueAt与稳定itemId；修订/换题不能重复算“完成一项”。Remove事件另带Removed结果，Undo不能被新runner破坏。会话中移除直接下一项与组2五秒Undo要协调保留toast及恢复语义。
4. session模式必须只有一个Next/Finish主按钮。Try a new situation降为保留的辅助行动；不能保留组2同卡两个主按钮。更换轮次仍是同一候选item，left不变。
5. `Next`执行时服务端重新查询。服务端pending/due状态为权威；sessionStorage仅存小结结果与恢复提示，不能让客户端排除列表绕过权限或改变掌握度。若当前完成后用户选择换轮，先前统计项如何更新为当前最终结果必须固定，避免重复入小结。

### 文件/接口清单

| 边界 | 文件与职责 |
| --- | --- |
| 今日契约与队列 | 新 `src/contracts/today-practice.ts`（建议名）定义summary/items/next；新 `src/server/domain/build-today-queue.ts` 合并Review→Second try→New、稳定排序/排除，不调用模型；新 `src/server/repositories/today-practice-repository.ts` 或独立new-expression-repository，负责SQL/分页/count。修改review-task-repository，保持due兼容。新增migration视图/函数、索引与RLS测试，重生成database.generated。 |
| Today HTTP | 新 `src/app/api/v1/practice/today/route.ts` 和 `today/next/route.ts`。GET认证/no-store。today输出6.9全字段；next解析有界exclude列表并归属校验，返回kind+身份+taskId/reviewTaskId或New候选selection，不预生成整队。进入New调用已批准组2POST /tasks；到期Second try若仍retry_scheduled需通过组2开轮接口获得新题，若已open round≥2则复用。 |
| 首页与连续会话 | 改 `src/app/(app)/practice/page.tsx`；新 `src/app/(app)/practice/session/page.tsx`；新 `today-practice.tsx`、`today-session.tsx`、`practice-summary.tsx`（建议名）。拆 `due-practice.tsx` 为单项Review部件；复用组2PracticeSession。sessionStorage读写try/catch、用户隔离/version、刷新/结束清理，小结只展示，不可信任其业务状态。 |
| Home | `home-view.ts` 删除unsortedSaveCount/due-only语义，改summary+recentVideos；`home-runtime.ts`共享today summary和最近3视频；`next-action.tsx`按网关→today→needsAnalysis→YouTube；`home-dashboard.tsx`主按钮/三格说明/灰零/分组锚点/本地日期；沿用mastery snapshot。 |
| Saved筛选 | `src/features/saved/api.ts` home count迁到summary，新增可练/待分析聚合；`saved-library.tsx`读取白名单needs-analysis参数；对应Saved page searchParams await；有标注未分析按有效active marks与当前analysis状态判定，不能简单ready/failed作近似。 |

可在冻结后并行：A队列仓储/SQL+API（独占migration/generated）；BHome+Saved筛选（独占saved/api.ts）；C首页/runner/小结（独占practice组件及CSS）；D独立验收。共享contract、practice-session、evaluation-panel、practice-material、同一CSS必须单一owner/串行整合，不能多个分支同时改。

## 7.8 逐项核对

| 核对项 | 结论与证据 | 影响 |
| --- | --- | --- |
| 到期任务表与评分情境 | 任务在 `practice_tasks`，kind=due_practice，review_task_id关联review_tasks。`202608160014_due_practice_completion.sql:6–8/64–79`有context_fingerprint、owner FK、每review一task唯一。`complete-due-practice.ts:372–381`读取prompt_chinese/instructions_english/goal_english；`:526–564`打开时ensure同步构建并插入，race时重读。`practice-material-repository.ts:281–309`同表读取。首次未晋升情境在practice_drafts。 | 不另造无必要transfer表。新增7.6字段需同时覆盖task schema、material schema、repository、completion evaluator、UI，不得题面显示新情境而评分读旧字段。当前unique review task适合“同一行原子替换未答题”策略；regen若另建一行需调整unique与completion引用，必须先冻结。 |
| 事务后入队、lease/重试 | `record-valid-attempt.ts:73–79/89–107`等待晋升RPC回执并拿reviewTaskId；`complete-due-practice.ts:565–580`等待completion RPC拿nextReviewTaskId，现均无prepare入队。`process-jobs.ts:45–110`store已按owner+expected lease写入；`:120–152`handler map可扩。SQL claim202608160005:19–42用skip locked、5分钟lease、最多5次；`lease-job.ts:5–8`同规则。 | 可在RPC成功返回后幂等enqueue，不把模型调用放数据库事务内。仅“RPC后await enqueue”仍有commit后崩溃丢任务窗口，打开同步恢复可兜底；若要求可靠提前生成，建议事务中写outbox/入队记录（worker仅commit后可见），然后事务外执行，不改变“模型事务外”原则，需在方案记录解释。job dedupe按owner+reviewTaskId+scenario revision+prompt版本，旧lease不能覆盖新regen或已提交task。新增prepare类型需同时更新contracts、DB check、process handler、lease-job JOB_TYPES allowlist。已有job模型强依赖video_source_id/saved_item_id，应核对review-only payload是否能复用，不能虚构source或扩做来源删除二期。 |
| 指纹输入 | `create-transfer-task.ts:20–41/88–103`SHA256对目标表达+中文情境+固定instruction+goal做length-prefix；SQL202608160014:10–53同算法/trigger。`:281–299` count distinct task.context_fingerprint直接决定owned场景阈值。 | 不可简单“新字段全部纳入并回填hash”，因为会改变掌握度证据。建议保留mastery context hash口径，另外定义统一scenarioFingerprint用于出题去重（normalize中文情境，不让翻译、对象标签、taskEn改动给同题另算新题），TS/SQL一致。若要替换现context口径须15.5产品批准+历史回填论证。 |
| 首次各轮原文 | `complete-due-practice.ts:532–545`当前只拿最早已晋升use_it_now题及历次due题，不含失败的practice_drafts。`create-practice-task.ts:301–315`已有highlightKey稳定身份；旧draft有future_user_expression_id。 | 组2必须给出所有轮次→稳定候选/最终userExpression的可靠关联。组4查同owner全部practice_drafts（含superseded/removed历史）+该userExpression所有due原文，按稳定身份去重，避免把晋升拷贝重复计入，也避免丢失败轮。每道新题前读最新历史，保存时再次检查并发唯一；regen被替换旧题也需留历史，否则可重复。 |

## 组 4 具体边界与依赖

串行先冻结：组2评分v5输入/提示和例句记录、组3单项Review runner与完成事件、统一情境schema/稳定候选、fingerprint双用途决定、fallback已批准版本、owned near/far持久化、regen原子存储与旧题历史。

1. **出题域**：重构 `src/server/domain/create-transfer-task.ts`，移除四种高价模板，改共享approved fallback selector；新 `src/server/ai/prompts/transfer-scenario.v1.ts` 使用8.6原文、400 tokens/20000ms；复用8.3常量和组1format retry。程序选择targetFunction/targetSetting与near/far（owned交替），传全部previousSituations；不传例句/来源原句。落盘scenario_source、prompt provenance和实际target字段。
2. **预生成/同步竞态**：新增 `src/server/jobs/handlers/prepare-transfer-task.ts`，process-jobs注册；新增幂等enqueue/publication RPC（建议）；晋升/完成后入队。worker和GET ensure走同一个协调服务；任务已备好不触发模型。锁只用于短claim/发布，不能持数据库行锁跨网络模型调用。发布需owner+pending review+预期scenario revision+lease fence校验，GET同步与worker只有一个获胜，败者重读已持久化题。
3. **换题**：新增 `/due/[reviewTaskId]/regenerate/route.ts`；提交前一次、第二次409 REGENERATE_USED、提交后409 ALREADY_SUBMITTED，服务端执行；并发两个标签页只能一次成功，失败生成是否消耗次数必须产品/契约明确（建议成功发布才消耗，不给网络失败罚次数）。异步过期任务不得覆盖regen。保存此前题原文便于去重。仅禁前端按钮不足以保证约束。
4. **Reveal**：新增 `/reveal-expression/route.ts`，原子设置首次expression_revealed_at，重复请求幂等。只展示表达不影响assistanceLevel；Show examples还必须服务端写examples_opened_at并同时显示表达。`About this expression`内出现的目标词程序遮盖；不能只遮页头。渲染传入的原文不能直接泄漏在可见label/title/aria文案。与本地暂存“不含表达提醒”协调，避免提醒行提前泄漏目标词。5.7该提醒与7.3遮盖是交互冲突，应批准遮盖时隐藏提醒中的词或仅用泛化提醒。
5. **修订**：新增 `/revisions/route.ts`及独立review revision service/repository；组2v5评估入参完整读取原题。新增review_revisions启用RLS，只写此表；绑定本人review_task_id/attempt_id与已完成正式原答，禁止调用complete_due_practice、晋升、scheduleReview或写attempts/mastery_events；每次修订可学习，原结果与nextDueAt不可变。需幂等requestId/键，重复请求不得多次收费/落重复评分。
6. **共享对比**：组2已要求逐字比对并排组件；应组2先建立纯展示 `answer-comparison.tsx`（建议名）及纯diff工具，组4复用，而非组4第二套。`evaluation-panel.tsx`保留first/latest分数差与折叠feedback；diff不调用模型、不改变辅助等级。组3runner继续控制Next/Finish，单项Review控制Revise，不把navigation写回due域。
7. **持久化/接口**：修改 `practice-material-repository.ts`、`complete-due-practice.ts`与due route，扩material/contracts；GET新增situationEn/interlocutor/taskEn/targetSetting/transferType/canRegenerate/expressionRevealed。组2已实现examples-opened和服务端assistance，组4只复用。migration新增字段/RLS/revisions/prepare支持/发布与regen RPC/索引；不编辑历史migration。所有接口认证及owner检查；新表加SQL隔离测试。

冻结后可并行：A出题prompt/validator/fallback selector（不得改审核文案）；Bjob+enqueue+lease发布（单owner migration/generated）；CReview UI/reveal/regen接线（独占due-practice和material）；D修订service+表/RLS测试（migration分工先约定，由A或B统一落迁移）；E共享diff纯展示测试可独立，但若组2已交付只验收/复用。`complete-due-practice.ts`、practice-material-repository和process-jobs不得并行多人修改；由集成owner串行接线。

## 验收矩阵与种子数据

所有矩阵为未来应执行的验收，不代表当前通过。本轮只读未跑测试。

### 组3

- 数据基准2 due +1 due Second try+3 New=6项/12min；同类due升序、New保存时间降序、Review→Second→New；Home与Practice解释文案完全一致。
- count用101+review、201+new验证不截断；Show all10展开完整；next可走到全部剩余项；未来retry不入池、逾期保留，removed/superseded/promoted剔除；not_expression opt-in按批准行为。
- start连续完成/最后Finish/清空All done；中途Exit首页小结；再次Start只剩余；刷新当前open首轮、open second round、已完成feedback分别验证；sessionStorage禁用/损坏不阻塞业务。
- 换轮left不变、修订不多算、remove马上前进且Undo保留正确效果；并发标签页已晋升/已移除/已完成时服务端重新计算；单项返回/practice。
- Home gateway优先、只有new也可Start、needs analysis、processing secondary、三格含零、最近3视频、本地日期；空队列nextPracticeAt正确。
- 测试更新：due-practice.test.tsx、practice-session.test.tsx、home-dashboard.test.tsx、home-runtime.test.ts、队列domain/repository/HTTP integration、SQL视图owner/RLS，e2e saved-learning-loop及returning-learner；pnpm lint/typecheck/test/db:test/相关e2e/build。seed-demo在组2状态上新增“同一用户同时三类”以及未到期/移除/未答首轮边界，不丢组1/2演示状态。

### 组4

- 种子加入tried near、reused far、owned交替、默认遮盖/已reveal、已看例句、未换/已换/已提交、model题/approved fallback题、已备好/未备好、revision与immutable正式completion。
- 3意图各3题，不含目标词、中文自然、意图/场合匹配、指纹互异；previousSituations包括失败首轮/后续轮/所有due/被regen替换题。
- 预生成已备好GET零模型调用；无准备GET同步、8秒提示、超时/不合规最多3格式重试、approved fallback选择/来源标记/耗尽按批准策略；worker过期lease/重复投递/GET并发/regen后旧worker不覆盖。
- reveal不影响独立；examples→model_answer刷新持久；遮盖包括About/提醒；regen仅一次、并发唯一、提交后409、仍独立；review revision评分写专表、first/latest对比正确，原mastery/due/attempt/evidence完全不变。
- 共享自然改写对比中首次与到期都逐字diff，零模型调用；三项全5无改写；Next/Finish与单项返回正确、本地日期。
- 测试：complete-due-practice.test.ts、due_practice_completion.sql、due-practice.test.tsx、transfer prompt golden/fixture/domain、job lease/race/regen/revision路由与SQL隔离，现mastery/schedule/promote原有用例继续通过；e2e两主链更新通过。

## 内容审核：20模板与20生成题

- 20模板不是20真实模型题。前者为10意图×2手工拟定共享fallback内容，结构含zh/en/interlocutor/taskEn/setting，须单独审核意图、自然性、场合、英译、无目标词/无答案暗示、去重以及other适用边界。文件可先放 `docs/engineering/fallback-situations-review.md` 并清楚标注待产品审核；在批准前不得加入运行时fallback、fixture或seed内容。当组2依赖fixture时，须提前完成这一审批，不可把后端“结构已准备”当作功能验收通过。
- 20生成题应来自已配置真实网关的actual run，不能用fixture或手写冒充。建议人工表列prompt/model/version、输入表达/meaning/function/setting/near-far/history、完整输出、自动约束结果、人工意图与场合匹配、中文自然、备注/批准人/日期。20题至少17题同时满足两个人工标准才≥85%；明确分母20，失败/重试筛选透明，不只挑最好20题。跑题分布应覆盖10意图、near/far、formal_writing/online等场合与不同掌握度。
- 当前任务未获准调用真实模型，因此本报告未起草真实题、未伪造85%通过率。组4可准备空白review表与执行说明；按16.4人工评审可以在产品审核后补勾，但15.5要求审核后合入，因此未批准前该组合入门禁未通过，不得开始后续阶段或宣称整组完成。
- 审核结论应绑定具体内容版本/文件hash；修改模板后重新批准，不能“批准过模板方案”等同于批准全部后来内容。产品批准内容且解决5.3/8.7冲突后，组2与组4分别接入共用同一批准版本。

## 每组交付记录

各组落地时更新docs/engineering/optimization-preflight.md、execution-ledger.md、scripts/seed-demo.ts；PR逐条勾5.17/6.12/7.9并附测试名/截图；Prompt若偏离原文需列原文/新文/原因获确认。保持passed/independentUse程序推导、1/7/30与owned阈值、事务原子与回执幂等、RLS/认证、作答不日志记录不变量。所有初稿/二期内容只保留边界说明，不实施来源删除后继续复习、扩展横幅、Vault/Progress旅程。

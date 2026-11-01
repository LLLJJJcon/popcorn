# Confirmed group 2–4 source excerpt

Source: user-provided execution specification, copied 2026-11-01. This is reference material within the user-authorized scope; execute only the current group after prerequisite acceptance. Draft/phase-2 text is absent. The three approved decisions in the plan override identified ambiguities. Template content and later human question review have explicit approval gates.

## 1 方案摘要

本方案把 Popcorn 从“主成功链路能走通”升级为“每个用户、每种结果都有下一步”的学习闭环，分两期交付：一期做核心闭环与亮点，二期做回流与可见的进步。方案与产品方逐组对齐，标注“已确认”的章节为定稿，可直接执行；尚未对齐的章节为初稿，执行前会按对齐结论重写。

**产品成功的定义**：用户在视频里遇到想学的表达后，能在间隔之后的新情境中独立用出来。所有设计取舍以此为准。本项目为自用，不做埋点和使用量分析，各章节以“验收标准”代替指标。

**分期与对齐进度**

| 组 | 期 | 主题 | 章节 | 状态 |
| --- | --- | --- | --- | --- |
| 1 | 一期 | 保存后的表达标注、Analyze 与学习卡 | 第 4 节 | 已确认 |
| 2 | 一期 | 首次练习：情境、题面、提示、评分、失败出路、刷新恢复 | 第 5 节 | 已确认 |
| 3 | 一期 | 今日学习会话与 Home 主行动 | 第 6 节 | 已确认 |
| 4 | 一期 | 到期复习：按意图与场合出题、换情境、反馈与排程展示 | 第 7 节 | 已确认 |
| 5 | 二期 | 扩展回流：到期横幅、已学表达重逢高亮 | 初稿见 P1-G | 待对齐 |
| 6 | 二期 | Vault 与 Progress：表达旅程、努力与证据分层、删除来源后继续复习 | 初稿见 P1-H、P0-D | 待对齐 |

统一报错与等待体验（初稿 P1-I）不单独成组，按需并入各组新流程。

**给执行 agent 的阅读顺序**：先读第 2、3 节理解为什么改；再读第 15 节执行规范；然后只执行状态为“已确认”的章节。

## 3 优化总览与优先级

本次只交付一期和二期。一期让“看到 → 选中 → 练习 → 失败有出路 → 入库 → 合适的复习”整条闭环完整、好用；二期在此基础上做回流和可见的进步。原初稿中的埋点（P1-K）和全部 P2 项已移出本次范围。

| 期 | 包含 | 交付后用户能感受到什么 |
| --- | --- | --- |
| 一期 | 组 1 表达标注与学习卡；组 2 首次练习；组 3 今日学习会话；组 4 到期复习 | 保存的句子里已标好值得学的表达，可自己增删；每个表达有一张讲清“何时用、怎么用、和普通说法差在哪”的学习卡；答错有出路；打开网站就知道今天练什么；复习题与表达的意图和场合匹配 |
| 二期 | 组 5 扩展回流；组 6 Vault 与 Progress | 在 YouTube 侧栏被提醒回来练习，并在新视频里认出学过的表达；能看到每个表达是怎么一步步学会的 |

**排序理由**：一期的每一项都会让用户“做对了事却没有得到结果”或“不知道下一步做什么”，直接决定闭环是否成立；二期的回流和呈现只有在闭环成立后才有意义。

&#91;embedded content: 改造后的学习闭环 · 高亮为新增或改造节点\]

改造前，首次未合格的人停在草稿里、收藏停在视频详情里、Vault 与观看互不相通；改造后，未合格走“换新情境 / 明天再试”回到会话，入库与到期结果都回流到会话，扩展把用户从 Vault 带回观看。

### 4.7 学习卡（第一层：给学习者看）

**字段规格**（文字字段全部英文，可内嵌中文；每项要求清晰简洁、把话说明白）

| 字段（键名） | 内容要求 | 长度 | 必填 | 展示 |
| --- | --- | --- | --- | --- |
| Meaning here（`meaningHere`） | 在原语境中的意思，不写泛泛的词典义 | ≤40 词 | 是 | 默认 |
| Use it when（`useItWhen`） | 什么交际场合、出于什么意图会用 | ≤40 词 | 是 | 默认 |
| Compared with（`comparedWith`） | 给出一个普通说法，并说明两者差别 | ≤40 词 | 是 | 默认 |
| Examples（`examples`） | 2 个例句，每个含 `zh` 与 `en` | `zh` ≤30 字；`en` ≤40 词 | 是 | 默认 |
| How it fits（`howItFits`） | 原文形式如何接进句子；只解释原形，不推广句型 | ≤40 词 | 是 | More |
| Tone & who（`toneAndWho`） | 语气，以及适合对谁、在什么场合说 | ≤40 词 | 是 | More |
| Watch out（`watchOut`） | 常见误用；没有就返回 null | ≤40 词 | 否 | More |

**例句规则**：两句分别在不同的日常场景，不同于原视频话题，彼此不重复；必须包含与标注逐字相同的表达（程序子串校验）；语气和场合与 Tone & who、`usageSettings` 一致。

**校验与兜底**：任一必填文字字段缺失或超长，或例句不含该表达，均为卡片级不合规，触发重试。重试用完后，若仅例句不合格、其余合格，卡片照常生成，例句区显示 `Examples unavailable`；其他必填字段不合格则该卡失败（4.6 部分成功）。

**卡片布局**

1. 标题：表达本身 + 来源时间点链接。
2. 标签行：`Used to: {functionCategories}`、`Good for: {usageSettings}`（4.8）。
3. 默认区：Meaning here、Use it when、Compared with、Examples。
4. `More` 折叠区：How it fits、Tone & who、Watch out。
5. 按钮：`Practice this expression`；`not_expression` 时显示原因与 `Practice anyway`（4.8）。

**示例**（“高得要命”，原视频在谈房价）

- Meaning here: Ridiculously high — the speaker is complaining the price is way too much.
- Use it when: You want to complain that something is excessive and exaggerate a little to show how annoyed you are.
- Compared with: 很高 just states that something is high; 高得要命 adds exaggeration and shows you're unhappy about it.
- Examples:
  - 这家店的咖啡高得要命，我还是自己做吧。 — Coffee here is crazy expensive; I'll just make my own.
  - 今天气温高得要命，根本不想出门。 — It's unbearably hot today; I don't want to go out at all.
- How it fits: Comes right after an adjective, joined by 得, usually at the end of the clause.
- Tone & who: Casual and exaggerated; natural with friends and family, too strong for formal writing.
- Watch out: Usually negative — don't use it to praise something.

### 4.8 系统字段（第二层：驱动出题、评分与筛选）

由 Analyze 一并输出，不直接作为正文展示。枚举值不合法时丢弃该值，不触发重试。

**`functionCategories`：交际意图，1–2 个，按主次排序**（全部不合法时记为 `["other"]`）

| 值 | 界面标签 | 出题规则：情境必须…… |
| --- | --- | --- |
| `emphasize` | Emphasize | 有一件程度明显超常的事，需要强调 |
| `complain` | Complain | 有一件令人不满或吃亏的事，需要表达不满 |
| `praise` | Praise | 有值得称赞或认可的人和事 |
| `react` | React | 发生意外、惊喜或令人震惊的事，需要即时反应 |
| `explain_sum_up` | Explain · Sum up | 对方没听懂，或讨论需要收尾总结 |
| `concede_contrast` | Concede · Contrast | 需要先认可对方一点，再提出不同看法 |
| `suggest` | Suggest | 对方需要建议，或需要被说服 |
| `connect_ideas` | Connect ideas | 一段叙述需要承接、转折或递进 |
| `describe` | Describe | 需要描述人、物或经过 |
| `other` | Other | 只按 Use it when 出题 |

**`usageSettings`：在哪些场合说这句话自然，1–3 个**（全部不合法时为空，出题按 `casual_chat` 处理，卡片不显示该标签）

| 值 | 界面标签 | 具体指什么 |
| --- | --- | --- |
| `casual_chat` | Casual chat | 和朋友、家人闲聊，发私聊消息 |
| `daily_errands` | Daily errands | 购物、点餐、打车、办事时和店员或服务人员说话 |
| `work_school` | Work & school | 和同事、上级、老师、同学交流，开会，上课 |
| `formal_writing` | Formal writing & speeches | 正式邮件、报告、演讲、公告 |
| `online_social` | Online posts | 发朋友圈、评论、群聊、弹幕 |

**`suitability`：两档**

| 值 | 含义 | 表现 |
| --- | --- | --- |
| `expression` | 值得练的表达 | 正常展示 |
| `not_expression` | 人名、地名、基础词或只在本视频有意义的内容 | 卡片显示模型给出的原因 `notExpressionReasonEn`（≤40 词，此时必填），按钮为 `Practice anyway`；不自动进入今日学习会话 |

### 4.9 与下游环节的衔接

| 环节 | 用法 | 归属 |
| --- | --- | --- |
| 练习页 `Need a hint?` | 展示 How it fits、Tone & who、Watch out 和两个例句；打开即记为有辅助（规则不变） | 已确认，实现随组 2 |
| 首次练习出题 | 按 `functionCategories[0]` 的出题规则和 `usageSettings[0]` 的场合出题；不向模型传例句 | 已确认，实现随组 2 |
| 到期复习出题 | 近迁移：主意图 + 第一个场合；远迁移：有次意图则用次意图，否则主意图；有其他场合则换场合，否则换话题和对话对象。每道题记录 `targetFunction` 与 `targetSetting` | 已确认，实现随组 4 |
| 评分 | 传入 `targetFunction`、`targetSetting`、Use it when、Tone & who、Watch out；Context fit 只判断是否完成 `targetFunction` 的交际行为；Context fit 的 3、4 分档判断说法是否适合 `targetSetting`，不适合时在反馈中指出 | 已确认，实现随组 2、组 4 |
| 今日学习会话 | `expression` 且未练的卡片进入“新表达”通道；`not_expression` 仅在用户点 `Practice anyway` 后进入练习 | 细则随组 3 |
| Vault | 按 `functionCategories`（任一命中）与 `usageSettings` 筛选；列表显示 `Used to:`、`Good for:` 标签；旧记录无此字段，归入 `Uncategorized` | 细则随组 6 |

## 5 一期 · 组 2：首次练习（已确认）

首次练习页按“出一道真正需要这种交际意图的题 → 用户先自己写 → 需要时看用法或例句 → 得到具体反馈 → 入库或有明确的下一步”重做。核心改动有三个：未入库不再是死路（默认自动排入明天的第二次尝试，也可立刻换新情境）；“了解用法”与“看示范”分开，只有看例句算有辅助；页面按钮与返回逻辑重新整理。评分 rubric 主体保留。

### 5.1 现有实现的不足

依据：`src/server/ai/prompts/activate.v1.ts`、`src/server/ai/prompts/evaluate.v1.ts`、`src/server/domain/create-practice-task.ts`、`src/features/practice/practice-material.tsx`、`src/features/practice/practice-session.tsx`、`src/features/practice/evaluation-panel.tsx`、`src/features/practice/practice-workspace.module.css`、`src/app/(app)/practice/[taskId]/page.tsx`、`src/contracts/practice.ts`。

| # | 现状 | 问题 |
| --- | --- | --- |
| B1 | 出题 prompt 只要求“一句以问号结尾的中文情境”；作答要求与目标是两句写死的通用英文 | 题目不保证需要该交际意图；没有对话对象、场合与英文对照 |
| B2 | 页头显示 `Current mastery: tried`，此时尚未入库 | 误导用户 |
| B3 | 来源卡 `Show original evidence` 可直接看到原句，不算辅助 | 与“看例句算辅助”不一致 |
| B4 | 提示面板是一个整体：英文解释 + Function / Tone / Register 抽象标签；一打开就算辅助 | 内容抽象；看一眼用法说明也失去入库资格，用户不敢求助 |
| B5 | 是否用过提示只存在前端状态，由前端随提交传给服务端 | 刷新即丢失记录 |
| B6 | 未提交文字只在页面状态中 | 刷新即丢 |
| B7 | 评分只接收目标表达、情境、回答，且 rubric 要求“从情境推断目标义、不假设原文义” | 用成别的意思也可能高分 |
| B8 | 通过即显示 `Strong start`，即使用过提示未入库；下方又写 `not added … independent evidence` | 自相矛盾，未说明原因与下一步 |
| B9 | 自然改写与 “修改再查” 同时出现 | 用户直接抄改写，修订失去意义 |
| B10 | 三项满分仍提示 `Rewrite your sentence once…` | 多余 |
| B11 | 下次到期日期按 UTC 显示（`formatDueDate` 写死 `timeZone: "UTC"`） | 与用户本地日期不一致 |
| B12 | 修订后新反馈直接替换旧反馈 | 看不到改了什么、改好了多少 |
| B13 | 只有首轮原答能入库；再点 Practice 复用原草稿 | 首次未入库即永久卡住 |
| B14 | `Stop for now` 在表单与反馈中各出现一次；`Continue` 与 `Stop for now` 都跳 `/practice`；`returnTo` 只认 Saved 详情 | 重复、无意义，且无法回到真实来源页 |
| B15 | `Open in Vault` 是反馈卡外的一行文字链接，进入 Vault 列表而非详情 | 不对齐，跳转不准 |
| B16 | `Need a hint?`、`Show original evidence` 为透明无边框按钮 | 看起来是普通文字，没有可点击的视觉提示 |

### 5.2 学习链路与入库规则

&#91;embedded content: 首次练习进入 Vault 的流程\]

**入库判定**（程序判定，规则不变）：本轮的首次回答三项均 ≥3，且本轮未看例句。

**轮次**

- 每一轮是一道新情境题，各有一次“首次回答”机会；任一轮的首次回答满足判定即入库为 `tried`，24 小时后首次到期。
- 立刻换新情境答对也可直接入库。理由：`tried` 只代表“至少独立用出过一次”，更高的 `reused` 仍须通过间隔至少 24 小时的到期复习。正式作答记录 `entry_round`（第几轮入库），供日后回看。
- 轮次不设上限。

**未入库时**

| 用户行为 | 结果 |
| --- | --- |
| 不做任何选择：点页头返回、关闭页面、在今日学习会话进入下一项 | 默认：24 小时后作为 `Second try` 进入今日学习会话；进入时出一道新情境题 |
| `Try a new situation` | 立即开新一轮 |
| `Revise this answer` | 本轮修订，只重新评分，不入库；不影响默认排期 |
| `Remove from practice` | 移出练习队列，不再自动出现；5 秒内可 `Undo` |

- 第二次尝试到期未做时，与到期复习一样逾期保留，直到完成或被移出。
- 被移出的表达在 Saved 学习卡上显示 `Removed from practice`，`Practice` 按钮仍可用，点击即开新一轮并回到队列。
- 用户可找到“练习中”表达的入口：Home 主行动计数、今日学习会话 `Second try` 标签、Saved 学习卡状态 `Practicing · Not in Vault yet` + `Continue`（直接开新一轮或进入未作答的最新一轮），二期的扩展到期横幅。

**“有辅助”的定义与影响**（首次练习与到期复习通用）

- 只有点 `Show examples`（两个例句 + 原句）算有辅助，记为 `model_answer`；`About this expression`（How it fits、Tone & who、Watch out）随时可看，不算辅助。

| 场景 | 有辅助时 |
| --- | --- |
| 首次练习 | 本轮即使通过也不入库，走“未入库”路径 |
| 到期复习 | 作答照常记录；掌握度不前进也不降级；下次间隔 1 天 |
| Progress | 不计入 `Unassisted reuse`，不计入 owned 的独立证据 |
| 不受影响 | 评分、反馈、修订照常 |

&#91;embedded content: 到期复习与掌握度循环\]

“掌握度按规则前进”沿用现有规则：tried 成功一次升为 reused（7 天后到期）；reused 再次成功且累计独立合格证据覆盖至少 2 种情境、至少 2 个日期并包含到期复习时升为 owned（30 天后到期），否则保持 reused（7 天）；owned 保持 owned（30 天）。

### 5.3 出题（`activate.v2`）

- **输入**：表达、Meaning here、Use it when、Tone & who、`functionCategories[0]` 及其出题规则（4.8）、`usageSettings[0]`、原句（仅用于要求避开相同话题）。不传例句。新一轮额外传入本表达此前各轮的情境原文，要求不同。
- **输出**

| 字段 | 内容 | 限制 |
| --- | --- | --- |
| `situationZh` | 中文情境，1–3 句 | ≤120 字，不含目标表达 |
| `situationEn` | 情境的英文对照 | ≤60 词，不含目标表达 |
| `interlocutor` | 对话对象，如“同事” | ≤10 字 |
| `taskEn` | 本题具体要求，如 `Reply to your coworker and complain about how expensive the lunch is.` | ≤30 词，不写出目标表达 |

- **校验**：中英文均不含目标表达；长度合规；新一轮的情境指纹不同于此前各轮。不合规时立即重试，最多 3 次（`completeWithFormatRetries`）。仍失败时显示 `We couldn't prepare a situation.` + `Try again`。
- 题目记录 `targetFunction`、`targetSetting`，供评分使用。

### 5.4 页面元素取舍

| 区域 | 元素 | 处理 | 说明 |
| --- | --- | --- | --- |
| 页头 | `Back to this Saved moment` | 优化 | 改为固定的返回入口 `← Back to {来源}`（5.11） |
| 页头 | `Focused Mandarin practice` 小标题 | 删除 | 无信息量 |
| 页头 | `Current mastery: tried` | 优化 | 改为阶段标签 `New · Not in your Vault yet`；第 2 轮起加 `Round {n}` |
| 情境卡 | 写死的英文要求和目标 | 删除 | 由 `taskEn` 替代 |
| 情境卡 | 对象与场合标签、`Show in English` 开关 | 新增 | 5.5 |
| 来源卡 | 视频标题与时间点链接 | 保留 | 加外链图标 |
| 来源卡 | `Show original evidence` | 删除 | 原句移入 `Show examples` |
| 作答区 | `Need a hint?` | 优化 | 拆为 `About this expression` 与 `Show examples`（5.6） |
| 作答区 | 表单内 `Stop for now` | 删除 | 统一用页头返回 |
| 作答区 | 未包含目标表达的提醒 | 新增 | 5.7 |
| 反馈卡 | `Keep practising – N areas need work`、`Strong start`、`Practice recorded` 区块 | 删除 | 合并为一行结果（5.9） |
| 反馈卡 | 三个维度、`Focus first` | 保留 | 满分时 `Nothing to fix.` |
| 反馈卡 | 自然改写 | 优化 | 默认收起 `Show a natural version` |
| 反馈卡 | 修订前后对比 | 新增 | 5.10 |
| 反馈卡 | `Continue`、反馈内 `Stop for now` | 删除 | 会话内的下一项由组 3 定义 |
| 反馈卡 | `Open in Vault` | 优化 | 移入按钮区作主按钮，打开表达详情 |
| 反馈卡 | `Try a new situation`、`Remove from practice` | 新增 | 5.9 |

### 5.5 题面

1. **页头**：左上角返回入口；表达本身 + Meaning here；右侧阶段标签 `New · Not in your Vault yet`（第 2 轮起前缀 `Round {n} ·`）。
2. **情境卡**
   - 标签行：`You're talking to: {interlocutor} · {场合标签}`。
   - 中文情境 `situationZh`。
   - 分段开关 `中文 / EN`，切到 EN 时在中文下方显示 `situationEn`；不算辅助；开关状态在本页会话内保持。
   - 本题要求 `taskEn`。
3. **来源卡**：视频标题 + 时间点链接（外链图标），不显示原句。

### 5.6 提示（首次练习与到期复习共用）

| 控件 | 级别 | 内容 | 是否算辅助 |
| --- | --- | --- | --- |
| `About this expression` | 展开按钮（默认收起） | How it fits、Tone & who、Watch out | 不算 |
| `Show examples` | 第三级按钮 | 两个例句（中英）+ 原句 | 算，记为 `model_answer` |

- `Show examples` 旁常驻说明：首次练习 `Seeing an example helps, but this round won't go into your Vault.`；到期复习 `Seeing an example helps, but this review won't move your progress.`
- 点击 `Show examples` 时立即调用服务端接口，在本轮写入 `examples_opened_at`；提交时 `assistanceLevel` 由服务端据此推导，不再接收前端传值。已打开后例句保持展开。
- 例句缺失（4.7 `Examples unavailable`）时，`Show examples` 只展示原句，仍算辅助。

### 5.7 作答与提交

- 作答框文案 `Your answer in Chinese`；提交按钮 `Check my answer`（主按钮）。
- 未提交文字暂存于 `localStorage`（键 `popcorn:answer:{taskId}`、到期为 `popcorn:due-answer:{reviewTaskId}`），500 ms 防抖，读写 try/catch；提交成功即清除；恢复时显示 `Restored your unsent answer.`。
- 回答不包含目标表达时，按钮上方显示 `Your answer doesn't include {表达} yet.`；只提醒，不阻止提交。
- 不含中文时阻止提交并提示 `Write your answer in Chinese.`（沿用现有契约）。
- 等待与失败：沿用 8 秒后的长等待提示；失败按原因区分——无可用网关 → `Connect a model to continue.` + `Set up model gateway`；模型出错或输出不合规 → `The model didn't respond. Your answer is still here.` + `Try again`。用户输入始终保留。

### 5.8 评分（`evaluate` 新版本，按现有命名规则递增）

保留现有 rubric 主体（三维度定义、分数锚点、反例），只改四处：

1. **新增输入**：Meaning here、`targetFunction`（含 4.8 的类别说明）、`targetSetting`（含场合说明）、`interlocutor`、`taskEn`、Tone & who、Watch out。
2. **Accuracy**：以 Meaning here 为目标义；删除“从情境推断目标义、不假设原文义”的指令；用成其他意思判为语义错误。
3. **Context fit / Naturalness**：Context fit 的 C1 判断是否完成 `targetFunction` 规定的交际行为；场合与对话对象由题目明确给出，按现有 rubric 在 Context fit 的 3、4 分档中据此判断语气与说法是否相称（不改 Naturalness 的定义），不再视为“发明要求”。
4. **自然改写**：在用户原句基础上尽量少改；三项均为 5 时不返回改写。

输出不合规时立即重试，最多 3 次。

### 5.9 反馈卡

从上到下：

1. **结果行**（按情况取一）

| 情况 | 文案 |
| --- | --- |
| 入库 | `Added to your Vault · Tried · Next practice {本地日期}` |
| 看了例句且三项通过 | `You got it with an example. Now try a new situation on your own.` |
| 未通过 | `Not in your Vault yet — {维度名} needs work.` |
| 未入库时的补充一行 | `We'll bring this back tomorrow in today's practice.` |

2. **三个维度**：分数与反馈，未达标维度高亮（沿用）。
3. **重点建议**：有维度 <5 时 `Focus first: {维度名}`；全为 5 时 `Nothing to fix.`，不出现修订建议。
4. **自然改写**：默认收起，展开按钮 `Show a natural version`；展开后并排显示 `Your answer`（最近一次提交的句子）与 `A natural version`，程序逐字比对并高亮不同部分，不调用模型；查看不影响任何判定。
5. **按钮区**

| 结果 | 主按钮 | 次按钮 | 第三级按钮 |
| --- | --- | --- | --- |
| 入库 | `Open in Vault`（打开 `/vault/[userExpressionId]`） | `Back to {来源}` | — |
| 未入库 | `Try a new situation` | `Revise this answer` | `Remove from practice` |
| 修订后通过 | `Try a new situation` | — | `Remove from practice` |

- 所有日期按用户本地时区显示。
- 在今日学习会话中，`Back to {来源}` 由会话的 `Next` 替代（组 3）。

**到期复习的结果行**（同一套辅助规则，按钮由组 3、组 4 定义）

| 情况 | 文案 |
| --- | --- |
| 独立通过 | `Nice — {状态变化或保持}. Next practice {本地日期}` |
| 看了例句后通过 | `You got it with an example. We'll check again tomorrow — on your own.` |
| 未通过（含看了例句） | `Keep going — we'll bring this back tomorrow.` |

### 5.10 修订

- 点 `Revise this answer`：反馈卡收起为一行摘要（首次回答 + 三项分数），作答框重新可编辑并带入原回答，按钮变为 `Check my revision`。
- 修订结果显示 `Your first answer` 与 `Your revision` 两句，分数显示变化（如 `Naturalness 2 → 4`）；首次回答的完整反馈收入折叠区 `First feedback`。
- 修订通过时显示 `Nice fix. To add it to your Vault, try once more in a new situation without examples.`，主按钮 `Try a new situation`。
- 修订次数不限；修订不改变默认排期。

### 5.11 返回逻辑

- `returnTo` 改为白名单，允许：Saved 详情（含条目锚点）、`/practice`（含会话参数）、`/vault/[userExpressionId]`、`/home`。不在白名单时忽略。
- 所有进入首次练习的入口都必须带上 `returnTo`（Saved 学习卡、今日学习会话、Home 等）。
- 页头返回入口 `← Back to {来源名}`：来源名分别为 `Saved`、`Today's practice`、`Vault`、`Home`；无 `returnTo` 时显示 `← Back to Saved`，回到 `/saved`。
- `Remove from practice` 后 5 秒撤销窗口结束即返回来源页；入库后的 `Back to {来源}` 同样回到来源页。

### 5.12 刷新恢复

- 任务页加载时服务端返回本轮完整状态 `roundState`：`{ roundNumber, status, firstAnswer: { text, evaluation, naturalVersion } | null, latestRevision | null, examplesOpened, promotion: { userExpressionId, nextDueAt } | null, retryDueAt }`。页面据此直接渲染对应状态；已提交首次回答的轮次不可再提交首次回答。
- 同一轮重复提交不同首次回答时，服务端返回 `409 FIRST_ANSWER_EXISTS` 并附已有结果，前端直接渲染，提示 `You already answered this round. Here's your feedback.`；相同文本重复提交保持现有幂等重放。

### 5.13 按钮与布局规范（全站，练习页先落地）

| 级别 | 外观 | 用途示例 |
| --- | --- | --- |
| 主按钮 | 实心填充；每个按钮区最多一个 | `Check my answer`、`Open in Vault`、`Try a new situation` |
| 次按钮 | 描边胶囊 | `Revise this answer`、`Back to {来源}` |
| 第三级按钮 | 前置图标 + 文字；悬停浅色底；高度 ≥36px | `Show examples`、`Remove from practice` |
| 展开按钮 | 第三级按钮 + 右侧箭头，展开时旋转，带 `aria-expanded` | `About this expression`、`Show a natural version`、`First feedback` |
| 分段开关 | 小号两段控件 | `中文 / EN` |
| 链接 | 下划线；外部链接带外链图标 | 来源视频、返回入口 |

- 不允许“有点击功能但看起来是普通文字”的元素；`.hintButton`、`.disclosureButton` 等透明无边框样式按上表替换。
- 按钮区放在所属卡片底部，左对齐，顺序为主 → 次 → 第三级，间距统一；卡片外不放零散链接或按钮。
- 所有卡片左边缘与内边距一致；页头返回入口与卡片左边缘对齐。
- 后续各组的页面（Saved、今日学习会话、Vault 等）沿用本规范，并在各组附页面元素清单。

### 5.14 数据与接口

**轮次状态**（每一轮是一行 `practice_drafts`，各有自己的情境）

| 状态 | 含义 | 进入方式 |
| --- | --- | --- |
| `open` | 已出题，尚未提交首次回答 | 创建新一轮 |
| `retry_scheduled` | 首次回答未入库，等待第二次尝试 | 首次回答评分后未入库时自动写入，`retry_due_at` = 首次回答时间 + 24h |
| `promoted` | 本轮首次回答入库 | 晋升事务 |
| `superseded` | 已被下一轮取代 | 新一轮创建时 |
| `removed` | 用户移出练习 | `Remove from practice`；撤销时恢复为原状态 |

- 同一候选任意时刻最多一个 `open` 或 `retry_scheduled` 的轮次（部分唯一索引）。
- 新一轮从 `retry_scheduled` 轮次创建时继承其 `retry_due_at`，使未作答的新一轮仍按原时间留在队列中。
- 今日学习会话的 `Second try` = 状态为 `retry_scheduled`，或 `open` 且 `round_number ≥ 2`，并且 `retry_due_at ≤ now`（细则随组 3）。

**迁移**（新文件）

- `practice_drafts` 增加：`round_number smallint not null default 1`、`status text`（上表 5 值）、`retry_due_at timestamptz`、`previous_draft_id uuid`、`status_before_remove text`、`examples_opened_at timestamptz`；若情境字段存放于草稿，增加 `situation_en`、`interlocutor`、`task_en`、`target_function`、`target_setting`（存放位置以执行前核对为准）。
- 唯一约束 (user\_id, 候选标识, round\_number)；部分唯一索引见上。
- `attempts` 增加 `entry_round smallint`（仅入库那条正式作答填写）。
- 辅助等级沿用现有枚举 `none / hint / model_answer`，新流程只写 `none` 与 `model_answer`，旧数据中的 `hint` 保持原样。
- 修改晋升函数：条件由“revision = 1”改为“该作答是所属轮次的 revision 1”，并增加“该候选尚无晋升回执”；幂等回执不变。
- 回填：现有草稿 `round_number = 1`；有晋升回执的为 `promoted`；有首次回答无回执的为 `retry_scheduled`，`retry_due_at` = 首次回答时间 + 24h；其余为 `open`。

**接口**

| 接口 | 用途与响应 |
| --- | --- |
| `GET` 任务页数据（现有服务端加载） | 增加 `roundState`（5.12）、`situationEn`、`interlocutor`、`taskEn`、`targetSetting` |
| `POST /api/v1/practice/tasks`（现有，从学习卡进入） | 已入库 → `{ redirect: "/vault/[id]" }`；有 `open` 轮次 → 返回该轮；有 `retry_scheduled` 或仅有 `removed` → 新开一轮并返回 |
| `POST /api/v1/practice/tasks/[taskId]/rounds` | `Try a new situation`；body `{ requestId }`；`201 { taskId, roundNumber }`；已入库返回 `409 ALREADY_PROMOTED { userExpressionId }`；本轮尚未提交首次回答时返回 `200` 与当前轮 |
| `POST /api/v1/practice/tasks/[taskId]/remove` / `restore` | 移出练习 / 撤销 |
| `POST /api/v1/practice/tasks/[taskId]/examples-opened` | 记录本轮已看例句 |
| `POST /api/v1/practice/due/[reviewTaskId]/examples-opened` | 到期复习同上 |
| `POST /api/v1/practice/attempts`（现有） | 不再接收 `assistanceLevel`（传入则忽略）；同轮不同首次回答返回 `409 FIRST_ANSWER_EXISTS` 并附已有结果 |

**Saved 学习卡的练习状态**（随组 1 学习卡展示）：`In your Vault`（链接详情）/ `Practicing · Not in Vault yet` + `Continue` / `Removed from practice` + `Practice` / 未练习时 `Practice this expression`。

### 5.15 涉及文件

- 新增：`src/server/ai/prompts/activate.v2.ts`、评分 prompt 新版本文件、`rounds`、`remove`、`restore`、`examples-opened` 路由、迁移文件。
- 修改：`src/server/domain/create-practice-task.ts`、`src/server/repositories/attempt-repository.ts`（首次回答、修订、晋升条件、冲突返回）、`src/server/domain/record-valid-attempt.ts`、`src/server/repositories/practice-material-repository.ts`、`src/contracts/practice.ts`、`src/features/practice/material-schema.ts`、`src/features/practice/practice-material.tsx`、`src/features/practice/practice-session.tsx`、`src/features/practice/evaluation-panel.tsx`、`src/features/practice/due-practice.tsx`（提示拆分、例句记录、结果行文案）、`src/features/practice/practice-workspace.module.css`、`src/app/(app)/practice/[taskId]/page.tsx`（`returnTo` 白名单）、`src/features/saved/candidate-expression.tsx`（练习状态）、`src/types/database.generated.ts`。

### 5.16 执行前核对

- [ ] 首次练习情境存放在 `practice_drafts` 还是 `practice_tasks`；草稿如何标识候选。
- [ ] “revision === 1”的判断在 TS 与 SQL 中的全部位置，统一改为“轮内 revision 1”。
- [ ] 晋升回执表结构，确认“候选已晋升”的查询方式。
- [ ] 现有评分 prompt 的版本命名规则，以及 `PracticeCoachingSchema` 中 `naturalRevision` 可为空的处理。
- [ ] 回填规则在本地演示库上验证。

### 5.17 验收标准

- [ ] 打开新题：页头为 `New · Not in your Vault yet`，情境卡有对象与场合标签、`中文 / EN` 开关和本题专属 `taskEn`；中英文情境均不含目标表达。
- [ ] `About this expression` 可随时展开，提交合格回答后入库；点 `Show examples` 后刷新再提交合格回答，仍不入库，结果行为 `You got it with an example…`。
- [ ] 首次回答 Naturalness=2：结果行、`Focus first`、三个按钮符合 5.9；自然改写默认收起；直接点返回后，该表达在 24 小时后出现在今日学习会话 `Second try`，打开时为新情境。
- [ ] `Try a new situation`：新情境与上一轮不同，页头显示 `Round 2`；无例句通过后入库，复习到期 = 本次作答 + 24h，`entry_round = 2`。
- [ ] `Revise this answer`：显示两句对比与分数变化；修订通过时提示再开新一轮；不入库，不改变默认排期。
- [ ] `Remove from practice`：5 秒内可撤销；之后不出现在会话中，Saved 学习卡显示 `Removed from practice`，点 `Practice` 开新一轮。
- [ ] 三项满分时显示 `Nothing to fix.` 且无改写。
- [ ] 从 Saved、今日学习会话、Vault 进入时，页头返回入口文案与目标正确；无 `returnTo` 时回 `/saved`。
- [ ] 提交后刷新：恢复全部结果；另一标签页对同轮提交不同首次回答时直接显示已有结果。
- [ ] 输入一半刷新：文字恢复；不含目标表达时出现提醒但可提交。
- [ ] 所有日期为本地日期；页面上不存在看起来像普通文字的可点击元素，按钮区均在卡片底部左对齐。
- [ ] 用成其他意思的回答 Accuracy 被判为语义错误。
- [ ] `mastery.test.ts`、`schedule-review.test.ts`、`promote_practice_attempt.sql` 原有用例通过；新增多轮晋升、默认排期、移出与撤销、辅助记录的单元、集成与 SQL 测试。

## 6 一期 · 组 3：今日学习会话与 Home（已确认）

`/practice` 改为 “Today's practice”：把到期复习、第二次尝试、新表达合成一个队列，一个 `Start` 连续做到清空或随时退出，每一项也可单独点开；Home 主行动统一指向它，并用三格计数加一句话说明让新用户看懂这三类内容。

### 6.1 现有实现的不足

依据：`src/features/practice/due-practice.tsx`、`src/app/(app)/practice/page.tsx`、`src/server/repositories/review-task-repository.ts`（`listDue`）、`src/features/home/home-dashboard.tsx`、`src/features/home/next-action.tsx`、`src/features/home/home-view.ts`。

| # | 现状 | 问题 |
| --- | --- | --- |
| C1 | `/practice` 只列到期复习 | 新表达、第二次尝试没有入口；有可学内容时仍显示 `You are caught up` |
| C2 | 每次取积压前 3 项，标题 `3 due · about 6 minutes` | 不显示总量 |
| C3 | 会话进度只在页面内存中 | 刷新回到起始页；`Stop for now` 重置队列 |
| C4 | `Continue` 时而在作答区、时而在反馈区；`Stop for now` 重复；做完最后一项直接回起始页 | 按钮位置不定，无结束总结 |
| C5 | 打开失败只提示 `Check Settings, then try again` | 未区分原因 |
| C6 | Home 主行动只看到期数、处理中保存数（`unsortedSaveCount`）、YouTube | 有新表达可学时把用户引去 YouTube；`Review N recent saves` 只跳 Saved 列表 |
| C7 | Home 只有 1 个最近视频；日期按 UTC；主行动是普通链接；`Your learning workspace`、`Most useful now` 等小标题无信息量 | 信息少、日期不准、按钮不合规范 |

### 6.2 三类待练内容

| 类型 | 界面名称 | 是什么 | 怎么来的 | 一句话说明（界面文案） |
| --- | --- | --- | --- | --- |
| Review | `Reviews` | 已在 Vault、复习日已到的表达 | 入库后按 1 / 7 / 30 天间隔排期 | `Due for review — use a Vault expression again in a new situation.` |
| Second try | `Second tries` | 首次练习未入库（未通过或看了例句）的表达 | 组 2：未入库自动排到 24 小时后 | `Not in your Vault yet — one more try with a fresh question.` |
| New | `New expressions` | 已生成学习卡、从未练过的表达 | 组 1：标注 → Analyze → 学习卡 | `Analyzed from your saves — practice it for the first time.` |

一句话说明在 Home 计数格和 Practice 首页分组标题下都显示，用词一致。

### 6.3 队列规则

| 类型 | 进入条件 | 组内排序 |
| --- | --- | --- |
| Review | `review_tasks` 状态 pending 且 `due_at ≤ now` | 到期时间升序 |
| Second try | 组 2 的 `retry_scheduled`，或 `open` 且 `round_number ≥ 2`，并且 `retry_due_at ≤ now` | 到期时间升序 |
| New | 学习卡 `suitability = expression`、无练习轮次、未被移出练习；`not_expression` 仅在用户点过 `Practice anyway` 后进入 | 保存时间降序 |

- 整体顺序 Review → Second try → New；New 不设上限。
- 预计用时按每项 2 分钟计算。

### 6.4 Practice 首页（`/practice`）

- 标题 `Today's practice`，副标题 `Reviews, second tries and new expressions, in one place.`
- 概要行 `{d} reviews · {s} second tries · {n} new · about {m} min`；主按钮 `Start`。
- 完整列表按 Reviews、Second tries、New expressions 分组，每组标题带数量和 6.2 的一句话说明；空组不显示。
  - 每行：表达、Meaning here、右侧状态（Review 显示掌握度，逾期时 `Overdue {x} days`；Second try 显示 `Round {n}`；New 显示来源视频名）。
  - 每行可单独点开练习，进入对应练习页（`returnTo=/practice`），完成后回到首页。
  - New 组默认显示 10 项，其余由 `Show all {n}` 展开。
- 空状态：`You're all caught up.` + `Next practice: {本地日期}`；有标注未分析的保存时主按钮 `Analyze your saves`（`/saved?filter=needs-analysis`），否则 `Watch something on YouTube`。
- 打开失败按原因提示：无网关 → `Connect a model to continue.` + `Set up model gateway`；其他 → `Practice couldn't open.` + `Try again`。

### 6.5 连续会话（`/practice/session`）

- 页头：`← Exit session`（回 `/practice`）、`Today's practice · {k} left`、进度条（本次已完成比例）。
- 每一项沿用组 2 的组件：Review 用到期复习组件；Second try、New 用首次练习组件，轮到时才出题。
- 反馈后按钮区主按钮固定为 `Next`，队列最后一项为 `Finish`；组 2 的其他按钮保留：`Try a new situation` 在当前位置开新一轮，不计为新的一项；`Revise this answer` 照常；`Remove from practice` 后直接进入下一项。
- 下一项由服务端每次重新计算队列给出，并排除本次会话已完成的项；刚被排到明天的第二次尝试自然退出队列。
- 本次会话已完成项及结果存于 `sessionStorage`（读写 try/catch），仅用于小结展示，刷新后可恢复。

### 6.6 结束与小结

- 队列清空时显示 `All done for today`；中途 `Exit session` 时在 `/practice` 首页顶部显示本次小结。
- 小结：每项一个结果标签（`Added to your Vault`、`Tried → Reused`、`Reused → Owned`、`Practice again tomorrow`、`Removed`）；汇总 `{x} added to your Vault · {y} moved up`；`Next practice: {本地日期}`。
- 结束页按钮：主按钮 `Back to Home`；次按钮 `Watch something on YouTube`。

### 6.7 Home

**主行动**（按顺序取第一个成立的）

1. 无可用网关 → `Set up model gateway`。
2. 今日队列非空 → `Start today's practice`，副文案 `about {m} min`，直接进入连续会话。
3. 有标注未分析的保存 → `Analyze {k} saves`。
4. 否则 → `Watch something on YouTube`，副文案 `Next practice: {本地日期}`。

**三格计数**：主行动按钮下方横排三格 `Reviews`、`Second tries`、`New expressions`，每格显示数量与 6.2 的一句话说明；数量为 0 时也显示（灰色），帮助新用户理解三类内容；点击跳到 `/practice` 对应分组。

**次要提示**：处理中或失败的保存不再作为主行动，显示为一行 `{p} saves are still processing`。

| 元素 | 处理 | 说明 |
| --- | --- | --- |
| `Your learning workspace`、`Most useful now` 小标题 | 删除 | 无信息量 |
| 主行动 | 优化 | 主按钮样式，判断顺序如上 |
| 三格计数与说明 | 新增 | 如上 |
| 处理中提示 | 新增 | 次要样式 |
| Mastery snapshot | 保留 | `View Progress` 改为次按钮 |
| Recent Saved video | 优化 | 最近 3 个视频紧凑列表，各显示可练习数或待分析数；日期用本地时间 |
| `View all Saved videos` | 保留 | 次按钮，置于卡片底部 |

### 6.8 Practice 页面元素取舍

| 元素 | 处理 |
| --- | --- |
| `A short active-use session` 小标题 | 删除 |
| `{n} due · about X minutes` | 优化为分类计数与总用时 |
| 仅前 3 项的列表 | 优化为完整分组列表，每行可单独练 |
| `Start practice` | 优化为 `Start` |
| 空状态两个文字链接 | 优化为按状态给出一个主按钮 |
| 作答区与反馈区的 `Continue`、`Stop for now` | 删除，由 `Exit session` 与 `Next` 替代 |
| 结束页与小结 | 新增 |
| 到期复习的 `Compare with suggested revision` | 随组 4 处理 |

### 6.9 数据与接口

- `GET /api/v1/practice/today` → `{ summary: { reviewCount, secondTryCount, newCount, estimatedMinutes, needsAnalysisCount, processingCount, nextPracticeAt }, items: [{ kind, id, expression, meaningHere, mastery, dueAt, overdueDays, roundNumber, sourceVideoTitle }] }`。Home 与二期扩展横幅共用 `summary`。
- `GET /api/v1/practice/today/next?exclude={ids}` → 下一项（含进入该项所需的 taskId 或 reviewTaskId；New 项返回学习卡标识，进入时调用组 2 的 `POST /api/v1/practice/tasks` 出题）。
- 新表达池查询：新建 SQL 视图或函数，联接组 1 的学习卡、组 2 的练习轮次与移出状态，只读本人数据（RLS 或 security invoker），单次最多 200 条。
- 现有 `GET /api/v1/practice/due` 保留兼容；`HomeView` 删除 `unsortedSaveCount`，改用 `summary`。

### 6.10 涉及文件

`src/app/(app)/practice/page.tsx`、新增 `src/app/(app)/practice/session/page.tsx`、`src/features/practice/due-practice.tsx`（拆分为首页与会话运行器）、新增 `src/server/domain/build-today-queue.ts`、`src/server/repositories/review-task-repository.ts`、新增表达池仓储、`src/features/home/home-dashboard.tsx`、`src/features/home/next-action.tsx`、`src/features/home/home-view.ts`、`src/features/home/home-runtime.ts`、`src/features/saved/api.ts`（home 查询）、`src/features/saved/saved-library.tsx`（`needs-analysis` 筛选）。

### 6.11 执行前核对

- [ ] 学习卡在组 1 落地后的存储与标识方式，新表达池如何高效查询。
- [ ] `listDue` 的 100 条上限对计数的影响；计数改用 count 查询。
- [ ] 组 2 的首次练习组件能否在会话中复用（传入会话模式与 `Next` 回调）。

### 6.12 验收标准

- [ ] 数据：2 到期、1 第二次尝试、3 新表达 → 首页概要 `2 reviews · 1 second try · 3 new · about 12 min`，分组顺序与说明正确。
- [ ] `Start` 后依次为 2 个 Review、1 个 Second try、3 个 New；每项反馈后为 `Next`，最后一项为 `Finish`，结束显示 `All done for today` 与小结。
- [ ] 会话中途 `Exit session`：首页顶部出现本次小结；已完成项不再出现；再次 `Start` 从剩余项继续。
- [ ] 刷新会话页：小结记录不丢，当前项按服务端队列继续。
- [ ] 在会话中某项选 `Try a new situation`：仍是同一项，`{k} left` 不变；选 `Remove from practice`：直接进入下一项。
- [ ] 从列表单独点开一项：完成后回到 `/practice`。
- [ ] Home：有新表达但无到期时主行动为 `Start today's practice`；三格计数与说明显示，0 时为灰色；点击跳到对应分组；最近 3 个视频与本地日期正确。
- [ ] 无任何待练内容且无待分析保存时，Home 与 Practice 首页均给出 `Watch something on YouTube` 与下次练习日期。
- [ ] `due-practice.test.tsx`、`home-dashboard.test.tsx`、`home-runtime.test.ts`、`tests/e2e/returning-learner.spec.ts` 按新行为更新并通过。

## 7 一期 · 组 4：到期复习（已确认）

到期复习从“4 个高价模板里照着用”改为“按意图和场合出一道真正需要这个表达的新题，先回想再使用”：题目由模型按近迁移或远迁移生成并提前备好；表达默认遮住、先让用户回想；修订会重新评分，示范改写与用户句子并排比对。掌握度判定与排程规则不变。

### 7.1 现有实现的不足

依据：`src/server/domain/create-transfer-task.ts`、`src/server/domain/complete-due-practice.ts`、`src/app/api/v1/practice/due/[reviewTaskId]/route.ts`、`src/features/practice/due-practice.tsx`。

| # | 现状 | 问题 |
| --- | --- | --- |
| D1 | `buildDueTransferTask` 在食堂套餐、充电线、打车、租伞 4 个“高价反应”模板中轮换，金额按序号递增 | 学总结、让步等表达时，题目与交际意图不符，评分失真 |
| D2 | 题面写成 `请用“{表达}”自然回应`；作答要求与目标是两句写死的英文 | 每题一样，没有对象和场合 |
| D3 | 页头直接显示目标表达与英文含义 | 复习只是“照着用”，不检验能否回想起说法 |
| D4 | `Compare with suggested revision`：本地改写后与示范并排，不评分 | 与首次练习修订不一致；改得好不好没有反馈 |
| D5 | 结果文案为 `added to your Vault as learning evidence` 等术语；日期按 UTC | 难懂、日期不准 |
| D6 | 出题在打开时同步完成 | 改为模型出题后打开会等待 |

### 7.2 出题（`transfer-scenario.v1`）

**近迁移与远迁移**：都是在新情境里用这个表达，区别是新情境与原场景的差距。

| 当前掌握度 | 类型 | 规则 | 例（“高得要命”，原视频：朋友间吐槽房价） |
| --- | --- | --- | --- |
| tried | 近迁移 near | 主意图 + 第一个场合；话题与此前各题不同 | 跟朋友吐槽一杯咖啡太贵 |
| reused | 远迁移 far | 有次意图用次意图，否则主意图；有其他场合换场合，否则换话题与对话对象 | 在工作群跟同事说这个月加班多得离谱 |
| owned | 维持 maintain | 近、远交替（上一次为近则本次为远） | — |

理由：tried 阶段先确认隔一段时间仍能在相似场景用出；reused 阶段检验能否带到差别更大的场景，更接近“真的会用”；owned 阶段交替出现，避免只在一种场景里会用。

- **输入**：表达、Meaning here、Use it when、Tone & who、`targetFunction` 及其出题规则（4.8）、`targetSetting` 及其说明、迁移类型、此前所有题目原文（首次练习各轮 + 历次到期，要求避开）。不传例句，不传原句（来源被删除后仍可出题）。
- **输出**：与首次出题一致——`situationZh`（≤120 字）、`situationEn`（≤60 词）、`interlocutor`（≤10 字）、`taskEn`（≤30 词）。
- **校验**：中英文均不含目标表达；情境指纹不同于此前任一题。不合规时立即重试，最多 3 次。
- **出题时机**
  1. 复习排期写入后（首次晋升、到期完成），在事务提交后入队后台任务 `prepare_transfer_task`，提前出题并持久化。
  2. 打开时已备好则直接返回；未备好则同步生成，超过 8 秒显示 `Preparing a new situation…`。
  3. 仍失败时用兜底模板：10 类意图各 2 个模板，按 `targetFunction` 选取，模板含对象与场合但不出现目标表达；替换现有 4 个高价模板（`buildDueTransferTask` 改为 `buildFallbackTransferTask`）。模板由执行 agent 起草，产品方审核后合入。
- **换一道题**：作答前可点 `Try a different situation`（第三级按钮），每个复习项限 1 次，不算辅助；提交后不可用。
- **owned 判定**：规则不变。每道题记录 `targetFunction`、`targetSetting`、`transferType`，供二期表达旅程展示。

### 7.3 题面：先回想，再使用

- **页头**：当前掌握度标签；Meaning here；表达按字数显示为遮盖块（如 `▢▢▢▢`），旁边第三级按钮 `Show the expression`。
- 点 `Show the expression`：显示表达；**不算辅助**，只在本题记录 `expression_revealed_at`，用于二期表达旅程显示“这次没能自己回想起来”。
- 遮盖期间，`About this expression` 中出现的该表达同样遮盖；`Show examples` 会同时显示表达（并按组 2 规则算辅助）。
- **情境卡**：与首次练习一致——`You're talking to: {interlocutor} · {场合}`、中文情境、`中文 / EN` 开关、`taskEn`。
- 作答区、提示（`About this expression` / `Show examples`）、本地暂存、失败提示、评分输入与 rubric 改动，全部沿用组 2 第 5.6–5.8 节。

### 7.4 反馈与修订

- **结果行**（沿用组 2 第 5.9 节的到期版本）：

| 情况 | 文案 |
| --- | --- |
| 独立通过且状态前进 | `Nice — {旧状态} → {新状态}. Next practice {本地日期}` |
| 独立通过、状态不变 | `Nice — still {状态}. Next practice {本地日期}` |
| 看了例句后通过 | `You got it with an example. We'll check again tomorrow — on your own.` |
| 未通过（含看了例句） | `Keep going — we'll bring this back tomorrow.` |

- 三个维度、`Focus first` / `Nothing to fix.` 同组 2。
- **与示范对比**：`Show a natural version` 展开后并排显示 `Your answer`（最近一次提交的句子）与 `A natural version`，程序逐字比对并高亮不同部分，不调用模型（首次练习同样适用，见 5.9）。
- **修订**：删除 `Compare with suggested revision`，改为次按钮 `Revise this answer`——修改后重新评分，显示 `Your first answer` 与 `Your revision` 及分数变化（同 5.10）。修订仅用于学习，不改变本次复习结果、掌握度与下次到期时间。
- **按钮区**：会话中主按钮 `Next`（最后一项 `Finish`）；单独打开时主按钮 `Back to Today's practice`；次按钮 `Revise this answer`。
- 所有日期按本地时区显示。

### 7.5 页面元素取舍（到期复习页）

| 元素 | 处理 |
| --- | --- |
| 题面 `请用“{表达}”自然回应`、写死的英文要求与目标 | 删除，改用 `taskEn` |
| 页头直接显示的表达 | 优化：默认遮盖 + `Show the expression` |
| 情境卡对象与场合标签、`中文 / EN` | 新增 |
| `Try a different situation` | 新增（作答前） |
| `Compare with suggested revision` | 删除，由 `Revise this answer` 替代 |
| 示范改写 | 优化：与用户句子并排、高亮差异 |
| 术语化的结果与证据文案 | 优化为 7.4 结果行 |
| 当前掌握度标签 | 保留 |

### 7.6 数据与接口

**迁移**

- 到期迁移任务表增加：`situation_en`、`interlocutor`、`task_en`、`target_function`、`target_setting`、`transfer_type`（`near` / `far` / `maintain`）、`scenario_source`（`model` / `fallback`）、`regenerated boolean default false`、`expression_revealed_at`、`examples_opened_at`。
- `knowledge_jobs` 任务类型增加 `prepare_transfer_task`。
- 新表 `review_revisions(id, user_id, review_task_id, attempt_id, response_chinese, evaluation jsonb, created_at)`，RLS 仅本人；只存修订评分，不参与掌握度、排程与 Progress 证据。

**接口**

| 接口 | 用途 |
| --- | --- |
| `GET /api/v1/practice/due/[reviewTaskId]`（现有） | 返回已备好的题目（或同步生成），新增 `situationEn`、`interlocutor`、`taskEn`、`targetSetting`、`transferType`、`canRegenerate`、`expressionRevealed` |
| `POST /api/v1/practice/due/[reviewTaskId]/regenerate` | 换一道题；第二次调用返回 `409 REGENERATE_USED`；已提交后返回 `409 ALREADY_SUBMITTED` |
| `POST /api/v1/practice/due/[reviewTaskId]/reveal-expression` | 记录点开表达 |
| `POST /api/v1/practice/due/[reviewTaskId]/examples-opened` | 记录看例句（组 2） |
| `POST /api/v1/practice/due/[reviewTaskId]`（现有完成接口） | 不再接收 `assistanceLevel`，由服务端按 `examples_opened_at` 推导 |
| `POST /api/v1/practice/due/[reviewTaskId]/revisions` | 修订评分，写入 `review_revisions` |

评分 prompt 使用组 2 第 5.8 节的新版本；情境字段的形状须与评分入参一致。

### 7.7 涉及文件

- 新增：`src/server/ai/prompts/transfer-scenario.v1.ts`、`src/server/jobs/handlers/prepare-transfer-task.ts`、`regenerate`、`reveal-expression`、`revisions` 路由、迁移文件、逐字比对的展示组件。
- 修改：`src/server/domain/create-transfer-task.ts`、`src/server/domain/complete-due-practice.ts`、首次晋升代码（入队）、`src/server/jobs/process-jobs.ts`、`src/contracts/knowledge.ts`、`src/app/api/v1/practice/due/[reviewTaskId]/route.ts`、`src/features/practice/due-practice.tsx`、`src/features/practice/practice-material.tsx`、`src/features/practice/evaluation-panel.tsx`、`src/server/repositories/practice-material-repository.ts`、`src/types/database.generated.ts`。

### 7.8 执行前核对

- [ ] 到期迁移任务持久化在哪张表、现有字段，以及评分读取的情境字段。
- [ ] 现有 job 入队方式能否在事务提交后入队；`process-jobs.ts` 的 lease 与重试能否复用。
- [ ] 情境指纹函数的输入是否需纳入新字段。
- [ ] 首次练习各轮情境原文的读取方式，用于“避开此前题目”。

### 7.9 验收标准

- [ ] 3 个不同意图的表达（如“高得要命”Complain、“说白了”Explain · Sum up、“话虽如此”Concede · Contrast）各生成 3 道到期题：均不含目标表达、指纹互不相同、意图与场合匹配；tried 为近迁移，reused 为远迁移。
- [ ] 人工评审 20 道生成题，判定“意图与场合匹配、中文自然”的比例 ≥85%，评审表提交到 `docs/engineering/`。
- [ ] 题目提前备好时，打开到期项不触发模型调用；网关停用时使用对应意图的兜底模板，完成与排程正常。
- [ ] 表达默认遮盖，`About this expression` 中同样遮盖；点 `Show the expression` 后不影响独立判定，`expression_revealed_at` 有记录。
- [ ] `Try a different situation` 每项仅一次，提交后不可用，该次作答仍可算独立。
- [ ] `Revise this answer` 重新评分并显示对比，复习结果、掌握度、下次到期时间不变。
- [ ] `Show a natural version` 并排显示两句并高亮差异（首次练习与到期复习均是）。
- [ ] 结果行按 7.4 显示，日期为本地日期。
- [ ] `complete-due-practice.test.ts`、`due_practice_completion.sql`、`due-practice.test.tsx` 按新行为更新并通过。

### 8.0 通用约定

- **文件与版本**：沿用仓库现有写法，每个 prompt 一个文件放在 `src/server/ai/prompts/`，导出 `*_PROMPT_VERSION` 常量；旧版本加入对应的 `*_READABLE_PROMPT_VERSIONS`，旧产物仍可读取。版本号按上表；注意现有首次出题已是 `activate-practice-v2`、评分已是 `evaluate-practice-v4`，新版本分别为 v3、v5。
- **系统提示与数据分离**：`systemPrompt` = 现有 `INSTRUCTION_ISOLATION_PREFIX` 原文 + 空行 + 本节给出的任务指令；`userPrompt` = 输入数据的 `JSON.stringify` + 换行 + 现有 `USER_DATA_INSTRUCTION`。用户内容（字幕、作答）只出现在 `userPrompt` 的 JSON 里，绝不拼进 `systemPrompt`。
- **语言**：指令一律英文；中文只出现在示例中。
- **输出**：一个 JSON 对象；用 Zod wire normalizer 校验；不合规时用 `completeWithFormatRetries` 原样立即重试，最多 3 次（`FORMAT_RETRY_MAX`）。传输层 429 / 5xx 的现有重试不变。
- **参数**：每个 prompt 指定 `maxTokens` 与 `timeoutMs`（见各小节）。现有网关不支持 temperature，本次不新增该参数。
- **Fixture**：每个 prompt 必须有确定性的 fixture gateway（参照现有 `createActivationFixtureGateway`），根据输入生成能通过校验的输出；CI 与演示数据都依赖它。
- **样例集**：每个 prompt 的样例集以 JSON 存于 `tests/prompt-golden/<prompt-version>.json`，每条含 `input` 与 `expect`（必须包含 / 不得包含 / 允许为空 / 字段约束）。
  - CI：单元测试验证 prompt 构建结果（系统提示包含本节原文、`userPrompt` 结构正确）、normalizer 对合法与非法样例的判定、fixture 输出可通过校验。
  - 人工试跑：新增脚本 `scripts/try-prompts.ts`（`pnpm prompts:try -- <prompt-version>`），用已配置的真实网关跑样例集，把输出与 `expect` 对照结果写入 `docs/engineering/prompt-runs/<日期>-<prompt-version>.md`，供产品方评审。脚本不进 CI。
- **现有实现**：仓库工作区已有 `highlight-expressions.v1.ts` 与 `analyze-saved-item.v3.ts` 的初版，其指令较简略，须按本节原文更新；`analyze-saved-item.v3.ts` 中误放的 `Only pick spans from lines whose role is TARGET` 一句应删除（学习卡不选片段）。

### 8.3 共享常量：意图规则与场合说明

出题与评分 prompt 共用以下英文常量，集中定义在 `src/server/ai/prompts/learning-intent-constants.ts`，作为输入数据传给模型（不写进系统提示）。

| `functionCategories` 值 | label | rule（传给模型的原文） |
| --- | --- | --- |
| `emphasize` | Emphasize | Something is clearly beyond the usual degree and needs to be stressed. |
| `complain` | Complain | Something annoying, unfair or costly has happened and the speaker needs to express dissatisfaction. |
| `praise` | Praise | Someone or something deserves praise or approval. |
| `react` | React | Something surprising, unexpected or shocking has just happened and needs an immediate reaction. |
| `explain_sum_up` | Explain · Sum up | The other person has not understood, or a discussion needs to be summed up. |
| `concede_contrast` | Concede · Contrast | The speaker needs to accept one point the other person makes and then offer a different view. |
| `suggest` | Suggest | The other person needs advice or needs to be persuaded. |
| `connect_ideas` | Connect ideas | A short account needs a transition, a contrast or a follow-on point. |
| `describe` | Describe | A person, thing or event needs to be described. |
| `other` | Other | Use useItWhen to decide what the situation must require. |

| `usageSettings` 值 | label | description（传给模型的原文） |
| --- | --- | --- |
| `casual_chat` | Casual chat | Chatting with friends or family, or sending private messages. |
| `daily_errands` | Daily errands | Talking with shop staff or service workers while shopping, eating out, taking a taxi or running errands. |
| `work_school` | Work & school | Talking with colleagues, managers, teachers or classmates, including meetings and class. |
| `formal_writing` | Formal writing & speeches | Writing formal emails, reports or notices, or giving a speech. |
| `online_social` | Online posts | Writing posts, comments, group-chat messages or bullet comments. |

### 8.4 `activate-practice-v3`（首次练习出题）

**任务指令原文**

```text
[First practice situation] You write one practice situation for an intermediate learner of Mandarin Chinese whose helper language is English. The learner will reply in Chinese and should naturally need the target expression to do so. The learner can see the target expression and its meaning; the situation itself must not contain it.

Use "card" to understand the meaning, intention, tone and suitable settings. Design the situation as follows:
- It must make the target intention necessary: following targetFunction.rule, there must be something to emphasize, complain about, praise, react to, explain, concede, suggest, connect or describe.
- It takes place in targetSetting (see targetSetting.description), with one concrete interlocutor who fits that setting, such as a friend, a coworker or a shop assistant. For formal_writing, the learner writes one sentence of a message or speech instead of speaking.
- Choose an everyday topic that differs from sourceLine and from every text in avoidSituations.
- situationZh: natural Simplified Chinese an intermediate learner can read, 1 to 3 short sentences, at most 120 characters. Describe what is happening and end with what the interlocutor says or asks, so the learner has something to reply to.
- Never include the target expression, and never give wording that shows how to answer.
- situationEn: a faithful English translation of situationZh, at most 60 words, also without the target expression.
- interlocutor: who the learner is talking to, in Chinese, at most 10 characters (for example 同事).
- taskEn: one English instruction of at most 30 words saying what to do in the reply, for example "Reply to your coworker and complain about how expensive the lunch is." Do not mention or translate the target expression.

Output exactly: {"situationZh":"...","situationEn":"...","interlocutor":"...","taskEn":"..."}
```

**输入示例**

```json
{"task":"first_practice_situation","card":{"expression":"高得要命","meaningHere":"Ridiculously high — complaining the price is way too much.","useItWhen":"When you want to complain that something is excessive and exaggerate a little.","toneAndWho":"Casual and exaggerated; natural with friends and online."},"targetFunction":{"value":"complain","label":"Complain","rule":"Something annoying, unfair or costly has happened and the speaker needs to express dissatisfaction."},"targetSetting":{"value":"casual_chat","label":"Casual chat","description":"Chatting with friends or family, or sending private messages."},"sourceLine":"说白了，这边的房价高得要命","avoidSituations":[]}
```

**输出示例**

```json
{"situationZh":"周末你和朋友去了一家新开的咖啡店，一杯普通拿铁要六十块。朋友问你：“你觉得这家店怎么样？”","situationEn":"At the weekend you and a friend went to a new café, where a plain latte costs sixty yuan. Your friend asks: “What do you think of this place?”","interlocutor":"朋友","taskEn":"Reply to your friend and complain about how expensive the coffee is."}
```

**校验**：见 5.3（中英文均不含目标表达；长度；新一轮情境指纹不同于此前各轮）。`avoidSituations` 为本表达此前各轮的 `situationZh`。

**参数**：`maxTokens: 400`，`timeoutMs: 20000`。

**Fixture**：按 `targetFunction.value` 从 8.7 兜底模板中取第一个，原样返回。

**样例集**

| # | 输入要点 | 期望 |
| --- | --- | --- |
| 1 | 高得要命 · complain · casual\_chat | 情境中有令人不满的贵或多；对象为朋友或家人；中英文都不含“高得要命” |
| 2 | 说白了 · explain\_sum\_up · work\_school | 对方没听懂或需要总结；对象为同事、上级或同学 |
| 3 | 话虽如此 · concede\_contrast · work\_school | 对方提出一个合理观点，需要先认可再提出不同看法 |
| 4 | 同 1，`avoidSituations` 含 1 的输出 | 话题不同于咖啡与房价 |
| 5 | 有两把刷子 · praise · casual\_chat | 有人表现出色值得称赞 |

### 8.5 `evaluate-practice-v5`（评分）

在 `evaluate-practice-v4` 基础上只做以下修改，rubric 其余行原样保留。

**输入 JSON**（替换原来的 `targetExpression`、`promptChinese`、`learnerResponse` 三字段结构）

```json
{"task":"evaluation","targetExpression":"高得要命","targetMeaning":"Ridiculously high — complaining something is way too much.","situationZh":"……","interlocutor":"朋友","targetSetting":{"value":"casual_chat","label":"Casual chat","description":"Chatting with friends or family, or sending private messages."},"targetFunction":{"value":"complain","label":"Complain","rule":"Something annoying, unfair or costly has happened and the speaker needs to express dissatisfaction."},"taskEn":"Reply to your friend and complain about how expensive the coffee is.","toneAndWho":"Casual and exaggerated; natural with friends and online.","watchOut":"Usually negative — don't use it to praise something.","learnerResponse":"这杯咖啡高得要命，下次别来了。"}
```

**修改 1：`[Scoring scope]` 中替换一句**

原文：`Use only targetExpression, promptChinese, and learnerResponse. Infer the target sense from the supplied situation; do not assume a hidden source sense, reference answer, speaker relationship, regional preference, or extra task requirement.`

新文：

```text
Use targetExpression, targetMeaning, situationZh, interlocutor, targetSetting, targetFunction, taskEn and learnerResponse. The target sense is targetMeaning; using the expression in a different sense is a meaning error under Accuracy A2. The speaker relationship and setting are the ones given by interlocutor and targetSetting. toneAndWho and watchOut describe correct usage of the expression; use them only as reference when judging, never as extra requirements. Do not assume a reference answer, a regional preference or any requirement beyond taskEn.
```

**修改 2：`[Context fit checks]` 的 C1 之后追加一句**

```text
Here the requested act is the one defined by targetFunction.rule, directed at the interlocutor, as stated in taskEn.
```

场合与对象相称与否沿用现有 Context fit 3、4 对 tone 与 stated setting 的判断（`targetSetting` 即 stated setting），不改 Naturalness 的定义。

**修改 3：`EVALUATION_PROMPT_SUFFIX` 中关于 `naturalRevisionChinese` 的句子之后追加**

```text
The revision must change as little as possible from the learner's sentence. Omit naturalRevisionChinese when all three scores are 5.
```

**输出 schema**：不变。程序侧：三项均为 5 时忽略返回的改写。

**兼容**：缺少新字段的旧任务（一期前创建）继续用 v4 构建 prompt。

**参数**：`maxTokens: 700`，`timeoutMs` 沿用现有值。

**Fixture**：沿用现有评分 fixture，改为读取新输入结构中的 `targetExpression`。

**样例集**

| # | 作答（目标：高得要命 · complain · casual\_chat） | 期望 |
| --- | --- | --- |
| 1 | 这杯咖啡高得要命，下次别来了。 | 三项均 ≥3 |
| 2 | 他的个子高得要命，打篮球很厉害。（用于称赞，偏离 Meaning here 的抱怨义） | Accuracy ≤3，反馈指出与目标义不符 |
| 3 | 高得要命是什么意思？ | Accuracy = 1（只是提及） |
| 4 | 咖啡还行吧。 | Accuracy = 1（未使用目标表达） |
| 5 | 换为 work\_school、对象为上级：“老板，这个报价高得要命啊！” | Context fit ≤4，反馈指出对上级过于随意 |
| 6 | 完全自然的满分回答 | 三项均为 5，无 `naturalRevisionChinese` |

### 8.6 `transfer-scenario-v1`（到期复习出题）

**任务指令原文**

```text
[Review situation] You write one review situation for an intermediate learner of Mandarin Chinese whose helper language is English. The learner learned the target expression earlier and is reviewing it after a gap. The expression is hidden at first, so the learner must recall it. The situation and task must make the intention clear without hinting at the wording.

Use "card" to understand the meaning, intention, tone and suitable settings. Design the situation as follows:
- It must make the target intention necessary, following targetFunction.rule.
- It takes place in targetSetting (see targetSetting.description), with one concrete interlocutor who fits that setting. For formal_writing, the learner writes one sentence of a message or speech instead of speaking.
- transferType "near": choose a new everyday topic that differs from every text in previousSituations.
- transferType "far": choose a topic from a different area of life than every text in previousSituations, and an interlocutor whose relationship to the learner differs from those in previousSituations (for example a coworker instead of a friend).
- situationZh: natural Simplified Chinese an intermediate learner can read, 1 to 3 short sentences, at most 120 characters, ending with what the interlocutor says or asks.
- Never include the target expression, and never give wording that shows how to answer.
- situationEn: a faithful English translation of situationZh, at most 60 words, also without the target expression.
- interlocutor: in Chinese, at most 10 characters.
- taskEn: one English instruction of at most 30 words saying what to do in the reply. Do not mention or translate the target expression.

Output exactly: {"situationZh":"...","situationEn":"...","interlocutor":"...","taskEn":"..."}
```

**输入示例**

```json
{"task":"review_situation","card":{"expression":"高得要命","meaningHere":"Ridiculously high — complaining something is way too much.","useItWhen":"When you want to complain that something is excessive and exaggerate a little.","toneAndWho":"Casual and exaggerated; natural with friends and online."},"targetFunction":{"value":"complain","label":"Complain","rule":"Something annoying, unfair or costly has happened and the speaker needs to express dissatisfaction."},"targetSetting":{"value":"online_social","label":"Online posts","description":"Writing posts, comments, group-chat messages or bullet comments."},"transferType":"far","previousSituations":["周末你和朋友去了一家新开的咖啡店，一杯普通拿铁要六十块。朋友问你：“你觉得这家店怎么样？”"]}
```

**输出示例**

```json
{"situationZh":"公司群里，同事转发了一条消息：这个月起停车费涨到每天八十块。同事问大家：“你们怎么看？”","situationEn":"In the company group chat, a coworker shares a notice that parking now costs eighty yuan a day from this month. The coworker asks everyone: “What do you think?”","interlocutor":"同事","taskEn":"Reply in the group chat and complain about the new parking fee."}
```

**`transferType` 的确定**（程序侧）：tried → `near`；reused → `far`；owned → 与上一次到期题相反（上一次为 near 则 far，反之 near；无记录时 near）。传给模型的只有 `near` 或 `far`；`targetFunction` 与 `targetSetting` 按 4.9 规则由程序选定后传入。`previousSituations` 为本表达首次练习各轮与历次到期的 `situationZh`。

**校验**：见 7.2（中英文均不含目标表达；指纹不同于此前任一题）。

**参数**：`maxTokens: 400`，`timeoutMs: 20000`。

**Fixture**：按 `targetFunction.value` 从 8.7 兜底模板中选取，跳过指纹与 `previousSituations` 重复的模板。

**样例集**

| # | 输入要点 | 期望 |
| --- | --- | --- |
| 1 | 高得要命 · complain · casual\_chat · near；此前为咖啡 | 新话题（非咖啡、非房价）；对象为朋友或家人 |
| 2 | 高得要命 · complain · online\_social · far；此前为朋友与咖啡 | 对象关系不同于朋友；话题属于不同生活领域 |
| 3 | 说白了 · explain\_sum\_up · work\_school · near | 对方没听懂或需要总结 |
| 4 | 说白了 · explain\_sum\_up · casual\_chat · far | 对象与场合都变化 |
| 5 | 话虽如此 · concede\_contrast · work\_school · near | 需先认可再提出不同看法 |
| 6 | 任一样例 | 中英文均不含目标表达，`taskEn` 未暗示措辞 |

### 8.7 兜底模板

- 文件：`src/server/domain/fallback-situations.ts`，导出按 `functionCategories` 分组的模板，每类 2 条，结构与出题输出相同：`{ situationZh, situationEn, interlocutor, taskEn, setting }`。
- 模板不含任何目标表达，话题通用（不依赖具体表达）；10 类意图 × 2 = 20 条。
- 选取：优先 `setting` 与 `targetSetting` 相同的模板，其次同类第一条；跳过指纹与此前题目重复的模板。
- 首次练习出题失败（5.3）与到期出题失败（7.2）共用；写入 `scenario_source = 'fallback'`。
- 由执行 agent 起草，标注“待产品方审核”后合入。

## 15 执行规范

执行 agent 按组推进，每组单独提交、单独验收，验收通过后才开始下一组；每组的可复制指令见第 16 节。任何“执行前核对”结论与本方案假设冲突时，先停下记录差异与可选方案，不得自行改变产品行为。

### 15.1 阶段与顺序

1. **阶段 0 核对**：阅读仓库 `AGENTS.md` 与 `node_modules/next/dist/docs/` 相关指南；完成所执行章节的“执行前核对”，输出 `docs/engineering/optimization-preflight.md`，每条写“结论 + 证据文件 + 对方案的影响”。
2. **一期**：组 1（第 4 节）→ 组 2（第 5 节）→ 组 3（第 6 节）→ 组 4（第 7 节）。只执行状态为“已确认”的章节；标题带“初稿”的章节不执行。
3. **二期**：组 5 → 组 6。
4. **收尾**：全部验收后按第 18 节更新 README。

每组结束更新 `scripts/seed-demo.ts`，使演示库覆盖该组新增的全部状态，便于人工走查：组 1 为自动标注成功 / 为空 / 失败兜底的保存、已分析与未分析的标注、`not_expression` 学习卡；组 2 为多轮练习、`retry_scheduled` 第二次尝试、被移出练习的表达；组 3 为同时含三类待练内容的队列；组 4 为近迁移与远迁移到期项、遮盖表达的到期项、兜底模板出题的到期项。

### 15.2 不可破坏的不变量

- `passed` 与 `independentUse` 只由程序依据三项分数和服务端记录的辅助等级推导；模型不输出任何业务状态、ID、时间或排程。
- 掌握度状态机与排程间隔（1 / 7 / 30 天、owned 阈值）不改。
- 晋升与到期完成保持事务原子性与回执幂等；新增写入路径必须同样幂等。
- 来源证据只能由服务端已有字幕映射建立，不信任模型返回的时间点。
- 所有新表启用 RLS，并在 `supabase/tests/` 增加隔离测试；所有新接口做认证检查，导航可见性不替代权限。
- 用户作答原文不写入日志。
- 不新增产品边界：无语音、无多语言、无推送通知、无积分或连续打卡。

### 15.3 工程约定

- 迁移：只新增文件，命名延续现有时间戳格式（如 `202611010018_practice_rounds.sql`），不修改已有迁移；每次迁移后重新生成 `src/types/database.generated.ts`。
- Prompt：新增或变更一律新建版本文件（`highlight-expressions.v1`、`analyze-saved-item.v3`、`activate.v2`、`transfer-scenario.v1`、评分 prompt 新版本），生成记录写入 prompt 版本。
- 常量集中在 `src/server/domain/learning-config.ts`：`FORMAT_RETRY_MAX = 3`（模型输出不合规时的立即重试次数）、`ANALYZE_BATCH_SIZE = 5`、`SECOND_TRY_DELAY_HOURS = 24`、`ESTIMATED_MINUTES_PER_ITEM = 2`、`REGENERATE_LIMIT_PER_REVIEW = 1`。本方案不设练习轮次上限、每日新表达上限或每轮项数。
- UI 文案为英文，以本方案给出的字符串为准；需要改动时在 PR 中列出原文与新文案。
- 时间：服务端统一 UTC；界面展示日期用用户本地时区，并在统计口径处注明 UTC。

### 15.4 每组的完成定义

- [ ] 执行前核对结论已写入 preflight 文档。
- [ ] 该章节全部验收标准逐条通过，并在 PR 描述中逐条勾选、附证据（测试名或截图）。
- [ ] 新增与受影响的单元、集成、SQL 测试通过；端到端用例 `tests/e2e/saved-learning-loop.spec.ts`、`returning-learner.spec.ts` 按新流程更新并通过。
- [ ] 扩展改动时确认 `test:extension` 的过滤集合包含新测试，必要时运行完整扩展测试。
- [ ] 在 `docs/engineering/execution-ledger.md` 追加一条：组号、改动摘要、偏离方案之处及原因、已知遗留。

### 15.5 需要回到产品方确认的情况

- 核对发现数据结构与方案假设不同，且两种实现会导致用户可见行为差异。
- 任何会改变掌握度、排程或独立性判定的改动。
- 模型调用超出本方案已确定的范围（新增调用点，或单次用户操作多出一次以上调用）。
- 到期复习兜底模板（第 7.2 节）与 20 道题的人工评审表（第 7.9 节）需要产品方审核后合入。

### 16.2 组 2：首次练习

```text
你将在 Popcorn 仓库中实现《Popcorn 功能优化方案（执行版）》第 5 节（组 2）。前提：组 1（第 4 节）已验收通过。本次只做组 2，完成后停止。

先读：第 1、3、15 节，第 4.7–4.9 节（学习卡与系统字段，本组要用到），第 5 节全文，第 8.0、8.3、8.4、8.5、8.7 节（Prompt 规格）。Prompt 指令原文必须按第 8 节实现，不得随意改写；确需修改时在报告中列出原文、新文与原因。
开工前：阅读 AGENTS.md 与 node_modules/next/dist/docs/ 相关指南。

范围：
- 5.2 学习链路与入库规则：练习轮次、未入库自动排期（retry_scheduled，24 小时）、Try a new situation、Revise this answer、Remove from practice 与撤销、辅助的定义（只有 Show examples 算辅助，记为 model_answer）
- 5.3 出题 activate.v2
- 5.4–5.12 首次练习页：元素取舍、题面、提示拆分、作答与提交、评分新版本、反馈卡（含与示范并排比对）、修订、returnTo 白名单、刷新恢复
- 5.13 按钮与布局规范：在首次练习页落地，并抽成可复用样式或组件
- 5.14 数据与接口，包括 Saved 学习卡上的练习状态（Practicing · Not in Vault yet / Removed from practice）
- 共享部分同时接入到期复习页，但只做这些：提示拆分（About this expression / Show examples）、examples-opened 记录、服务端推导辅助等级、组 2 的到期结果行文案；到期复习的其余改动留给组 4

不做：
- /practice 首页与连续会话（组 3）；第二次尝试只需保证数据状态正确，入口由组 3 实现
- 到期复习出题、遮盖表达、换题、到期修订评分（组 4）
- Vault、Progress 的任何改动；任何标题带“初稿”的章节

流程：
1. 完成 5.16 执行前核对，写入 preflight 文档；与方案冲突且影响用户可见行为时停下报告。
2. 实现；迁移只新增文件；晋升条件改为“轮内 revision 1”，掌握度规则与排程间隔不得改动。
3. 更新 seed-demo 覆盖 15.1 中组 2 的状态。
4. 运行并通过相关测试，包括 mastery.test.ts、schedule-review.test.ts、promote_practice_attempt.sql 原有用例。
5. 在 execution-ledger 追加记录。

完成标准：5.17 验收标准逐条通过，且满足 15.4。
最后输出：逐条验收结果与证据、偏离方案之处及原因、遗留问题。
```

### 16.3 组 3：今日学习会话与 Home

```text
你将在 Popcorn 仓库中实现《Popcorn 功能优化方案（执行版）》第 6 节（组 3）。前提：组 1、组 2 已验收通过。本次只做组 3，完成后停止。

先读：第 1、3、15 节，第 5.2、5.13、5.14 节（轮次状态、按钮规范、接口），第 6 节全文。
开工前：阅读 AGENTS.md 与 node_modules/next/dist/docs/ 相关指南。

范围：
- 6.2 三类待练内容的定义与界面说明文案（Home 与 Practice 首页用词一致）
- 6.3 队列规则（Review → Second try → New，New 不设上限）
- 6.4 Practice 首页 /practice（分组列表、每项可单独练、空状态、失败提示）
- 6.5 连续会话 /practice/session（一直做到队列清空，Exit session，反馈后 Next / Finish，服务端每次重算下一项）
- 6.6 结束页与小结
- 6.7 Home（主行动顺序、三格计数与说明、处理中提示、最近 3 个视频、本地日期）
- 6.8 元素取舍、6.9 数据与接口；页面沿用 5.13 按钮与布局规范

不做：
- 到期复习本身的出题、遮盖表达、换题、修订（组 4）
- 扩展到期横幅（二期组 5）；Vault、Progress 改动（二期组 6）；任何标题带“初稿”的章节

流程：
1. 完成 6.11 执行前核对，写入 preflight 文档；冲突时停下报告。
2. 实现；HomeView 删除 unsortedSaveCount，改用今日队列 summary。
3. 更新 seed-demo 覆盖 15.1 中组 3 的状态。
4. 运行并通过相关测试。
5. 在 execution-ledger 追加记录。

完成标准：6.12 验收标准逐条通过，且满足 15.4。
最后输出：逐条验收结果与证据、偏离方案之处及原因、遗留问题。
```

### 16.4 组 4：到期复习

```text
你将在 Popcorn 仓库中实现《Popcorn 功能优化方案（执行版）》第 7 节（组 4）。前提：组 1、组 2、组 3 已验收通过。本次只做组 4，完成后停止。

先读：第 1、3、15 节，第 4.8 节（交际意图与场合的出题规则）、第 5.6–5.10 节（提示、评分、反馈、修订），第 7 节全文，第 8.0、8.3、8.5、8.6、8.7 节（Prompt 规格）。Prompt 指令原文必须按第 8 节实现，不得随意改写；确需修改时在报告中列出原文、新文与原因。
开工前：阅读 AGENTS.md 与 node_modules/next/dist/docs/ 相关指南。

范围：
- 7.2 出题 transfer-scenario.v1：近迁移 / 远迁移 / 维持规则、校验与立即重试、prepare_transfer_task 后台预生成、打开时同步兜底、按意图分类的兜底模板（替换 4 个高价模板）、Try a different situation（每项 1 次，不算辅助）
- 7.3 题面：表达默认遮盖、Show the expression（不算辅助，只记录 expression_revealed_at）、About this expression 中同步遮盖、情境卡
- 7.4 反馈与修订：结果行、Revise this answer 重新评分（不影响复习结果、掌握度与排程）、示范并排比对、按钮区
- 7.5 元素取舍、7.6 数据与接口

不做：
- 删除来源后的复习处理（二期组 6，初稿 P0-D）
- 表达旅程等对 expression_revealed_at、targetFunction 的展示（二期组 6）
- 任何标题带“初稿”的章节

流程：
1. 完成 7.8 执行前核对，写入 preflight 文档；冲突时停下报告。
2. 实现；掌握度判定、owned 阈值与排程间隔不得改动。
3. 起草兜底模板（10 类意图 × 2）与 20 道生成题的人工评审表，提交到 docs/engineering/，标注“待产品方审核”。
4. 更新 seed-demo 覆盖 15.1 中组 4 的状态。
5. 运行并通过相关测试，包括 complete-due-practice.test.ts、due_practice_completion.sql。
6. 在 execution-ledger 追加记录。

完成标准：7.9 验收标准逐条通过（人工评审一项可在产品方审核后补勾），且满足 15.4。
最后输出：逐条验收结果与证据、偏离方案之处及原因、遗留问题、待产品方审核的文件路径。
```

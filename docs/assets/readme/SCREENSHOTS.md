# README 截图来源

更新日期：2026-11-02（Asia/Shanghai）。图片均来自实际产品界面，无合成界面或模型生成图片。

## 扩展截图

`youtube-watching.png`、`extension-overview.png`、`extension-overview-expressions.png` 沿用此前 README 的真实观看场景截图，展示字幕、保存和 Overview。这次没有重新执行扩展的真实模型生成，也没有修改这些图片。

## 新版 Web 截图

对应产品源码：`3f43ec7e479545220ca124b699e896c668f86215`，随 PR #4 合入 main `909158b521c1e2b28421fcd60a2062e41eded2f8`。本次 README 更新只改变文档与图片。

所有 Web 图片均为**隔离测试环境中的固定演示数据**；学习卡、题目、评分和作答不代表真实模型评测。截图中的 `@popcorn.test` 是测试账号，截图不包含个人真实学习数据或密钥。部分页面保留未配置模型的提示，这是测试账号的实际状态。

| 文件 | 内容 | 来源 |
| --- | --- | --- |
| `home.png` | Home 三类计数、下一步、掌握度与最近视频 | 本次对已验收生产构建重新截图，1440px 视口 |
| `today-practice.png` | 2 Reviews / 1 Second try / 3 New 的完整队列 | 同上；实际页面返回 200 |
| `learning-cards.png` | “挺靠谱”学习卡 | 同上；直接截取实际卡片元素 |
| `first-practice-feedback.png` | 首次回答、修改、三维反馈和新情境入口 | 同上；读取已存在的示范作答，没有提交回答 |
| `review-near.png` | 遮蔽目标表达的近迁移复习 | 同上；读取已准备好的题目，没有揭示、换题或提交 |
| `review-far.png` | 展开 About 和 EN 的远迁移复习 | 复用独立验收 D 在同一源码生产构建上截取的原图；其只读观察和数据保护验证见下方验收记录 |

本次截图使用 API 54331 / DB 54332 的隔离测试栈，临时页面端口 3105；没有连接个人学习数据库。浏览器脚本拦截非 GET/HEAD 的业务 API 请求，成功截图均观察到 0 次浏览器业务写入。远迁移预置题尚未到期，本次没有修改到期时间或触发重新准备，改为复用同源码的已验收截图。

验收与原图来源：[最终集成验收](../../engineering/group-4-main-integration-acceptance.md)。真实生成题目的人工审核另见[20 题审阅记录](../../engineering/prompt-runs/2026-11-01-transfer-scenario-v1-review-set.md)，与这些固定演示截图分别记录。

本目录其他旧版 Web 图片保留为历史素材，当前 README 不再引用。

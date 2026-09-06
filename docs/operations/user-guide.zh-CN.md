# Popcorn 中文使用指南

Popcorn 是一个个人本地运行的学校项目，帮助以英语为母语、正在学习普通话的用户，保存**当前正在观看的 YouTube 视频**中的学习片段。它只在你的电脑上运行：本地网站、本地数据库和 Chrome 扩展都由你自己控制，不是托管服务或商业部署。

## 每天使用：一键开始与停止

首次完成后面的“一次性设置”后，每天在仓库文件夹中双击 `Start Popcorn.command`（macOS），或运行：

```bash
pnpm popcorn:start
```

它会启动本地服务并打开 Popcorn。完成学习后，双击 `Stop Popcorn.command`，或运行：

```bash
pnpm popcorn:stop
```

正常停止不会清除你的配置、本地账号、学习数据或已加载的解压扩展。`pnpm db:reset` 不是日常启动命令；它会删除本地数据库中的所有账号和学习数据。

## 一次性设置

### 1. 准备软件

安装并准备以下软件：

- [Git](https://git-scm.com/downloads)
- 正在运行的 [Docker Desktop](https://docs.docker.com/get-started/introduction/get-docker-desktop/)
- [Node.js 24.5 或更高版本](https://nodejs.org/en/download)（Node 24.5 起才有下面可选设置所需的内置环境代理支持）
- [pnpm 11.19.0](https://pnpm.io/installation)
- [Chrome 116+](https://www.google.com/chrome/)

### 2. 取得项目并安装锁定版本的依赖

在终端中进入你想存放项目的位置，然后取得项目并进入它的文件夹：

```bash
git clone https://github.com/LLLJJJcon/popcorn.git
cd popcorn
pnpm install --frozen-lockfile
```

最后一条命令只会按项目锁定的版本安装依赖。

### 3. 启动本地 Supabase 并建立本地配置

先确认 Docker Desktop 已完全启动，再运行：

```bash
pnpm exec supabase start
pnpm exec supabase status
```

这会在你的电脑上启动本地 Supabase。常用地址是：API `http://127.0.0.1:54321`、Studio `http://127.0.0.1:54323`、Mailpit `http://127.0.0.1:54324`。

在文件管理器中复制 `.env.example`，将副本改名为 `.env.local`。用文本编辑器打开 `.env.local`，再依据下表填写。不要把 `.env.local` 提交到 Git、粘贴到聊天中，或发给任何人。

| `.env.local` 字段 | 填写位置 | 如何取得 | 示例形状 | 是否为秘密 |
| --- | --- | --- | --- | --- |
| `APP_URL` | `APP_URL=` 后 | 固定值 | `http://127.0.0.1:3000` | 否 |
| `NEXT_PUBLIC_SUPABASE_URL` | 同名行后 | 当前 `pnpm exec supabase status` 输出中的 API URL | `http://127.0.0.1:54321` | 否，可在浏览器使用 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 同名行后 | 同一份 status 输出中的 anon/publishable key | 一串公开配置字符 | 否，可在浏览器使用 |
| `SUPABASE_SERVICE_ROLE_KEY` | 同名行后 | 同一份 status 输出中的 service-role/secret key | 一串密钥字符 | 是，仅服务器使用 |
| `SUPADATA_API_KEY` | 同名行后 | 在 [Supadata dashboard](https://dash.supadata.ai/) 注册后取得；入门说明见 [Supadata 文档](https://docs.supadata.ai/) | 一串 API 密钥字符 | 是，仅服务器使用 |
| `INTERNAL_JOB_SECRET` | 同名行后 | 在你自己的电脑上运行 `openssl rand -hex 32`，将输出**只粘贴到该本地文件** | 64 个十六进制字符 | 是，仅服务器使用 |
| `POPCORN_PROXY_URL`（可选） | 同名行后 | 仅在需要时，从你的代理应用查看 HTTP/Mixed 代理端口 | `http://127.0.0.1:8080` | 否 |

不要把 service-role key 放进 Chrome 扩展。不要把任何秘密作为终端命令参数输入。表中的 `openssl` 命令只在本机生成值；生成后请直接写入 `.env.local`，不要复制到聊天、Git 或日志。

#### 可选：本地 HTTP 代理

`POPCORN_PROXY_URL` 只影响本地 Web 和 worker，可不填。只能填写你自己的一个完整 `http://` 或 `https://` 代理来源地址；不能含路径（根 `/` 除外）、查询、片段、用户名或密码。

- **直连**：留空。
- **真正的 TUN/全局路由**：通常留空；这种路由已经同时覆盖 Node 和浏览器。
- **只让浏览器/系统代理生效**：在这里填写一次你的本地 **HTTP/Mixed** 代理来源地址，例如代理应用显示的端口为 `8080` 时可填 `http://127.0.0.1:8080`。不要填写只支持 SOCKS 的端口。

在代理应用的网络、端口或监听器页面找到 **HTTP/Mixed** 代理端口，再据此填写。Popcorn 不会自动检测或修改 macOS、Windows 或 Linux 的系统代理设置；直连或真正的 TUN/全局路由也不需要此值。

修改后用原有的一键命令重启：先运行 `pnpm popcorn:stop`，再运行 `pnpm popcorn:start`（或双击对应的 macOS command 文件）。若代理错误或不可用，改正主机/端口，或留空后重启。模型 API 密钥仍只在已登录的网关页面填写，绝不放进 `.env.local`。

### 4. 第一次建立本地数据

完成 `.env.local` 后，只在这一次新安装时运行：

```bash
pnpm db:reset
```

这是刻意的初始重置：它会重建并填充**本地** Popcorn 数据库。以后不要用它来“修复小问题”，因为它会永久删除该本地库里的所有账号和学习记录。

### 5. 第一次启动、创建账号并设置模型网关

使用每日的一键启动方式：`pnpm popcorn:start` 或 `Start Popcorn.command`。浏览器打开后，在 `http://127.0.0.1:3000/sign-in` 创建本地账号并登录。

登录后进入 `/settings/model-gateway`。这里的 API 密钥只在已登录的 Web 设置中输入，绝不放进 `.env.local`、终端命令、Chrome 扩展、Git 或聊天。OpenAI 并非必需；你可以选择任何你已确认兼容的服务商，并只参考该服务商自己的官方 API 文档与控制台。对这个个人本地项目，保存后的密钥会继续显示在已登录的设置页，方便你核对和修改；不要在共享电脑上保持登录。

| Web 设置字段 | 填写内容 | 取得方式 | 注意事项 |
| --- | --- | --- | --- |
| 显示名称 | 你给这项配置起的名称 | 自己填写，例如“我的学习模型” | 仅便于识别 |
| HTTPS API 根地址 | 服务商的准确 OpenAI-compatible HTTPS API root | 服务商官方文档/控制台 | 例如官方给出的以 `/v1` 结尾的根地址；不要填完整的 `/chat/completions` 地址，Popcorn 会自行追加它 |
| 模型 ID | 服务商要求的准确模型标识 | 服务商官方文档/控制台 | 原样输入，不要猜测 |
| API 密钥 | 你的服务商密钥 | 服务商官方控制台 | 仅在此已登录的 Web 页面输入 |

保存前，确认页面显示的**准确目标地址**；确认无误后同意该目标并启用配置。没有真实的网关凭据时，本地界面和固定演示数据仍可使用，但 AI 生成步骤会保持等待状态。

### 6. 生成并加载 Chrome 扩展

一键启动已经读取本地配置。若需要重新生成扩展，运行：

```bash
pnpm extension:local
```

在 Chrome 打开 `chrome://extensions`，开启“开发者模式”，选择“加载已解压的扩展程序”，并选择仓库中的 `dist/popcorn-extension` 文件夹。使用与 Web 相同的本地账号登录扩展。

若源代码或本地配置发生变化，再运行一次 `pnpm extension:local`，然后在
`chrome://extensions` 对 Popcorn 选择“重新加载”。

## 日常学习流程

1. 启动 Popcorn，并在 Web 与扩展中登录同一账号。
2. 打开一个公开、带原生简体中文字幕的 YouTube 视频观看页。
3. 从右侧扩展保存视频时刻、字幕行、字幕选择、Key Quote 或 AI Explanation。保存会在后台完成，不暂停视频，也不会跳转或弹出表单。
4. 点击扩展顶部的 **Open Popcorn**。它总是打开 Web 主入口：已经登录会进入 **Home**；没有 Web 登录状态才会进入登录页。
5. 从 **Saved** 打开刚才的视频。Saved 是忠实的来源收件箱：保留当时的原文、译文、时间点和处理状态。
6. 在候选表达上点击 **Practice this expression**，用目标表达写一个新的中文句子。提交失败时，输入与原始证据都应留在页面，可直接重试。
7. 首次有效练习后，从 **Open in Vault** 查看表达详情。Vault 是已经练过的长期学习资料库，不是 Saved 的重复列表；它按表达汇总含义、原始视频证据和完整尝试历史。
8. 之后从 **Practice** 完成到期的新情境练习，再从 **Progress** 查看本周练习、到期完成数、独立复用和掌握度分布。

掌握度只有 **tried -> reused -> owned**：第一次有效尝试进入 tried；之后在新情境中独立复用进入 reused；持续独立使用后才进入 owned。保存数量本身不会提高掌握度。

### 页面分别做什么

| 页面 | 用途 | 典型下一步 |
| --- | --- | --- |
| **Home** | 聚合入口，显示最近保存、当前到期练习和网关状态 | 去 Saved 整理刚保存的内容，或开始到期 Practice |
| **Saved** | 按 YouTube 视频保存原始学习快照和处理状态 | 打开一个视频，选择值得练习的候选表达 |
| **Practice** | 完成首次表达练习和到期复用练习 | 写自己的中文句子，查看反馈后重写 |
| **Vault** | 搜索已练表达，查看来源证据与完整尝试历史 | 回看一个表达，或等待下一次到期 Practice |
| **Progress** | 展示可验证的练习证据与 tried/reused/owned 分布 | 决定今天优先练什么 |
| **Settings** | 配置并启用 OpenAI-compatible 模型网关 | 核对目标地址、模型 ID 和 API key |

### 状态消息怎么理解

- **Queued / retrying automatically**：Web 暂时不可用，但原始保存已经进入扩展本地队列；保持 Popcorn 运行后会自动重试，不要反复点击同一条。
- **Saved. Waiting to organize / Organizing this save**：原始快照已经安全保存，后台正在补齐字幕、翻译或学习材料，可以继续看视频。
- **Could not organize / Provider unavailable**：本次外部服务或模型调用没有完成；原始保存和练习输入不会因此消失。检查 Supadata、网关或代理设置后重试。
- **Set up a model gateway**：Saved 仍可浏览，但生成候选表达和练习反馈前需要在 Settings 启用一个网关。

没有外部密钥时，你仍可以打开本地 UI，并在已有本地账号后运行 `pnpm demo:seed -- --user <你的本地邮箱或 UUID>` 来加入固定演示资料；它不会创建账号，也不会调用 Supadata 或模型网关。真实的 YouTube 转录需要真实 `SUPADATA_API_KEY`，AI 学习材料需要已启用且已同意目标地址的网关凭据。

## 按现象排查

| 你看到的情况 | 可以先做什么 |
| --- | --- |
| Docker 或 Supabase 无法启动 | 确认 Docker Desktop 正在运行；再次运行 `pnpm exec supabase start` 和 `pnpm exec supabase status`，并检查 `.env.local` 中的本地 Supabase 值。 |
| Web 页面打不开 | 用每日启动命令重新启动；确认地址为 `http://127.0.0.1:3000`，并确认 `.env.local` 的 `APP_URL` 是同一地址。 |
| 扩展没有反应或更新未出现 | 回到 `chrome://extensions`，确认扩展已启用；重新运行 `pnpm extension:local` 后选择“重新加载”，并确认登录的是同一账号。 |
| 点击 Open Popcorn 后出现登录页 | 扩展登录和 Web 登录是两个本地会话；在 Web 登录一次即可。以后会直接进入 Home，除非会话过期或浏览器数据被清除。 |
| 转录一直显示等待 | 确认 `SUPADATA_API_KEY` 已在 `.env.local` 本地填写且有效；让 Popcorn 保持启动。没有真实 Supadata 密钥时，转录不能完成。 |
| AI 项目一直显示等待或需要同意 | 在 `/settings/model-gateway` 检查四个 Web 字段，核对显示的准确目标地址，再同意并启用；不要把网关 API 密钥放入 `.env.local`、终端、Chrome、Git 或聊天。 |
| 提交 Practice 后失败 | 保留当前页面和输入，检查网关/代理后直接重试；Popcorn 不会要求你重新从 Saved 找材料。 |
| 想运行 `pnpm db:reset` | 先停止。它会删除本地数据库的全部账号和学习资料；只在你确认要完整重建本地演示时使用。 |

若一键停止没有完成，可在启动窗口按 `Ctrl-C`，再运行 `pnpm exec supabase stop`。这同样不会删除正常保存的数据或已加载的扩展。

## 教授演示清单

1. 运行 `pnpm popcorn:start`，说明 `pnpm db:reset` 会破坏本地数据、不是日常启动命令。
2. 在 Web 和扩展中用同一个本地账号登录。
3. 打开带中文字幕的 YouTube 视频，保存一个当前时刻，并在 **Saved** 展示原始快照。
4. 从 Saved 进入 **Practice**，提交一个新中文句子，再在 **Vault** 展示表达、来源证据和尝试历史。
5. 在 **Progress** 展示练习证据和 `tried -> reused -> owned` 掌握度路径。
6. 明确说明 `.env.local` 被 Git 忽略；任何密钥、密码都不提交、不贴到 issue 或聊天，网关密钥只在已登录的 Web 设置中输入。

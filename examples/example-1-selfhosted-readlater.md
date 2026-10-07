# 开源方案选型体检报告（repo-audit）

- 生成时间：2026-10-07T14:38:15.862Z
- 需求画像：自托管稍后读/书签归档，单人使用，Docker 部署，需要网页正文存档
- 目标技术栈：TypeScript, Python
- 输入：52 个候选（来源 gh-search 候选池），深度体检 6 个；缓存里另有 3 个
- 计分权重（满分 100，预设 `fit-first`）：功能匹配 30 / 可落地 20 / 维护 15 / 文档 10 / 生态 10 / 许可 8 / 风险 5 / **热度(star) 2**（硬上限 10）
- 证据门槛：功能匹配分每条至少 3 个来源（不足则该项封顶 20 分）
- 认证：`anonymous`；请求 1 次，缓存命中 12

> **这张表不是 star 榜。** star 只在最后一栏占 2 分（对数缩放）。
> `功能匹配` 列带 * = 未提供 --fit（按中位 15 估算）；带 ^ = 证据来源不足已封顶。**两者都不可直接用于决策。**

## 〇、结论：✅ 找到强匹配

有 2 个强匹配（功能匹配 ≥22 且进首选/备选）：首选 [sissbruecker/linkding](https://github.com/sissbruecker/linkding)


## 一、适配度榜（按总分）

| # | 分档 | 仓库 | 总分 | 功能匹配/30 | 可落地/20 | 维护/15 | 文档/10 | 生态/10 | 许可/8 | 风险/5 | 热度/2 | ★ | 语言 | 停更d | 许可 |
| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | --- |
| 1 | 首选 | [sissbruecker/linkding](https://github.com/sissbruecker/linkding) | 93.7 | 27 | 20 | 15 | 10 | 7 | 8 | 5 | 1.7 | 11278 | Python | 5 | MIT |
| 2 | 首选 | [linkwarden/linkwarden](https://github.com/linkwarden/linkwarden) | 83.8 | 24 | 20 | 15 | 7 | 8 | 3 | 5 | 1.8 | 19952 | TypeScript | 4 | AGPL-3.0 |
| 3 | 备选 | [ahmadfarhan1981/linkstash](https://github.com/ahmadfarhan1981/linkstash) | 76.1 | 15* | 20 | 13 | 10 | 4.3 | 8 | 5 | 0.8 | 64 | TypeScript | 86 | MIT |
| 4 | 观察 | [carlos-dubon/loomark](https://github.com/carlos-dubon/loomark) | 67.8 | 18^ | 16 | 10 | 5 | 5.3 | 8 | 5 | 0.5 | 17 | TypeScript | 8 | MIT |
| 5 | 观察 | [goniszewski/grimoire](https://github.com/goniszewski/grimoire) | 67.0 | 15* | 16 | 10 | 5 | 6.5 | 8 | 5 | 1.5 | 2863 | TypeScript | 8 | MIT |
| 6 | 观察 | [denho/faved](https://github.com/denho/faved) | 65.8 | 15* | 16 | 9 | 5 | 6.5 | 8 | 5 | 1.3 | 1320 | TypeScript | 62 | MIT |
| 7 | 观察 | [slax-lab/slax-reader](https://github.com/slax-lab/slax-reader) | 65.1 | 15* | 16 | 10 | 5 | 5.3 | 8 | 5 | 0.8 | 80 | TypeScript | 5 | Apache-2.0 |
| 8 | 观察 | [brendanlong/lion-reader](https://github.com/brendanlong/lion-reader) | 62.8 | 15* | 14 | 10 | 5 | 5.3 | 8 | 5 | 0.5 | 17 | TypeScript | 0 | MIT |
| 9 | 观察 | [ayoub9360/stash-bookmark](https://github.com/ayoub9360/stash-bookmark) | 58.8 | 15* | 16 | 5 | 5 | 5.3 | 8 | 4 | 0.5 | 14 | TypeScript | 220 | MIT |
| 10 | 观察 | [nilukush/article_saver](https://github.com/nilukush/article_saver) | 58.7 | 15* | 16 | 5 | 5 | 5.3 | 8 | 4 | 0.4 | 6 | TypeScript | 189 | MIT |
| 11 | 观察 | [sak96/read_later](https://github.com/sak96/read_later) | 58.1 | 15* | 9 | 10 | 5 | 5.3 | 8 | 5 | 0.8 | 73 | Rust | 3 | MIT |
| 12 | 观察 | [gregyjames/readr](https://github.com/gregyjames/readr) | 57.7 | 15* | 9 | 10 | 5 | 5.3 | 8 | 5 | 0.4 | 10 | Go | 1 | MIT |
| 13 | 观察 | [artur-shaik/wallabag-client](https://github.com/artur-shaik/wallabag-client) | 57.0 | 15* | 14 | 5 | 5 | 5.3 | 8 | 4 | 0.7 | 42 | Python | 226 | MIT |
| 14 | 观察 | [guozi/koby](https://github.com/guozi/koby) | 56.8 | 15* | 9 | 9 | 5 | 5.3 | 8 | 5 | 0.5 | 16 | Vue | 62 | MIT |
| 15 | 观察 | [chrisgrieser/alfred-read-later](https://github.com/chrisgrieser/alfred-read-later) | 55.8 | 15* | 7 | 10 | 5 | 5.3 | 8 | 5 | 0.5 | 12 | JavaScript | 6 | MIT |
| 16 | 仅借鉴 | [angristan/gongyu](https://github.com/angristan/gongyu) | 54.9 | 15* | 16 | 10 | 5 | 5.3 | 0 | 3 | 0.6 | 21 | TypeScript | 26 | — |
| 17 | 仅借鉴 | [blob42/gosuki](https://github.com/blob42/gosuki) | 53.2 | 15* | 9 | 9 | 5 | 6 | 3 | 5 | 1.2 | 554 | Go | 52 | AGPL-3.0 |
| 18 | 仅借鉴 | [mkoppmann/eselsohr](https://github.com/mkoppmann/eselsohr) | 52.7 | 15* | 7 | 10 | 5 | 5.3 | 5 | 5 | 0.4 | 10 | Haskell | 2 | EUPL-1.2 |
| 19 | 仅借鉴 | [nikhilbd/read-later](https://github.com/nikhilbd/read-later) | 52.3 | 15* | 14 | 10 | 5 | 5.3 | 0 | 3 | 0.0 | 0 | TypeScript | 10 | — |
| 20 | 仅借鉴 | [jensomato/ReadeckApp](https://github.com/jensomato/ReadeckApp) | 52.0 | 15* | 7 | 10 | 5 | 6 | 3 | 5 | 1.0 | 222 | Kotlin | 4 | GPL-3.0 |

## 二、star 榜 vs 适配榜的偏离（这是本 skill 的核心产出）

**高星但被高估/落选（只看 star 会选错）**

- [kanishka-linux/reminiscence](https://github.com/kanishka-linux/reminiscence) ★1856 → 适配度第 31 名，未进适配 Top10 —— 功能匹配度尚未判定，若认为它匹配需求，请补 --fit 重跑
- [blob42/gosuki](https://github.com/blob42/gosuki) ★554 → 适配度第 17 名，未进适配 Top10 —— 功能匹配度尚未判定，若认为它匹配需求，请补 --fit 重跑
- [jensomato/ReadeckApp](https://github.com/jensomato/ReadeckApp) ★222 → 适配度第 20 名，未进适配 Top10 —— 功能匹配度尚未判定，若认为它匹配需求，请补 --fit 重跑
- [kbroose/stash](https://github.com/kbroose/stash) ★146 → 适配度第 35 名，未进适配 Top10 —— 功能匹配度尚未判定，若认为它匹配需求，请补 --fit 重跑
- [kyoheiu/leaf](https://github.com/kyoheiu/leaf) ★90 → 适配度第 24 名，未进适配 Top10 —— 功能匹配度尚未判定，若认为它匹配需求，请补 --fit 重跑

**低星但适配度高（只看 star 会漏掉）**

- [ahmadfarhan1981/linkstash](https://github.com/ahmadfarhan1981/linkstash) ★64（star 榜第 13）→ 适配度第 3，分档「备选」
- [carlos-dubon/loomark](https://github.com/carlos-dubon/loomark) ★17（star 榜第 20）→ 适配度第 4，分档「观察」
- [brendanlong/lion-reader](https://github.com/brendanlong/lion-reader) ★17（star 榜第 21）→ 适配度第 8，分档「观察」
- [ayoub9360/stash-bookmark](https://github.com/ayoub9360/stash-bookmark) ★14（star 榜第 23）→ 适配度第 9，分档「观察」
- [nilukush/article_saver](https://github.com/nilukush/article_saver) ★6（star 榜第 30）→ 适配度第 10，分档「观察」

## 三、被硬门槛淘汰的

| 仓库 | ★ | 淘汰原因 |
| --- | --- | --- |
| [Nepochal/wallabag-cli](https://github.com/Nepochal/wallabag-cli) | 35 | 停更 1803d > 1095d |
| [sebcode/b](https://github.com/sebcode/b) | 52 | 停更 1234d > 1095d |
| [0xlaxel/DragPaper](https://github.com/0xlaxel/DragPaper) | 2 | 停更 2839d > 1095d |
| [jeromenerf/nieh](https://github.com/jeromenerf/nieh) | 1 | 停更 4310d > 1095d |
| [GeekCookie/ReadLater](https://github.com/GeekCookie/ReadLater) | 2 | 停更 3642d > 1095d |
| [jwest/gazetka](https://github.com/jwest/gazetka) | 3 | 停更 1348d > 1095d |
| [ThomasRoest/better-bookmarks](https://github.com/ThomasRoest/better-bookmarks) | 21 | 停更 1372d > 1095d |
| [kybernetyk/Read-Later](https://github.com/kybernetyk/Read-Later) | 4 | 停更 5632d > 1095d |
| [hanipcode/twitter-read-later-app](https://github.com/hanipcode/twitter-read-later-app) | 3 | 停更 3368d > 1095d |
| [thadd/FIFO-Links](https://github.com/thadd/FIFO-Links) | 6 | 停更 5964d > 1095d |
| [rupertl/app-zapzi](https://github.com/rupertl/app-zapzi) | 3 | 停更 4077d > 1095d |
| [nguyen13901/Android-](https://github.com/nguyen13901/Android-) | 2 | 停更 1512d > 1095d |
| [mathpunk/hyperlexia](https://github.com/mathpunk/hyperlexia) | 1 | 停更 3596d > 1095d |
| [Oli4242/Lisi](https://github.com/Oli4242/Lisi) | 0 | 停更 1397d > 1095d |

## 四、逐项证据（前 8 个）

### 1. [sissbruecker/linkding](https://github.com/sissbruecker/linkding) — 总分 93.7｜首选

- 描述：Self-hosted bookmark manager that is designed be to be minimal, fast, and easy to set up using Docker.
- 功能匹配：自托管书签+归档，Docker 单容器；README 有 Install/Usage；验收标准 1/2/3 全中，4（全文存档）只到部分归档｜风险：单人维护；无 Windows 原生版，需 Docker｜证据来源 4 个
- 事实：★11278｜fork 642｜订阅者 45｜贡献者 未采样｜语言 Python｜许可 MIT
- 最近提交：2026-09-13T18:10:47Z 「Update CHANGELOG.md」
- 最近发布：v1.47.0 @ 2026-09-13T17:47:41Z
- 风险提示：未见明显
- 功能匹配证据来源（4 个）：https://github.com/sissbruecker/linkding · https://github.com/sissbruecker/linkding/releases · https://raw.githubusercontent.com/sissbruecker/linkding/master/README.md · https://hub.docker.com/r/sissbruecker/linkding

- README 摘要：linkding is a bookmark manager that you can host yourself. It's designed be to be minimal, fast, and easy to set up using Docker. - link which is often used as a synonym for URLs and bookmarks in common language - Ding which is German for thing - ...so basically something for managing your links - …


### 2. [linkwarden/linkwarden](https://github.com/linkwarden/linkwarden) — 总分 83.8｜首选

- 描述：⚡️⚡️⚡️ Self-hosted collaborative bookmark manager to collect, read, annotate, and fully preserve what matters, all in one place.
- 功能匹配：自托管书签+全文归档+协作，功能强但偏团队场景｜风险：AGPL-3.0，闭源商用需评估｜证据来源 3 个
- 事实：★19952｜fork 859｜订阅者 53｜贡献者 未采样｜语言 TypeScript｜许可 AGPL-3.0
- 最近提交：2026-09-10T00:12:04Z 「Merge pull request #1834 from linkwarden/dev」
- 最近发布：v2.16.3 @ 2026-09-09T21:34:39Z
- 风险提示：强 copyleft（AGPL/GPL）：闭源商用或 SaaS 需评估
- 功能匹配证据来源（3 个）：https://github.com/linkwarden/linkwarden · https://docs.linkwarden.app/ · https://github.com/linkwarden/linkwarden/releases

- README 摘要：Cloud · Website · Self-Host · Docs Linkwarden is a self-hosted, open-source collaborative bookmark manager to collect, read, annotate, and fully preserve what matters, all in one place. The objective is to organize useful webpages and articles you find across the web in one place, and since useful …


### 3. [ahmadfarhan1981/linkstash](https://github.com/ahmadfarhan1981/linkstash) — 总分 76.1｜备选

- 描述：Stash Your Links, Revisit Anytime - LinkStash: Your Self-Hosted Bookmark Manager
- 功能匹配：未提供：需要用 README/描述证据判定功能匹配度（见 SKILL.md 步骤 3）
- 事实：★64｜fork 5｜订阅者 2｜贡献者 未采样｜语言 TypeScript｜许可 MIT
- 最近提交：2026-07-13T08:15:19Z 「version bump」
- 最近发布：v1.1.2 @ 2026-03-07T17:07:51Z
- 风险提示：功能匹配度未判定（--fit 缺失），总分为估算值


- README 摘要："Stash Your Links, Revisit Anytime - LinkStash: Your Self-Hosted Bookmark Manager" LinkStash is a self-hosted, backend-driven bookmarking and "read it later" solution, empowering you to take full control of your saved links and offline content. - :file folder: Privacy & Ownership : Full control ove…


### 4. [carlos-dubon/loomark](https://github.com/carlos-dubon/loomark) — 总分 67.8｜观察

- 描述：A self-hosted bookmark manager that syncs with your browser.
- 功能匹配：功能边界只覆盖一半｜风险：项目太新｜证据来源 2 个｜⚠ 证据来源仅 2 个 < 要求 3 个（独立域 1 个）
- 事实：★17｜fork 0｜订阅者 ?｜贡献者 未采样｜语言 TypeScript｜许可 MIT
- 最近提交：2026-09-28T23:28:43Z（8d 前）
- 最近发布：无 GitHub Release
- 风险提示：未见明显
- 功能匹配证据来源（2 个）：https://github.com/carlos-dubon/loomark · https://github.com/carlos-dubon/loomark/releases
- ⚠ 证据问题：证据来源仅 2 个 < 要求 3 个（独立域 1 个）



### 5. [goniszewski/grimoire](https://github.com/goniszewski/grimoire) — 总分 67.0｜观察

- 描述：Bookmark manager for the wizards 🧙
- 功能匹配：未提供：需要用 README/描述证据判定功能匹配度（见 SKILL.md 步骤 3）
- 事实：★2863｜fork 88｜订阅者 ?｜贡献者 未采样｜语言 TypeScript｜许可 MIT
- 最近提交：2026-09-28T16:08:57Z（8d 前）
- 最近发布：无 GitHub Release
- 风险提示：功能匹配度未判定（--fit 缺失），总分为估算值





### 6. [denho/faved](https://github.com/denho/faved) — 总分 65.8｜观察

- 描述：Free open-source bookmark manager with customisable nested tags. Super fast and lightweight. All data is stored locally.
- 功能匹配：未提供：需要用 README/描述证据判定功能匹配度（见 SKILL.md 步骤 3）
- 事实：★1320｜fork 73｜订阅者 ?｜贡献者 未采样｜语言 TypeScript｜许可 MIT
- 最近提交：2026-08-05T17:51:41Z（62d 前）
- 最近发布：无 GitHub Release
- 风险提示：功能匹配度未判定（--fit 缺失），总分为估算值





### 7. [slax-lab/slax-reader](https://github.com/slax-lab/slax-reader) — 总分 65.1｜观察

- 描述：Open-source, AI-powered read-it-later — save web pages, highlight, and discuss
- 功能匹配：未提供：需要用 README/描述证据判定功能匹配度（见 SKILL.md 步骤 3）
- 事实：★80｜fork 4｜订阅者 ?｜贡献者 未采样｜语言 TypeScript｜许可 Apache-2.0
- 最近提交：2026-10-02T12:22:16Z（5d 前）
- 最近发布：无 GitHub Release
- 风险提示：功能匹配度未判定（--fit 缺失），总分为估算值





### 8. [brendanlong/lion-reader](https://github.com/brendanlong/lion-reader) — 总分 62.8｜观察

- 描述：An AI-native, all-in-one reader that unifies RSS/Atom/JSON feeds, email newsletters, and read-later into one fast, self-hostable app.
- 功能匹配：未提供：需要用 README/描述证据判定功能匹配度（见 SKILL.md 步骤 3）
- 事实：★17｜fork 1｜订阅者 ?｜贡献者 未采样｜语言 TypeScript｜许可 MIT
- 最近提交：2026-10-07T04:28:33Z（0d 前）
- 最近发布：无 GitHub Release
- 风险提示：功能匹配度未判定（--fit 缺失），总分为估算值






## 五、⚠ 数据不完整（API 配额耗尽）

深度体检在 3/6 个仓库处被限速中断：core API rate limit exhausted. Resets at 2026-10-07T14:55:25.000Z.

**未体检的仓库在"文档/生态"两栏拿中位分，其排序不可与已体检者直接比较。** 继续办法：配 token（`export GITHUB_TOKEN=...`，或写进 `~/.dsh/github-token`）、等配额重置、或先 `--no-deep` 看可比分排序。

## 六、数据缺口说明

- 深度体检上限 5 个，其余候选只有浅层数据（可落地/维护/许可由搜索快照得出，文档与生态按中位分），其总分仅供排序参考。
- 功能匹配分缺失（带 * ）的条目，总分不可直接决策：请按 README/描述补齐 --fit。
- 自动标记（flags）来自命名词/描述/体积的启发式判断，可能误判，请人工复核。

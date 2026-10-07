# 开源方案选型体检报告（repo-audit）

- 生成时间：2026-10-07T14:38:18.685Z
- 需求画像：Windows 本地文件夹全文搜索（含 PDF/Office 正文），单机、依赖越少越好，最好单文件/单命令安装
- 目标技术栈：（未声明 --target-lang）
- 输入：97 个候选（来源 gh-search 候选池），深度体检 0（--no-deep 浅层模式，只读缓存）
- 计分权重（满分 100，预设 `fit-first`）：功能匹配 30 / 可落地 20 / 维护 15 / 文档 10 / 生态 10 / 许可 8 / 风险 5 / **热度(star) 2**（硬上限 10）
- 证据门槛：功能匹配分每条至少 3 个来源（不足则该项封顶 20 分）
- 认证：`anonymous`；请求 0 次，缓存命中 40

> **这张表不是 star 榜。** star 只在最后一栏占 2 分（对数缩放）。
> `功能匹配` 列带 * = 未提供 --fit（按中位 15 估算）；带 ^ = 证据来源不足已封顶。**两者都不可直接用于决策。**

## 〇、结论：✅ 找到强匹配

有 3 个强匹配（功能匹配 ≥22 且进首选/备选）：首选 [riccione/glintindex](https://github.com/riccione/glintindex)

> **本表按"可比分"排序（满分 80）**：文档与生态两项需要逐仓采样才有区分度，浅层模式下不计入排序，否则"先被体检的仓库"会白占便宜。

## 一、适配度榜（按可比分）

| # | 分档 | 仓库 | 可比分 | 功能匹配/30 | 可落地/20 | 维护/15 | 文档/10 | 生态/10 | 许可/8 | 风险/5 | 热度/2 | ★ | 语言 | 停更d | 许可 |
| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | --- |
| 1 | 首选 | [riccione/glintindex](https://github.com/riccione/glintindex) | 64.0 | 24^ | 13 | 14 | 10 | 4.3 | 8 | 5 | 0.0 | 0 | Rust | 39 | Apache-2.0 |
| 2 | 备选 | [nampara-ai/librarian](https://github.com/nampara-ai/librarian) | 61.7 | 18^ | 15 | 15 | 10 | 4.3 | 8 | 5 | 0.7 | 49 | Python | 13 | MIT |
| 3 | 备选 | [Dicklesworthstone/ultrasearch](https://github.com/Dicklesworthstone/ultrasearch) | 59.6 | 24^ | 15 | 15 | 10 | 4.3 | 1 | 4 | 0.6 | 29 | Rust | 14 | NOASSERTION |
| 4 | 备选 | [JMTDI/Blesus](https://github.com/JMTDI/Blesus) | 58.3 | 15* | 15 | 15 | 7 | 4.3 | 8 | 5 | 0.3 | 3 | TypeScript | 26 | Apache-2.0 |
| 5 | 备选 | [illmxnn/PDF-HTML-TXT-WORD-Document-Analyzer](https://github.com/illmxnn/PDF-HTML-TXT-WORD-Document-Analyzer) | 57.0 | 22^ | 13 | 9 | 10 | 4.3 | 8 | 5 | 0.0 | 0 | Python | 39 | MIT |
| 6 | 备选 | [alessandrobrunoh/Mnemosyne](https://github.com/alessandrobrunoh/Mnemosyne) | 56.4 | 15* | 15 | 13 | 10 | 4.3 | 8 | 5 | 0.4 | 10 | Rust | 42 | Apache-2.0 |
| 7 | 备选 | [mirkosertic/MCPLuceneServer](https://github.com/mirkosertic/MCPLuceneServer) | 55.4 | 12^ | 15 | 15 | 10 | 4.3 | 8 | 5 | 0.4 | 6 | Java | 1 | Apache-2.0 |
| 8 | 观察 | [yetidevworks/ygrep](https://github.com/yetidevworks/ygrep) | 51.8 | 15* | 13 | 10 | 5 | 5.3 | 8 | 5 | 0.8 | 60 | Rust | 22 | MIT |
| 9 | 观察 | [ltspace/dowse](https://github.com/ltspace/dowse) | 51.6 | 15* | 13 | 10 | 5 | 5.3 | 8 | 5 | 0.6 | 26 | Rust | 2 | Apache-2.0 |
| 10 | 观察 | [syberx/AI-Paperless-Organizer](https://github.com/syberx/AI-Paperless-Organizer) | 51.4 | 15* | 13 | 10 | 5 | 5.3 | 8 | 5 | 0.4 | 10 | TypeScript | 20 | MIT |
| 11 | 观察 | [paperless-ngx/paperless-ngx](https://github.com/paperless-ngx/paperless-ngx) | 49.0 | 16 | 13 | 10 | 5 | 7 | 3 | 5 | 2.0 | 46338 | Python | 0 | GPL-3.0 |
| 12 | 观察 | [botisan-ai/tantivy.swift](https://github.com/botisan-ai/tantivy.swift) | 48.5 | 15* | 11 | 9 | 5 | 5.3 | 8 | 5 | 0.5 | 12 | Swift | 63 | MIT |
| 13 | 观察 | [alrece/pivotsearch](https://github.com/alrece/pivotsearch) | 48.4 | 15* | 11 | 9 | 5 | 5.3 | 8 | 5 | 0.4 | 9 | Rust | 69 | Apache-2.0 |
| 14 | 观察 | [hueys/repogrep](https://github.com/hueys/repogrep) | 48.0 | 15* | 11 | 9 | 10 | 4.3 | 8 | 5 | 0.0 | 0 | Go | 40 | MIT |
| 15 | 观察 | [indextables/tantivy4java](https://github.com/indextables/tantivy4java) | 47.2 | 15* | 9 | 10 | 5 | 5.3 | 8 | 5 | 0.2 | 2 | Java | 1 | Apache-2.0 |
| 16 | 观察 | [TotallyNotAHackerTrustMeIAmADolphin/paperless-agent-ingest](https://github.com/TotallyNotAHackerTrustMeIAmADolphin/paperless-agent-ingest) | 47.0 | 15* | 9 | 10 | 5 | 5.3 | 8 | 5 | 0.0 | 0 | Python | 8 | MIT |
| 17 | 观察 | [strichte/paperless-rearchive](https://github.com/strichte/paperless-rearchive) | 47.0 | 15* | 9 | 10 | 5 | 5.3 | 8 | 5 | 0.0 | 0 | Python | 11 | MIT |
| 18 | 观察 | [rabestro/paperless-genie](https://github.com/rabestro/paperless-genie) | 46.4 | 15* | 13 | 10 | 5 | 5.3 | 3 | 5 | 0.4 | 9 | Python | 2 | AGPL-3.0 |
| 19 | 观察 | [eikek/docspell](https://github.com/eikek/docspell) | 45.4 | 13^ | 13 | 10 | 5 | 6.5 | 3 | 5 | 1.4 | 2332 | Elm | 1 | AGPL-3.0 |
| 20 | 观察 | [NextQuotes-EDGE/NexQ-Atlas](https://github.com/NextQuotes-EDGE/NexQ-Atlas) | 45.0 | 15* | 9 | 8 | 5 | 4.3 | 8 | 5 | 0.0 | 0 | ? | 136 | MIT |

## 二、star 榜 vs 适配榜的偏离（这是本 skill 的核心产出）

**高星但被高估/落选（只看 star 会选错）**

- [paperless-ngx/paperless-ngx](https://github.com/paperless-ngx/paperless-ngx) ★46338 → 适配度第 11 名，未进适配 Top10 —— 功能匹配仅 16/30：★46k、维护活跃、OCR 与全文检索成熟，覆盖'搜 PDF 正文'｜风险：是文档管理系统不是文件搜索；需导入文件；多容器部署｜证据来源 3 个
- [quickwit-oss/tantivy](https://github.com/quickwit-oss/tantivy) ★16187 → 适配度第 23 名，未进适配 Top10 —— 功能匹配仅 8/30：只提供检索引擎能力，可作自建底座｜风险：是库不是工具，工作量以周计｜证据来源 3 个
- [zhoubear/open-paperless](https://github.com/zhoubear/open-paperless) ★2558 → 被硬门槛拦下：停更 2857d > 1095d
- [eikek/docspell](https://github.com/eikek/docspell) ★2332 → 适配度第 19 名，未进适配 Top10 —— 功能匹配仅 13/30：文档整理+全文检索，能覆盖 PDF 正文检索｜风险：JVM+数据库+服务端形态；导入式管理｜证据来源 2 个｜⚠ 证据来源仅 2 个 < 要求 3 个（独立域 
- [zszszszsz/.config](https://github.com/zszszszsz/.config) ★359 → 被硬门槛拦下：停更 1097d > 1095d
- [SpaceFrontiers/summa](https://github.com/SpaceFrontiers/summa) ★294 → 适配度第 27 名，未进适配 Top10 —— 功能匹配度尚未判定，若认为它匹配需求，请补 --fit 重跑
- [Sfedfcv/redesigned-pancake](https://github.com/Sfedfcv/redesigned-pancake) ★267 → 被硬门槛拦下：停更 1970d > 1095d；空仓库（size=0）
- [ManojKumarPatnaik/Major-project-list](https://github.com/ManojKumarPatnaik/Major-project-list) ★255 → 适配度第 34 名，未进适配 Top10 —— 功能匹配度尚未判定，若认为它匹配需求，请补 --fit 重跑
- [Don-No7/Hack-SQL](https://github.com/Don-No7/Hack-SQL) ★148 → 适配度第 59 名，未进适配 Top10 —— 功能匹配度尚未判定，若认为它匹配需求，请补 --fit 重跑
- [Dicklesworthstone/xf](https://github.com/Dicklesworthstone/xf) ★112 → 适配度第 28 名，未进适配 Top10 —— 功能匹配度尚未判定，若认为它匹配需求，请补 --fit 重跑

**低星但适配度高（只看 star 会漏掉）**

- [riccione/glintindex](https://github.com/riccione/glintindex) ★0（star 榜第 68）→ 适配度第 1，分档「首选」
- [nampara-ai/librarian](https://github.com/nampara-ai/librarian) ★49（star 榜第 19）→ 适配度第 2，分档「备选」
- [Dicklesworthstone/ultrasearch](https://github.com/Dicklesworthstone/ultrasearch) ★29（star 榜第 24）→ 适配度第 3，分档「备选」
- [JMTDI/Blesus](https://github.com/JMTDI/Blesus) ★3（star 榜第 41）→ 适配度第 4，分档「备选」
- [illmxnn/PDF-HTML-TXT-WORD-Document-Analyzer](https://github.com/illmxnn/PDF-HTML-TXT-WORD-Document-Analyzer) ★0（star 榜第 69）→ 适配度第 5，分档「备选」
- [alessandrobrunoh/Mnemosyne](https://github.com/alessandrobrunoh/Mnemosyne) ★10（star 榜第 32）→ 适配度第 6，分档「备选」
- [mirkosertic/MCPLuceneServer](https://github.com/mirkosertic/MCPLuceneServer) ★6（star 榜第 38）→ 适配度第 7，分档「备选」
- [yetidevworks/ygrep](https://github.com/yetidevworks/ygrep) ★60（star 榜第 17）→ 适配度第 8，分档「观察」
- [ltspace/dowse](https://github.com/ltspace/dowse) ★26（star 榜第 25）→ 适配度第 9，分档「观察」
- [syberx/AI-Paperless-Organizer](https://github.com/syberx/AI-Paperless-Organizer) ★10（star 榜第 33）→ 适配度第 10，分档「观察」

## 三、被硬门槛淘汰的

| 仓库 | ★ | 淘汰原因 |
| --- | --- | --- |
| [karlicoss/scrapyroo](https://github.com/karlicoss/scrapyroo) | 7 | 停更 2307d > 1095d |
| [k-yomo/ostrich](https://github.com/k-yomo/ostrich) | 14 | 停更 1281d > 1095d |
| [swinkelhofer/paperless-office](https://github.com/swinkelhofer/paperless-office) | 8 | 停更 1420d > 1095d |
| [docfetcher/DocFetcher](https://github.com/docfetcher/DocFetcher) | 64 | 停更 2999d > 1095d |
| [hugozhu/node-fts-search](https://github.com/hugozhu/node-fts-search) | 3 | 停更 4181d > 1095d |
| [zszszszsz/.config](https://github.com/zszszszsz/.config) | 359 | 停更 1097d > 1095d |
| [yiluzhou/windows-local-search](https://github.com/yiluzhou/windows-local-search) | 0 | 空仓库（size=0） |
| [zhoubear/open-paperless](https://github.com/zhoubear/open-paperless) | 2558 | 停更 2857d > 1095d |
| [yiv/full_search](https://github.com/yiv/full_search) | 99 | 停更 2079d > 1095d |
| [jakejscott/dynamodb-email-indexer](https://github.com/jakejscott/dynamodb-email-indexer) | 34 | 停更 1635d > 1095d |
| [prahaladd/FSSearchIndexFX](https://github.com/prahaladd/FSSearchIndexFX) | 2 | 停更 5824d > 1095d |
| [uozuAho/lucene_cli_example](https://github.com/uozuAho/lucene_cli_example) | 0 | 停更 2251d > 1095d |
| [yugrocks/Searchbase-2.0](https://github.com/yugrocks/Searchbase-2.0) | 0 | 停更 3293d > 1095d |
| [klonnet23/helloy-word](https://github.com/klonnet23/helloy-word) | 92 | 停更 1499d > 1095d |
| [xiaoniu-578fa6bff964d005/docfetcher](https://github.com/xiaoniu-578fa6bff964d005/docfetcher) | 84 | 停更 3066d > 1095d |
| [dalanicolai/gnome-tracker-extension](https://github.com/dalanicolai/gnome-tracker-extension) | 69 | 停更 1715d > 1095d |
| [vivainio/docfetcher](https://github.com/vivainio/docfetcher) | 63 | 停更 4648d > 1095d |
| [vohidjon123/google](https://github.com/vohidjon123/google) | 44 | 停更 1638d > 1095d |
| [yida-lxw/docfetcher](https://github.com/yida-lxw/docfetcher) | 5 | 停更 4138d > 1095d |
| [cztchoice/docfetcher](https://github.com/cztchoice/docfetcher) | 2 | 停更 1882d > 1095d |
| [ProgrammerManstein/-Full-Text-Retrieval](https://github.com/ProgrammerManstein/-Full-Text-Retrieval) | 1 | 停更 1343d > 1095d |
| [OwlinLight/DocFetcher](https://github.com/OwlinLight/DocFetcher) | 1 | 停更 1283d > 1095d |
| [AlexandreSuperCC/docfetcher](https://github.com/AlexandreSuperCC/docfetcher) | 0 | 停更 1659d > 1095d |
| [xiaxiaoyu1988/docfetcher](https://github.com/xiaxiaoyu1988/docfetcher) | 0 | 停更 2721d > 1095d |
| [AlokPal88/SearchEngine](https://github.com/AlokPal88/SearchEngine) | 0 | 停更 3163d > 1095d |
| [gzpyzjy/docfetcher](https://github.com/gzpyzjy/docfetcher) | 0 | 停更 4008d > 1095d |
| [djbclark/docfetcher](https://github.com/djbclark/docfetcher) | 0 | 停更 3861d > 1095d |
| [nposocco/docfetcher](https://github.com/nposocco/docfetcher) | 0 | 停更 2565d > 1095d |
| [chriscz/docfetcher](https://github.com/chriscz/docfetcher) | 0 | 停更 3513d > 1095d |
| [shutaozhenzhen/docfetcher](https://github.com/shutaozhenzhen/docfetcher) | 0 | 停更 2239d > 1095d |
| [nyaundid/EC2-AWS-AND-SHELL](https://github.com/nyaundid/EC2-AWS-AND-SHELL) | 57 | 停更 1133d > 1095d |
| [arashstar1/bot-lua](https://github.com/arashstar1/bot-lua) | 43 | 停更 3312d > 1095d |
| [amir2510/script](https://github.com/amir2510/script) | 18 | 停更 3151d > 1095d；空仓库（size=0） |
| [kashyapshyani/Elasticsearch-based-Full-Text-search-engine](https://github.com/kashyapshyani/Elasticsearch-based-Full-Text-search-engine) | 1 | 停更 2404d > 1095d |
| [antoine-de/full_text_search_demo](https://github.com/antoine-de/full_text_search_demo) | 1 | 停更 2583d > 1095d |
| [Sfedfcv/redesigned-pancake](https://github.com/Sfedfcv/redesigned-pancake) | 267 | 停更 1970d > 1095d；空仓库（size=0） |
| [amremam2004/docfetcher](https://github.com/amremam2004/docfetcher) | 0 | 停更 3979d > 1095d；空仓库（size=0） |
| [hiteshsuthar01/OK-](https://github.com/hiteshsuthar01/OK-) | 41 | 停更 1628d > 1095d；空仓库（size=0） |

## 四、逐项证据（前 8 个）

### 1. [riccione/glintindex](https://github.com/riccione/glintindex) — 总分 64.0｜首选

- 描述：A fast, local desktop search engine built in Rust. GlintIndex indexes your files and provides instant full-text search.
- 功能匹配：Rust 本地桌面搜索引擎；README 明确 crawls configured directories + 27+ file types + Tantivy，无云｜风险：★0、无 release、单人项目，零社区验证；需自行编译｜证据来源 3 个｜⚠ 证据来源 3 个但都来自同一域名（github.com），独立性存疑
- 事实：★0｜fork 0｜订阅者 0｜贡献者 未采样｜语言 Rust｜许可 Apache-2.0
- 最近提交：2026-08-28T19:33:31Z 「Merge pull request #72 from riccione/release/v0.4.0」
- 最近发布：v0.4.0 @ 2026-08-28T19:48:13Z
- 风险提示：未见明显
- 功能匹配证据来源（3 个）：https://github.com/riccione/glintindex · https://github.com/riccione/glintindex/releases · https://github.com/riccione/glintindex/blob/main/README.md
- ⚠ 证据问题：证据来源 3 个但都来自同一域名（github.com），独立性存疑
- README 摘要：A fast, local desktop search engine built in Rust. GlintIndex indexes your files and provides instant full-text search without sending data to the cloud. GlintIndex crawls configured directories, parses text content from 27+ file types, and builds a Tantivy-powered search index. It supports binary …


### 2. [nampara-ai/librarian](https://github.com/nampara-ai/librarian) — 总分 61.7｜备选

- 描述：Text corpus cleaner and organizer. Local-first document parsing/copyediting/indexing pipeline. Feed it transcripts, PDFs, DOCX, images, or scans. Librarian extracts the text, cleans it with an LLM to…
- 功能匹配：local-first 文档解析+索引（PDF/DOCX/图片/扫描件），MIT｜风险：定位偏 LLM 清洗，超出需求且有外部依赖｜证据来源 3 个｜⚠ 证据来源 3 个但都来自同一域名（github.com），独立性存疑
- 事实：★49｜fork 3｜订阅者 1｜贡献者 未采样｜语言 Python｜许可 MIT
- 最近提交：2026-09-20T21:21:10Z 「docs: align v1.9.0 guides with current app and pipeline」
- 最近发布：v1.9.0 @ 2026-09-20T16:08:43Z
- 风险提示：未见明显
- 功能匹配证据来源（3 个）：https://github.com/nampara-ai/librarian · https://github.com/nampara-ai/librarian/releases · https://github.com/nampara-ai/librarian/blob/main/README.md
- ⚠ 证据问题：证据来源 3 个但都来自同一域名（github.com），独立性存疑
- README 摘要：Drop in messy documents. Get back a clean, classified, searchable library. Librarian is a local-first parser + copy-editor + librarian in one. Hand it transcripts, PDFs, DOCX, images, or scans; it extracts the text, can use an LLM to clean it in Chicago Manual of Style while preserving source facts…


### 3. [Dicklesworthstone/ultrasearch](https://github.com/Dicklesworthstone/ultrasearch) — 总分 59.6｜备选

- 描述：Windows desktop search engine combining NTFS MFT enumeration (instant filename search) with Tantivy full-text content indexing, in a multi-process Rust architecture
- 功能匹配：Windows 原生桌面搜索：NTFS MFT 秒级文件名 + Tantivy 全文内容索引，Rust 多进程，README 明确 single binary｜风险：许可 NOASSERTION；PDF/Office 正文抽取 README 未明确｜证据来源 3 个｜⚠ 证据来源 3 个但都来自同一域名（github.com），独立性存疑
- 事实：★29｜fork 7｜订阅者 0｜贡献者 未采样｜语言 Rust｜许可 NOASSERTION
- 最近提交：2026-09-22T17:26:09Z 「docs(agents): synchronize suite-wide rules and canonical multi-agent conventions」
- 最近发布：v1.5.1 @ 2026-08-31T21:34:48Z
- 风险提示：未见明显
- 功能匹配证据来源（3 个）：https://github.com/Dicklesworthstone/ultrasearch · https://github.com/Dicklesworthstone/ultrasearch/releases · https://github.com/Dicklesworthstone/ultrasearch/blob/master/README.md
- ⚠ 证据问题：证据来源 3 个但都来自同一域名（github.com），独立性存疑
- README 摘要：UltraSearch is a high‑performance, memory‑efficient desktop search engine for Windows. It combines NTFS MFT enumeration (Everything‑style instant filename search) with full‑text content indexing, all in Rust, with a multi‑process architecture that keeps the always‑on service tiny while isolating he…


### 4. [JMTDI/Blesus](https://github.com/JMTDI/Blesus) — 总分 58.3｜备选

- 描述：A fast, private, cross-platform desktop email client. Multi-account IMAP, full-text search, rules engine, and keyboard-first — no AI, no cloud, no tracking.
- 功能匹配：未提供：需要用 README/描述证据判定功能匹配度（见 SKILL.md 步骤 3）
- 事实：★3｜fork 0｜订阅者 0｜贡献者 未采样｜语言 TypeScript｜许可 Apache-2.0
- 最近提交：2026-09-10T17:09:59Z 「chore(release): v0.2.8」
- 最近发布：v0.2.8 @ 2026-09-10T17:17:03Z
- 风险提示：功能匹配度未判定（--fit 缺失），总分为估算值


- README 摘要：A fast, private desktop email client for Windows, macOS, and Linux. Multi-account IMAP, rich composer, FTS5 full-text search, rules engine, keyboard-first. No AI, Status: v0.1 — feature-complete for daily use; pre-release polish in progress. - Multi-account IMAP with SSL/TLS, STARTTLS, and plaintex…


### 5. [illmxnn/PDF-HTML-TXT-WORD-Document-Analyzer](https://github.com/illmxnn/PDF-HTML-TXT-WORD-Document-Analyzer) — 总分 57.0｜备选

- 描述：Local document indexing and search engine for PDF, DOCX, HTML, TXT and RAR with SQLite full-text search and OCR fallback
- 功能匹配：README 明确 PDF/DOCX/HTML/TXT/RAR + SQLite FTS + OCR 兜底 + PySide6 界面，验收标准全中｜风险：★0、无 release、依赖较多，需自备 Python｜证据来源 3 个｜⚠ 证据来源 3 个但都来自同一域名（github.com），独立性存疑
- 事实：★0｜fork 0｜订阅者 0｜贡献者 未采样｜语言 Python｜许可 MIT
- 最近提交：2026-08-29T13:43:07Z 「Improve project documentation」
- 最近发布：无 GitHub Release
- 风险提示：未见明显
- 功能匹配证据来源（3 个）：https://github.com/illmxnn/PDF-HTML-TXT-WORD-Document-Analyzer · https://github.com/illmxnn/PDF-HTML-TXT-WORD-Document-Analyzer/releases · https://github.com/illmxnn/PDF-HTML-TXT-WORD-Document-Analyzer/blob/main/README.md
- ⚠ 证据问题：证据来源 3 个但都来自同一域名（github.com），独立性存疑
- README 摘要：Desktop document indexing and search application for PDF, HTML, TXT, DOCX and RAR files. The project combines local SQLite full-text search, document extraction, optional OCR for scanned PDFs, entity-aware search and a PySide6 desktop interface. Local document search engine for PDF/HTML/TXT/DOCX/RA…


### 6. [alessandrobrunoh/Mnemosyne](https://github.com/alessandrobrunoh/Mnemosyne) — 总分 56.4｜备选

- 描述：Mnemosyne is a local history tool for developers that automatically captures every code save, even between Git commits. It provides fast snapshots, full‑text search, and instant file restore, all loc…
- 功能匹配：未提供：需要用 README/描述证据判定功能匹配度（见 SKILL.md 步骤 3）
- 事实：★10｜fork 1｜订阅者 1｜贡献者 未采样｜语言 Rust｜许可 Apache-2.0
- 最近提交：2026-08-25T21:45:17Z 「Merge pull request #36 from webbrain-one/webbrain/readme-translation」
- 最近发布：0.1.2 @ 2026-03-08T14:38:27Z
- 风险提示：功能匹配度未判定（--fit 缺失），总分为估算值


- README 摘要：Semantic Code Archaeology & High-Performance Memory for Your Codebase. Mnemosyne is a high-performance, local-first platform designed to provide an eternal memory for your development workflow. By leveraging Tree-sitter for semantic understanding and a content-addressable storage (CAS) architecture…


### 7. [mirkosertic/MCPLuceneServer](https://github.com/mirkosertic/MCPLuceneServer) — 总分 55.4｜备选

- 描述：MCP Lucene Server is a Model Context Protocol (MCP) server that exposes Apache Lucene's full-text search capabilities through a conversational interface. It allows AI assistants (like Claude) to help…
- 功能匹配：Lucene 全文检索 + 自动索引，Apache-2.0，活跃｜风险：面向 LLM Agent，不是给人用的搜索界面；需 JVM｜证据来源 3 个｜⚠ 证据来源 3 个但都来自同一域名（github.com），独立性存疑
- 事实：★6｜fork 2｜订阅者 0｜贡献者 未采样｜语言 Java｜许可 Apache-2.0
- 最近提交：2026-09-21T22:24:08Z 「chore(deps): bump lucene.version from 10.5.0 to 10.5.1」
- 最近发布：2.0.1 @ 2026-04-24T10:43:28Z
- 风险提示：未见明显
- 功能匹配证据来源（3 个）：https://github.com/mirkosertic/MCPLuceneServer · https://github.com/mirkosertic/MCPLuceneServer/releases · https://github.com/mirkosertic/MCPLuceneServer/blob/main/README.md
- ⚠ 证据问题：证据来源 3 个但都来自同一域名（github.com），独立性存疑
- README 摘要：A Model Context Protocol (MCP) server that exposes Apache Lucene fulltext search capabilities with automatic document crawling and indexing. This server supports both STDIO transport (for Claude Desktop integration) and HTTP transport (for web-based clients and remote access). - Automatically index…


### 8. [yetidevworks/ygrep](https://github.com/yetidevworks/ygrep) — 总分 51.8｜观察

- 描述：A fast, local, indexed code search tool optimized for AI coding assistants. Written in Rust using Tantivy for full-text indexing.
- 功能匹配：未提供：需要用 README/描述证据判定功能匹配度（见 SKILL.md 步骤 3）
- 事实：★60｜fork 8｜订阅者 ?｜贡献者 未采样｜语言 Rust｜许可 MIT
- 最近提交：2026-09-15T00:16:01Z（22d 前）
- 最近发布：无 GitHub Release
- 风险提示：功能匹配度未判定（--fit 缺失），总分为估算值






## 六、数据缺口说明

- 深度体检上限 无（--no-deep 浅层模式） 个，其余候选只有浅层数据（可落地/维护/许可由搜索快照得出，文档与生态按中位分），其总分仅供排序参考。
- 功能匹配分缺失（带 * ）的条目，总分不可直接决策：请按 README/描述补齐 --fit。
- 自动标记（flags）来自命名词/描述/体积的启发式判断，可能误判，请人工复核。

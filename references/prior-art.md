# 同类方案调研（prior-art）：取什么、扔什么

> 这份文档回答两个问题：**"这个想法是不是已经有人做了？"** 和 **"我们凭什么不直接用它们？"**
> 调研时间：2026-10-07；方法：GitHub 仓库检索 4 轮共 16 条检索式（候选池累积 139 个）+ skill 市场（skillsmp）+ web 检索，对其中 7 个读了 SKILL.md / README 原文。
> 所有数字都是**检索当时的快照**，会变；要看最新状态请自己重跑 `gh-search.mjs`。

---

## 1. 结论先说

**在同一条赛道上，已经有一小撮人在做**（而且名字重复度高到 `github-open-source-scout` 撞车两次），说明"用一句需求去搜开源方案"是普遍直觉。

**但"反 star 权重 + 证据化功能匹配 + 硬门槛 + 高星落选对照"这个组合没有现成等价物。** 最接近的两个是 `@rakeshroushan/reposcout`（架构像，但 star 占 20%）和 `whichlib`（能力像，但 star/热度占 65%）。

---

## 2. 现有方案逐条对照

| 方案 | 形态 | 重合点 | 关键差异（为什么不能直接用） |
|---|---|---|---|
| `@rakeshroushan/reposcout`（[npm](https://www.npmjs.com/package/@rakeshroushan/reposcout)） | MCP server + 配套 skill | **架构最接近**：按意图多查询并集去重 → 拉 README+元数据 → 确定性分值 + agent 相关性判断 → 可解释短名单；本地缓存、GITHUB_TOKEN、默认排除 archived | 权重 `relevance 0.4 / popularity 0.2 / maintenance 0.2 / completeness 0.2` —— **star 占 20%**（我们 2%）；无"高星落选"对照输出；无内容倾倒仓库识别 |
| `whichlib`（[npm](https://www.npmjs.com/package/whichlib) · [repo](https://github.com/josifb/whichlib), MIT） | MCP server | 能力最像：`recommend_repos` / `compare_repos`，0–100 分 + 分档 + 一句话 verdict + 完整分项 | 分值 **Momentum 40%（7 日 star 增量）+ Adoption 25%（star/fork/下载）= 65% 热度驱动**；archived 只是封顶 20 分而非淘汰；还有 **"1 万星以上仓库的维护分永不跌破一半"**的豁免规则——这正是我们要消灭的偏差 |
| `reposcout`（[npm](https://www.npmjs.com/package/reposcout)，build-vs-borrow） | npm CLI + Claude skill | 定位最像：实现前"先看看有没有现成的"预检；分析需求 → 查栈上下文 → 搜 OSS → 按 relevance/stack fit/maintenance/**popularity**/license 排序 | 偏"防重复造轮子"而非"选型调研"；排序含 popularity；无对照输出、无硬门槛 |
| `github-solution-finder`（[DevHive1/DevHive-Cli](https://github.com/DevHive1/DevHive-Cli)，★18） | Agent Skill | 意图几乎一致："Search GitHub for battle-tested libraries instead of building from scratch"；有完整检索算子表与查询模板（含 `stars:N..M` 挖 hidden gems） | **把 star 当信任门槛**（基线模板 `stars:>500` / `>5000`）；无评分权重、无证据体检、无对照输出；主力靠 web 检索 |
| `pi-skill-tech-deep-dive`（[npm](https://pi.dev/packages/@firstpick/pi-skill-tech-deep-dive), MIT） | Agent Skill（约 5KB） | 方法论最讲究：8 维度 ×1–5 分、**每个候选最少 3 个独立来源（深评 ≥8）**、要求并行取证、缺来源必须明说 | 不搜 GitHub（靠 package registry + awesome 清单）；无硬门槛；无"高星落选"；不规定 star 权重 |
| `github-open-source-scout`（[LiShiyirain](https://github.com/LiShiyirain/github-open-source-scout) ★3 MIT ／ [Zibor233](https://github.com/Zibor233/github-open-source-scout) ★4 Apache-2.0） | Agent Skill | **同名同定位**；后者源自 [Trae 社区赛作品](https://forum.trae.cn/t/topic/18255/7)，描述为"一句需求 → 搜 GitHub → 识别开源协议 → 输出候选链接/适配理由/风险提示/推荐建议" | 星数极低、86–140 天未更新；无公开的评分机制与反 star 规则 |
| `nathan-hoche/RepoSniffer`（[★2 MIT](https://glama.ai/mcp/servers/nathan-hoche/RepoSniffer)）／[will702/find-repo](https://github.com/will702/find-repo) | MCP / agent 工具 | "描述一个功能 → 拿到仓库"；find-repo 还带 codebase health 体检 | 无公开排序方法论；项目极早期 |
| `lingzhi227/agent-research-skills`（★383）→ `github-research` skill | Agent Skill | 也是"用 skill 搜 GitHub" | 面向学术检索，不是选型 |

---

## 3. 我们吸收的（取其精华）

| 借来的东西 | 来源 | 我们的实现 |
|---|---|---|
| **每次调用可覆盖权重**（预设 + 细粒度） | `@rakeshroushan/reposcout` | `--weights fit-first \| risk-averse \| quick-tool \| "fit=40,license=12,popularity=0"`，自动归一化到 100 |
| **每个候选至少 N 个独立来源**，缺证据必须明说 | `pi-skill-tech-deep-dive` | `--fit` 条目支持 `sources: [...]`；`--min-sources 3`；不足则该项**封顶 20 分并标 `^`**；`--strict-evidence` 下直接视为未提供；来源全在同一域名会提示"独立性存疑" |
| **"强匹配才打断"纪律** | `reposcout`（build-vs-borrow） | 报告开头新增「〇、结论」：只有 `功能匹配 ≥22 且进首选/备选` 才算强匹配；否则明确建议"直说没有现成方案 + 给自建路线"，不许硬推 |
| **多查询并集 + README 富化 + 确定性打分与 LLM 判断分工** | `@rakeshroushan/reposcout` | `gh-search.mjs` 多策略并集去重；`repo-audit.mjs` 负责确定性数学，`--fit` 留给模型判断功能匹配 |
| **0–100 分 + 分档 + 一句话 verdict** | `whichlib` | 100 分制 + 首选/备选/观察/仅借鉴 + 每项 note 作为"可解释的分项" |
| **`pushed:>` 作为关键新鲜度信号、算子清单** | `github-solution-finder` | 已在其检索策略里（`search-patterns.md`），并更进一步：新鲜度是**可调硬门槛**（`--max-idle-days`）而非查询词 |
| **问题→需求画像→候选→评分→推荐的骨架** | `pi-skill-tech-deep-dive` | Phase 0 八行画像 + Phase 3 三问 + 报告模板 |

## 4. 我们明确拒绝的（去其糟粕）

| 扔掉的东西 | 出处 | 为什么不学 |
|---|---|---|
| **用 star/热度当 20%–65% 的权重** | reposcout 20%、whichlib 65% | star 是"过去有多少人觉得它有用"，不是"对你这个需求有没有用"。高星头部常被泛用大平台和配置文件仓库占据（实测：搜 `claude skills` 时 star 榜首是 ★274k 的 harness 配置和 ★217k 的单文件 CLAUDE.md） |
| **star 增量（momentum）作为"势头"信号** | whichlib（Momentum 40%） | ① 它是**热度放大器**：涨星快常来自热点/营销，而不是适配性；② 数据源在本机不可达（其依赖 `raw.githubusercontent.com`，实测 000），第三方抓取脆弱。**替代方案**：用我们已经免费拿到的 release 数据算发行节奏变化（发行活跃/仍在发行/发行放缓），这是 star-free 的势头信号 |
| **"高星仓库永不跌破维护半分"的豁免** | whichlib | 这等于说"著名项目可以永远不更新"。停更就是停更，应当按同一把尺子量 |
| **archived 只降分不淘汰** | whichlib（封顶 20 分） | 归档 = 官方宣布不再维护。默认直接淘汰，想留就显式 `--allow-archived` |
| **把 awesome 清单/教程当候选** | 多数方案未处理 | 清单是**线索源**不是方案；我们的候选池会自动打 `likely-awesome-list` / `likely-learning-material` / `content-dump` 标记并降权 |
| **只给一个"好排序"，不解释为什么没选高星项目** | 全部现有方案 | 报告的第三节/第四节（高星落选、低星入选）是"不按 star"最直接的落地形式，缺了它等于把结论交给读者猜 |
| **沉默的权重调法（改代码常量）** | — | 权重可覆盖，但 `popularity > 10` 直接拒绝执行（`--allow-star-heavy` 才能放行）——**工具自己不能变成 star 排序器** |

---

## 5. 已知盲区（这份调研没覆盖到的）

1. 本机 `raw.githubusercontent.com` 被墙、GitHub core 配额在调研时耗尽，**没能逐个 grep 几个大合集内部**（如 `VoltAgent/awesome-agent-skills` 号称 1000+ skills、`alirezarezvani/claude-skills` 380 个）。所以结论是"没找到等价物"，不是"绝对不存在"。
2. 只覆盖了公开可检索的方案；闭源/内部工具、以及非英语社区（日/韩/西语）的 skill 可能没被检索到。
3. star 数字只是快照，且该领域 star 榜噪声极大（`gh-search` 的池质量告警在这一轮里又一次触发）。

**复现方式**（配 token 后可把盲区补齐）：

```bash
node scripts/gh-search.mjs \
  --q "github solution finder" --q "repo discovery skill claude" \
  --q "library recommendation choose dependency agent" --q "agent skills marketplace" \
  --q "awesome claude skills" --q "tech selection skill" \
  --runs best,name,stars,updated --per-page 20 --out gh-scout-out/prior-art.json --md gh-scout-out/prior-art.md
```

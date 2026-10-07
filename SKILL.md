---
name: github-repo-scout
description: 需求驱动的 GitHub 开源方案侦察：用户说出任何"想做个东西 / 找个工具 / 选个库 / 有没有现成的 / 找个替代品 / 别自己造轮子 / 自托管方案"的需求时，先主动把 GitHub 上的相关项目搜全，再用证据化体检与适配度评分给出"最合适且真正有用"的方案，而不是 star 最多的那个（star 在 100 分里只占 2 分，且有硬上限）。含 gh-search.mjs 多策略检索脚本、repo-audit.mjs 体检评分/分档/高星落选对照脚本、可调权重与证据门槛（功能匹配分要求 ≥3 个独立来源）、检索策略库、评分细则与同类方案调研。触发词：找个开源项目、有没有现成的、技术选型、替代方案、替代品、自托管、用什么库、别自己造轮子、GitHub 上有什么、帮我搜项目/轮子。
metadata:
  short-description: 需求驱动搜 GitHub 开源方案，按适配度而非 star 排序
argument-hint: "<需求描述>"
version: 1.0.0
---

# GitHub Repo Scout — 先搜生态，再给方案

**用户一旦表达"我要做点什么"的需求，默认动作是先去 GitHub 搜一圈，而不是先凭记忆答。**
本 skill 的产出不是"star 最多的那个项目"，而是**对这个用户的这个需求最合适、且真正能用起来的项目**。

---

## 0. 铁律（违反任意一条 = 返工重做）

| # | 铁律 | 可检验的形式 |
|---|---|---|
| **R1** | **不许按 star 排序** | 最终榜单按 `repo-audit.mjs` 的总分排（满分 100，star 只占 2 分）。若首选不是候选池里 star 最高的，必须显式写出"为什么低星更合适"。若首选就是最高星，必须写出"它凭什么赢过其他候选"，不能只因为它星多。 |
| **R2** | **先立需求画像再检索** | 检索前先输出 Phase 0 的八行卡片；需求含糊时一次性问 ≤3 个关键问题，同时**不要停**，先按最宽的假设搜一轮。 |
| **R3** | **收全优先（Recall）** | 候选池 ≥ 20 个；检索式 ≥ 6 条且中英各半、含同义词/上位词/竞品名；至少跑 `best / name / stars / updated` 四种策略。只搜一个词就下结论 = 未完成。 |
| **R4** | **禁止凭记忆描述仓库** | 任何关于某仓库的事实（还在维护吗、什么许可、支持不支持某功能）必须来自脚本输出、README 或 web_search 结果，并给出处（URL/字段名）。记忆里的 star 数、最近提交时间**一律不可信**。 |
| **R5** | **首选/备选必须可验证** | 每个首选/备选条目附"最小验证步骤"（docker run / npm i / pip install / 5 分钟跑通路径），并注明该步骤来自 README 的哪一节。 |
| **R6** | **不许把资料当项目** | awesome 清单、教程、课程、面试题、论文仓库、纯镜像 fork 一律不能作为"可用方案"，只能作为"继续找的线索"。脚本的 `flags` 会标出来，但你必须复核。 |

> 这条铁律的存在理由：**star 是"过去有多少人觉得它有用"，不是"对你现在这个需求有没有用"。**
> 高星头部通常已经被"泛用型大项目"占满（它们能解决 10% 的需求，但会带 10 倍的复杂度）。

---

## 1. 四阶段工作流

每个阶段都有 **MUST 输出**，缺失就不许进入下一阶段。

### Phase 0 · 需求画像（Intent → Query Model）

**进入条件**：用户提出需求，无论多模糊。

**MUST 输出**（八行，写给人看）：

```
- 要解决的事：<一句话>
- 交付形态：<CLI / 库 / 自托管服务 / 桌面 GUI / 浏览器扩展 / 只是参考实现>
- 运行环境：<Windows/macOS/Linux/Docker/浏览器/移动端>
- 技术栈：<语言与框架；用户没说的话写"未指定">
- 硬约束：<离线 / 私有化 / 许可（能否闭源商用）/ 性能 / 体积 / 依赖越少越好>
- 验收标准：<做到什么算解决了>
- 排除项：<明确不要的东西，例如"不要 SaaS""不要 Electron">
- 检索词种子：<中英各 3-6 个关键词 + 同义词 + 上位词 + 已知竞品名>
```

需求含糊时：**一次性**问 3 个问题（交付形态 / 运行环境 / 许可与部署约束），然后**立即按最宽假设开搜**，不要在等回答的间隙干等。搜到的结果往往能让用户把需求说清楚。

### Phase 1 · 广撒网（Recall 优先，不排序）

```bash
node scripts/gh-search.mjs \
  --q "<英文关键词 3-6 个> in:name,description" \
  --q "<英文同义词>" --q "<上位词 / 更通用的说法>" \
  --q "<竞品名> alternative" --q "<中文关键词1 中文关键词2>" \
  --runs best,name,stars,updated \
  --per-page 30 --max-requests 30 \
  --out gh-scout-out/candidates.json --md gh-scout-out/candidates.md
```

要点：
- **一个 `--q` 只放 3-6 个关键词**。GitHub 搜索是 AND 语义，写一整句话会返回 0 条（`total≈0` 就是这个信号）。
- 多词概念要用引号，例如 `--q '"read it later" self-hosted'`。
- 中文需求也要配英文检索式（GitHub 中文描述命中率低得多）。
- 候选池里出现 `total_count` 只有 1-2 的检索式，说明这条式写得太窄，换词重跑。
- 命中数为 0 或候选池 < 20 时，回到 Phase 0 换词，不许直接下结论。
- **换词重搜时用 `--merge <上一轮的 candidates.json>` 累积**，不要丢上一轮的战果（脚本按 `full_name` 去重，`hits` 会累加）。
- **看脚本的「池质量告警」**：如果 `star 榜前 15 名里带质量标记的比例 ≥ 50%`，说明这批关键词在这个领域里根本没有"被 star 认可的真实项目"（实测常见于用泛化名词搜索时，star 头部全是 `.config`、JSON/HTML 倾倒仓库、教程清单）。此时**不要继续评这些垃圾**，立刻换用更具体的词：竞品名、`<能力> + cli/docker/self-hosted`、领域技术词（如 `tantivy`、`lucene`、`ripgrep`、`ntfs`）。

**MUST 输出**：候选池（≥ 20 个）+ 检索式清单 + "star 榜 vs 命中榜"差异（脚本已生成，直接读 `candidates.md` 第二、三节）+ 池质量告警的处置（有告警就必须说明换了什么词）。

### Phase 2 · 体检（把模糊候选变成事实）

```bash
node scripts/repo-audit.mjs --in gh-scout-out/candidates.json \
  --target-lang "<你的栈，如 TypeScript,Python>" --deep 12 \
  --intent "<Phase 0 的画像一句话>" \
  --commercial            # 用户要商用/闭源集成时加上，无许可会被硬门槛拦下
  --out gh-scout-out/audit.json --md gh-scout-out/audit.md
```

先看 `audit.md` 的第四节"逐项证据"——里面有每个仓库的 **README 摘要、最近提交、最近 release、订阅者、许可**。这些就是判定功能匹配的证据。

**配额不够时的两级打法**（实测匿名配额跑两轮就见底：search 10/min、core 60/hr）：
1. 先 `--no-deep` 跑一次（**0 请求**）：按"可比分"排序（不含需要逐仓采样的文档/生态两项），先把值得看的候选挑出来。
2. 再对挑出来的那几个补深度体检：`--deep 6`（6×4≈24 请求）。之前体检过的仓库会走缓存，不消耗配额。

**MUST 输出**：哪些被硬门槛淘汰（archived / 停更 / 无许可 / 内容倾倒仓库）及其原因；哪些是"冻结但可用"（停更 >1y 但功能完备，属于可用候选而不是垃圾，要单独说明）。

### Phase 3 · 功能匹配判定（这一步必须自己做，不能交给 star 或描述）

对 Phase 2 里的前 10-15 个候选，逐个回答三个问题：

1. 它的**功能边界**覆盖了 Phase 0 验收标准的哪几条？哪几条明显缺口？
2. 它的**部署/集成成本**具体是多少（几个容器？要数据库吗？要 Node 版本？Windows 能不能跑？）
3. 它的**项目状态**：单人维护 / 公司维护 / 已收编进某组织？issue 是否有人回？

然后写 `fit.json`（0-30 分，证据来自 README 摘要与描述，理由必须写清楚）：

```json
{
  "owner/name": {
    "fit": 27,
    "why": "支持 X/Y/Z，与验收标准 1-3 一致；Docker 单容器，符合部署约束",
    "risk": "README 未见 Windows 原生支持",
    "sources": [
      "https://github.com/owner/name",
      "https://github.com/owner/name/releases",
      "https://raw.githubusercontent.com/owner/name/master/README.md",
      "https://hub.docker.com/r/owner/name"
    ]
  },
  "owner/name2": { "fit": 12, "why": "只覆盖 Z，缺 X/Y；且依赖外部搜索服务，与离线约束冲突" }
}
```

**`sources` 不是可选项**（这条规则借自 `pi-skill-tech-deep-dive` 的"每个候选最少 3 个独立来源"）：
- 少于 `--min-sources`（默认 3）个来源 → 该项**封顶 20 分**并在表里标 `^`；
- 来源全在同一域名 → 提示"独立性存疑"（一个 README 看三遍不算三个来源）；
- `--strict-evidence` → 证据不足的条目直接视为未提供（退回中位分）。

参考打分口径（细见 `references/scoring.md`）：
`28-30` 边界完全吻合且部署无障碍｜`22-27` 核心需求全中，有次要缺口｜`15-21` 只中一半，需要二次开发或胶水层｜
`8-14` 只能借架构/思路｜`0-7` 名字像但用途不同。

补上 `--fit gh-scout-out/fit.json` **重跑 Phase 2 命令**（缓存命中，几秒完成），总分才可用于决策。

**权重按场景调**（`--weights`，预设或维度覆盖；star 项有硬上限 10 分，超了会被拒绝）：

| 预设 | 适用 | star 项 |
|---|---|---|
| `fit-first`（默认） | 通用选型 | 2 |
| `risk-averse` | 要长期维护、许可敏感、上生产 | 2 |
| `quick-tool` | 只要个能跑的小工具 | 2 |
| `"fit=40,license=12,popularity=0"` | 自己指定（自动归一化到 100） | 你说了算，但 ≤10 |

**MUST 输出**：`fit.json`（含 sources）+ 重跑后的适配榜 + 报告开头的「结论」判定。

### Phase 4 · 交付（报告 + 建议 + 落选说明）

按 `references/report-template.md` 输出。**必须包含**：

1. **需求画像**（Phase 0 那张卡片）
2. **结论先行**：报告开头就要给"有没有强匹配"的判定（借自 `reposcout` 的 build-vs-borrow 纪律）——
   **只有 `功能匹配 ≥22 且进首选/备选` 才算强匹配**。若最高功能匹配 < 22，直接说"没有合适的现成方案"，
   不要为了让报告好看而硬推一个；纯定制业务逻辑本来就不该硬找轮子。
3. **适配榜前 3-5 名**：每个写"为什么适合你"（对着验收标准逐条对）、"代价/风险"、"最小验证步骤"（注明来自 README 哪一节）
4. **高星落选说明**：至少 3 个 star 很高但没选的项目 + 落选原因（是硬门槛？还是功能不匹配？还是被复杂度拖累？）
5. **低星入选说明**：如果首选 star 不高，说明它在哪一点上赢了
6. **兜底方案**：如果全都不合适，明确说"没有合适的现成方案，建议自己写 + 可借鉴 A 的 X 部分、B 的 Y 部分"
7. **下一步动作**：装哪个、怎么验证、需要用户拍板的点

---

## 2. 脚本速查

两个脚本都在本 skill 目录下的 `scripts/`，无第三方依赖，Node ≥ 18 直接跑（`--help` 看全部参数）。

| 脚本 | 作用 | 关键参数 |
|---|---|---|
| `scripts/gh-search.mjs` | 多策略检索 → 候选池 JSON/MD | `--q`（可重复）、`--q-file`、`--runs best,name,stars,updated,forks,readme`、`--lang`、`--pushed-days`、`--min-stars/-max-stars`、`--include-archived`、`--order hits\|stars\|recent`、**`--merge`（多轮累积）**、`--top`、`--out/--md`、`--dry-run`、`--token` |
| `scripts/repo-audit.mjs` | 体检 + 适配度评分 + 分档 + 高星落选对照 | `--in`、`--repo`（可重复）、`--file`、`--target-lang`、`--intent`、**`--no-deep`（0 请求浅层排序）**、`--deep N\|all`、`--readme/--no-readme`、`--contributors`、`--commercial`、`--deny-licenses`、`--max-idle-days`、`--fit`、`--allow-archived/--allow-stale`、`--out/--md`（`--md -` 打到 stdout） |

两个脚本都会对**未知参数名**发警告（历史上出现过 `--merge` 被静默忽略），看到 `[warn] 未知参数` 就是拼错了。

工作目录约定：输出统一放 `gh-scout-out/`（脚本会自动建目录）。

**离线 / 无网时**：`--dry-run` 仍可生成检索式清单；改用 `web_search` 工具按同样的检索式搜，并把结果手工整理进候选池。**不要**因为不能用脚本就退回"凭记忆推荐"。

**在带沙箱的 agent 里跑（Codex、Claude Code 等）**：两个脚本都要访问 `api.github.com`，属于网络操作。
- 沙箱默认禁止联网时，**执行脚本前先申请网络/沙箱升级**（Codex 会说 "request escalation"），不要因为一次失败就断定脚本坏了。
- 脚本只做读操作（GET + 本地写缓存/报告），不写仓库、不发数据。允许联网即可，不需要更高权限。
- 缓存目录默认在系统临时目录；**若沙箱禁止写临时目录，脚本会自动降级为不缓存**（`noCache`），功能不受影响，只是重跑不再秒回。
- 报告输出统一写到当前工作目录下的 `gh-scout-out/`，这是沙箱通常已允许的位置。

**配额**：匿名 `search 10 次/分钟`、`core 60 次/小时`（深度体检每仓 4 请求，所以匿名下 `--deep` 别超过 12）。给一个 token 就宽 10-80 倍：

```bash
export GITHUB_TOKEN=<personal access token>     # 或写进 ~/.dsh/github-token
```
脚本自带节流、磁盘缓存（默认 6h，重跑秒回）与 403/429 重试；限速耗尽会明确告诉你何时恢复。

---

## 3. 检索式怎么写（写错就白搜）

| 场景 | 写法 |
|---|---|
| 精确找这类项目 | `--q "self hosted bookmark manager" --q "bookmark manager self-hosted in:name,description"` |
| 找同义/上位词 | `--q "read later"` + `--q "article archiver"` + `--q "web clipper server"` |
| 借竞品找替代 | `--q "wallabag alternative"` + `--q "obsidian alternative self-hosted"`（竞品名最有效） |
| 找某个具体能力 | `--q "headless browser screenshot"` + `--q "html to pdf cli"` |
| 按技术栈收窄 | `--lang Python,Rust`（`ts/py/golang` 等别名可用） |
| 排除死项目 | `--pushed-days 730`（默认不带，先广后窄） |
| 找成熟度高的 | `--min-stars 100`（**只用来补一条检索式，不能作为筛选主力**） |
| 中文项目 | `--q "自托管 稍后读"`（中文命中率低，一定配英文式） |

更多套路（topic:、in:readme、created:、反向检索、依赖生态反查）见 `references/search-patterns.md`。

---

## 4. 评分口径

满分 100：**功能匹配 30 / 可落地 20 / 维护 15 / 文档 10 / 生态 10 / 许可 8 / 风险 5 / 热度(star) 2**。

- **功能匹配 30** 只能由证据判定（`--fit`），脚本给不出，也不许用 star 代理。**每个条目至少 3 个独立来源**（`--min-sources`），不足则封顶 20 分并标 `^`；`--strict-evidence` 下视为未提供。
- **可落地 20**：语言是否命中你的栈（命中 8 / 未声明中位 5 / 不匹配 1）、有无可安装产物、体积是否正常、有无 topics/主页。
- **维护 15**：最近提交距今（≤30d 得 9 分档）、release 新鲜度、发布节奏 + **发行节奏变化**（发行活跃/仍在发行/发行放缓 —— 这是 star-free 的"势头"信号，用来替代 star 增量）。
- **生态 10**：贡献者（`--contributors` 采样）、订阅者、fork。**订阅者比 star 更抗刷。**
- **许可 8**：MIT/Apache 类 8；弱 copyleft 6；AGPL/GPL 3；无许可 0（商用场景直接硬门槛淘汰）。
- **风险 5**：停更、无许可、归档、疑似教程/清单/镜像、issue 积压、单一贡献者。
- **热度 2**：`2·log10(stars+1)/log10(50001)`。**刻意压到 2 分**：10 星和 5 万星的差距只有 1.4 分。

以上均可被 `--weights` 覆盖（预设 `fit-first` / `risk-averse` / `quick-tool`，或 `"fit=40,license=12,popularity=0"`）。
**唯一的硬约束：`popularity > 10` 会被拒绝执行**（除非显式 `--allow-star-heavy`）——工具本身不能变成 star 排序器。

硬门槛（先淘汰再看分）：已归档、停更超过 `--max-idle-days`（默认 1095 天）、商用场景无许可、命中 `--deny-licenses`、空仓库、**内容倾倒仓库**（description 是 `.config`/JSON/HTML 文件内容而不是项目说明——这类仓库会靠关键词全中污染检索结果，实测能在 `sort=stars` 里排到前几名）。

分档（按可得分上限的百分比，`--no-deep` 时上限是 80）：≥80% 首选｜68-79% 备选｜55-67% 观察（值得读代码/借鉴）｜<55% 仅借鉴。

---

## 5. 必须避开的坑（踩过就别再踩）

1. **只挑 star 头部** → 前 10 名通常全是"泛用大平台"，你的需求只是它的 5%。候选池要能看到 10-200 星但精准命中的项目。
2. **把 awesome 清单 / 教程当方案** → 它们只能提供线索（清单反而值得读，用来扩充检索词）。
3. **没发现"star 榜全是垃圾"这个信号** → 泛化名词（如 `desktop full text search`）的 star 头部经常是 `.config`、JSON/HTML 倾倒仓库、课程作业（实测某轮 star 榜前 15 有 12 个带质量标记）。这不是"没有好项目"，是**你的词不对**：换竞品名/具体技术词重搜（见 Phase 1 池质量告警）。
4. **只看 README 首页就下结论** → README 是营销；要看最近提交、release、issue 是否有人回、有没有 CI。
5. **把停更的成熟项目一票否决** → "冻结但可用"（功能完备、无重大 bug、许可清楚）是合理选择，要在报告里明确标"已停更但可用"。
6. **漏掉不在 GitHub 的项目** → 一些项目在 Codeberg / Gitea / GitLab / 自建站；`web_search` 补一轮，并在报告里说明"生态里还有非 GitHub 方案"。实测：搜 `recoll alternative` 返回 0 条，因为 Recoll 的主场不在 GitHub。
7. **撞上镜像/派生仓而不自知** → 搜老牌项目时命中的可能是 `someone-else/project` 这种镜像（无许可、久未更新），必须回到原始仓库再核一次。
8. **搜到 3 个就宣布"没有更好的"** → 候选池 < 20 时结论无效，换词继续。
9. **推荐一个需要二次开发才能用的项目却不说明工作量** → 凡 `fit < 22` 的候选，必须给出改造工作量的量级估计。
10. **把 monorepo 里的某个子目录当独立项目** → 大项目的插件/扩展生态要单独搜（搜 `topic:` 或 `in:readme`）。

---

## 6. 什么时候不该触发本 skill

- 纯知识问答（"X 是什么""A 和 B 的区别"）——除非用户是要选型。
- 调试用户已经在用的库的报错 → 直接定位问题。
- 用户明确说"别搜了，直接按我说的做"。
- 目标明确到只有一个实现路径（例如"给这个函数加个参数"）。

## 7. 相关文件

- `references/search-patterns.md` — 检索策略库（查询语法、关键词扩展矩阵、反 star 偏见的 6 种手法、噪声识别、非 GitHub 生态、多轮累积实战）
- `references/scoring.md` — 评分与硬门槛的完整细则、fit 打分锚点、浅层/可比分模式、深度体检名额分配
- `references/report-template.md` — 交付报告模板与写作纪律
- `references/prior-art.md` — **同类方案调研**：这个想法别人做到哪一步了、我们取了哪些精华、明确拒绝了哪些糟粕（含证据链接、权重数字与复现命令）
- `examples/example-1-selfhosted-readlater.md` — 真实产出范例（自托管稍后读；star 榜首入选但 AGPL 降权）
- `examples/example-2-local-fulltext-search.md` — 真实产出范例（Windows 本地全文搜索；★0 项目胜出、★46k 项目落选，含"star 榜全是垃圾"的池质量告警过程）

# 检索策略库（search-patterns）

> 本文件回答一个问题：**怎么才能把"和这个需求有关的项目"搜全、搜准，而不是只捞到 star 头部。**
> 配合 `scripts/gh-search.mjs` 使用；命令里的 `--q` 直接吃 GitHub 原生检索语法。

---

## 1. 先记住 GitHub 仓库搜索的三个事实

1. **AND 语义**：`self hosted read later app` 会要求五个词都出现（名称/描述/README 里）。所以**检索式里放 3-6 个词**，多一个词命中数可能掉一个数量级。
2. **多词概念必须加引号**：`"read it later"`、`"headless browser"`、`"static site generator"`。不加引号会被拆成独立词，召回噪声大。
3. **排序方式决定你看到谁**：默认 best-match 偏相关，`sort=stars` 只给你头部大项目。**同一个需求必须轮换排序跑**，否则永远只看到同一批人。

---

## 2. 限定符速查（写进 `--q` 或 `--extra` 即可）

| 限定符 | 用途 | 例子 |
|---|---|---|
| `in:name` | 名字里必须有 → 精度最高 | `"bookmark manager" in:name` |
| `in:description` | 描述里必须有 | `clipper in:description` |
| `in:readme` | README 提到 → 召回最广、噪声最大 | `pocket alternative in:readme` |
| `in:topics` | 按 topic 命中 | `selfhosted in:topics` |
| `language:` | 语言 | `language:Rust`（脚本用 `--lang rust`） |
| `stars:` | 区间，**挖中腰部必用** | `stars:20..800`（脚本 `--min-stars 20 --max-stars 800`） |
| `forks:` | 二次开发活跃度 | `forks:>=30` |
| `pushed:` | 最后提交时间 → 过滤死项目 | `pushed:>2025-01-01`（脚本 `--pushed-since`） |
| `created:` | 创建时间 → 找新锐 | `created:>2024-06-01`（脚本 `--created-since`） |
| `topic:` | 精确 topic | `topic:self-hosted`（脚本 `--topic`） |
| `license:` | 许可（脚本侧更推荐 `--commercial` 让无许可直接淘汰） | `license:mit` |
| `archived:` | 归档状态 | 脚本默认加 `archived:false` |
| `mirror:false` | 排除镜像 | `mirror:false` |
| `fork:false` | 排除 fork | `fork:false` |
| `org:` / `user:` | 限定组织/作者 | `org:stalwartlabs` |
| `size:` | 体积 KB（判断是不是巨型单体） | `size:<50000` |
| `template:false` | 排除模板仓库 | `template:false` |

---

## 3. 关键词扩展矩阵（每个需求至少铺满 6 个角度）

| 角度 | 说明 | 例子（"自托管稍后读"） |
|---|---|---|
| 核心功能词 | 用户真正要的动作 | `read later`、`bookmark`、`archive` |
| 领域词 | 所属品类 | `knowledge management`、`content curation` |
| 上位词 | 更宽的类别，用来发现"不叫这个名字但能做这事"的项目 | `self-hosted web app`、`link manager` |
| 同义词 | 同一件事的别的叫法 | `save for later`、`link rot`、`web clipping` |
| 竞品名 | **命中率最高的一招** | `wallabag`、`pocket alternative`、`instapaper alternative` |
| 场景词 | 交付形态/使用方式 | `self-hosted`、`docker`、`cli`、`headless`、`serverless`、`browser extension`、`nas` |
| 技术栈词 | 影响可落地性 | `typescript`、`rust cli`、`go server` |
| 反向/组合词 | 找特定角度 | `offline first`、`privacy focused`、`no cloud` |

**中英双写**：`--q "稍后读 自托管"` + `--q "read later self-hosted"`。GitHub 中文描述命中率显著更低，中文式是补充不是主力。

---

## 4. 反 star 偏见：六种"让低星项目浮上来"的手法

1. **排序轮换**（脚本默认做了）：`--runs best,name,stars,updated`。`name` 那条最容易捞出精准的小项目。
2. **主动挖中腰部**：`--min-stars 20 --max-stars 800`。这个区间的项目通常"一个人认真维护、功能单一、正好够用"。
3. **用"多式共振"排序**：脚本的 `--order hits`（默认）。被 4 条完全不同的检索式都命中的项目，相关性远高于"只在某个宽松式里出现的高星大哥"。
4. **看抗刷信号**：`--contributors` 拉贡献者数；`subscribers_count`（订阅者）比 star 难刷得多；`forks/stars` 比值高 = 真被人二次开发过。
5. **把高星头部当"检索词矿"**：读它的 topics 和 README 里的 "Alternatives / Comparison / Inspired by" 段落，抄出新关键词再搜一轮。**高星项目最大的价值是它列出的替代品。**
6. **换个排序看同一批词**：`--order recent` 能看到"刚发版、还没涨星"的项目；`--order forks` 能看到"被拿来当底座"的项目。

---

## 5. 常见噪声与识别方法

脚本会给候选打 `flags`，但你要复核：

| flag | 含义 | 处理 |
|---|---|---|
| `content-dump` | **内容倾倒仓库**：description 是 `.config`/JSON/HTML/JS 文件内容（`Automatically generated file`、`Skip to content`、`<!DOCTYPE html>`、`{ "releases": {`、`(function(`…） | 直接淘汰。它们靠"关键词全中"污染候选池，实测能在 `sort=stars` 里排前几名 |
| `likely-awesome-list` | awesome-* / 精选清单 / 资料汇总 | 不是方案 → 当线索，抄它的列表继续搜 |
| `likely-learning-material` | 教程 / 课程 / 面试 / 笔记 / roadmap | 排除，或作为学习资料单独提一句 |
| `possible-mirror` | 镜像 / "fork of" | 找原始仓库（实测：搜老牌项目容易先命中 `someone/fork-of-it` 镜像） |
| `idle>2y` / `idle>1y` | 停更 | 不必然淘汰：判断是否"冻结但可用" |
| `no-license` / `license-unclear` | 无许可 / NOASSERTION | 商用场景直接淘汰（`--commercial`） |
| `huge-but-thin-desc` | 星多但描述空洞 | 手动看一眼，常见于"名字好听的聚合仓库" |
| `empty-repo` | size=0 | 淘汰 |
| `possible-toy` | 个人自用/玩具/实验性 | 降权，除非恰好够用 |

另外两类脚本标不出来的噪声：
- **同名不同物**：名字像但其实是别的东西（例：搜 `stash` 会撞上各种缓存/媒体库）。
- **monorepo 子目录**：真正想要的功能是某个大项目的子包/插件，要单独搜 `topic:` 或 `in:readme`。

---

## 6. 非 GitHub 生态（每个报告都该提一句）

GitHub 之外同样有方案，漏了会让结论失真：

- **代码托管**：Codeberg、GitLab（有 SaaS 也有 self-host）、Gitea/Forgejo、SourceHut、sr.ht
- **包管理器**：npm / PyPI / crates.io / Maven 上很多工具的主仓不在 GitHub（用 `web_search` 搜 "xxx npm package"、"xxx pypi" 找主页）
- **模型/数据集**：Hugging Face
- **论坛线索**：Hacker News（`hn.algolia.com`）、Reddit 子版、V2EX/掘金（中文项目常先在社区发布）
- **对比榜单**：awesome-selfhosted、AlternativeTo、OpenAlternative（**只当线索源**）

补充手法：`web_search` 搜 `"<需求>" self-hosted alternative`、`"<需求>" 开源 项目 2025`，把命中的仓库名回填到 `--repo` 里让脚本体检：

```bash
node scripts/repo-audit.mjs --repo owner/name --repo owner/name2 --readme --md gh-scout-out/audit-extra.md
```

---

## 7. 现成检索式模板（按需求类型套用）

**A. 自托管服务**
```
--q "self hosted <品类>" --q "<品类> self-hosted docker" --q "<竞品> alternative" \
--q "<品类> in:name,description" --q "自托管 <中文品类>"
```

**B. CLI 工具**
```
--q "<动作> cli" --q "<动作> command line tool" --q "<动作> tui" \
--q "<动作> cli in:name,description" --q "terminal <动作>"
```

**C. 库 / SDK（要嵌进自己代码）**
```
--q "<能力> library <语言>" --q "<能力> sdk" --q "<能力> bindings" \
--q "<能力> in:name,description" --lang <语言>
```

**D. 桌面 / 移动 GUI**
```
--q "<品类> desktop app" --q "<品类> tauri" --q "<品类> electron alternative" \
--q "<品类> gui" --q "<品类> 客户端"
```

**E. 找竞品替代（已有一个不顺手的工具）**
```
--q "<竞品> alternative" --q "<竞品> replacement" --q "alternative to <竞品>" \
--q "<竞品> in:readme" --q "<竞品> clone"
```

**F. 算法 / 实现参考（不需要成品，只想看别人怎么做）**
```
--q "<算法/协议> implementation" --q "<算法> reference implementation" \
--q "<算法> port" --q "<论文名> code"
```

**G. 挖中腰部（对已有的高星头部不满意时）**
```
... --min-stars 20 --max-stars 800 --pushed-days 365 --runs name,updated
```

---

## 8. 自查清单（Phase 1 结束前逐条过）

- [ ] 检索式 ≥ 6 条，中英各半，覆盖"核心功能/上位词/同义词/竞品名/场景词"五个角度
- [ ] 每种排序（best/name/stars/updated）都跑过至少一条
- [ ] 候选池 ≥ 20 个，且**包含至少 5 个 star < 200 的项目**
- [ ] 读过脚本输出的"star 榜 vs 命中榜"差异，能说出哪些高星是"泛用大项目"
- [ ] 有至少一条检索式专门用来找"中腰部"（`--min-stars/--max-stars`）
- [ ] **脚本没有报"池质量告警"**；若报了，已经换词重搜并用 `--merge` 把两轮结果并在一起
- [ ] 若候选池 < 20，已回到 Phase 0 换词，并记录了换词过程

## 9. 多轮检索怎么累积（实战用法）

第一轮泛词通常只能确认"该用什么词"，第二轮才是真正有效的检索。用 `--merge` 累积，别覆盖：

```bash
# 第一轮：泛化名词（大概率触发池质量告警）
node scripts/gh-search.mjs --q "desktop full text search engine" --q "local document search" \
  --out gh-scout-out/r1.json --md gh-scout-out/r1.md

# 第二轮：换成竞品名 + 具体技术词，并把第一轮并进来
node scripts/gh-search.mjs --q "ripgrep pdf epub office documents" --q "tantivy full text search" \
  --q "docfetcher" --q "paperless document archive ocr" \
  --merge gh-scout-out/r1.json \
  --out gh-scout-out/candidates.json --md gh-scout-out/candidates.md
```

实测效果（同一个需求）：第一轮 37 个候选里 star 头部全是垃圾；第二轮加入 `paperless-ngx`(★46k)、`tantivy`(★16k)、`docspell`(★2.3k) 等真实项目，池涨到 97 个，排序才有意义。
**经验：泛化名词用来"发现词汇"，竞品名和领域技术词用来"发现项目"。**

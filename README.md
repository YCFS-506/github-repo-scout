# GitHub 方案侦察（GitHub Repo Scout）

一个面向 AI 助手的开源方案选型 skill：先把需求转成检索画像，再广泛搜索 GitHub，用可核查的证据判断项目是否适合，而不是只看 star 数。

适合回答“有没有现成的工具”“用哪个库”“找个更轻量的替代方案”“有什么可自托管的项目”等问题。

## 它会做什么

- 明确运行环境、技术栈、部署和许可约束，以及验收标准。
- 用中英文、同义词、竞品名和多种排序策略建立候选池，并支持多轮合并去重。
- 检查 README、提交、release、许可证和项目风险，识别教程、清单、镜像及内容倾倒仓库。
- 根据功能匹配、落地成本和维护情况排序，说明首选、备选和高星项目落选的原因。
- 给出最小验证步骤；没有强匹配时，明确说明需要自行实现，以及哪些项目值得借鉴。

默认总分为 100：功能匹配 30、可落地 20、维护 15、文档 10、生态 10、许可 8、风险 5、热度 2。功能匹配由助手根据证据填写，脚本负责汇总、评分和生成报告。

## 安装为 skill

将本仓库放进你的 AI 助手支持的 skills 目录，使 `github-repo-scout/SKILL.md` 位于 skill 根目录。

Codex 首次安装示例：

```bash
# macOS / Linux
git clone https://github.com/YCFS-506/github-repo-scout.git ~/.codex/skills/github-repo-scout
```

```powershell
# Windows PowerShell
git clone https://github.com/YCFS-506/github-repo-scout.git "$env:USERPROFILE\.codex\skills\github-repo-scout"
```

如果目标目录已经存在，请先核对已有版本，再决定更新或替换。其他支持 `SKILL.md` 的助手，可按各自的 skill 加载方式导入整个目录。

加载后可以这样提出需求：

> 用 $github-repo-scout 帮我找一个 Docker 可部署的稍后读服务，要能保存网页正文并离线阅读。请按适配度推荐，并说明高星方案为什么入选或落选。

完整执行规范见 [SKILL.md](SKILL.md)。

## 独立运行脚本

需要 **Node.js 18 或更新版本**。脚本使用 Node.js 内置模块，无需安装 npm 依赖。联网检索会访问 GitHub API；匿名访问可用，但额度较小。

在仓库根目录执行：

```bash
# 查看完整参数
node scripts/gh-search.mjs --help
node scripts/repo-audit.mjs --help

# 只查看检索计划，不发网络请求
node scripts/gh-search.mjs --q "self-hosted bookmark manager" --q "wallabag alternative" --runs best,name,stars,updated --dry-run

# 生成候选池
node scripts/gh-search.mjs --q "self-hosted bookmark manager" --q "wallabag alternative" --runs best,name,stars,updated --per-page 30 --max-requests 8 --out gh-scout-out/candidates.json --md gh-scout-out/candidates.md

# 先做浅层评分，避免额外的深度体检请求
node scripts/repo-audit.mjs --in gh-scout-out/candidates.json --no-deep --intent "Docker 自托管稍后读服务，支持正文存档与离线阅读" --out gh-scout-out/audit.json --md gh-scout-out/audit.md
```

以上是脚本入门示例。完整选型应按 `SKILL.md` 扩展检索式和候选池，并对关键候选做深度体检。

助手还需要提供 `fit.json`，写明各候选的功能匹配分、理由、风险和来源，再通过 `--fit` 重跑评分。默认要求至少 3 个证据来源；来源不足的功能匹配分封顶 20。模板与规则见 [评分细则](references/scoring.md) 和 [报告模板](references/report-template.md)。

如需提高 API 额度，可在本地设置 `GITHUB_TOKEN` 或 `GH_TOKEN` 环境变量。不要把真实 token 写入仓库、报告或提交记录。脚本带有节流、缓存和限速重试。

## 目录结构

```text
.
├── SKILL.md                 # 触发条件、工作流和交付要求
├── agents/openai.yaml       # 展示名称和默认提示词
├── scripts/
│   ├── gh-search.mjs        # 多策略检索与候选池合并
│   ├── repo-audit.mjs       # 证据体检、评分和报告生成
│   └── lib.mjs              # 参数解析、API、缓存与公共工具
├── references/
│   ├── search-patterns.md   # 查询语法与检索策略
│   ├── scoring.md           # 权重、证据要求与硬门槛
│   ├── report-template.md   # 最终报告模板
│   └── prior-art.md         # 同类方案调研
├── examples/                # 实际选型报告与候选池示例
└── evals/evals.json          # 用于评估 skill 表现的需求案例
```

## 使用边界

这个 skill 帮助发现和比较方案，最终推荐仍需要运行最小验证步骤。star 仅占默认总分的 2 分，不能替代功能证据、部署验证或许可核查。纯知识问答和已有代码报错通常无需启动完整选型流程。

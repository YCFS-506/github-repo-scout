#!/usr/bin/env node
/**
 * gh-search.mjs — 广撒网检索：把一个需求扩成多条检索式，跑出"候选项目池"。
 *
 * 设计要点（对应 SKILL.md 的铁律 R1/R3）：
 *   1. 同一个需求至少跑 4 种检索式（默认 best / name / stars / updated），
 *      排序轮换是为了让"热度低但命中精准"的项目也能浮上来，而不是只捞 star 头部。
 *   2. 候选池的默认顺序是 `hits`（被多少条不同检索式命中），不是 star。
 *      hits 高 = 从多个不同角度都被搜到 = 更可能是这个需求的核心项目。
 *   3. star 只出现在"诊断视图"里，脚本会显式打印 star 榜与命中榜的差集，
 *      方便发现"高星但不相关"和"低星但正合适"。
 *
 * 用法示例：
 *   node scripts/gh-search.mjs \
 *     --q "self hosted read it later bookmark manager" \
 *     --q "read later 稍后读 自托管" \
 *     --lang TypeScript,Python --pushed-days 730 \
 *     --out gh-scout-out/candidates.json --md gh-scout-out/candidates.md
 *
 *   node scripts/gh-search.mjs --q "..." --dry-run     # 只打印检索式，不消耗配额
 */

import process from 'node:process';
import fs from 'node:fs';
import {
  API, Http, RateLimited, parseArgs, resolveToken, daysSince, shiftDays,
  normalizeLang, mdTable, mdEscape, writeJson, writeText, writeFailureHint, die,
} from './lib.mjs';

/* ------------------------------------------------------------------ plan --- */

const RUN_TYPES = {
  best: (q) => ({ q }),
  name: (q) => ({ q: `${q} in:name,description` }),
  stars: (q) => ({ q, sort: 'stars' }),
  updated: (q) => ({ q, sort: 'updated' }),
  forks: (q) => ({ q, sort: 'forks' }),
  readme: (q) => ({ q: `${q} in:readme` }),
};
const DEFAULT_RUNS = ['best', 'name', 'stars', 'updated'];
const RUN_ORDER = ['best', 'name', 'stars', 'updated', 'forks', 'readme'];

const HELP = `gh-search.mjs — 需求驱动的 GitHub 多策略检索（候选池）

用法:
  node scripts/gh-search.mjs --q "<检索式>" [--q "<另一条>"] [选项]

检索式（可重复；建议同时给中英两版、上位词、同义词、竞品名、"alternative" 等）
  --q "<str>"            一条检索式（GitHub 原生语法可直接写，如 "cli markdown editor"）
  --q-file <path>        从文件读检索式，一行一条（支持 # 注释）

检索策略
  --runs best,name,stars,updated,forks,readme   默认 best,name,stars,updated；all = 全跑
  --per-page 30          每个检索式取多少条（1-100）
  --max-requests 30      本次最多发多少个请求（匿名限速保护；按优先级顺序消耗）
  --order hits|stars|recent|forks   打印/排序依据，默认 hits（被多少条检索式命中）

过滤 / 限定（会写进 GitHub 查询语法）
  --lang TypeScript,Python     语言限定（支持 ts/py/golang 等别名）
  --min-stars N   --max-stars N
  --pushed-days N | --pushed-since YYYY-MM-DD
  --created-since YYYY-MM-DD
  --topic <t>（可重复） --owner <user> --extra "<原始限定符>"
  --include-archived           默认排除 archived

网络 / 配额
  --token <pat>    也可用 env GITHUB_TOKEN / GH_TOKEN，或 ~/.dsh/github-token（或 gh auth token）
  --no-cache  --cache-dir <dir>  --ttl-hours 6  --verbose

输出
  --out <candidates.json>   --md <candidates.md>
  --merge <old-candidates.json>   把上一轮候选池并进来（换词重搜时不丢战果；可重复）
  --top 40                  打印前 N 条
  --dry-run                 只打印将执行的检索式（0 请求，离线可用）
`;

function readQFile(a) {
  return a.all('q-file').flatMap((f) => {
    try {
      return fs.readFileSync(f, 'utf8').split('\n').map((l) => l.replace(/#.*$/, '').trim()).filter(Boolean);
    } catch (e) {
      return die(`读不到 --q-file ${f}: ${e.message}`);
    }
  });
}

function buildQualifiers(a) {
  const quals = [];
  const langs = a.all('lang').flatMap((v) => v.split(',')).map((s) => s.trim()).filter(Boolean).map(normalizeLang);
  for (const l of langs) quals.push(`language:"${l}"`);
  if (a.has('min-stars')) quals.push(`stars:>=${a.num('min-stars', 0)}`);
  if (a.has('max-stars')) quals.push(`stars:<=${a.num('max-stars', 0)}`);
  if (a.has('pushed-since')) quals.push(`pushed:>=${a.get('pushed-since')}`);
  else if (a.has('pushed-days')) quals.push(`pushed:>=${shiftDays(a.num('pushed-days', 0))}`);
  if (a.has('created-since')) quals.push(`created:>=${a.get('created-since')}`);
  for (const t of a.all('topic')) quals.push(`topic:${String(t).trim()}`);
  if (a.has('owner')) quals.push(`user:${a.get('owner')}`);
  if (!a.flag('include-archived')) quals.push('archived:false');
  if (a.has('extra')) quals.push(String(a.get('extra')));
  return quals;
}

function buildPlan(a) {
  const bases = [...a.all('q'), ...readQFile(a)].map((s) => s.trim()).filter(Boolean);
  if (!bases.length) die('没有检索式。至少给一个 --q "<关键词>"（可重复）或 --q-file <文件>。');
  let runs = a.has('runs') ? a.all('runs').flatMap((v) => v.split(',')).map((s) => s.trim()) : DEFAULT_RUNS;
  if (runs.includes('all')) runs = [...new Set([...runs.filter((r) => r !== 'all'), 'forks', 'readme'])];
  for (const r of runs) if (!RUN_TYPES[r]) die(`未知 --runs 取值 "${r}"，可选：${Object.keys(RUN_TYPES).join(' / ')} / all`);
  const quals = buildQualifiers(a);
  const perPage = Math.min(Math.max(a.num('per-page', 30), 1), 100);
  const plan = [];
  for (const run of RUN_ORDER.filter((r) => runs.includes(r))) {
    for (const base of bases) {
      const built = RUN_TYPES[run](base);
      const params = new URLSearchParams({ q: [built.q, ...quals].join(' '), per_page: String(perPage) });
      if (built.sort) {
        params.set('sort', built.sort);
        params.set('order', 'desc');
      }
      plan.push({ label: `${run}: ${base}`, run, searchText: built.q, url: `${API}/search/repositories?${params.toString()}` });
    }
  }
  const seen = new Set();
  return plan.filter((p) => (seen.has(p.url) ? false : (seen.add(p.url), true)));
}

/* ------------------------------------------------------------------ flags --- */

/**
 * 内容倾倒仓库识别（实测痛点）：有些仓库把 .config / JSON / HTML 文件内容直接当 description，
 * 靠"关键词全中"污染候选池，甚至能在 sort=stars 里排到前几名。它们不是项目，必须标出来。
 */
function looksLikeContentDump(name, descRaw) {
  const d = descRaw || '';
  if (/automatically generated file|do not edit|file generated (with|by)|generated with sqlitestudio|skip to content|<!doctype html|<html[\s>]|\(function\(|closure library authors|"releases"\s*:\s*\{/i.test(d)) return true;
  if (/code issues \d+ pull requests \d+|pulse ma?tador|spdx-license-identifier/i.test(d) && d.length > 120) return true;
  if (/^\s*[#{}<[]/.test(d) && d.length > 80) return true;
  const punct = (d.match(/[{}\[\]<>;=()\\/|]/g) || []).length;
  if (d.length > 200 && punct / d.length > 0.12) return true;
  const n = (name || '').toLowerCase();
  if (/^(\.config|\.?dotfiles?|scripts?|notes?|tmp|temp|backup|dump|data|config)$/.test(n) && punct > 0) return true;
  return false;
}

function computeFlags(c) {
  const name = (c.name || '').toLowerCase();
  const desc = (c.description || '').toLowerCase();
  const hay = name + ' ' + desc;
  const topics = (c.topics || []).map((t) => t.toLowerCase());
  const flags = [];
  if (c.archived) flags.push('archived');
  if (c.fork) flags.push('fork');
  if (!c.license) flags.push('no-license');
  else if (String(c.license).toLowerCase() === 'noassertion') flags.push('license-unclear');
  const idle = daysSince(c.pushed_at);
  if (idle !== null && idle > 730) flags.push('idle>2y');
  else if (idle !== null && idle > 365) flags.push('idle>1y');
  if (looksLikeContentDump(c.name, c.description)) flags.push('content-dump');
  if (/^awesome[-_.\s]/.test(name) || /awesome list|awesome-|精选|零基础|from zero|学习路线/.test(desc) || topics.includes('awesome') || topics.includes('awesome-list'))
    flags.push('likely-awesome-list');
  if (/(tutorial|course|教程|教学|面试|interview|handbook|cheat[- ]?sheet|学习笔记|读书笔记|roadmap|笔记仓库)/.test(hay))
    flags.push('likely-learning-material');
  if (/(\bmirror\b|镜像|read-?only mirror|\bfork of\b)/.test(hay)) flags.push('possible-mirror');
  if (/(self[- ]?use|for my own|个人自用|玩具|toy project|实验性|experimental only)/.test(desc)) flags.push('possible-toy');
  if ((c.size_kb || 0) === 0) flags.push('empty-repo');
  if (c.stars >= 20000 && (c.description || '').length < 12) flags.push('huge-but-thin-desc');
  return flags;
}

function rel(d) {
  if (d === null || d === undefined) return '?';
  if (d < 0) return 'future';
  if (d < 30) return `${d}d`;
  if (d < 365) return `${Math.round(d / 30)}mo`;
  return `${(d / 365).toFixed(1)}y`;
}

/* ------------------------------------------------------------------- main --- */

const a = parseArgs(process.argv.slice(2));

// 未知参数名很可能是拼错（曾经出现 --merge 被静默忽略），直接提示出来。
{
  const KNOWN = new Set(["q","q-file","runs","per-page","max-requests","order","lang","min-stars","max-stars","pushed-days","pushed-since","created-since","topic","owner","extra","include-archived","token","no-cache","cache-dir","ttl-hours","verbose","out","md","merge","top","dry-run","help"]);
  const unknown = [...new Set(process.argv.slice(2).filter((t) => t.startsWith('--')).map((t) => t.slice(2).split('=')[0]))].filter((k) => !KNOWN.has(k));
  if (unknown.length) process.stderr.write(`[warn] 未知参数（会被忽略）：${unknown.map((u) => '--' + u).join(', ')}；用 --help 查看支持的参数\n`);
}
if (a.flag('help')) {
  process.stdout.write(HELP);
  process.exit(0);
}

const token = resolveToken(a.get('token'));
const http = new Http({
  token: token.token,
  cacheDir: a.get('cache-dir'),
  ttlMs: a.num('ttl-hours', 6) * 3600e3,
  noCache: a.flag('no-cache'),
  verbose: a.flag('verbose'),
});

const plan = buildPlan(a);
const maxRequests = a.num('max-requests', 30);

if (a.flag('dry-run')) {
  process.stdout.write(`# 计划执行 ${Math.min(plan.length, maxRequests)} / ${plan.length} 条检索（auth=${token.source}）\n`);
  for (const p of plan.slice(0, maxRequests)) {
    process.stdout.write(`- [${p.label}]\n  ${decodeURIComponent(p.url.split('?')[1] || '')}\n`);
  }
  process.exit(0);
}

process.stderr.write(`[gh-search] auth=${token.source} plan=${plan.length} max_requests=${maxRequests}\n`);

const byRepo = new Map();
const queryLog = [];
const errors = [];
let rawItems = 0;
let mergedIn = 0;

/* 支持多轮检索累积：--merge 把之前的候选池并进来（同一需求换词重搜时用，不要丢上一轮的战果）。 */
for (const f of a.all('merge')) {
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (e) {
    die(`读不到 --merge ${f}: ${e.message}`);
  }
  for (const c of doc.candidates || []) {
    if (byRepo.has(c.full_name)) continue;
    byRepo.set(c.full_name, {
      full_name: c.full_name,
      name: c.name || c.full_name.split('/')[1],
      owner: c.owner || c.full_name.split('/')[0],
      owner_type: c.owner_type || null,
      url: c.url || `https://github.com/${c.full_name}`,
      description: c.description || '',
      homepage: c.homepage || '',
      stars: c.stars ?? 0,
      forks: c.forks ?? 0,
      open_issues: c.open_issues ?? 0,
      language: c.language || '',
      license: c.license || null,
      license_name: c.license_name || null,
      created_at: c.created_at || null,
      pushed_at: c.pushed_at || null,
      archived: !!c.archived,
      fork: !!c.fork,
      topics: c.topics || [],
      size_kb: c.size_kb ?? 0,
      default_branch: c.default_branch || null,
      matched_by: [...(c.matched_by || [])],
    });
    mergedIn++;
  }
  process.stderr.write(`[gh-search] merge ${f} → 累积 ${byRepo.size} 个候选（新增 ${mergedIn}）\n`);
}

for (const p of plan) {
  if (queryLog.length + errors.length >= maxRequests) {
    process.stderr.write(`[gh-search] 达到 --max-requests ${maxRequests}，剩余检索式未执行（加 token 或调大上限）\n`);
    break;
  }
  let res;
  try {
    res = await http.get(p.url);
  } catch (e) {
    if (e instanceof RateLimited) {
      errors.push({ label: p.label, error: 'rate-limited' });
      process.stderr.write(`[gh-search] 限速中断：${e.message.split('\n')[0]}\n`);
      break;
    }
    if (e.validation) {
      const degraded = p.url.replace(/(%20|\+| )archived:false/, '');
      try {
        res = await http.get(degraded);
        process.stderr.write(`[gh-search] 检索式被拒，已降级重试：${p.label}\n`);
      } catch (e2) {
        errors.push({ label: p.label, error: e2.message.split('\n')[0] });
        continue;
      }
    } else {
      errors.push({ label: p.label, error: e.message.split('\n')[0] });
      process.stderr.write(`[gh-search] 跳过 ${p.label}: ${e.message.split('\n')[0]}\n`);
      continue;
    }
  }
  const items = res.json?.items || [];
  queryLog.push({
    label: p.label,
    run: p.run,
    search_text: p.searchText,
    total_count: res.json?.total_count ?? 0,
    returned: items.length,
    from_cache: !!res.fromCache,
  });
  rawItems += items.length;
  process.stderr.write(`  · ${p.label} → ${items.length} 条 (total≈${res.json?.total_count ?? '?'})${res.fromCache ? ' [cache]' : ''}\n`);

  for (const it of items) {
    const key = it.full_name;
    const prev = byRepo.get(key);
    if (prev) {
      prev.matched_by.push(p.label);
      continue;
    }
    byRepo.set(key, {
      full_name: it.full_name,
      name: it.name,
      owner: it.owner?.login,
      owner_type: it.owner?.type,
      url: it.html_url,
      description: it.description || '',
      homepage: it.homepage || '',
      stars: it.stargazers_count ?? 0,
      forks: it.forks_count ?? 0,
      open_issues: it.open_issues_count ?? 0,
      language: it.language || '',
      license: it.license?.spdx_id || null,
      license_name: it.license?.name || null,
      created_at: it.created_at,
      pushed_at: it.pushed_at,
      archived: !!it.archived,
      fork: !!it.fork,
      topics: it.topics || [],
      size_kb: it.size ?? 0,
      default_branch: it.default_branch,
      matched_by: [p.label],
    });
  }
}

const all = [...byRepo.values()].map((c) => {
  const idle = daysSince(c.pushed_at);
  const ageYears = Math.max((daysSince(c.created_at) || 30) / 365, 0.08);
  return {
    ...c,
    flags: computeFlags(c),
    metrics: {
      days_since_push: idle,
      age_years: Number(ageYears.toFixed(2)),
      stars_per_year: Math.round(c.stars / ageYears),
      fork_ratio: c.stars ? Number((c.forks / c.stars).toFixed(3)) : null,
      hits: c.matched_by.length,
    },
  };
});

const includeArchived = a.flag('include-archived');
const pool = all.filter((c) => includeArchived || !c.archived);
const droppedArchived = all.length - pool.length;

const order = a.get('order', 'hits');
const cmp = {
  hits: (x, y) => y.metrics.hits - x.metrics.hits || y.stars - x.stars,
  stars: (x, y) => y.stars - x.stars,
  recent: (x, y) => (x.metrics.days_since_push ?? 1e9) - (y.metrics.days_since_push ?? 1e9),
  forks: (x, y) => y.forks - x.forks,
}[order];
if (!cmp) die(`--order 只支持 hits / stars / recent / forks，收到 "${order}"`);
pool.sort(cmp);
pool.forEach((c, i) => (c.pool_rank = i + 1));

/* ----------------------------------------------------------------- output --- */

const out = {
  schema: 'github-repo-scout/candidates@1',
  generated_at: new Date().toISOString(),
  auth: token.source,
  authenticated: !!token.token,
  notes: [
    'pool_rank 是候选池排序，不是最终推荐顺序；最终排序由 repo-audit.mjs 的适配度评分给出。',
    'metrics.hits = 被多少条不同检索式命中，是"多角度相关性共振"信号，优先于 star。',
    'flags 是自动打标（学习资料/清单/镜像/停更等），需要复核，不要盲信。',
  ],
  plan: { executed: queryLog.length, planned: plan.length, max_requests: maxRequests },
  queries: queryLog,
  errors,
  rate: http.rate,
  http: http.stats,
  stats: { raw_items: rawItems, merged_in: mergedIn, unique: all.length, pool: pool.length, archived_dropped: droppedArchived },
  candidates: pool,
};

const topN = a.num('top', 40);
const rows = (list, ranks) =>
  list.map((c, i) => [
    ranks ? ranks(c, i) : c.pool_rank,
    `[${c.full_name}](${c.url})`,
    c.stars,
    c.language || '?',
    rel(c.metrics.days_since_push),
    c.license || '—',
    c.metrics.hits,
    c.flags.length ? c.flags.join(',') : '',
    mdEscape(c.description, 90),
  ]);
const HEADERS = ['#', '仓库', '★', '语言', '最近提交', '许可', '命中', '标记', '说明'];
const ALIGN = ['r', '', 'r', '', 'r', '', 'r', '', ''];

const hitsBoard = pool.slice(0, topN);
const starBoard = [...pool].sort((x, y) => y.stars - x.stars).slice(0, Math.min(15, pool.length));
const hitsSet = new Set(hitsBoard.map((c) => c.full_name));
const starOnly = starBoard.filter((c) => !hitsSet.has(c.full_name));
const hitsOnlyLowStar = hitsBoard.filter((c) => !starBoard.some((s) => s.full_name === c.full_name));

/* 池质量告警：star 头部大量带 flags（内容倾倒/学习资料/停更）说明关键词没写对，
   这时候该做的是回 Phase 0 换词（竞品名、具体技术词），而不是硬着头皮往下评。 */
const junkInStarTop = starBoard.filter((c) => c.flags.length).length;
const starTopJunkRatio = starBoard.length ? junkInStarTop / starBoard.length : 0;
const qualityWarn =
  starBoard.length >= 5 && starTopJunkRatio >= 0.5
    ? `⚠️ star 榜前 ${starBoard.length} 名里有 ${junkInStarTop} 个带质量标记（内容倾倒/学习资料/停更），` +
      `说明这批关键词在这个领域里没有"被 star 认可的真实项目"。**不要继续评这些垃圾**：` +
      `回 Phase 0 换检索词（优先用竞品名、"<能力> + cli/docker/self-hosted"、具体技术词如 tantivy/lucene/ripgrep），再搜一轮。`
    : null;
out.stats.pool_quality = {
  flagged: pool.filter((c) => c.flags.length).length,
  star_top_flagged: junkInStarTop,
  star_top_size: starBoard.length,
  star_top_junk_ratio: Number(starTopJunkRatio.toFixed(2)),
  warning: qualityWarn,
};

let md = `# GitHub 候选池（gh-search）

- 生成时间：${out.generated_at}
- 认证模式：\`${token.source}\`${token.token ? '' : '（匿名：search 10 req/min、core 60 req/hr，建议配 token）'}
- 检索式：${queryLog.length}/${plan.length} 条执行；原始条目 ${rawItems}${mergedIn ? `（含上轮累积 ${mergedIn}）` : ''} → 去重 ${all.length} → 候选池 ${pool.length}${droppedArchived ? `（丢弃 archived ${droppedArchived}）` : ''}
- 排序：\`${order}\` —— **这不是 star 榜**；最终推荐顺序由 repo-audit.mjs 的适配度评分决定。
- 池质量：带质量标记 ${out.stats.pool_quality.flagged}/${pool.length}；star 榜前 ${starBoard.length} 名里带标记 ${junkInStarTop} 个

${qualityWarn ? `> ### 🚨 池质量告警\n>\n> ${qualityWarn}\n` : ''}
## 一、候选池（按 ${order}）

${mdTable(HEADERS, rows(hitsBoard), ALIGN)}

## 二、对照：只看 star 会看到什么（诊断视图）

${mdTable(HEADERS, rows(starBoard, (_c, i) => `S${i + 1}`), ALIGN)}

**只在 star 榜里（热度高，但只被 ${1} 条以内检索式命中 → 可能是"泛用大项目"或"名字像但用途不同"）**
${starOnly.length ? starOnly.map((c) => `- [${c.full_name}](${c.url}) ★${c.stars} — hits=${c.metrics.hits}：${mdEscape(c.description, 90)}`).join('\n') : '- （无）'}

**只在命中榜里（热度低，但被多条检索式命中 → 值得优先体检）**
${hitsOnlyLowStar.length ? hitsOnlyLowStar.map((c) => `- [${c.full_name}](${c.url}) ★${c.stars} — hits=${c.metrics.hits}：${mdEscape(c.description, 90)}`).join('\n') : '- （无）'}

## 三、下一步

\`\`\`bash
node scripts/repo-audit.mjs --in <上面的 candidates.json> --target-lang "<你的技术栈>" --fit fit.json --out audit.json --md audit.md
\`\`\`
`;

/* 沙箱只读时不要白跑一轮：写失败就降级到 stdout，并说清怎么办。 */
const wrote = { json: null, md: null };
for (const [key, target] of [['json', a.get('out')], ['md', a.get('md')]]) {
  if (!target) continue;
  try {
    if (key === 'json') writeJson(target, out);
    else writeText(target, md);
    wrote[key] = target;
  } catch (e) {
    if (e.name !== 'WriteFailed') throw e;
    process.stderr.write(writeFailureHint(e));
    process.stderr.write(`  → 已把 Markdown 报告打到 stdout（JSON 太大就不打了，可用 --out 指定可写路径重跑）\n\n`);
    process.stdout.write(md + '\n');
  }
}
if (!a.has('out') && !a.has('md')) process.stdout.write(JSON.stringify(out, null, 2) + '\n');

process.stdout.write(
  `\n[gh-search] 候选池 ${pool.length} 个（原始 ${rawItems}，去重 ${all.length}）\n` +
    `  requests=${http.stats.requests} cache_hits=${http.stats.cacheHits} waits=${http.stats.waits} errors=${errors.length}\n` +
    (qualityWarn ? `\n${qualityWarn}\n` : '') +
    (wrote.json ? `  JSON → ${wrote.json}\n` : '') +
    (wrote.md ? `  Markdown → ${wrote.md}\n` : '') +
    `  rate=${JSON.stringify(http.rate)}\n`,
);

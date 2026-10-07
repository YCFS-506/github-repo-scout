#!/usr/bin/env node
/**
 * repo-audit.mjs — 体检 + 适配度评分 + 分档。
 *
 * 这是"不按 star 排序"真正落地的地方：
 *   - 满分 100 分里 star(favor/热度) 只占 2 分，且对数缩放；功能匹配 30 分由证据（README/描述）判定。
 *   - 先用硬门槛（archived / 停更 / 许可缺失 / 明确拒绝的许可）淘汰，再做评分。
 *   - 输出会显式给出"star 榜 vs 适配榜"的偏离清单：谁被高估、谁被低估。
 *
 * 用法示例：
 *   node scripts/repo-audit.mjs --in gh-scout-out/candidates.json \
 *     --target-lang "TypeScript,Python" --deep 12 --readme \
 *     --fit fit.json --intent "自托管稍后读，单人使用，需要网页正文归档" \
 *     --out gh-scout-out/audit.json --md gh-scout-out/audit.md
 *
 *   node scripts/repo-audit.mjs --repo immich-app/immich --repo photoprism/photoprism --md -
 */

import process from 'node:process';
import fs from 'node:fs';
import {
  API, Http, RateLimited, parseArgs, resolveToken, daysSince, normalizeLang, langMatches,
  licenseClass, mdTable, mdEscape, readJson, writeJson, writeText, writeFailureHint, die,
} from './lib.mjs';

/**
 * 权重预设。这是从 @rakeshroushan/reposcout 学来的"每次调用可覆盖权重"的灵活性，
 * 但加了一道它没有的护栏：popularity（star）硬上限 10 分。
 * 超过 10 分就不再是选型工具，而是 star 排序器 —— 那正是本 skill 要消灭的东西。
 */
const WEIGHT_PRESETS = {
  'fit-first': { fit: 30, integrability: 20, maintenance: 15, docs: 10, ecosystem: 10, license: 8, risk: 5, popularity: 2 },
  'risk-averse': { fit: 30, integrability: 18, maintenance: 15, docs: 8, ecosystem: 6, license: 12, risk: 9, popularity: 2 },
  'quick-tool': { fit: 35, integrability: 15, maintenance: 12, docs: 12, ecosystem: 6, license: 8, risk: 10, popularity: 2 },
};
const POPULARITY_CAP = 10;
const WEIGHTS = WEIGHT_PRESETS['fit-first'];

/** 解析 --weights：预设名，或 "fit=40,license=12,popularity=0" 形式的覆盖。 */
function resolveWeights(spec, { allowStarHeavy = false, warn = () => {} } = {}) {
  if (!spec) return { weights: { ...WEIGHTS }, preset: 'fit-first', adjusted: false };
  if (WEIGHT_PRESETS[spec]) return { weights: { ...WEIGHT_PRESETS[spec] }, preset: spec, adjusted: spec !== 'fit-first' };
  const weights = { ...WEIGHTS };
  for (const pair of String(spec).split(',').map((s) => s.trim()).filter(Boolean)) {
    const m = pair.match(/^([a-z_]+)\s*[:=]\s*(\d+(?:\.\d+)?)$/i);
    if (!m) die(`--weights 里这项看不懂："${pair}"。格式：fit=40,license=12,popularity=0（或用预设名 ${Object.keys(WEIGHT_PRESETS).join(' / ')}）`);
    const key = m[1].toLowerCase();
    if (!(key in weights)) die(`--weights 未知维度 "${key}"，可选：${Object.keys(weights).join(', ')}`);
    weights[key] = Number(m[2]);
  }
  if (weights.popularity > POPULARITY_CAP) {
    if (!allowStarHeavy) {
      die(
        `popularity=${weights.popularity} 超过硬上限 ${POPULARITY_CAP}。\n` +
          `把 star 权重调到这个量级，结果就变成"star 排行榜"——恰恰是这个 skill 存在的理由（默认只给 2 分）。\n` +
          `如果确实要用 star 主导排序，请显式加 --allow-star-heavy（并在报告里说明这是有意为之）。`,
      );
    }
    warn(`[warn] popularity=${weights.popularity} 已超过建议上限 ${POPULARITY_CAP}，本次按你的要求保留，但结论会受 star 主导。`);
  }
  if (weights.fit < 20) warn(`[warn] fit（功能匹配）只有 ${weights.fit} 分：功能不匹配的项目可能排到前面，建议不要低于 20。`);
  const sum = Object.values(weights).reduce((s, v) => s + v, 0);
  if (sum !== 100) {
    const scale = 100 / sum;
    for (const k of Object.keys(weights)) weights[k] = Number((weights[k] * scale).toFixed(2));
    warn(`[warn] 权重合计 ${sum}，已按比例归一化到 100。`);
  }
  return { weights, preset: 'custom', adjusted: true };
}

const HELP = `repo-audit.mjs — 对候选仓库做证据化体检 + 适配度评分 + 分档

输入（三选一，可组合）
  --in <candidates.json>     gh-search.mjs 产出的候选池
  --repo <owner/name>        （可重复）直接指定仓库
  --file <path>              一行一个仓库（owner/name 或 URL）

需求上下文（影响评分与报告，强烈建议都填）
  --intent "<str>"           需求画像（会写进报告抬头）
  --target-lang "TS,Python"  你的技术栈；命中 +8，不命中 +1，未声明给中位 5
  --commercial               商用/闭源集成场景：许可证缺失会被硬门槛拦下
  --deny-licenses "AGPL-3.0,GPL-3.0"   明确不能接受的许可
  --fit <fit.json>           功能匹配分（0-30）、证据来源与理由，见下
  --fit <path> 文件格式: { "owner/name": { "fit": 27, "why": "...", "risk": "...", "sources": ["url1","url2","url3"] } }

权重（默认 fit-first；star 项硬上限 10，超过会拒绝）
  --weights fit-first|risk-averse|quick-tool     用预设
  --weights "fit=40,license=12,popularity=0"     按维度覆盖（自动归一化到 100）
  --allow-star-heavy                             解禁 popularity>10（需要你在报告里说明是有意为之）

证据门槛
  --min-sources 3            功能匹配分的证据来源下限（少于这个数 → 该项封顶 20 分并标注）
  --strict-evidence          证据不足的 --fit 条目视为未提供（退回中位分）

体检深度（配额相关）
  --deep 12                  对前 N 个候选做深度体检；all = 全部；0 或 --no-deep = 完全不体检（0 请求）
  --readme / --no-readme     是否拉 README 正文（默认拉；每仓 1 请求，用于判定功能匹配）
  --contributors             额外拉贡献者列表（每仓 1 请求，用于判断 bus factor）
  --no-deep                  只做浅层评分（0 请求）：先看排序，再决定体检谁（配额紧张时用）
  --max-idle-days 1095       超过这个天数没提交 → 硬门槛淘汰（--allow-stale 可放行）
  --allow-archived --allow-stale --allow-empty-license

网络 / 配额 / 输出
  --token <pat> --no-cache --cache-dir <dir> --ttl-hours 6 --verbose
  --out <audit.json> --md <audit.md|->   （--md - 打到 stdout）
  --top 20                   报告里列出前 N 个
`;

/* ------------------------------------------------------------------ input --- */

function loadCandidates(a) {
  const list = [];
  if (a.has('in')) {
    const doc = readJson(a.get('in'));
    if (doc.schema !== 'github-repo-scout/candidates@1' && !Array.isArray(doc.candidates)) {
      die(`--in 文件不像 gh-search.mjs 的输出（缺 candidates 数组）：${a.get('in')}`);
    }
    const langs = a.all('target-lang').join(',').split(',').map((s) => s.trim()).filter(Boolean).map(normalizeLang);
    for (const c of doc.candidates || []) {
      list.push({ ...c, source: 'gh-search' });
    }
    return { list, meta: doc, langs };
  }
  const names = [...a.all('repo')];
  if (a.has('file')) {
    try {
      names.push(
        ...fs
          .readFileSync(a.get('file'), 'utf8')
          .split('\n')
          .map((l) => l.replace(/#.*$/, '').trim())
          .filter(Boolean)
          .map((l) => {
            const m = l.match(/github\.com\/([^/\s]+\/[^/\s#?]+)/);
            return (m ? m[1] : l).replace(/\.git$/, '');
          }),
      );
    } catch (e) {
      die(`读不到 --file ${a.get('file')}: ${e.message}`);
    }
  }
  if (!names.length) die('没有输入。用 --in <candidates.json>，或 --repo owner/name（可重复），或 --file <列表>。');
  const langs = a.all('target-lang').join(',').split(',').map((s) => s.trim()).filter(Boolean).map(normalizeLang);
  return {
    list: [...new Set(names)].map((full_name) => ({
      full_name,
      name: full_name.split('/')[1],
      owner: full_name.split('/')[0],
      url: `https://github.com/${full_name}`,
      description: '',
      stars: null,
      forks: null,
      open_issues: null,
      language: null,
      license: null,
      created_at: null,
      pushed_at: null,
      archived: null,
      fork: null,
      topics: [],
      size_kb: null,
      matched_by: [],
      flags: [],
      metrics: { hits: 0, days_since_push: null },
      source: 'explicit',
    })),
    meta: null,
    langs,
  };
}

/* ---------------------------------------------------------------- shallow --- */

/**
 * 浅评：只决定"谁值得花配额做深度体检"。**刻意不按 star 排序**，但保留一个很小的
 * "实体性"下限分：★0-2 且体积极小的仓库大多是随手传的 demo/作业，不能让它们把
 * 深度体检的配额吃光（这只影响"谁被体检"，不影响最终评分）。
 */
function prelimScore(c, langs, opts) {
  let s = 0;
  const m = c.metrics || {};
  s += (m.hits || 0) >= 3 ? 8 : (m.hits || 0) === 2 ? 6 : 3;
  const idle = m.days_since_push ?? daysSince(c.pushed_at);
  if (idle !== null && idle <= 180) s += 5;
  else if (idle !== null && idle <= 365) s += 4;
  else if (idle !== null && idle <= 730) s += 2;
  const lc = licenseClass(c.license);
  s += { permissive: 4, weak: 3, other: 2, strong: 2, unclear: 1, none: 0 }[lc] ?? 1;
  const lm = langMatches(c.language, langs);
  s += lm === null ? 2 : lm ? 4 : -1;
  // 实体性下限（上限 4 分，远小于"功能/维护"的权重，不构成 star 排序）
  const stars = c.stars ?? 0;
  s += Math.min(4, Math.log10(stars + 1) * 1.3);
  if (stars === 0 && (c.size_kb ?? 0) < 200) s -= 4;
  else if (stars < 3 && (c.size_kb ?? 0) < 60) s -= 2;
  if ((c.forks ?? 0) >= 3) s += 1;
  for (const f of c.flags || []) {
    if (['archived', 'empty-repo'].includes(f)) s -= 12;
    else if (f === 'content-dump') s -= 15;
    else if (f === 'likely-awesome-list') s -= 7;
    else if (f === 'likely-learning-material') s -= 5;
    else if (['possible-mirror', 'possible-toy'].includes(f)) s -= 3;
    else if (f === 'no-license') s -= opts.commercial ? 6 : 2;
    else if (f === 'idle>2y') s -= 3;
  }
  return s;
}

/* ------------------------------------------------------------------ deep --- */

/**
 * 体检取数。**限速异常必须继续往上抛**（RateLimited 由主循环统一处理并中止），
 * 只有普通错误（404、网络抖动）才吞掉并记录——否则配额耗尽时会一路重试把时间烧光，
 * 还把 "?" 数据静静写进报告。
 */
async function tryGet(http, url, out, label, opts) {
  try {
    out.requests++;
    return await http.get(url, opts);
  } catch (e) {
    if (e instanceof RateLimited) throw e;
    out.errors.push(`${label}: ${e.message.split('\n')[0]}`);
    return null;
  }
}

async function deepFetch(http, c) {
  const full = c.full_name;
  const out = { requests: 0, errors: [] };
  const repo = await tryGet(http, `${API}/repos/${full}`, out, 'repo');
  if (repo?.json) out.repo = repo.json;
  if (repo?.status === 404) {
    out.errors.push('404: 仓库不存在（改名/删除/拼写错误）');
    return out;
  }
  const rel = await tryGet(http, `${API}/repos/${full}/releases?per_page=5`, out, 'releases');
  if (Array.isArray(rel?.json)) out.releases = rel.json;
  const com = await tryGet(http, `${API}/repos/${full}/commits?per_page=1`, out, 'commits');
  if (Array.isArray(com?.json) && com.json.length) {
    out.last_commit = {
      sha: com.json[0].sha?.slice(0, 8),
      date: com.json[0].commit?.author?.date || com.json[0].commit?.committer?.date,
      message: (com.json[0].commit?.message || '').split('\n')[0].slice(0, 120),
    };
  }
  return out;
}

async function fetchReadme(http, c) {
  let r = null;
  try {
    r = await http.get(`${API}/repos/${c.full_name}/readme`, { raw: true });
  } catch (e) {
    if (e instanceof RateLimited) throw e;
    return null;
  }
  if (!r || r.status === 404 || typeof r.raw !== 'string') return null;
  return r.raw;
}

/**
 * --no-deep 模式：只用磁盘缓存里已有的体检数据（0 请求）。
 * 之前跑过的仓库会白捡到 README/Release/提交，没跑过的就只有搜索快照。
 */
function deepFetchCachedOnly(http, c) {
  const out = { requests: 0, errors: [], fromCache: true };
  const repo = http.peek(`${API}/repos/${c.full_name}`);
  if (repo?.json) out.repo = repo.json;
  const rel = http.peek(`${API}/repos/${c.full_name}/releases?per_page=5`);
  if (Array.isArray(rel?.json)) out.releases = rel.json;
  const com = http.peek(`${API}/repos/${c.full_name}/commits?per_page=1`);
  if (Array.isArray(com?.json) && com.json.length) {
    out.last_commit = {
      sha: com.json[0].sha?.slice(0, 8),
      date: com.json[0].commit?.author?.date || com.json[0].commit?.committer?.date,
      message: (com.json[0].commit?.message || '').split('\n')[0].slice(0, 120),
    };
  }
  const rd = http.peek(`${API}/repos/${c.full_name}/readme`);
  if (typeof rd?.raw === 'string') out.readme = rd.raw;
  const cs = http.peek(`${API}/repos/${c.full_name}/contributors?per_page=100&anon=false`);
  if (Array.isArray(cs?.json)) out.contributors = cs.json;
  out.cached_any = !!(out.repo || out.releases || out.readme);
  return out;
}

async function fetchContributors(http, c) {
  let r = null;
  try {
    r = await http.get(`${API}/repos/${c.full_name}/contributors?per_page=100&anon=false`);
  } catch (e) {
    if (e instanceof RateLimited) throw e;
    return null;
  }
  if (!Array.isArray(r?.json)) return null;
  return r.json;
}

/* ----------------------------------------------------------------- score --- */

/** 把 README 洗成"人能读的散文"，用于判定功能匹配（去掉徽章/HTML/图片/表格噪音）。 */
function readmeProse(text, max = 420) {
  const t = String(text)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/^\s*\|.*\|\s*$/gm, ' ')
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/[|*_>`]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 30 && !/^(badge|license|build|ci|coverage|codecov|trendshift|star|fork|download)/i.test(s))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

function analyzeReadme(text) {
  if (!text) return null;
  const bytes = Buffer.byteLength(text, 'utf8');
  const head = text.slice(0, 20000);
  const hasInstall = /(^|\n)#{1,3}\s*.*(install|installation|getting started|quick ?start|setup|deploy|usage|安装|部署|使用|快速开始)/i.test(head);
  const hasCode = /```/.test(head);
  const hasImage = /!\[|\.png|\.gif|\.webp/.test(head);
  const badges = (head.match(/img\.shields\.io|badgen\.net|badge\./g) || []).length;
  const langHint = (head.match(/[\u4e00-\u9fa5]/g) || []).length > 80;
  return { bytes, hasInstall, hasCode, hasImage, badges, looksChinese: langHint, excerpt: readmeProse(head) };
}

function scoreRepo(c, deep, opts) {
  const parts = [];
  const add = (key, score, max, note) => parts.push({ key, score: Number(score.toFixed(2)), max, note });
  const repo = deep?.repo || {};
  const releases = deep?.releases || [];
  const readme = deep?.readme ?? null;

  const pushedAt = repo.pushed_at || c.pushed_at;
  const idle = daysSince(pushedAt) ?? c.metrics?.days_since_push ?? null;
  const stars = repo.stargazers_count ?? c.stars ?? null;
  const forks = repo.forks_count ?? c.forks ?? null;
  const openIssues = repo.open_issues_count ?? c.open_issues ?? null;
  const language = repo.language ?? c.language ?? null;
  const spdx = repo.license?.spdx_id ?? c.license ?? null;
  const archived = repo.archived ?? c.archived ?? null;
  const sizeKb = repo.size ?? c.size_kb ?? null;
  const topics = repo.topics ?? c.topics ?? [];
  const homepage = repo.homepage ?? c.homepage ?? '';
  const subscribers = repo.subscribers_count ?? null;

  /* maintenance 15 */
  let mRecency = 1;
  if (idle !== null) {
    if (idle <= 30) mRecency = 9;
    else if (idle <= 90) mRecency = 8;
    else if (idle <= 180) mRecency = 7;
    else if (idle <= 365) mRecency = 5;
    else if (idle <= 730) mRecency = 3;
    else if (idle <= 1095) mRecency = 2;
  }
  let mRelease = 0;
  let releaseNote = '无 GitHub Release';
  if (releases.length) {
    const latest = daysSince(releases[0].published_at || releases[0].created_at);
    if (latest !== null && latest <= 180) (mRelease = 4), (releaseNote = `最近发布 ${latest}d 前`);
    else if (latest !== null && latest <= 365) (mRelease = 3), (releaseNote = `最近发布 ${latest}d 前`);
    else (mRelease = 2), (releaseNote = `最近发布 >1y`);
  } else if (idle !== null && idle <= 180) {
    (mRelease = 1), (releaseNote = '无 release，但仓库活跃');
  }
  const cadence = Math.min(releases.length, 5) >= 3 ? 2 : releases.length ? 1 : 0;
  // star-free 的"势头"信号：用已有 release 数据的发行节奏变化代替 star 增量
  // （star 增量是热度放大器，奖励的正是我们要压低的东西；见 references/prior-art.md）。
  const relTs = releases.map((r) => Date.parse(r.published_at || r.created_at)).filter((t) => Number.isFinite(t)).sort((x, y) => y - x);
  const recent180 = relTs.filter((t) => Date.now() - t <= 180 * 86400e3).length;
  const prior = relTs.filter((t) => Date.now() - t > 180 * 86400e3 && Date.now() - t <= 720 * 86400e3).length;
  const shippingTrend = recent180 >= 2 ? '发行活跃' : recent180 === 1 ? '仍在发行' : prior > 0 ? '发行放缓' : '无发行记录';
  add('maintenance', mRecency + mRelease + cadence, 15,
    `最近提交 ${idle}d 前；${releaseNote}；近 ${releases.length} 次 release 采样：${shippingTrend}${cadence >= 2 ? '（节奏稳定）' : ''}`);

  /* integrability 20 */
  const lm = langMatches(language, opts.langs);
  const langScore = lm === null ? 5 : lm ? 8 : 1;
  const sizeScore = sizeKb === null ? 2 : sizeKb < 50 ? 2 : sizeKb <= 500 * 1024 ? 4 : 1;
  add('integrability', langScore + (releases.length ? 4 : 0) + sizeScore + (topics.length ? 2 : 0) + (homepage ? 2 : 0), 20,
    `语言 ${language || '?'}（${lm === null ? '未声明目标栈，给中位' : lm ? '命中你的栈' : '不匹配你的栈'}）；体积 ${sizeKb ?? '?'}KB；` +
      `${releases.length ? '有可安装产物(release)' : '无 release 产物'}；${topics.length ? '有 topics' : '无 topics'}${homepage ? '；有主页' : ''}`);

  /* docs 10 */
  if (readme) {
    const r = analyzeReadme(readme);
    const present = r.bytes > 200 ? 3 : 1;
    const install = r.hasInstall ? 4 : 1;
    const size = r.bytes >= 1000 && r.bytes <= 200 * 1024 ? 3 : 1;
    add('docs', present + install + size, 10,
      `README ${(r.bytes / 1024).toFixed(1)}KB；${r.hasInstall ? '有安装/使用章节' : '未见明确安装章节'}${r.looksChinese ? '；README 含中文' : ''}`);
  } else {
    add('docs', 5, 10, '未取 README（--no-readme 或拉取失败），给中位分');
  }

  /* ecosystem 10 */
  let ecoKnown = 0;
  let ecoScore = 0;
  let ecoNote = [];
  if (deep?.contributors) {
    const n = deep.contributors.length;
    ecoScore += n >= 50 ? 5 : n >= 20 ? 4 : n >= 5 ? 3 : n >= 2 ? 2 : 0;
    ecoNote.push(`贡献者 ${n}${n >= 100 ? '+' : ''}`);
    ecoKnown++;
  } else {
    ecoScore += 3.5;
    ecoNote.push('贡献者未采样（中位分）');
  }
  if (subscribers !== null) {
    ecoScore += subscribers >= 200 ? 3 : subscribers >= 50 ? 2.5 : subscribers >= 10 ? 1.5 : 0.5;
    ecoNote.push(`订阅者 ${subscribers}`);
    ecoKnown++;
  } else {
    ecoScore += 1.5;
    ecoNote.push('订阅者未知（中位分）');
  }
  if (forks !== null) {
    ecoScore += forks >= 200 ? 2 : forks >= 50 ? 1.5 : forks >= 10 ? 1 : 0.3;
    ecoNote.push(`fork ${forks}`);
  } else {
    ecoScore += 1;
    ecoNote.push('fork 未知（中位分）');
  }
  add('ecosystem', ecoScore, 10, ecoNote.join('；') + (ecoKnown === 0 ? '（全部按中位分，此项无区分度）' : ''));

  /* license 8 */
  const licCls = licenseClass(spdx);
  const licScore = { permissive: 8, weak: 6, other: 5, strong: 3, unclear: 1, none: 0 }[licCls];
  add('license', licScore, 8, `${spdx || '无许可文件'}（${licCls}）${licCls === 'strong' ? '：强 copyleft，闭源商用需评估' : ''}`);

  /* risk 5（扣分制） */
  let risk = 5;
  const riskNotes = [];
  if (idle !== null && idle > 365) (risk -= 2), riskNotes.push('停更>1y');
  else if (idle !== null && idle > 180) (risk -= 1), riskNotes.push('停更>6mo');
  if (licCls === 'none') (risk -= 2), riskNotes.push('无许可');
  else if (licCls === 'unclear') (risk -= 1), riskNotes.push('许可不清');
  if (archived) (risk -= 1), riskNotes.push('已归档');
  const badFlags = (c.flags || []).filter((f) => ['likely-awesome-list', 'likely-learning-material', 'possible-mirror', 'possible-toy'].includes(f));
  if (badFlags.length) (risk -= 1), riskNotes.push('自动标记：' + badFlags.join('/'));
  if ((c.flags || []).includes('content-dump')) (risk -= 3), riskNotes.push('疑似内容倾倒仓库（描述是文件内容而不是项目说明）');
  if (openIssues !== null && stars !== null && openIssues > 500 && stars < 5000) (risk -= 1), riskNotes.push(`未处理 issue 积压 ${openIssues}`);
  if (deep?.contributors && deep.contributors.length === 1) (risk -= 1), riskNotes.push('单一贡献者（bus factor=1）');
  risk = Math.max(0, risk);
  add('risk', risk, 5, riskNotes.length ? riskNotes.join('；') : '未见明显风险信号');

  /* popularity（唯一的 star 项；默认满分 2，权重可被 --weights 覆盖但硬上限 10） */
  const pop = stars ? Math.max(0, Math.min(2, (2 * Math.log10(stars + 1)) / Math.log10(50001))) : 0;
  add('popularity', pop, 2, `★${stars ?? '?'}（对数缩放，权重 ${opts.weights.popularity}/100${opts.weights.popularity <= 2 ? '，刻意压权重' : '（已上调）'}）`);

  /* fit 30 */
  const fitEntry = opts.fit[String(c.full_name).toLowerCase()];
  let fit = null;
  let fitWhy = '未提供：需要用 README/描述证据判定功能匹配度（见 SKILL.md 步骤 3）';
  let fitRisk = '';
  let fitSources = [];
  let evidenceShortfall = null;
  if (fitEntry) {
    fit = Number(fitEntry.fit);
    if (!Number.isFinite(fit)) fit = null;
    else fit = Math.max(0, Math.min(30, fit));
    fitWhy = fitEntry.why || '（--fit 未写理由，视为证据不足）';
    fitRisk = fitEntry.risk || '';
    const raw = Array.isArray(fitEntry.sources) ? fitEntry.sources : fitEntry.sources ? [fitEntry.sources] : [];
    fitSources = [...new Set(raw.map((s) => String(s).trim()).filter(Boolean))];
    // 证据门槛（借鉴 tech-deep-dive 的"每个候选最少 3 个独立来源"）：
    // 来源不足就封顶分数并标注，strict 模式下直接视为未提供。
    const hosts = new Set(fitSources.map((u) => { try { return new URL(u).host; } catch { return u.split('/')[0]; } }));
    if (fitSources.length < opts.minSources) {
      const msg = `证据来源仅 ${fitSources.length} 个 < 要求 ${opts.minSources} 个（独立域 ${hosts.size} 个）`;
      if (opts.strictEvidence) {
        evidenceShortfall = msg + '，--strict-evidence 下视为未提供';
        fit = null;
        fitWhy = msg;
      } else {
        evidenceShortfall = msg;
        fit = Math.min(fit ?? 0, 20);
      }
    } else if (hosts.size < 2) {
      evidenceShortfall = `证据来源 ${fitSources.length} 个但都来自同一域名（${[...hosts][0]}），独立性存疑`;
    }
  }
  add('fit', fit ?? 15, 30,
    (fit === null ? fitWhy : `${fitWhy}${fitRisk ? `｜风险：${fitRisk}` : ''}`) +
      (fitSources.length ? `｜证据来源 ${fitSources.length} 个` : '') +
      (evidenceShortfall ? `｜⚠ ${evidenceShortfall}` : ''));

  /* 加权汇总：每个维度先归一化成 0..1，再乘以该维度的权重（权重可被 --weights 覆盖）。 */
  const W = opts.weights;
  const partsOut = parts.map((p) => {
    const frac = p.max ? p.score / p.max : 0;
    const weight = W[p.key] ?? 0;
    return { ...p, frac: Number(frac.toFixed(4)), weight, weighted: Number((frac * weight).toFixed(2)) };
  });
  const contrib = (k) => partsOut.find((p) => p.key === k)?.weighted ?? 0;
  const total = Number(partsOut.reduce((s, p) => s + p.weighted, 0).toFixed(2));
  const auto = Number((total - contrib('fit')).toFixed(2));
  const hasFit = fit !== null;

  return {
    parts: partsOut,
    auto_score: auto,
    total,
    score_with_fit: hasFit ? total : null,
    score_estimated: !hasFit ? total : null,
    fit_state: hasFit ? 'provided' : evidenceShortfall ? `unset(${evidenceShortfall})` : 'unset(按中位 15 估算)',
    fit_sources: fitSources,
    evidence_shortfall: evidenceShortfall,
    facts: {
      language, spdx, license_class: licCls, archived, stars, forks, open_issues: openIssues,
      subscribers, size_kb: sizeKb, pushed_at: pushedAt, days_since_push: idle,
      latest_release: releases[0] ? { tag: releases[0].tag_name, at: releases[0].published_at } : null,
      last_commit: deep?.last_commit || null,
      topics, homepage, contributors: deep?.contributors ? deep.contributors.length : null,
    },
  };
}

/* ------------------------------------------------------------------ gates --- */

function gatesFor(c, scored, opts) {
  const f = scored.facts;
  const fails = [];
  const warns = [];
  const idle = f.days_since_push;
  if (f.archived && !opts.allowArchived) fails.push('已 archived（不再维护）');
  if (idle !== null && idle > opts.maxIdleDays && !opts.allowStale) fails.push(`停更 ${idle}d > ${opts.maxIdleDays}d`);
  if (licenseClass(f.spdx) === 'none' && opts.commercial && !opts.allowEmptyLicense) fails.push('无许可证（商用/闭源集成不可用）');
  const deny = opts.denyLicenses.find((d) => (f.spdx || '').toLowerCase() === d.toLowerCase());
  if (deny) fails.push(`许可证 ${f.spdx} 在 --deny-licenses 名单内`);
  if ((c.flags || []).includes('empty-repo')) fails.push('空仓库（size=0）');
  if ((c.flags || []).includes('content-dump')) fails.push('疑似内容倾倒仓库（description 是 .config/JSON/HTML 文件内容，不是项目说明）');
  if (licenseClass(f.spdx) === 'none') warns.push('无许可证：自用/学习可，二次分发与商用有风险');
  if (licenseClass(f.spdx) === 'strong') warns.push('强 copyleft（AGPL/GPL）：闭源商用或 SaaS 需评估');
  if ((c.flags || []).includes('likely-awesome-list')) warns.push('疑似 awesome 清单/资料汇总，不是可直接使用的项目');
  if ((c.flags || []).includes('likely-learning-material')) warns.push('疑似教程/学习资料');
  if (idle !== null && idle > 365) warns.push(`停更 ${Math.round(idle / 365 * 10) / 10}y，可能"冻结但可用"`);
  if (scored.fit_state.startsWith('unset')) warns.push('功能匹配度未判定（--fit 缺失），总分为估算值');
  return { pass: fails.length === 0, fails, warns };
}

/** 按"可得分上限"的百分比分档，这样浅层模式（满分 80）与完整模式（满分 100）口径一致。 */
function tierOf(score, max = 100) {
  const r = score / max;
  if (r >= 0.8) return '首选';
  if (r >= 0.68) return '备选';
  if (r >= 0.55) return '观察';
  return '仅借鉴';
}

/* ------------------------------------------------------------------- main --- */

const a = parseArgs(process.argv.slice(2));

// 未知参数名很可能是拼错（曾经出现 --merge 被静默忽略），直接提示出来。
{
  const KNOWN = new Set(["in","repo","file","intent","target-lang","commercial","deny-licenses","fit","weights","allow-star-heavy","min-sources","strict-evidence","deep","readme","no-readme","contributors","max-idle-days","allow-archived","allow-stale","allow-empty-license","no-deep","token","no-cache","cache-dir","ttl-hours","verbose","out","md","top","help"]);
  const unknown = [...new Set(process.argv.slice(2).filter((t) => t.startsWith('--')).map((t) => t.slice(2).split('=')[0]))].filter((k) => !KNOWN.has(k));
  if (unknown.length) process.stderr.write(`[warn] 未知参数（会被忽略）：${unknown.map((u) => '--' + u).join(', ')}；用 --help 查看支持的参数\n`);
}
if (a.flag('help')) {
  process.stdout.write(HELP);
  process.exit(0);
}

const wWarn = (m) => process.stderr.write(m + '\n');
const resolved = resolveWeights(a.get('weights'), { allowStarHeavy: a.flag('allow-star-heavy'), warn: wWarn });
const opts = {
  langs: [],
  commercial: a.flag('commercial'),
  denyLicenses: a.all('deny-licenses').flatMap((v) => v.split(',')).map((s) => s.trim()).filter(Boolean),
  allowArchived: a.flag('allow-archived'),
  allowStale: a.flag('allow-stale'),
  allowEmptyLicense: a.flag('allow-empty-license'),
  maxIdleDays: a.num('max-idle-days', 1095),
  weights: resolved.weights,
  weightsPreset: resolved.preset,
  minSources: a.num('min-sources', 3),
  strictEvidence: a.flag('strict-evidence'),
  fit: {},
};
if (a.has('fit')) {
  const raw = readJson(a.get('fit'));
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith('_')) continue;
    opts.fit[k.toLowerCase()] = v;
  }
}

const { list, meta, langs } = loadCandidates(a);
opts.langs = langs;

const token = resolveToken(a.get('token'));
const http = new Http({
  token: token.token,
  cacheDir: a.get('cache-dir'),
  ttlMs: a.num('ttl-hours', 6) * 3600e3,
  noCache: a.flag('no-cache'),
  verbose: a.flag('verbose'),
});

const doReadme = !a.flag('no-readme');
const doContributors = a.flag('contributors');
const deepN = a.num('deep', 12);
const noDeep = a.flag('no-deep') || String(a.get('deep')) === 'none' || (a.has('deep') && deepN === 0);
const ranked = [...list].sort((x, y) => prelimScore(y, langs, opts) - prelimScore(x, langs, opts));
let deepList = noDeep ? [] : String(a.get('deep')) === 'all' ? ranked : ranked.slice(0, Math.max(deepN, 0));
// 提供了 --fit 的仓库一定要体检（它们是被人工/模型点名的候选），否则补进来一个都不漏。
const fitted = Object.keys(opts.fit);
if (fitted.length && !noDeep) {
  const have = new Set(deepList.map((c) => c.full_name.toLowerCase()));
  const extra = ranked.filter((c) => fitted.includes(String(c.full_name).toLowerCase()) && !have.has(String(c.full_name).toLowerCase()));
  if (extra.length) process.stderr.write(`[repo-audit] 因 --fit 额外体检 ${extra.length} 个：${extra.map((c) => c.full_name).join(', ')}\n`);
  deepList = [...deepList, ...extra];
}
const deepSet = new Set(deepList.map((c) => c.full_name));

const perRepo = 3 + (doReadme ? 1 : 0) + (doContributors ? 1 : 0);
process.stderr.write(
  noDeep
    ? `[repo-audit] 浅层模式（0 请求）：${list.length} 个仓库只做搜索快照评分 + 读取已有缓存\n`
    : `[repo-audit] 输入 ${list.length} 个仓库；深度体检 ${deepSet.size} 个（约 ${deepSet.size * perRepo} 请求，auth=${token.source}）\n`,
);

let rateLimited = false;
let rateLimitMsg = null;
const deepMap = new Map();
if (noDeep) {
  for (const c of list) {
    const d = deepFetchCachedOnly(http, c);
    if (d.cached_any) deepMap.set(c.full_name, d);
  }
  if (deepMap.size) process.stderr.write(`  · 命中缓存的历史体检数据 ${deepMap.size} 个（0 请求）\n`);
}
for (const c of deepList) {
  try {
    const d = await deepFetch(http, c);
    if (doReadme && !d.errors.some((e) => e.startsWith('404'))) {
      const r = await fetchReadme(http, c);
      d.requests++;
      if (r) d.readme = r;
    }
    if (doContributors) {
      const cs = await fetchContributors(http, c);
      d.requests++;
      if (cs) d.contributors = cs;
    }
    deepMap.set(c.full_name, d);
    process.stderr.write(
      `  · ${c.full_name} → ${d.errors.length ? 'err=' + d.errors.join('; ') : 'ok'}${d.repo ? ` ★${d.repo.stargazers_count} 近提交 ${daysSince(d.repo.pushed_at)}d` : ''}\n`,
    );
  } catch (e) {
    if (e instanceof RateLimited) {
      rateLimited = true;
      rateLimitMsg = e.message.split('\n')[0];
      process.stderr.write(
        `\n[repo-audit] ⚠ 配额耗尽，深度体检提前中止：已体检 ${deepMap.size}/${deepList.length} 个。\n` +
          `  ${e.message.split('\n').slice(0, 2).join('\n  ')}\n` +
          `  继续办法：① 配 token（export GITHUB_TOKEN=...）；② 等配额重置；③ 用 --no-deep 先看排序。\n` +
          `  注意：未体检的仓库在"文档/生态"两栏是中位分，本报告的排序会受影响。\n\n`,
      );
      break;
    }
    deepMap.set(c.full_name, { requests: perRepo, errors: [e.message.split('\n')[0]] });
    process.stderr.write(`  · ${c.full_name} → 失败：${e.message.split('\n')[0]}\n`);
  }
}

const results = ranked.map((c) => {
  const scored = scoreRepo(c, deepMap.get(c.full_name), opts);
  const gates = gatesFor(c, scored, opts);
  // 可比分：把"需要逐仓采样才有区分度"的文档/生态两栏去掉，避免"谁先被体检谁占便宜"。
  const docsContrib = scored.parts.find((p) => p.key === 'docs')?.weighted ?? 0;
  const ecoContrib = scored.parts.find((p) => p.key === 'ecosystem')?.weighted ?? 0;
  const comparable = Number((scored.total - docsContrib - ecoContrib).toFixed(2));
  const comparableMax = Math.max(1, 100 - opts.weights.docs - opts.weights.ecosystem);
  return {
    full_name: c.full_name,
    url: c.url || `https://github.com/${c.full_name}`,
    description: c.description || '',
    homepage: c.homepage || '',
    source: c.source,
    matched_by: c.matched_by || [],
    hits: c.metrics?.hits ?? 0,
    flags: c.flags || [],
    deep_audited: deepSet.has(c.full_name),
    deep_errors: deepMap.get(c.full_name)?.errors || [],
    readme_excerpt: deepMap.get(c.full_name)?.readme ? analyzeReadme(deepMap.get(c.full_name).readme).excerpt : null,
    ...scored,
    comparable,
    comparable_max: comparableMax,
    gates,
    tier: gates.pass ? tierOf(noDeep ? comparable : scored.total, noDeep ? comparableMax : 100) : '落选',
  };
});

const rankKey = (r) => (noDeep ? r.comparable : r.total);
const scoredOnly = results.filter((r) => r.gates.pass);
scoredOnly.sort((x, y) => rankKey(y) - rankKey(x));
results.sort((x, y) => {
  if (x.gates.pass !== y.gates.pass) return x.gates.pass ? -1 : 1;
  return rankKey(y) - rankKey(x);
});
results.forEach((r, i) => (r.fit_rank = i + 1));

const byStars = [...results].filter((r) => r.facts.stars !== null).sort((x, y) => y.facts.stars - x.facts.stars);
byStars.forEach((r, i) => (r.star_rank = i + 1));

/* ------------------------------------------------------------------ verdict --- */

/**
 * "强匹配才打断"门槛（摘自 reposcout 的 build-vs-borrow 纪律）：只有功能匹配 ≥22 且进得了
 * 首选/备选档，才算真的找到了轮子；否则应该直说"没有合适的现成方案"，而不是硬推一个。
 * 这样也避免了对纯定制业务逻辑硬找库。
 */
const strongMatches = scoredOnly.filter((r) => {
  const fitPart = r.parts.find((p) => p.key === 'fit');
  return fitPart && fitPart.score >= 22 && ['首选', '备选'].includes(r.tier);
});
const cappedByEvidence = scoredOnly.filter((r) => r.evidence_shortfall);
const best = scoredOnly[0] || null;
const bestFit = best?.parts.find((p) => p.key === 'fit')?.score ?? null;
const verdict = {
  strong_match: strongMatches.length > 0,
  strong_match_count: strongMatches.length,
  top_pick: strongMatches[0]?.full_name || null,
  best_any: best?.full_name || null,
  best_fit: bestFit,
  advice: strongMatches.length
    ? `有 ${strongMatches.length} 个强匹配（功能匹配 ≥22 且进首选/备选）：首选 [${strongMatches[0].full_name}](${strongMatches[0].url})`
    : bestFit === null
      ? '功能匹配度尚未判定（--fit 缺失），无法判断是否存在强匹配 —— 先补 --fit 再下结论'
      : cappedByEvidence.length
        ? `暂时判不出强匹配：最高的 ${cappedByEvidence.length} 个候选功能匹配分被证据门槛封顶（来源不足 ${opts.minSources} 个）。**先给这些候选补足独立来源再下结论**，不要现在就宣布"没有现成方案"。`
        : `没有强匹配（最高功能匹配 ${bestFit}/30 < 22）。建议直说"没有合适的现成方案"，转而给自建路线 + 借鉴哪几个项目的哪个部分，不要硬推现成的。`,
};

/* ---------------------------------------------------------------- contrast --- */

const topFit = scoredOnly.slice(0, 10);
const topStar = byStars.slice(0, 10);
const fitNames = new Set(topFit.map((r) => r.full_name));
const starNames = new Set(topStar.map((r) => r.full_name));
const overHyped = topStar
  .filter((r) => !fitNames.has(r.full_name))
  .map((r) => ({
    ...r,
    reason: !r.gates.pass
      ? `被硬门槛拦下：${r.gates.fails.join('；')}`
      : r.fit_state.startsWith('unset')
        ? `适配度第 ${r.fit_rank} 名，未进适配 Top10 —— 功能匹配度尚未判定，若认为它匹配需求，请补 --fit 重跑`
        : `适配度第 ${r.fit_rank} 名，未进适配 Top10 —— 功能匹配仅 ${r.parts.find((p) => p.key === 'fit')?.score}/30：${r.parts.find((p) => p.key === 'fit')?.note?.slice(0, 80) || ''}`,
  }));
const underHyped = topFit
  .filter((r) => !starNames.has(r.full_name))
  .map((r) => ({
    ...r,
    reason: `★${r.facts.stars}（star 榜第 ${r.star_rank ?? '?'} 名，适配度第 ${r.fit_rank} 名）${r.fit_state.startsWith('unset') ? '，功能匹配待判定' : `，功能匹配 ${r.parts.find((p) => p.key === 'fit')?.score}/30`}`,
  }));

/* ----------------------------------------------------------------- output --- */

const out = {
  schema: 'github-repo-scout/audit@1',
  generated_at: new Date().toISOString(),
  intent: a.get('intent', null),
  input: { from: a.get('in') || null, repos: list.length, langs, commercial: opts.commercial, deny_licenses: opts.denyLicenses, max_idle_days: opts.maxIdleDays, min_sources: opts.minSources, strict_evidence: opts.strictEvidence },
  weights: opts.weights,
  weights_preset: opts.weightsPreset,
  popularity_cap: POPULARITY_CAP,
  verdict,
  auth: token.source,
  candidates_file: meta ? { generated_at: meta.generated_at, stats: meta.stats } : null,
  http: http.stats,
  rate: http.rate,
  deep: { limit: noDeep ? 'none' : String(a.get('deep')) === 'all' ? 'all' : deepN, audited: [...deepSet], audited_ok: deepMap.size, readme: doReadme, contributors: doContributors },
  rate_limited: rateLimited ? { aborted: true, message: rateLimitMsg } : { aborted: false },
  results,
  divergence: {
    over_hyped: overHyped.map((r) => ({ repo: r.full_name, stars: r.facts.stars, fit_rank: r.fit_rank, reason: r.reason })),
    under_hyped: underHyped.map((r) => ({ repo: r.full_name, stars: r.facts.stars, star_rank: r.star_rank, fit_rank: r.fit_rank, tier: r.tier })),
  },
};

const pct = (r) => (r.gates.pass ? rankKey(r).toFixed(1) : '—');
const rows = results.slice(0, a.num('top', 20)).map((r) => {
  const get = (k) => r.parts.find((p) => p.key === k)?.score ?? 0;
  return [
    r.fit_rank,
    r.tier,
    `[${r.full_name}](${r.url})`,
    pct(r),
    `${get('fit')}${r.fit_state.startsWith('unset') ? '*' : r.evidence_shortfall ? '^' : ''}`,
    get('integrability'),
    get('maintenance'),
    get('docs'),
    get('ecosystem'),
    get('license'),
    get('risk'),
    get('popularity').toFixed(1),
    r.facts.stars ?? '?',
    r.facts.language || '?',
    r.facts.days_since_push ?? '?',
    r.facts.spdx || '—',
  ];
});

let md = `# 开源方案选型体检报告（repo-audit）

- 生成时间：${out.generated_at}
- 需求画像：${a.get('intent', '（未提供 --intent；报告缺少需求边界，评分可读性下降）')}
- 目标技术栈：${langs.length ? langs.join(', ') : '（未声明 --target-lang）'}${opts.commercial ? '；商用/闭源集成场景' : ''}
- 输入：${list.length} 个候选（来源 ${a.get('in') ? 'gh-search 候选池' : '显式指定'}），深度体检 ${noDeep ? '0（--no-deep 浅层模式，只读缓存）' : deepSet.size + ' 个'}${noDeep ? '' : `；缓存里另有 ${deepMap.size} 个`}
- 计分权重（满分 100，预设 \`${opts.weightsPreset}\`）：功能匹配 ${opts.weights.fit} / 可落地 ${opts.weights.integrability} / 维护 ${opts.weights.maintenance} / 文档 ${opts.weights.docs} / 生态 ${opts.weights.ecosystem} / 许可 ${opts.weights.license} / 风险 ${opts.weights.risk} / **热度(star) ${opts.weights.popularity}**（硬上限 ${POPULARITY_CAP}）
- 证据门槛：功能匹配分每条至少 ${opts.minSources} 个来源${opts.strictEvidence ? '（strict：不足即视为未提供）' : '（不足则该项封顶 20 分）'}
- 认证：\`${token.source}\`；请求 ${http.stats.requests} 次，缓存命中 ${http.stats.cacheHits}

> **这张表不是 star 榜。** star 只在最后一栏占 ${opts.weights.popularity} 分（对数缩放）。
> \`功能匹配\` 列带 * = 未提供 --fit（按中位 15 估算）；带 ^ = 证据来源不足已封顶。**两者都不可直接用于决策。**

## 〇、结论：${verdict.strong_match ? '✅ 找到强匹配' : '⚠ 没有强匹配'}

${verdict.advice}

${noDeep ? '> **本表按"可比分"排序（满分 ' + (100 - opts.weights.docs - opts.weights.ecosystem) + '）**：文档与生态两项需要逐仓采样才有区分度，浅层模式下不计入排序，否则"先被体检的仓库"会白占便宜。\n' : ''}
## 一、适配度榜（按${noDeep ? '可比分' : '总分'}）

${mdTable(
  ['#', '分档', '仓库', `${noDeep ? '可比分' : '总分'}`, `功能匹配/${WEIGHTS.fit}`, `可落地/${WEIGHTS.integrability}`, `维护/${WEIGHTS.maintenance}`, `文档/${WEIGHTS.docs}`, `生态/${WEIGHTS.ecosystem}`, `许可/${WEIGHTS.license}`, `风险/${WEIGHTS.risk}`, `热度/${WEIGHTS.popularity}`, '★', '语言', '停更d', '许可'],
  rows,
  ['r', '', '', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', '', 'r', ''],
)}

## 二、star 榜 vs 适配榜的偏离（这是本 skill 的核心产出）

**高星但被高估/落选（只看 star 会选错）**

${overHyped.length ? overHyped.map((r) => `- [${r.full_name}](${r.url}) ★${r.facts.stars} → ${r.reason}`).join('\n') : '- （无：star 头部与适配头部一致）'}

**低星但适配度高（只看 star 会漏掉）**

${underHyped.length ? underHyped.map((r) => `- [${r.full_name}](${r.url}) ★${r.facts.stars}（star 榜第 ${r.star_rank ?? '?'}）→ 适配度第 ${r.fit_rank}，分档「${r.tier}」`).join('\n') : '- （无）'}

## 三、被硬门槛淘汰的

${results.filter((r) => !r.gates.pass).length
  ? mdTable(
      ['仓库', '★', '淘汰原因'],
      results.filter((r) => !r.gates.pass).map((r) => [`[${r.full_name}](${r.url})`, r.facts.stars ?? '?', r.gates.fails.join('；')]),
    )
  : '（无）'}

## 四、逐项证据（前 ${Math.min(8, results.length)} 个）

${results
  .slice(0, Math.min(8, results.length))
  .map(
    (r) => `### ${r.fit_rank}. [${r.full_name}](${r.url}) — 总分 ${pct(r)}｜${r.tier}

- 描述：${mdEscape(r.description, 200) || '（无 description）'}
- 功能匹配：${r.parts.find((p) => p.key === 'fit').note}
- 事实：★${r.facts.stars ?? '?'}｜fork ${r.facts.forks ?? '?'}｜订阅者 ${r.facts.subscribers ?? '?'}｜贡献者 ${r.facts.contributors ?? '未采样'}｜语言 ${r.facts.language || '?'}｜许可 ${r.facts.spdx || '无'}
- 最近提交：${r.facts.last_commit ? `${r.facts.last_commit.date} 「${mdEscape(r.facts.last_commit.message, 80)}」` : `${r.facts.pushed_at || '?'}（${r.facts.days_since_push ?? '?'}d 前）`}
- 最近发布：${r.facts.latest_release ? `${r.facts.latest_release.tag} @ ${r.facts.latest_release.at}` : '无 GitHub Release'}
- 风险提示：${r.gates.warns.length ? r.gates.warns.join('；') : '未见明显'}
${r.fit_sources?.length ? `- 功能匹配证据来源（${r.fit_sources.length} 个）：${r.fit_sources.join(' · ')}` : ''}
${r.evidence_shortfall ? `- ⚠ 证据问题：${r.evidence_shortfall}` : ''}
${r.readme_excerpt ? `- README 摘要：${mdEscape(r.readme_excerpt, 300)}` : ''}
${r.deep_errors.length ? `- 取数异常：${r.deep_errors.join('；')}` : ''}
`,
  )
  .join('\n')}

${rateLimited ? `## 五、⚠ 数据不完整（API 配额耗尽）

深度体检在 ${deepMap.size}/${deepList.length} 个仓库处被限速中断：${rateLimitMsg}

**未体检的仓库在"文档/生态"两栏拿中位分，其排序不可与已体检者直接比较。** 继续办法：配 token（\`export GITHUB_TOKEN=...\`，或写进 \`~/.dsh/github-token\`）、等配额重置、或先 \`--no-deep\` 看可比分排序。

` : ''}## 六、数据缺口说明

- 深度体检上限 ${noDeep ? '无（--no-deep 浅层模式）' : String(a.get('deep')) === 'all' ? 'all' : deepN} 个，其余候选只有浅层数据（可落地/维护/许可由搜索快照得出，文档与生态按中位分），其总分仅供排序参考。
- 功能匹配分缺失（带 * ）的条目，总分不可直接决策：请按 README/描述补齐 --fit。
- 自动标记（flags）来自命名词/描述/体积的启发式判断，可能误判，请人工复核。
`;

/* 沙箱只读时不要白跑一轮：写失败就降级到 stdout，并说清怎么办。 */
const wrote = { json: null, md: null };
if (a.has('out')) {
  try {
    writeJson(a.get('out'), out);
    wrote.json = a.get('out');
  } catch (e) {
    if (e.name !== 'WriteFailed') throw e;
    process.stderr.write(writeFailureHint(e));
  }
}
const mdTarget = a.get('md');
if (mdTarget === '-') process.stdout.write(md);
else if (mdTarget) {
  try {
    writeText(mdTarget, md);
    wrote.md = mdTarget;
  } catch (e) {
    if (e.name !== 'WriteFailed') throw e;
    process.stderr.write(writeFailureHint(e) + '  → 已把报告打到 stdout\n\n');
    process.stdout.write(md + '\n');
  }
}
if (!a.has('md') && !wrote.md) {
  process.stdout.write(
    mdTable(
      ['#', '分档', '仓库', noDeep ? '可比分' : '总分', '★', '语言', '停更d', '许可'],
      results.slice(0, a.num('top', 20)).map((r) => [r.fit_rank, r.tier, r.full_name, pct(r), r.facts.stars ?? '?', r.facts.language || '?', r.facts.days_since_push ?? '?', r.facts.spdx || '—']),
      ['r', '', '', 'r', 'r', '', 'r', ''],
    ) + '\n',
  );
}
process.stdout.write(
  `[repo-audit] ${results.length} 个仓库：适配榜前 3 = ${scoredOnly.slice(0, 3).map((r) => `${r.full_name}(${r.total})`).join(', ') || '无'}\n` +
    `  结论：${verdict.strong_match ? '✅ 有强匹配' : '⚠ 没有强匹配'} — ${verdict.advice}\n` +
    `  高星落选 ${overHyped.length} 个｜低星高适配 ${underHyped.length} 个｜被门槛淘汰 ${results.filter((r) => !r.gates.pass).length} 个｜证据不足 ${results.filter((r) => r.evidence_shortfall).length} 个\n` +
    `  权重预设=${opts.weightsPreset}（star 项 ${opts.weights.popularity}/100，上限 ${POPULARITY_CAP}）｜证据门槛 ${opts.minSources} 个来源\n` +
    `  requests=${http.stats.requests} cache_hits=${http.stats.cacheHits}` +
    (wrote.json ? `\n  JSON → ${wrote.json}` : '') +
    (wrote.md ? `\n  Markdown → ${wrote.md}` : '') +
    '\n',
);

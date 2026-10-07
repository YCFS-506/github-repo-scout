/**
 * Shared helpers for the github-repo-scout skill.
 *
 * Dependency-free (Node >= 18, uses global fetch). Responsibilities:
 *   - tiny CLI arg parser (repeatable flags, --key=value or --key value)
 *   - GitHub token discovery
 *   - rate-limit aware, cached, retrying GET client
 *   - date / formatting / license helpers used by the two entry scripts
 *
 * Rate limits this module defends against (documented by GitHub):
 *   anonymous : search 10 req/min, core 60 req/hour
 *   token     : search 30 req/min, core 5000 req/hour
 * Anonymous budgets are tiny, so every response is cached on disk (TTL) and
 * the client paces requests instead of hammering and getting 403s.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const API = 'https://api.github.com';
export const UA = 'github-repo-scout/1.0 (+dsh-skill)';

/* ------------------------------------------------------------------ args --- */

/**
 * Parse argv into repeatable options. `--flag value`, `--flag=value`, and bare
 * `--flag` (boolean true) are supported; the bare form is used only when the
 * next token is absent or itself is another `--flag`.
 */
export function parseArgs(argv) {
  const opts = new Map();
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') {
      pos.push(...argv.slice(i + 1));
      break;
    }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      let k;
      let v;
      if (eq > -1) {
        k = a.slice(2, eq);
        v = a.slice(eq + 1);
      } else {
        k = a.slice(2);
        const nx = argv[i + 1];
        const looksLikeFlag = nx !== undefined && /^--[a-z]/i.test(nx);
        if (nx !== undefined && !looksLikeFlag) {
          v = nx;
          i++;
        } else {
          v = true;
        }
      }
      if (!opts.has(k)) opts.set(k, []);
      opts.get(k).push(v);
    } else {
      pos.push(a);
    }
  }
  const asStr = (v) => (v === true || v === undefined || v === null ? undefined : String(v));
  return {
    has: (k) => opts.has(k),
    get: (k, d) => {
      if (!opts.has(k)) return d;
      const v = asStr(opts.get(k).at(-1));
      return v === undefined ? d : v;
    },
    flag: (k) => {
      if (!opts.has(k)) return false;
      const v = opts.get(k).at(-1);
      if (v === true) return true;
      return !/^(false|no|off|0)$/i.test(String(v));
    },
    all: (k) => (opts.has(k) ? opts.get(k).map(asStr).filter((x) => x !== undefined) : []),
    num: (k, d) => {
      const v = opts.has(k) ? Number(asStr(opts.get(k).at(-1))) : NaN;
      return Number.isFinite(v) ? v : d;
    },
    pos,
  };
}

/* ----------------------------------------------------------------- token --- */

function readTokenFile(p) {
  try {
    const raw = fs.readFileSync(p, 'utf8').trim();
    if (!raw) return null;
    const m = raw.match(/(?:^|\s)(?:export\s+)?(?:GITHUB_TOKEN|GH_TOKEN)=(\S+)/);
    return m ? m[1] : raw.split(/\s+/)[0];
  } catch {
    return null;
  }
}

/**
 * Resolve a GitHub token, in order: explicit --token, env, gh CLI, token files.
 * Anonymous access is a supported (slow) mode, so this never throws.
 */
export function resolveToken(explicit) {
  if (explicit) return { token: explicit, source: '--token' };
  for (const k of ['GITHUB_TOKEN', 'GH_TOKEN', 'GITHUB_PAT']) {
    if (process.env[k] && process.env[k].trim()) return { token: process.env[k].trim(), source: 'env:' + k };
  }
  try {
    const out = execFileSync('gh', ['auth', 'token'], { stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 })
      .toString()
      .trim();
    if (out) return { token: out, source: 'gh auth token' };
  } catch {
    /* gh absent or not logged in */
  }
  for (const p of [
    path.join(os.homedir(), '.dsh', 'github-token'),
    path.join(os.homedir(), '.config', 'gh', 'token'),
    path.join(os.homedir(), '.github-token'),
  ]) {
    const t = readTokenFile(p);
    if (t) return { token: t, source: 'file:' + p };
  }
  return { token: null, source: 'anonymous' };
}

/* ------------------------------------------------------------------ http --- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');

export class RateLimited extends Error {
  constructor(message, resetAt) {
    super(message);
    this.name = 'RateLimited';
    this.resetAt = resetAt;
  }
}

export class Http {
  /**
   * @param {object} o
   * @param {string|null} [o.token]
   * @param {string} [o.cacheDir]  disk cache directory
   * @param {number} [o.ttlMs]     cache TTL
   * @param {boolean} [o.noCache]  bypass cache reads and writes
   * @param {number} [o.maxSleepMs] longest we wait out a rate-limit reset
   * @param {boolean} [o.verbose]
   */
  constructor({ token = null, cacheDir = null, ttlMs = 6 * 3600e3, noCache = false, maxSleepMs = 90e3, verbose = false } = {}) {
    this.token = token;
    this.cacheDir = cacheDir || path.join(os.tmpdir(), 'github-repo-scout-cache');
    this.ttlMs = ttlMs;
    this.noCache = noCache;
    this.maxSleepMs = maxSleepMs;
    this.verbose = verbose;
    this.stats = { requests: 0, cacheHits: 0, waits: 0, retries: 0, notFound: 0 };
    this.rate = {};
    this._lastCallAt = { search: 0, core: 0 };
    // Anonymous search is 10/min -> keep headroom instead of racing the window.
    this._minInterval = { search: token ? 2100 : 6600, core: token ? 60 : 1100 };
    if (!this.noCache) {
      try {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      } catch {
        this.noCache = true;
      }
    }
  }

  bucket(url) {
    return url.includes('/search/') ? 'search' : 'core';
  }

  _cachePath(url) {
    return path.join(this.cacheDir, sha1(url) + '.json');
  }

  _readCache(url) {
    if (this.noCache) return null;
    try {
      const rec = JSON.parse(fs.readFileSync(this._cachePath(url), 'utf8'));
      if (rec.url !== url) return null;
      if (Date.now() - rec.ts > this.ttlMs) return null;
      return rec;
    } catch {
      return null;
    }
  }

  _writeCache(url, status, body, rate) {
    if (this.noCache) return;
    try {
      fs.writeFileSync(this._cachePath(url), JSON.stringify({ url, ts: Date.now(), status, body, rate }));
    } catch {
      /* cache is best-effort */
    }
  }

  /**
   * 只读磁盘缓存，绝不发请求。用于 --no-deep 模式：把之前体检过的仓库结果白捡回来。
   * 返回 null 表示缓存里没有（调用方必须容忍）。
   */
  peek(url) {
    const hit = this._readCache(url);
    if (!hit) return null;
    this.stats.cacheHits++;
    if (hit.status === 404) return { status: 404, json: null, fromCache: true };
    return typeof hit.body === 'string'
      ? { raw: hit.body, status: hit.status, fromCache: true }
      : { json: hit.body, status: hit.status, fromCache: true };
  }

  async _pace(bucket) {
    const wait = this._lastCallAt[bucket] + this._minInterval[bucket] - Date.now();
    if (wait > 0) {
      this.stats.waits++;
      if (this.verbose) process.stderr.write(`[pacing] ${bucket} sleeping ${Math.round(wait)}ms\n`);
      await sleep(wait);
    }
    this._lastCallAt[bucket] = Date.now();
  }

  /**
   * GET a GitHub endpoint. Returns { json, status, fromCache, rate }.
   * With raw:true the body is text (README) and returned in `.raw`.
   */
  async get(url, { raw = false, headers = {} } = {}) {
    const hit = this._readCache(url);
    if (hit) {
      this.stats.cacheHits++;
      if (hit.rate) this.rate = { ...this.rate, ...hit.rate };
      return hit.status === 404
        ? { status: 404, json: null, fromCache: true, rate: hit.rate }
        : { json: raw ? undefined : hit.body, raw: raw ? hit.body : undefined, status: hit.status, fromCache: true, rate: hit.rate };
    }

    const bucket = this.bucket(url);
    let lastErr = null;
    for (let attempt = 1; attempt <= 4; attempt++) {
      await this._pace(bucket);
      let res;
      try {
        res = await fetch(url, {
          headers: {
            accept: raw ? 'application/vnd.github.raw' : 'application/vnd.github+json',
            'user-agent': UA,
            'x-github-api-version': '2022-11-28',
            ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
            ...headers,
          },
          signal: AbortSignal.timeout(30_000),
        });
      } catch (e) {
        lastErr = e;
        this.stats.retries++;
        if (attempt === 4) break;
        await sleep(1000 * 2 ** (attempt - 1));
        continue;
      }
      this.stats.requests++;

      const rate = {
        limit: Number(res.headers.get('x-ratelimit-limit') || 0) || undefined,
        remaining: Number(res.headers.get('x-ratelimit-remaining') ?? NaN),
        reset: Number(res.headers.get('x-ratelimit-reset') || 0) || undefined,
        resource: res.headers.get('x-ratelimit-resource') || bucket,
      };
      if (!Number.isFinite(rate.remaining)) delete rate.remaining;
      this.rate[rate.resource || bucket] = rate;

      if (res.status === 404) {
        this.stats.notFound++;
        this._writeCache(url, 404, null, rate);
        return { status: 404, json: null, fromCache: false, rate };
      }

      const exhausted = (res.status === 403 || res.status === 429) && rate.remaining === 0;
      if (exhausted) {
        const resetMs = rate.reset ? rate.reset * 1000 - Date.now() : Infinity;
        if (resetMs <= this.maxSleepMs) {
          const w = Math.max(resetMs + 1500, 2000);
          if (this.verbose) process.stderr.write(`[rate] ${bucket} window exhausted, sleeping ${Math.round(w / 1000)}s\n`);
          this.stats.waits++;
          this.stats.retries++;
          await sleep(w);
          continue;
        }
        throw new RateLimited(
          `${bucket} API rate limit exhausted. Resets at ${rate.reset ? new Date(rate.reset * 1000).toISOString() : 'unknown'}.\n` +
            `Get 10-80x more headroom with a token: export GITHUB_TOKEN=<pat>, write it to ~/.dsh/github-token, or pass --token.`,
          rate.reset ? rate.reset * 1000 : null,
        );
      }
      if (res.status === 403 || res.status === 429 || res.status >= 500) {
        const ra = Number(res.headers.get('retry-after') || 0);
        lastErr = new Error(`HTTP ${res.status} for ${url}`);
        this.stats.retries++;
        if (attempt === 4) break;
        await sleep(ra ? ra * 1000 : 1500 * 2 ** (attempt - 1));
        continue;
      }
      if (res.status === 422) {
        const body = await res.text().catch(() => '');
        const err = new Error(`HTTP 422 (invalid search query) for ${url}\n${body.slice(0, 300)}`);
        err.validation = true;
        err.url = url;
        throw err;
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} for ${url}\n${body.slice(0, 300)}`);
      }

      if (raw) {
        const text = await res.text();
        this._writeCache(url, res.status, text, this.rate);
        return { raw: text, status: res.status, fromCache: false, rate };
      }
      const json = await res.json();
      this._writeCache(url, res.status, json, this.rate);
      return { json, status: res.status, fromCache: false, rate };
    }
    throw lastErr || new Error(`request failed: ${url}`);
  }
}

/* ------------------------------------------------------------------ misc --- */

export function daysSince(iso) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.floor((Date.now() - t) / 86400e3);
}

export function isoDay(d) {
  return new Date(d).toISOString().slice(0, 10);
}

export function shiftDays(n) {
  return isoDay(Date.now() - n * 86400e3);
}

export function fmtRel(days) {
  if (days === null || days === undefined) return '?';
  if (days < 0) return 'future';
  if (days === 0) return 'today';
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

export function mdEscape(s, max = 110) {
  let t = String(s ?? '').replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim();
  if (t.length > max) t = t.slice(0, max - 1) + '…';
  return t;
}

export function mdTable(headers, rows, align = []) {
  const line = (cells) => '| ' + cells.map((c) => String(c)).join(' | ') + ' |';
  const sep = headers.map((_, i) => (align[i] === 'r' ? '---:' : '---'));
  return [line(headers), line(sep), ...rows.map(line)].join('\n');
}

export function readJson(p) {
  return JSON.parse(fs.readFileSync(path.resolve(p), 'utf8'));
}

/**
 * 永不抛错的写文件。沙箱型 agent（Codex 等）在未受信任的目录里是只读的，
 * 写报告会 EPERM —— 这时候应该给出清楚的原因并降级到 stdout，而不是把整轮体检白跑。
 * 返回 { ok: true, path } 或 { ok: false, error }。
 */
export function safeWrite(p, content) {
  const abs = path.resolve(p);
  try {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
    return { ok: true, path: abs };
  } catch (e) {
    return { ok: false, path: abs, error: `${e.code || ''} ${e.message}`.trim() };
  }
}

export function writeJson(p, obj) {
  const r = safeWrite(p, JSON.stringify(obj, null, 2) + '\n');
  if (!r.ok) throw new WriteFailed(r.path, r.error);
  return r.path;
}

export function writeText(p, text) {
  const r = safeWrite(p, text);
  if (!r.ok) throw new WriteFailed(r.path, r.error);
  return r.path;
}

export class WriteFailed extends Error {
  constructor(path, reason) {
    super(`写不进 ${path}：${reason}`);
    this.name = 'WriteFailed';
    this.path = path;
    this.reason = reason;
  }
}

/** 写不进去时的统一提示（沙箱只读是最常见原因）。 */
export function writeFailureHint(err) {
  return (
    `[warn] 输出文件写失败：${err.reason || err.message}\n` +
    `  常见原因：沙箱只读（Codex 等项目未被信任时，工作区不可写）。可选做法：\n` +
    `    ① 申请沙箱升级后重跑；② 在 Codex 里把该项目标记为 trusted；③ 只输出到 stdout（--md -）。\n`
  );
}

export function die(msg, code = 1) {
  process.stderr.write(`\n✖ ${msg}\n`);
  process.exit(code);
}

/* -------------------------------------------------------------- languages --- */

const LANG_ALIASES = {
  ts: 'TypeScript', typescript: 'TypeScript',
  js: 'JavaScript', javascript: 'JavaScript', node: 'JavaScript', nodejs: 'JavaScript',
  py: 'Python', python: 'Python', python3: 'Python',
  go: 'Go', golang: 'Go',
  rust: 'Rust', rs: 'Rust',
  java: 'Java', kotlin: 'Kotlin', kt: 'Kotlin', scala: 'Scala',
  c: 'C', cpp: 'C++', 'c++': 'C++', cs: 'C#', 'c#': 'C#', csharp: 'C#',
  php: 'PHP', ruby: 'Ruby', rb: 'Ruby', perl: 'Perl',
  shell: 'Shell', bash: 'Shell', sh: 'Shell', powershell: 'PowerShell',
  lua: 'Lua', dart: 'Dart', swift: 'Swift', elixir: 'Elixir', erlang: 'Erlang',
  haskell: 'Haskell', zig: 'Zig', nim: 'Nim', clojure: 'Clojure',
  vue: 'Vue', svelte: 'Svelte', html: 'HTML', css: 'CSS', 'jupyter notebook': 'Jupyter Notebook',
};

export function normalizeLang(v) {
  const s = String(v).trim();
  const hit = Object.keys(LANG_ALIASES).find((k) => k === s.toLowerCase());
  return hit ? LANG_ALIASES[hit] : s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** null when no target stack was declared (unknown, not mismatch). */
export function langMatches(lang, targets) {
  if (!targets || !targets.length) return null;
  if (!lang) return false;
  const l = lang.toLowerCase();
  return targets.some((t) => t.toLowerCase() === l);
}

/* ---------------------------------------------------------------- licenses --- */

export const LICENSE_CLASS = {
  mit: 'permissive', 'apache-2.0': 'permissive', 'bsd-2-clause': 'permissive', 'bsd-3-clause': 'permissive',
  'bsd-4-clause': 'permissive', isc: 'permissive', '0bsd': 'permissive', unlicense: 'permissive',
  'cc0-1.0': 'permissive', wtfpl: 'permissive', zlib: 'permissive', 'mpl-2.0': 'weak', 'epl-2.0': 'weak',
  lgpl: 'weak', 'lgpl-2.1': 'weak', 'lgpl-3.0': 'weak', 'artistic-2.0': 'weak',
  gpl: 'strong', 'gpl-2.0': 'strong', 'gpl-3.0': 'strong', agpl: 'strong', 'agpl-3.0': 'strong',
};

export function licenseClass(spdx) {
  if (!spdx) return 'none';
  const s = String(spdx).toLowerCase();
  if (s === 'noassertion') return 'unclear';
  return LICENSE_CLASS[s] || 'other';
}

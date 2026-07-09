#!/usr/bin/env node
/**
 * Expo Router 라우트 충돌 검사기. 의존성 없음(node >= 18).
 *
 * 검사 항목
 *   E1 DUPLICATE      같은 URL + 같은 그룹 시그니처 → 어느 쪽도 고를 수 없다. 하드 에러.
 *                     예: diary/[id].tsx + diary/[id]/index.tsx
 *   E2 UNADDRESSABLE  URL을 여러 라우트가 공유하는데, 그중 하나가 그룹 밖에 있다.
 *                     그룹 밖 라우트는 그룹 접두사로 지목할 수 없어 "먼저 매칭되는 쪽"
 *                     에 가려진다. 모든 참여 라우트를 그룹으로 감쌀 것.
 *                     예: index.tsx + (tabs)/index.tsx
 *   E3 AMBIGUOUS_NAV  모호한 URL로 그룹 접두사 없이 이동하는 호출부.
 *                     예: router.replace('/')  (매칭 라우트가 2개일 때)
 *   W1 UNKNOWN_HREF   알려진 라우트에 매칭되지 않는 리터럴 href (오타 탐지).
 *
 * 사용법: node scripts/check-routes.mjs [routeRoot] [scanRoot...]
 *   기본값: routeRoot=app, scanRoot=app src
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROUTE_EXT = /\.(tsx|ts|jsx|js)$/;
const SKIP_DIR = /^(__tests__|__mocks__|node_modules)$/;
const SKIP_FILE = /(\.test\.|\.spec\.|^_layout\.|^\+html\.|^\+native-intent\.)/;

const [, , routeRootArg, ...scanRootArgs] = process.argv;
const ROUTE_ROOT = routeRootArg ?? 'app';
const SCAN_ROOTS = scanRootArgs.length ? scanRootArgs : ['app', 'src'];

/* ---------- 1. 라우트 테이블 만들기 ---------- */

/** routesOnly=true 면 _layout/테스트 등 라우트가 아닌 파일을 뺀다. */
function walk(dir, routesOnly, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIR.test(entry)) walk(full, routesOnly, out);
    } else if (ROUTE_EXT.test(entry) && !(routesOnly && SKIP_FILE.test(entry))) {
      out.push(full);
    }
  }
  return out;
}

const isGroup = (seg) => /^\(.+\)$/.test(seg);

/** 파일 경로 → { url, groups } */
function toRoute(file) {
  const segs = relative(ROUTE_ROOT, file).split(sep);
  segs[segs.length - 1] = segs[segs.length - 1].replace(ROUTE_EXT, '');

  const groups = segs.filter(isGroup);
  const path = segs
    .filter((s) => !isGroup(s))
    .filter((s, i, a) => !(s === 'index' && i === a.length - 1))

  return { file, url: '/' + path.join('/'), groups };
}

const routes = walk(ROUTE_ROOT, true).map(toRoute);

const byUrl = new Map();
for (const r of routes) {
  if (!byUrl.has(r.url)) byUrl.set(r.url, []);
  byUrl.get(r.url).push(r);
}

/* ---------- 2. 라우트 트리 검사 ---------- */

const errors = new Set();
const warnings = new Set();
const ambiguousUrls = new Set();

for (const [url, rs] of byUrl) {
  if (rs.length === 1) continue;
  ambiguousUrls.add(url);

  const sigs = new Map();
  for (const r of rs) {
    const sig = r.groups.join('>');
    if (!sigs.has(sig)) sigs.set(sig, []);
    sigs.get(sig).push(r);
  }

  for (const [sig, dupes] of sigs) {
    if (dupes.length > 1) {
      errors.add(
        `E1 DUPLICATE  ${url} — 그룹 시그니처가 같은 라우트 ${dupes.length}개. ` +
          `하나만 남길 것.\n` +
          dupes.map((d) => `        ${d.file}`).join('\n'),
      );
    }
  }

  const naked = rs.filter((r) => r.groups.length === 0);
  if (naked.length) {
    errors.add(
      `E2 UNADDRESSABLE  ${url} — 라우트 ${rs.length}개가 공유하는데 ` +
        `그룹 밖 라우트가 있어 지목이 불가능하다. 전부 그룹으로 감쌀 것.\n` +
        rs
          .map(
            (r) =>
              `        ${r.file}` +
              (r.groups.length ? `  → ${hrefFor(r)}` : '  → 지목 불가'),
          )
          .join('\n'),
    );
  }
}

function hrefFor(r) {
  if (!r.groups.length) return r.url;
  const segs = relative(ROUTE_ROOT, r.file).replace(ROUTE_EXT, '').split(sep);
  const kept = segs.filter((s, i, a) => !(s === 'index' && i === a.length - 1));
  return '/' + kept.join('/');
}

/* ---------- 3. 호출부 검사 ---------- */

const NAV_PATTERNS = [
  /router\s*\.\s*(?:push|replace|navigate)\s*\(\s*['"`]([^'"`]+)['"`]/g,
  /pathname\s*:\s*['"`]([^'"`]+)['"`]/g,
  /\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|\{\s*['"`]([^'"`]+)['"`]\s*\})/g,
  /\brouter\s*\.\s*(?:push|replace|navigate)\s*\(\s*\{\s*pathname\s*:\s*['"`]([^'"`]+)['"`]/g,
];

const knownUrls = new Set(byUrl.keys());
const knownHrefs = new Set(routes.map(hrefFor));

/** href에서 그룹 세그먼트를 제거해 URL로 정규화 */
const hrefToUrl = (h) =>
  '/' +
  h
    .split('/')
    .filter(Boolean)
    .filter((s) => !isGroup(s))
    .join('/');

for (const root of SCAN_ROOTS) {
  for (const file of walk(root, false)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (/^\s*(\/\/|\*)/.test(line)) return; // 주석 스킵
      for (const re of NAV_PATTERNS) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(line))) {
          const href = m[1] ?? m[2] ?? m[3];
          if (!href || !href.startsWith('/')) continue;
          const loc = `${file}:${i + 1}`;
          const hasGroup = href.split('/').some(isGroup);

          const url = hrefToUrl(href);
          if (ambiguousUrls.has(url) && !hasGroup) {
            errors.add(
              `E3 AMBIGUOUS_NAV  ${loc}\n` +
                `        '${href}' 는 라우트 ${byUrl.get(url).length}개에 매칭된다. ` +
                `그룹을 명시할 것:\n` +
                byUrl
                  .get(url)
                  .map((r) => `          ${hrefFor(r)}`)
                  .join('\n'),
            );
          } else if (!knownHrefs.has(href) && !knownUrls.has(url)) {
            warnings.add(`W1 UNKNOWN_HREF  ${loc}  '${href}'`);
          }
        }
      }
    });
  }
}

/* ---------- 4. 리포트 ---------- */

console.log(`라우트 ${routes.length}개 · 고유 URL ${byUrl.size}개`);
if (ambiguousUrls.size) {
  console.log(`공유 URL: ${[...ambiguousUrls].join(', ')}`);
}
console.log('');

for (const w of warnings) console.log(`  ⚠ ${w}`);
for (const e of errors) console.log(`  ✖ ${e}\n`);

if (errors.size) {
  console.log(`실패: 에러 ${errors.size}개, 경고 ${warnings.size}개`);
  process.exit(1);
}
console.log(`통과: 에러 0개, 경고 ${warnings.size}개`);

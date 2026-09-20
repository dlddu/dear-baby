#!/usr/bin/env node
/**
 * 목업 ↔ 라우트 매핑 레지스트리 검사기. 의존성 없음(node >= 18).
 *
 * 레지스트리: docs/mockup-route-map.md
 * 시각 SSOT : docs/mockups (화면 ID M-NN)
 * 구현      : app/app/** (expo-router 라우트) · app/src/**
 *
 * 검사 항목
 *   R1 UNREGISTERED    라우트가 매핑 표에 없다 / 두 번 있다.
 *   R2 PHANTOM_ROW     매핑 표의 라우트 파일이 실재하지 않는다.
 *   R3 UNKNOWN_MOCKUP  매핑 표가 지목한 M-NN 이 갤러리 인덱스에 없다.
 *   R4 SILENT_GAP      목업 칸이 `—` 인데 비고에 사유가 없다.
 *   R5 COMMENT_MISMATCH 라우트 주석의 M-NN 이 매핑 표 값의 부분집합이 아니다.
 *   R6 STALE_REF       주석이 인용한 docs 경로가 없거나 줄 범위가 유효 구간 밖이다.
 *   R7 LEDGER          원장이 실제 위반 집합과 다르거나(누락·공전) 상한을 넘는다.
 *   R8 DEVIATION       허용목록 행에 사유가 없거나 구현 심볼이 fonts.ts 에 없다.
 *   R9 COUNT_DRIFT     목업 총수가 실측·일람 표·README 선언과 어긋난다.
 *
 * R5·R6 위반은 「미해소 위반 원장」에 등재돼 있으면 통과시키되, R7 이 원장을
 * 실제 위반 집합과 정확히 대조한다 — 등재되지 않은 새 위반도, 이미 고쳐졌는데
 * 원장에 남아 있는 공전 행도 실패다(래칫).
 *
 * 사용법: node scripts/check-mockup-route-map.mjs [repoRoot]
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.argv[2] ?? '.';
const REGISTRY = 'docs/mockup-route-map.md';
const ROUTE_ROOT = 'app/app';
const SCAN_ROOTS = ['app/app', 'app/src'];
const SCREENS_DIR = 'docs/mockups/source/src/screens';
const GALLERY = `${SCREENS_DIR}/GalleryScreen.tsx`;
const MOCKUPS_README = 'docs/mockups/README.md';
const DOCS_README = 'docs/README.md';
const FONTS = 'app/src/theme/fonts.ts';
const NO_MOCKUP = '—';

const abs = (p) => join(ROOT, p);
const read = (p) => readFileSync(abs(p), 'utf8');

const violations = [];
const fail = (code, msg) => violations.push(`${code}  ${msg}`);

/* ---------- 0. 레지스트리 파싱 ---------- */

/** 마커 사이 구간만 읽는다 — 설명 산문이 파서의 입력이 되지 않게 한다. */
function section(md, name) {
  const re = new RegExp(`<!--\\s*${name}:begin\\s*-->([\\s\\S]*?)<!--\\s*${name}:end\\s*-->`);
  const m = md.match(re);
  if (!m) {
    // 마커를 지우면 그 구간이 통째로 검사에서 빠져 버린다 — 조용히 넘기지 않고 여기서 끝낸다.
    console.log(`  ✖ R0 NO_MARKER  ${REGISTRY} 에 <!-- ${name}:begin/end --> 마커가 없다\n\n실패: 위반 1건`);
    process.exit(1);
  }
  return m[1];
}

/** 마크다운 표 → 셀 배열(헤더·구분선 제외) */
function table(block) {
  return block
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|'))
    .map((l) => l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()))
    .filter((cells, i) => i > 0 && !cells.every((c) => /^:?-{3,}:?$/.test(c)));
}

const code = (s) => (s.match(/`([^`]+)`/) ?? [])[1] ?? '';

const registryMd = read(REGISTRY);
const routeRows = table(section(registryMd, 'route-map'));
const ledgerRows = table(section(registryMd, 'ledger'));
const deviationRows = table(section(registryMd, 'deviations'));

const ledgerCap = Number((registryMd.match(/<!--\s*ledger-cap:\s*(\d+)\s*-->/) ?? [])[1] ?? NaN);
if (!Number.isInteger(ledgerCap)) fail('R7 LEDGER', '<!-- ledger-cap: N --> 선언이 없다');

/** 라우트 → { mockups:Set, status, note } */
const registry = new Map();
for (const [routeCell, mockupCell, status, note = ''] of routeRows) {
  const route = code(routeCell);
  if (!route) {
    fail('R2 PHANTOM_ROW', `라우트 칸을 백틱으로 감싼 경로로 적을 것: ${routeCell}`);
    continue;
  }
  if (registry.has(route)) fail('R1 UNREGISTERED', `${route} — 매핑 표에 행이 2개 이상이다`);
  const mockups = mockupCell === NO_MOCKUP ? [] : (mockupCell.match(/M-\d{2}/g) ?? []);
  if (mockupCell !== NO_MOCKUP && !mockups.length)
    fail('R3 UNKNOWN_MOCKUP', `${route} — 목업 칸을 M-NN 또는 ${NO_MOCKUP} 로 적을 것: "${mockupCell}"`);
  if (!['구현', '부분', '플레이스홀더'].includes(status))
    fail('R1 UNREGISTERED', `${route} — 상태는 구현/부분/플레이스홀더 중 하나여야 한다: "${status}"`);
  if (mockupCell === NO_MOCKUP && note.replace(/[*`]/g, '').trim().length < 10)
    fail('R4 SILENT_GAP', `${route} — 대응 목업이 없으면 비고에 사유를 적을 것(공백은 침묵으로 숨는다)`);
  registry.set(route, { mockups: new Set(mockups), status, note });
}

/* ---------- 1. 실측 인벤토리 ---------- */

const SKIP_DIR = /^(__tests__|__mocks__|node_modules)$/;
const SKIP_FILE = /(\.test\.|\.spec\.|^_layout\.|^\+html\.|^\+native-intent\.)/;
const SRC_EXT = /\.(tsx|ts|jsx|js)$/;

/** routesOnly=true 면 _layout/테스트 등 라우트가 아닌 파일을 뺀다 (check-routes.mjs 와 동일 기준). */
function walk(dir, routesOnly, out = []) {
  for (const entry of readdirSync(abs(dir))) {
    const full = join(dir, entry);
    if (statSync(abs(full)).isDirectory()) {
      if (!SKIP_DIR.test(entry)) walk(full, routesOnly, out);
    } else if (SRC_EXT.test(entry) && !(routesOnly && SKIP_FILE.test(entry))) {
      out.push(full.split(sep).join('/'));
    }
  }
  return out;
}

const routes = walk(ROUTE_ROOT, true).sort();
const galleryIds = new Set((read(GALLERY).match(/\{\s*id:\s*"(M-\d{2})"/g) ?? []).map((s) => s.match(/M-\d{2}/)[0]));

/** 목업 화면 파일 → { M-NN: [시작줄, 끝줄] } (`// M-NN` 선언이 블록 경계) */
function mockupBlocks(path) {
  const lines = read(path).split('\n');
    const marks = [];
  lines.forEach((l, i) => {
    const m = l.match(/^\s*\/\/\s*(M-\d{2})\b/);
    if (m) marks.push([i + 1, m[1]]);
  });
  const out = new Map();
  marks.forEach(([ln, id], j) => out.set(id, [ln, j + 1 < marks.length ? marks[j + 1][0] - 1 : lines.length]));
  return { blocks: out, length: lines.length };
}

/* ---------- 2. R1 · R2 · R3 ---------- */

for (const r of routes) if (!registry.has(r)) fail('R1 UNREGISTERED', `${r} — 매핑 표에 없다. 대응 목업이 없으면 ${NO_MOCKUP} + 사유로 등재할 것`);
for (const r of registry.keys()) if (!existsSync(abs(r))) fail('R2 PHANTOM_ROW', `${r} — 파일이 없다(이동·삭제됐으면 행도 지울 것)`);
for (const [r, { mockups }] of registry)
  for (const id of mockups) if (!galleryIds.has(id)) fail('R3 UNKNOWN_MOCKUP', `${r} → ${id} — 갤러리 인덱스(${GALLERY})에 없다`);

/* ---------- 3. R5 · R6 (원장 대조 대상) ---------- */

/** `docs/…확장자` + 선택적 줄 범위 */
const REF = /(docs\/[A-Za-z0-9_./-]+?\.(?:tsx|ts|md))(?:[: ]L?(\d+)-(\d+))?/g;
const found = new Set(); // `${file}|${rule}`

for (const file of SCAN_ROOTS.flatMap((r) => walk(r, false)).sort()) {
  const txt = read(file);
  const cited = new Set(txt.match(/M-\d{2}/g) ?? []);

  // R5 — 주석이 언급한 M-NN 은 그 라우트의 매핑 값이어야 한다.
  const row = registry.get(file);
  if (row) {
    const stray = [...cited].filter((id) => !row.mockups.has(id));
    if (stray.length) {
      found.add(`${file}|R5`);
      recordable('R5 COMMENT_MISMATCH', file, `주석이 ${stray.join(', ')} 를 인용하는데 매핑은 ${[...row.mockups].join(', ') || NO_MOCKUP} 다`);
    }
  }

  // R6 — 인용한 docs 경로·줄 범위가 유효해야 한다.
  const problems = [];
  for (const m of txt.matchAll(REF)) {
    const [, path, a, b] = m;
    if (!existsSync(abs(path))) {
      problems.push(`${path} — 경로가 없다`);
      continue;
    }
    if (!a) continue;
    const [from, to] = [Number(a), Number(b)];
    if (!path.startsWith(SCREENS_DIR)) continue;
    const { blocks, length } = mockupBlocks(path);
    if (to > length) {
      problems.push(`${path}:${from}-${to} — 파일은 ${length}줄뿐이다`);
      continue;
    }
    const owners = [...blocks].filter(([, [s, e]]) => s <= from && to <= e).map(([id]) => id);
    if (cited.size && !owners.some((id) => cited.has(id)))
      problems.push(`${path}:${from}-${to} — 인용한 ${[...cited].join(', ')} 블록 밖이다(현재 구간: ${owners.join(', ') || '없음'})`);
  }
  if (problems.length) {
    found.add(`${file}|R6`);
    recordable('R6 STALE_REF', file, problems.join(' / '));
  }
}

/** 원장에 등재돼 있으면 위반을 통과시키고, 없으면 실패로 올린다. */
function recordable(codeStr, file, detail) {
  const listed = ledgerRows.some(([, target, rule]) => code(target) === file && rule.trim() === codeStr.split(' ')[0]);
  if (!listed) fail(codeStr, `${file} — ${detail}. 고치거나 「미해소 위반 원장」에 사유와 함께 등재할 것`);
}

/* ---------- 4. R7 원장 래칫 ---------- */

if (ledgerRows.length > ledgerCap)
  fail('R7 LEDGER', `원장 ${ledgerRows.length}행 > 상한 ${ledgerCap}. 상한은 내릴 때만 고친다`);

for (const cells of ledgerRows) {
  const [, target, rule] = cells;
  const key = `${code(target)}|${rule.trim()}`;
  if (!code(target)) fail('R7 LEDGER', `원장 대상은 백틱 경로로 적을 것: ${target}`);
  else if (!found.has(key)) fail('R7 LEDGER', `${code(target)} (${rule.trim()}) — 더 이상 위반이 아니다. 고쳤으면 원장에서 지울 것(공전 금지)`);
  if (cells.slice(3).some((c) => c.trim().length < 5)) fail('R7 LEDGER', `${code(target)} — 위반 내용·해소 조건을 비워 둘 수 없다`);
}

/* ---------- 5. R8 이탈 허용목록 ---------- */

const fontsSrc = read(FONTS);
for (const [item, spec, symbolCell, reason = ''] of deviationRows) {
  const symbol = code(symbolCell);
  if (!symbol) fail('R8 DEVIATION', `${item} — 구현 심볼을 백틱으로 적을 것`);
  else if (!fontsSrc.includes(symbol)) fail('R8 DEVIATION', `${item} — 구현 심볼 ${symbol} 이 ${FONTS} 에 없다`);
  if (!spec.trim()) fail('R8 DEVIATION', `${item} — 목업/문서 쪽 값을 비워 둘 수 없다`);
  if (reason.replace(/[*`]/g, '').trim().length < 20) fail('R8 DEVIATION', `${item} — 사유 없는 이탈은 허용목록이 아니다(미문서화 이탈)`);
}

/* ---------- 6. R9 집계 고정 ---------- */

const declared = [
  ['레지스트리', Number((registryMd.match(/목업 총수\(실측 기준\): \*\*(\d+)\*\*/) ?? [])[1])],
  ['docs/mockups/README.md 일람 제목', Number((read(MOCKUPS_README).match(/##\s*(\d+)개 페이지 일람/) ?? [])[1])],
  ['docs/mockups/README.md 일람 표', read(MOCKUPS_README).split('\n').filter((l) => /^\|\s*\*{0,2}M-\d{2}/.test(l)).length],
  ['docs/README.md', Number((read(DOCS_README).match(/—\s*(\d+)개 화면/) ?? [])[1])],
];
for (const [where, n] of declared)
  if (n !== galleryIds.size) fail('R9 COUNT_DRIFT', `${where} 의 목업 수 ${Number.isNaN(n) ? '(선언 없음)' : n} ≠ 실측 ${galleryIds.size}`);

const declaredRoutes = Number((registryMd.match(/라우트 총수\(실측 기준\): \*\*(\d+)\*\*/) ?? [])[1]);
if (declaredRoutes !== routes.length)
  fail('R9 COUNT_DRIFT', `레지스트리의 라우트 수 ${Number.isNaN(declaredRoutes) ? '(선언 없음)' : declaredRoutes} ≠ 실측 ${routes.length}`);

/* ---------- 7. 리포트 ---------- */

const gaps = [...registry.values()].filter((v) => !v.mockups.size).length;
const placeholders = [...registry.values()].filter((v) => v.status === '플레이스홀더').length;
console.log(`라우트 ${routes.length}개 · 목업 ${galleryIds.size}개 · 등재 ${registry.size}행`);
console.log(`대응 목업 없음 ${gaps}행 · 플레이스홀더 ${placeholders}행 · 미해소 원장 ${ledgerRows.length}/${ledgerCap}행 · 이탈 허용목록 ${deviationRows.length}행`);
console.log('');

for (const v of violations) console.log(`  ✖ ${v}`);
if (violations.length) {
  console.log(`\n실패: 위반 ${violations.length}건`);
  process.exit(1);
}
console.log('통과: 위반 0건 (R1~R9)');

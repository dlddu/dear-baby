#!/usr/bin/env node
/**
 * 여정 ↔ 목업 매핑 레지스트리 검사기. 의존성 없음(node >= 18).
 *
 * 레지스트리 : docs/journey-mockup-map.md
 * 흐름 SSOT  : docs/user-journeys/*-journey.md
 *              (`### Stage <번호>` 또는 슬러그 체계의 ``### `STP-<슬러그>` `` 헤딩)
 * 목업       : docs/mockups/source/src/screens (GalleryScreen.tsx 의 갤러리 그룹 + 화면 라벨)
 *              docs/mockups/source/src/journey/<id>.tsx (독립 여정 페이지의 단계 → 카드)
 * 번들       : docs/mockups/index.html (빌드된 갤러리 번들)
 *              docs/journeys/<id>/index.html (빌드된 독립 여정 페이지)
 *
 * 진입점 모형 — 갤러리 그룹과 독립 여정 페이지의 혼재를 명시적으로 다룬다.
 *   한 여정의 **정규 진입점은 갤러리 그룹 1개**다(모델 규칙 2의 단위). 여정이 자기 페이지로
 *   이관돼도 갤러리 그룹은 색인으로 남으므로, 페이지를 「그룹 대체」가 아니라 **추가 선언**으로
 *   읽는다. 그래야 이관이 그룹을 고아로 만들지 않고(J7 래칫 무이동) 페이지 쪽 기계 대조(J10)를
 *   덤으로 얻는다. 페이지가 없는 여정은 지금까지와 똑같이 그룹만으로 판정된다.
 *
 * 검사 항목
 *   J0 NO_MARKER     레지스트리·예외 섹션의 begin/end 마커가 없다.
 *   J1 UNREGISTERED  여정 문서가 여정 표에 없다 / 두 번 있다.
 *   J2 PHANTOM_ROW   여정 표·원장이 지목한 여정 문서가 실재하지 않는다.
 *   J3 ENTRYPOINT    갤러리 그룹이 실재하지 않거나, 두 여정이 같은 그룹을 지목하거나,
 *                    진입점 없는 여정이 「여정 mockup 예외」에 등재돼 있지 않다.
 *   J4 CARD_SET      단계 표의 카드 집합 ≠ 갤러리 그룹의 카드 집합(어느 방향이든).
 *   J5 STAGE_SET     단계 표의 단계 집합 ≠ 여정 문서의 단계 헤딩 집합(어느 방향이든).
 *   J6 UNVISUALIZED  대응 카드가 `—` 인 단계 집합 ≠ 미시각화 원장(또는 상한 초과·사유 없음).
 *   J7 ORPHAN        어느 여정도 지목하지 않은 갤러리 그룹 집합 ≠ 고아 원장(또는 상한 초과).
 *   J8 STALE_LABEL   화면 라벨이 인용한 `Stage <id>` 가 그 카드의 여정 문서에 없다 —
 *                    위반 집합 ≠ 구 번호 라벨 원장(또는 상한 초과).
 *   J9 SYNC          mockups/README.md 일람 표·번들·집계 선언이 이 레지스트리와 어긋난다.
 *   J10 JOURNEY_PAGE 독립 여정 페이지를 선언한 여정에서 페이지 소스의 `data-step` 단계 집합·
 *                    단계별 카드가 레지스트리와 어긋나거나, 빌드된 페이지가 뒤처졌다.
 *
 * J6·J7·J8 은 래칫이다: 등재된 위반은 통과시키되, 등재되지 않은 새 위반도 이미 고쳐졌는데
 * 원장에 남아 있는 공전 행도 실패다. 상한(`*-cap`)은 내리는 방향으로만 고친다.
 *
 * 사용법: node scripts/check-journey-mockup-map.mjs [repoRoot]
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.argv[2] ?? '.';
const REGISTRY = 'docs/journey-mockup-map.md';
const JOURNEY_DIR = 'docs/user-journeys';
const SCREENS_DIR = 'docs/mockups/source/src/screens';
const JOURNEY_SRC_DIR = 'docs/mockups/source/src/journey';
const GALLERY = `${SCREENS_DIR}/GalleryScreen.tsx`;
const MOCKUPS_README = 'docs/mockups/README.md';
const TRACKER = 'docs/doc-tracker.md';
const BUNDLE = 'docs/mockups/index.html';
const NONE = '—';

/** 구 번호 체계의 단계 식별자 — `4` · `6½-2` · `12-1`. */
const NUM_STAGE_ID = String.raw`[0-9]+½?(?:-[0-9]+)?`;
/** 슬러그 체계의 단계 식별자 — `STP-diary-enter`. 이관이 끝난 여정이 쓴다. */
const SLUG_STAGE_ID = String.raw`STP-[a-z0-9]+(?:-[a-z0-9]+)*`;
/**
 * 단계 식별자 — 두 체계가 공존한다. 슬러그를 먼저 시도해야 `STP-…` 안의 숫자에
 * 번호 패턴이 먼저 물리지 않는다.
 */
const STAGE_ID = `(?:${SLUG_STAGE_ID}|${NUM_STAGE_ID})`;
/** 라벨이 인용하는 식별자 — 구 체계의 `3-A1` · `4-B2-Purpose` 까지 받아 낸다. */
const LABEL_ID = String.raw`[0-9]+½?(?:-[0-9A-Za-z]+)*`;

const abs = (p) => join(ROOT, p);
const read = (p) => readFileSync(abs(p), 'utf8');

const violations = [];
const fail = (code, msg) => violations.push(`${code}  ${msg}`);

/* ---------- 0. 파싱 헬퍼 ---------- */

/** 마커 사이 구간만 읽는다 — 설명 산문이 파서의 입력이 되지 않게 한다. */
function section(md, name, file = REGISTRY) {
  const m = md.match(new RegExp(`<!--\\s*${name}:begin\\s*-->([\\s\\S]*?)<!--\\s*${name}:end\\s*-->`));
  if (!m) {
    // 마커를 지우면 그 구간이 통째로 검사에서 빠져 버린다 — 조용히 넘기지 않고 여기서 끝낸다.
    console.log(`  ✖ J0 NO_MARKER  ${file} 에 <!-- ${name}:begin/end --> 마커가 없다\n\n실패: 위반 1건`);
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
const cardsIn = (s) => [...new Set(s.match(/M-\d{2}/g) ?? [])];
/** 표 셀의 단계 — 구 체계는 `Stage 6½-1`, 슬러그 체계는 백틱으로 감싼 `` `STP-…` ``. */
const stageIn = (s) =>
  (s.match(new RegExp(`(?:Stage\\s+(${NUM_STAGE_ID})|(${SLUG_STAGE_ID}))`)) ?? []).slice(1).find(Boolean) ?? '';
/** 사람이 읽을 단계 표기 — 슬러그는 `Stage` 를 앞에 붙이지 않는다. */
const stageLabel = (id) => (id.startsWith('STP-') ? `\`${id}\`` : `Stage ${id}`);
const cap = (md, name) => Number((md.match(new RegExp(`<!--\\s*${name}-cap:\\s*(\\d+)\\s*-->`)) ?? [])[1] ?? NaN);
const setEq = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
const minus = (a, b) => [...a].filter((x) => !b.has(x));

/* ---------- 1. 실측 인벤토리 ---------- */

const journeyFiles = readdirSync(abs(JOURNEY_DIR))
  .filter((f) => f.endsWith('-journey.md'))
  .sort();

/**
 * 여정 문서 → 단계 식별자 배열 (`## 단계별 상세` 절의 단계 헤딩).
 * 두 체계를 받는다 — 구 번호 `### Stage 6½-1` 과 이관된 슬러그 ``### `STP-diary-enter` ``.
 */
const docStages = new Map();
const STAGE_HEADING = new RegExp(`^###\\s+(?:Stage\\s+(${NUM_STAGE_ID})|\`(${SLUG_STAGE_ID})\`)`, 'gm');
for (const f of journeyFiles) {
  const md = read(`${JOURNEY_DIR}/${f}`);
  const body = md.match(/\n## 단계별 상세\n([\s\S]*?)(?=\n## |$)/);
  if (!body) {
    fail('J5 STAGE_SET', `${f} — '## 단계별 상세' 절이 없다(단계 집합을 읽을 수 없다)`);
    docStages.set(f, []);
    continue;
  }
  const ids = [...body[1].matchAll(STAGE_HEADING)].map((m) => m[1] ?? m[2]);
  // 단계 헤딩이 하나도 안 잡히면 체계가 또 바뀐 것이다 — 「단계 0개」로 조용히 통과시키면
  // 그 여정의 J5 가 통째로 무력해지므로 여기서 실패로 드러낸다.
  if (!ids.length) fail('J5 STAGE_SET', `${f} — '## 단계별 상세' 에서 단계 헤딩을 하나도 읽지 못했다(식별자 체계가 바뀌었는지 확인할 것)`);
  docStages.set(f, ids);
}

/** 갤러리 그룹 — GalleryScreen.tsx 의 groups[] 를 순서대로 읽는다. */
const groups = [];
for (const line of read(GALLERY).split('\n')) {
  const n = line.match(/^\s*num:\s*"([^"]+)"/);
  if (n) {
    groups.push({ num: n[1], title: '', cards: [] });
    continue;
  }
  if (!groups.length) continue;
  const g = groups[groups.length - 1];
  const t = line.match(/^\s*title:\s*"([^"]+)"/);
  if (t && !g.title) {
    g.title = t[1];
    continue;
  }
  const c = line.match(/\bid:\s*"(M-\d{2})"/);
  if (c) g.cards.push(c[1]);
}
const groupByNum = new Map(groups.map((g) => [g.num, g]));
const allCards = new Set(groups.flatMap((g) => g.cards));
/** 그룹 제목의 앞머리 — `Onboarding (가입 …)` → `Onboarding`. README 일람 표의 여정 이름과 대조한다. */
const groupLabel = (g) => g.title.split(' (')[0].trim();

/** 화면 라벨 — `label="M-NN · <여정> · Stage <id>"` */
const labels = [];
for (const f of readdirSync(abs(SCREENS_DIR)).filter((f) => f.endsWith('.tsx')))
  for (const m of read(`${SCREENS_DIR}/${f}`).matchAll(/label="([^"]*)"/g)) labels.push(m[1]);

/**
 * 독립 여정 페이지 소스 — `docs/mockups/source/src/journey/<id>.tsx`.
 * `steps[]` 는 `id: "STP-…"` 로 시작해 다음 단계 전까지의 `id: "M-NN"` 을 자기 카드로 갖는다
 * (`JourneyShell` 이 그대로 `data-step` · `data-journey` 로 내보내는 구조 그대로다).
 */
function readJourneyPage(id) {
  const src = `${JOURNEY_SRC_DIR}/${id}.tsx`;
  if (!existsSync(abs(src))) return null;
  const text = read(src);
  const steps = [];
  for (const line of text.split('\n')) {
    const s = line.match(new RegExp(`\\bid:\\s*"(${SLUG_STAGE_ID})"`));
    if (s) {
      steps.push({ id: s[1], cards: [] });
      continue;
    }
    if (!steps.length) continue;
    for (const c of line.matchAll(/\bid:\s*"(M-\d{2})"/g)) steps[steps.length - 1].cards.push(c[1]);
  }
  return { src, docPath: (text.match(/docPath:\s*"([^"]+)"/) ?? [])[1] ?? '', steps };
}

/* ---------- 2. 레지스트리 파싱 ---------- */

const registryMd = read(REGISTRY);
const journeyRows = table(section(registryMd, 'journey-map'));
const stageRows = table(section(registryMd, 'stage-map'));
const unvisRows = table(section(registryMd, 'unvisualized-ledger'));
const orphanRows = table(section(registryMd, 'orphan-ledger'));
const staleRows = table(section(registryMd, 'stale-label-ledger'));

const trackerMd = read(TRACKER);
const exceptionRows = table(section(trackerMd, 'journey-mockup-exceptions', TRACKER));

for (const [name, n] of [
  ['unvisualized', cap(registryMd, 'unvisualized')],
  ['orphan', cap(registryMd, 'orphan')],
  ['stale-label', cap(registryMd, 'stale-label')],
])
  if (!Number.isInteger(n)) fail('J6 UNVISUALIZED', `<!-- ${name}-cap: N --> 선언이 없다`);

/** 여정 문서 → { group, page, stages, cards } */
const registry = new Map();
for (const [fileCell, groupCell, pageCell, stageCount, cardCount] of journeyRows) {
  const file = code(fileCell);
  if (!file) {
    fail('J2 PHANTOM_ROW', `여정 문서 칸을 백틱으로 감싼 파일명으로 적을 것: ${fileCell}`);
    continue;
  }
  if (registry.has(file)) fail('J1 UNREGISTERED', `${file} — 여정 표에 행이 2개 이상이다`);
  registry.set(file, {
    group: groupCell.trim() === NONE ? null : code(groupCell),
    page: pageCell === undefined || pageCell.trim() === NONE ? null : code(pageCell),
    declaredStages: Number(stageCount),
    declaredCards: Number(cardCount),
  });
}

/** 여정 문서 → 단계 → 카드 */
const mapped = new Map([...registry.keys()].map((f) => [f, new Map()]));
for (const [fileCell, stageCell, cardCell, note = ''] of stageRows) {
  const file = code(fileCell);
  const stage = stageIn(stageCell);
  if (!file || !stage) {
    fail('J5 STAGE_SET', `단계 표 행을 읽을 수 없다(여정 문서는 백틱, 단계는 \`Stage <id>\` 형식): ${fileCell} | ${stageCell}`);
    continue;
  }
  if (!mapped.has(file)) {
    fail('J1 UNREGISTERED', `${file} — 단계 표에 있는데 여정 표에 행이 없다`);
    continue;
  }
  const bucket = mapped.get(file);
  if (bucket.has(stage)) fail('J5 STAGE_SET', `${file} ${stageLabel(stage)} — 단계 표에 행이 2개 이상이다`);
  const cards = cardCell.trim() === NONE ? [] : cardsIn(cardCell);
  if (cardCell.trim() !== NONE && !cards.length)
    fail('J4 CARD_SET', `${file} ${stageLabel(stage)} — 대응 카드를 M-NN 또는 ${NONE} 로 적을 것: "${cardCell}"`);
  if (cardCell.trim() === NONE && note.replace(/[*`]/g, '').trim().length < 10)
    fail('J6 UNVISUALIZED', `${file} ${stageLabel(stage)} — 대응 카드가 없으면 비고에 사유를 적을 것(공백은 침묵으로 숨는다)`);
  bucket.set(stage, cards);
}

/* ---------- 3. J1 · J2 · J3 ---------- */

for (const f of journeyFiles)
  if (!registry.has(f)) fail('J1 UNREGISTERED', `${JOURNEY_DIR}/${f} — 여정 표에 없다. 진입점을 두지 않기로 했으면 ${NONE} + 예외 등재로 적을 것`);
for (const f of registry.keys())
  if (!existsSync(abs(`${JOURNEY_DIR}/${f}`))) fail('J2 PHANTOM_ROW', `${JOURNEY_DIR}/${f} — 파일이 없다(이동·삭제됐으면 행도 지울 것)`);

const seenGroup = new Map();
for (const [file, row] of registry) {
  if (!row.group) continue;
  if (!groupByNum.has(row.group)) fail('J3 ENTRYPOINT', `${file} → ${row.group} — 갤러리 인덱스(${GALLERY})에 그런 그룹이 없다`);
  if (seenGroup.has(row.group))
    fail('J3 ENTRYPOINT', `${row.group} — ${seenGroup.get(row.group)} 와 ${file} 두 여정이 같은 진입점을 지목한다(모델 규칙 2)`);
  seenGroup.set(row.group, file);
}

/** 예외 등재(모델 규칙 8) ↔ 진입점 없는 여정 */
const excepted = new Set();
for (const [fileCell, reason = ''] of exceptionRows) {
  const file = code(fileCell);
  if (!file) {
    fail('J3 ENTRYPOINT', `${TRACKER} 예외 등재의 여정 문서 칸을 백틱으로 적을 것: ${fileCell}`);
    continue;
  }
  excepted.add(file);
  if (!existsSync(abs(`${JOURNEY_DIR}/${file}`))) fail('J2 PHANTOM_ROW', `${TRACKER} 예외 등재 ${file} — 그런 여정 문서가 없다`);
  if (reason.replace(/[*`]/g, '').trim().length < 10) fail('J3 ENTRYPOINT', `${TRACKER} 예외 등재 ${file} — 사유를 비워 둘 수 없다`);
}
for (const [file, row] of registry)
  if (!row.group && !excepted.has(file))
    fail('J3 ENTRYPOINT', `${file} — 진입점이 없는데 ${TRACKER} 의 「여정 mockup 예외」에 등재돼 있지 않다`);
for (const file of excepted)
  if (registry.get(file)?.group)
    fail('J3 ENTRYPOINT', `${file} — 예외 등재돼 있는데 진입점 ${registry.get(file).group} 을 갖고 있다(등재를 지울 것)`);

/* ---------- 4. J4 · J5 ---------- */

/** 카드 → 그 카드가 할당된 단계 집합 (README 대조에 쓴다) */
const cardStages = new Map();
/** 카드 → 여정 문서 (라벨 대조에 쓴다) */
const cardJourney = new Map();

for (const [file, row] of registry) {
  const bucket = mapped.get(file) ?? new Map();
  const docSet = new Set(docStages.get(file) ?? []);
  const mapSet = new Set(bucket.keys());

  for (const s of minus(docSet, mapSet)) fail('J5 STAGE_SET', `${file} ${stageLabel(s)} — 문서에 있는데 단계 표에 없다`);
  for (const s of minus(mapSet, docSet)) fail('J5 STAGE_SET', `${file} ${stageLabel(s)} — 단계 표에 있는데 문서에 없다(폐기된 식별자거나 오타)`);
  if (row.declaredStages !== docSet.size)
    fail('J9 SYNC', `${file} — 여정 표의 단계 수 ${row.declaredStages} ≠ 문서 실측 ${docSet.size}`);

  const usedCards = new Set([...bucket.values()].flat());
  for (const c of usedCards) {
    if (!cardStages.has(c)) cardStages.set(c, new Set());
    cardJourney.set(c, file);
  }
  for (const [stage, cards] of bucket) for (const c of cards) cardStages.get(c).add(stage);

  if (!row.group) {
    if (usedCards.size) fail('J4 CARD_SET', `${file} — 예외 등재(진입점 없음)인데 단계 표가 카드 ${[...usedCards].join(', ')} 를 할당한다`);
    continue;
  }
  const groupCards = new Set(groupByNum.get(row.group)?.cards ?? []);
  for (const c of minus(groupCards, usedCards))
    fail('J4 CARD_SET', `${file} ← ${c} — 갤러리 그룹 ${row.group} 에 있는데 어느 단계에도 매핑되지 않았다`);
  for (const c of minus(usedCards, groupCards))
    fail('J4 CARD_SET', `${file} → ${c} — 단계 표가 지목하는데 그룹 ${row.group} 에 없다`);
  if (row.declaredCards !== groupCards.size)
    fail('J9 SYNC', `${file} — 여정 표의 카드 수 ${row.declaredCards} ≠ 그룹 ${row.group} 실측 ${groupCards.size}`);
}

/* ---------- 4b. J10 독립 여정 페이지 ---------- */

/*
 * 갤러리 그룹은 카드 묶음일 뿐이라 「어느 카드가 어느 단계인지」를 소스에서 읽을 수 없다 —
 * 그래서 J4 는 카드 집합만 대조하고 단계 귀속은 레지스트리의 손 선언을 믿는다. 독립 여정
 * 페이지는 `steps[].screens[]` 로 그 귀속을 소스에 갖고 있으므로, 페이지가 있는 여정은
 * 손 선언을 믿지 않고 소스와 직접 맞댄다(모델 규칙 3 의 양방향 기계 대조).
 */
const pagedJourneys = [];
for (const [file, row] of registry) {
  if (!row.page) continue;
  pagedJourneys.push(row.page);

  const page = readJourneyPage(row.page);
  if (!page) {
    fail('J10 JOURNEY_PAGE', `${file} → ${JOURNEY_SRC_DIR}/${row.page}.tsx — 여정 페이지 소스가 없다`);
    continue;
  }
  if (page.docPath !== `${JOURNEY_DIR.replace(/^docs\//, '')}/${file}`)
    fail(
      'J10 JOURNEY_PAGE',
      `${row.page}.tsx — docPath "${page.docPath}" 가 이 행의 여정 문서(${JOURNEY_DIR}/${file})를 가리키지 않는다`,
    );

  const bucket = mapped.get(file) ?? new Map();
  const pageStages = new Set(page.steps.map((s) => s.id));
  const mapSet = new Set(bucket.keys());
  for (const s of minus(mapSet, pageStages))
    fail('J10 JOURNEY_PAGE', `${row.page}.tsx — 단계 표의 ${stageLabel(s)} 가 여정 페이지에 없다`);
  for (const s of minus(pageStages, mapSet))
    fail('J10 JOURNEY_PAGE', `${row.page}.tsx — 여정 페이지의 ${stageLabel(s)} 가 단계 표에 없다`);

  for (const step of page.steps) {
    if (!bucket.has(step.id)) continue; // 위에서 이미 보고했다
    const listed = new Set(bucket.get(step.id));
    const actual = new Set(step.cards);
    if (!setEq(listed, actual))
      fail(
        'J10 JOURNEY_PAGE',
        `${row.page}.tsx ${stageLabel(step.id)} — 단계 표의 카드 [${[...listed].join(', ') || '없음'}] ≠ ` +
          `페이지 소스 [${[...actual].join(', ') || '없음'}]`,
      );
  }

  // 빌드된 페이지가 소스를 따라왔는지. 소스만 고치고 재빌드하지 않으면 공개된 페이지는 옛것이다.
  const built = `docs/journeys/${row.page}/index.html`;
  if (!existsSync(abs(built))) {
    fail('J10 JOURNEY_PAGE', `${built} — 빌드된 여정 페이지가 없다(소스만 있고 배포물이 없다)`);
    continue;
  }
  const builtHtml = read(built);
  for (const step of page.steps)
    if (!builtHtml.includes(step.id)) fail('J10 JOURNEY_PAGE', `${built} 에 단계 ${step.id} 가 없다 — 재빌드 필요`);
  for (const c of new Set(page.steps.flatMap((s) => s.cards)))
    if (!builtHtml.includes(c)) fail('J10 JOURNEY_PAGE', `${built} 에 카드 ${c} 가 없다 — 재빌드 필요`);
}

// 레지스트리가 모르는 여정 페이지가 소스에 생기면 그 여정은 검사 밖에 남는다.
if (existsSync(abs(JOURNEY_SRC_DIR)))
  for (const f of readdirSync(abs(JOURNEY_SRC_DIR)).filter((f) => f.endsWith('.tsx'))) {
    const id = f.replace(/\.tsx$/, '');
    if (id === 'JourneyShell' || pagedJourneys.includes(id)) continue;
    fail('J10 JOURNEY_PAGE', `${JOURNEY_SRC_DIR}/${f} — 여정 페이지 소스가 있는데 여정 표의 「여정 페이지」 칸에 등재되지 않았다`);
  }

/* ---------- 5. J6 미시각화 원장 (래칫) ---------- */

const unvisFound = new Set();
for (const [file, bucket] of mapped) for (const [stage, cards] of bucket) if (!cards.length) unvisFound.add(`${file}|${stage}`);

const unvisListed = new Set();
for (const cells of unvisRows) {
  const [, fileCell, stageCell, kind = '', reason = ''] = cells;
  const file = code(fileCell);
  const stage = stageIn(stageCell);
  const key = `${file}|${stage}`;
  if (!file || !stage) {
    fail('J6 UNVISUALIZED', `미시각화 원장 행을 읽을 수 없다: ${fileCell} | ${stageCell}`);
    continue;
  }
  unvisListed.add(key);
  if (!unvisFound.has(key)) fail('J6 UNVISUALIZED', `${file} ${stageLabel(stage)} — 더 이상 미시각화가 아니다. 시각화했으면 원장에서 지울 것(공전 금지)`);
  if (!['제품 외부', '제품 내부'].includes(kind.replace(/[*`]/g, '').trim()))
    fail('J6 UNVISUALIZED', `${file} ${stageLabel(stage)} — 성격은 '제품 외부' 또는 '제품 내부' 로 적을 것: "${kind}"`);
  if (reason.replace(/[*`]/g, '').trim().length < 20) fail('J6 UNVISUALIZED', `${file} ${stageLabel(stage)} — 사유·해소 조건을 비워 둘 수 없다`);
}
for (const key of minus(unvisFound, unvisListed))
  fail('J6 UNVISUALIZED', `${key.split('|')[0]} ${stageLabel(key.split('|')[1])} — 대응 카드가 없는데 미시각화 원장에 없다. 시각화하거나 사유와 함께 등재할 것`);
if (unvisRows.length > cap(registryMd, 'unvisualized'))
  fail('J6 UNVISUALIZED', `미시각화 원장 ${unvisRows.length}행 > 상한 ${cap(registryMd, 'unvisualized')}. 상한은 내릴 때만 고친다`);

/* ---------- 6. J7 고아 진입점 원장 (래칫) ---------- */

const orphanFound = new Set(groups.map((g) => g.num).filter((n) => !seenGroup.has(n)));
const orphanListed = new Set();
for (const [groupCell, cardCell, reason = ''] of orphanRows) {
  const num = code(groupCell);
  if (!num) {
    fail('J7 ORPHAN', `고아 원장의 갤러리 그룹 칸을 백틱으로 적을 것: ${groupCell}`);
    continue;
  }
  orphanListed.add(num);
  if (!groupByNum.has(num)) fail('J7 ORPHAN', `${num} — 갤러리 인덱스에 그런 그룹이 없다(제거됐으면 원장에서도 지울 것)`);
  else {
    if (!orphanFound.has(num)) fail('J7 ORPHAN', `${num} — 이제 여정에 매핑돼 있다. 고아가 아니면 원장에서 지울 것(공전 금지)`);
    const listed = new Set(cardsIn(cardCell));
    const actual = new Set(groupByNum.get(num).cards);
    if (!setEq(listed, actual)) fail('J7 ORPHAN', `${num} — 원장의 카드 [${[...listed].join(', ')}] ≠ 그룹 실측 [${[...actual].join(', ')}]`);
  }
  if (reason.replace(/[*`]/g, '').trim().length < 20) fail('J7 ORPHAN', `${num} — 사유·해소 조건을 비워 둘 수 없다`);
}
for (const num of minus(orphanFound, orphanListed))
  fail('J7 ORPHAN', `${num} — 어느 여정도 시각화하지 않는 그룹인데 고아 원장에 없다(모델 규칙 2). 재매핑·여정 문서 신설·제거 중 하나를 결정하거나 등재할 것`);
if (orphanRows.length > cap(registryMd, 'orphan'))
  fail('J7 ORPHAN', `고아 원장 ${orphanRows.length}행 > 상한 ${cap(registryMd, 'orphan')}. 상한은 내릴 때만 고친다`);

/* ---------- 7. J8 구 번호 라벨 원장 (래칫) ---------- */

const staleFound = new Set();
for (const label of labels) {
  const card = (label.match(/M-\d{2}/) ?? [])[0];
  const cited = (label.match(new RegExp(`Stage\\s+(${LABEL_ID})`)) ?? [])[1];
  if (!card || !cited) continue;
  const file = cardJourney.get(card);
  if (!file) continue; // 고아 그룹의 카드는 J7 소관
  if (!(docStages.get(file) ?? []).includes(cited)) staleFound.add(card);
}

const staleListed = new Set();
for (const [fileCell, cardCell, citedCell = '', reason = ''] of staleRows) {
  const file = code(fileCell);
  if (!file) {
    fail('J8 STALE_LABEL', `구 번호 원장의 여정 문서 칸을 백틱으로 적을 것: ${fileCell}`);
    continue;
  }
  if (!existsSync(abs(`${JOURNEY_DIR}/${file}`))) fail('J2 PHANTOM_ROW', `구 번호 원장 ${file} — 그런 여정 문서가 없다`);
  for (const c of cardsIn(cardCell)) {
    staleListed.add(c);
    if (cardJourney.get(c) !== file) fail('J8 STALE_LABEL', `${c} — 원장은 ${file} 에 걸어 두었는데 실제 소속은 ${cardJourney.get(c) ?? '(미매핑)'} 다`);
    if (!staleFound.has(c)) fail('J8 STALE_LABEL', `${c} — 라벨이 이제 문서의 단계를 가리킨다. 고쳤으면 원장에서 지울 것(공전 금지)`);
  }
  if (!citedCell.trim()) fail('J8 STALE_LABEL', `${file} — 라벨이 인용한 구 식별자를 비워 둘 수 없다`);
  if (reason.replace(/[*`]/g, '').trim().length < 20) fail('J8 STALE_LABEL', `${file} — 사유를 비워 둘 수 없다`);
}
for (const c of minus(staleFound, staleListed))
  fail('J8 STALE_LABEL', `${c} — 라벨이 ${cardJourney.get(c)} 에 없는 단계를 인용한다(모델 규칙 6). 라벨을 고치거나 구 번호 원장에 등재할 것`);
if (staleListed.size > cap(registryMd, 'stale-label'))
  fail('J8 STALE_LABEL', `구 번호 원장 ${staleListed.size}장 > 상한 ${cap(registryMd, 'stale-label')}. 상한은 내릴 때만 고친다`);

/* ---------- 8. J9 동기화 ---------- */

/* (a) docs/mockups/README.md 일람 표 — 여정 이름과 단계 인용이 이 레지스트리와 같아야 한다. */
const readmeMd = read(MOCKUPS_README);
const readmeLines = readmeMd.split('\n');
const head = readmeLines.findIndex((l) => /^\|\s*ID\s*\|/.test(l));
const readmeRows = head < 0 ? [] : table(readmeLines.slice(head).join('\n').split(/\n(?!\|)/)[0]);
if (head < 0) fail('J9 SYNC', `${MOCKUPS_README} 에 '| ID |' 로 시작하는 일람 표가 없다`);

const readmeSeen = new Set();
for (const [idCell, , stageCell = ''] of readmeRows) {
  const card = (idCell.match(/M-\d{2}/) ?? [])[0];
  if (!card) {
    fail('J9 SYNC', `${MOCKUPS_README} 일람 표 행의 ID 를 읽을 수 없다: ${idCell}`);
    continue;
  }
  if (!allCards.has(card)) {
    fail('J9 SYNC', `${MOCKUPS_README} 일람 표의 ${card} — 갤러리 인덱스에 없다`);
    continue;
  }
  readmeSeen.add(card);
  const parts = stageCell.replace(/[*`]/g, '').split('·').map((s) => s.trim());
  const group = groups.find((g) => g.cards.includes(card));
  if (parts[0] !== groupLabel(group))
    fail('J9 SYNC', `${MOCKUPS_README} ${card} — 여정 이름이 "${parts[0]}" 인데 갤러리 그룹은 "${groupLabel(group)}" 다`);
  const declared = new Set((parts[1] ?? '').match(new RegExp(STAGE_ID, 'g')) ?? []);
  const actual = cardStages.get(card) ?? new Set();
  if (!setEq(declared, actual))
    fail(
      'J9 SYNC',
      `${MOCKUPS_README} ${card} — 단계 인용 [${[...declared].join(', ') || '없음'}] ≠ 레지스트리 할당 [${[...actual].join(', ') || '없음'}]`,
    );
}
for (const c of minus(allCards, readmeSeen)) fail('J9 SYNC', `${MOCKUPS_README} 일람 표에 ${c} 행이 없다`);

/* (b) 허브 동기화 — 소스만 고치고 재빌드하지 않으면 번들이 뒤처진다. */
const bundle = read(BUNDLE);
for (const g of groups) {
  if (!bundle.includes(g.num)) fail('J9 SYNC', `${BUNDLE} 에 그룹 ${g.num} 이 없다 — 소스를 고치고 재빌드하지 않았다`);
  if (!bundle.includes(g.title)) fail('J9 SYNC', `${BUNDLE} 에 그룹 제목 "${g.title}" 이 없다 — 재빌드 필요`);
}
for (const c of allCards) if (!bundle.includes(c)) fail('J9 SYNC', `${BUNDLE} 에 카드 ${c} 가 없다 — 재빌드 필요`);

/* (c) 집계 고정 */
const num = (re, src) => Number((src.match(re) ?? [])[1]);
const totalStages = [...docStages.values()].reduce((n, ids) => n + ids.length, 0);
const declaredCounts = [
  ['여정 총수', num(/여정 총수\(실측\): \*\*(\d+)\*\*/, registryMd), journeyFiles.length],
  ['단계 총수', num(/단계 총수\(실측\): \*\*(\d+)\*\*/, registryMd), totalStages],
  ['목업 카드 총수', num(/목업 카드 총수\(실측\): \*\*(\d+)\*\*/, registryMd), allCards.size],
  ['갤러리 그룹 총수', num(/갤러리 그룹 총수\(실측\): \*\*(\d+)\*\*/, registryMd), groups.length],
  ['doc-tracker 여정 수', num(/사용자 여정: \*\*(\d+)개\*\*/, trackerMd), journeyFiles.length],
  ['doc-tracker 목업 수', num(/Mockup: \*\*(\d+)개 화면\*\*/, trackerMd), allCards.size],
];
for (const [where, declared, actual] of declaredCounts)
  if (declared !== actual) fail('J9 SYNC', `${where} 선언 ${Number.isNaN(declared) ? '(없음)' : declared} ≠ 실측 ${actual}`);

/* ---------- 9. 리포트 ---------- */

console.log(
  `여정 ${journeyFiles.length}개 · 단계 ${totalStages}개 · 카드 ${allCards.size}개 · ` +
    `갤러리 그룹 ${groups.length}개 · 독립 여정 페이지 ${pagedJourneys.length}개`,
);
console.log(
  `미시각화 ${unvisFound.size}/${cap(registryMd, 'unvisualized')} · 고아 진입점 ${orphanFound.size}/${cap(registryMd, 'orphan')} · ` +
    `구 번호 라벨 ${staleFound.size}/${cap(registryMd, 'stale-label')} · 예외 등재 ${excepted.size}건`,
);
console.log('');

for (const v of violations) console.log(`  ✖ ${v}`);
if (violations.length) {
  console.log(`\n실패: 위반 ${violations.length}건`);
  process.exit(1);
}
console.log('통과: 위반 0건 (J0~J10)');

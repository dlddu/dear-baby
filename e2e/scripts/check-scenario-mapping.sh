#!/usr/bin/env bash
# Static guard on the 테스트 시나리오 ↔ e2e flow 1:1 mapping.
#
# 판정 축은 AC 가 아니라 `docs/tests/` 의 테스트 시나리오(`### TC-NNN-NN: 제목`)다.
# 매핑은 각 flow 헤더의 `검증 시나리오: TC-NNN-NN` 선언(파일당 정확히 1개)에서
# 기계적으로 확인되고, 등재 SSOT 는 docs/doc-tracker.md § "e2e flow 매핑" 이다.
#
# 이 축의 고질은 "집계가 조용히 낡는 것" 이다 — 시나리오 문서가 늘거나 flow 가
# 추가돼도 아무도 소리를 내지 않으면 등재 표가 사실과 갈라진다. 그래서 이 스크립트는
# 문서에 적힌 수를 믿지 않고 **레포에서 다시 계산해서** 대조하고, 어긋나면 죽는다.
#
# Checks:
#   1. 최상위 flow 는 `검증 시나리오:` 또는 `검증 대상:` 중 정확히 하나의 키를 갖는다
#      (둘 다 갖거나 둘 다 없으면 실패). subflows/ 는 헬퍼라 대상이 아니다.
#   2. `검증 대상:` 만 갖는 파일은 정확히 login.yaml · health.yaml 이다.
#   3. `검증 시나리오:` 는 파일당 정확히 1줄이고, 선언된 TC 는 docs/tests/ 에 실재한다.
#   4. 같은 TC 를 두 flow 가 선언하지 않는다.
#   5. doc-tracker 의 집계(시나리오·매칭·예외·구현 대기·공백)가 실측과 일치하고,
#      다섯 수가 서로 더해서 시나리오 총수가 된다.
#   6. 네 표(매칭 = flow 선언 · 예외 · 구현 대기 · 공백)의 TC ID 집합이 시나리오 전수를
#      정확히 한 번씩 덮는다 — 빠진 ID 도, 두 표에 걸친 ID 도 없다. 예외·구현 대기·공백
#      표는 doc-tracker 의 `<!-- e2e-exceptions|e2e-pending|e2e-gap:begin/end -->` 마커
#      사이에서 읽는다(행 문구가 아니라 위치로 식별하므로 근거 문장을 고쳐도 안 깨진다).
#
# Usage: bash e2e/scripts/check-scenario-mapping.sh    (repo root 에서)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

TESTS_DIR="docs/tests"
FLOW_DIR="e2e/maestro"
TRACKER="docs/doc-tracker.md"

fail() { echo "FAIL: $*" >&2; exit 1; }
ok()   { echo "  ok  $*"; }

for p in "$TESTS_DIR" "$FLOW_DIR" "$TRACKER"; do
  [ -e "$p" ] || fail "경로가 없다: $p"
done

# ── 시나리오 원장 ────────────────────────────────────────────────────────────
# 판정 단위는 `### TC-NNN-NN[-X]: 제목`. 콜론+제목이 없는 헤딩(예: 이관 묘비
# `### TC-007-08 / TC-007-09-A / ...`)은 시나리오가 아니므로 의도적으로 제외된다.
SC_RE='^### (TC-[0-9]{3}-[0-9]{2}(-[A-Z])?): '
scenarios="$(grep -hE "$SC_RE" "$TESTS_DIR"/*.md | sed -E 's/^### (TC-[0-9]{3}-[0-9]{2}(-[A-Z])?):.*/\1/' | sort)"
n_scen="$(printf '%s\n' "$scenarios" | grep -c . || true)"
[ "$n_scen" -gt 0 ] || fail "docs/tests 에서 시나리오를 하나도 못 찾았다 (정규식 또는 문서 형식이 바뀌었나)"

dup_scen="$(printf '%s\n' "$scenarios" | uniq -d)"
[ -z "$dup_scen" ] || fail "TC ID 가 문서 간 중복된다: $(echo "$dup_scen" | tr '\n' ' ')"
ok "테스트 시나리오 $n_scen 개 (중복 ID 0)"

# ── flow 별 선언 키 ──────────────────────────────────────────────────────────
declared=""      # "TC<TAB>flow"
n_match=0
nonscenario=""
for f in "$FLOW_DIR"/*.yaml; do
  base="$(basename "$f")"
  n_sc="$(grep -cE '^#[[:blank:]]*검증 시나리오:' "$f" || true)"
  n_da="$(grep -cE '^#[[:blank:]]*검증 대상:'     "$f" || true)"

  if [ "$n_sc" -gt 0 ] && [ "$n_da" -gt 0 ]; then
    fail "$base: 두 키를 동시에 갖는다 (검증 시나리오 $n_sc · 검증 대상 $n_da). 서로소여야 한다"
  fi
  if [ "$n_sc" -eq 0 ] && [ "$n_da" -eq 0 ]; then
    fail "$base: 매핑 선언이 없다 (고아). 헤더에 '검증 시나리오:' 또는 '검증 대상:' 이 있어야 한다"
  fi
  if [ "$n_sc" -gt 1 ]; then
    fail "$base: '검증 시나리오:' 가 $n_sc 줄이다. 파일당 정확히 1개여야 한다 (규칙 2)"
  fi

  if [ "$n_sc" -eq 1 ]; then
    tc="$(grep -E '^#[[:blank:]]*검증 시나리오:' "$f" \
          | sed -E 's/^#[[:blank:]]*검증 시나리오:[[:blank:]]*(TC-[0-9]{3}-[0-9]{2}(-[A-Z])?).*/\1/')"
    case "$tc" in
      TC-[0-9][0-9][0-9]-[0-9][0-9]|TC-[0-9][0-9][0-9]-[0-9][0-9]-[A-Z]) : ;;
      *) fail "$base: '검증 시나리오:' 값이 TC-NNN-NN[-X] 형식이 아니다: '$tc'" ;;
    esac
    printf '%s\n' "$scenarios" | grep -qx "$tc" \
      || fail "$base: 선언한 $tc 가 docs/tests 에 없다 (개명·삭제된 시나리오를 가리킨다)"
    declared="${declared}${tc} ${base}
"
    n_match=$((n_match + 1))
  else
    nonscenario="${nonscenario}${base}
"
  fi
done

dup_decl="$(printf '%s' "$declared" | awk '{print $1}' | sort | uniq -d)"
[ -z "$dup_decl" ] || fail "같은 TC 를 두 flow 가 선언한다: $(echo "$dup_decl" | tr '\n' ' ')"
ok "매칭 flow $n_match 개 (선언 1개씩 · 실재하는 TC · 중복 0)"

expected_nonscenario="health.yaml
login.yaml
"
actual_nonscenario="$(printf '%s' "$nonscenario" | sort)
"
[ "$actual_nonscenario" = "$expected_nonscenario" ] || fail \
  "비-시나리오 허용 유형이 달라졌다. 기대: health.yaml login.yaml / 실제: $(printf '%s' "$actual_nonscenario" | tr '\n' ' ')
   (새 스모크·엔지니어링 flow 를 들였다면 doc-tracker 유형 표에 등재하고 이 스크립트의 기대 목록도 함께 고칠 것)"
ok "비-시나리오 허용 유형 2개 (login.yaml → ENG-003 · health.yaml → 스모크)"

# ── doc-tracker 집계 대조 ────────────────────────────────────────────────────
num_after() { # $1 = 라벨 정규식 → 그 뒤 첫 **N개|건** 의 N
  sed -nE "s/.*$1[^0-9*]*\*\*([0-9]+)(개|건)\*\*.*/\1/p" "$TRACKER" | head -1
}
d_scen="$(num_after '테스트 시나리오:')"
d_match="$(num_after '매칭 파일:')"
d_exc="$(num_after '예외:')"
d_pend="$(num_after '구현 대기:')"
d_gap="$(num_after '공백:')"

for v in "$d_scen" "$d_match" "$d_exc" "$d_pend" "$d_gap"; do
  [ -n "$v" ] || fail "$TRACKER 의 '집계' 항목을 못 읽었다 (라벨이 바뀌었나)"
done

[ "$d_scen"  = "$n_scen"  ] || fail "시나리오 수 불일치 — 문서 $d_scen / 실측 $n_scen"
[ "$d_match" = "$n_match" ] || fail "매칭 파일 수 불일치 — 문서 $d_match / 실측 $n_match"

sum=$((d_match + d_exc + d_pend + d_gap))
[ "$sum" = "$n_scen" ] || fail \
  "전수 분류가 시나리오 총수와 다르다 — 매칭 $d_match + 예외 $d_exc + 구현 대기 $d_pend + 공백 $d_gap = $sum ≠ $n_scen
   (시나리오가 추가·삭제됐다면 공백 목록과 집계를 함께 갱신할 것)"
ok "집계 일치 — 시나리오 $n_scen = 매칭 $d_match + 예외 $d_exc + 구현 대기 $d_pend + 공백 $d_gap"

# ── 네 표의 ID 집합 == 시나리오 전수 (누락 0 · 중복 0) ─────────────────────
# 표는 마커 사이의 행에서 첫 칸의 `TC-…` 만 읽는다(근거 문장 안의 다른 TC 언급은 세지 않는다).
ids_between() { # $1 = 마커 이름 → 그 마커 블록 안 표 행의 첫 칸 TC ID
  awk -v b="<!-- $1:begin -->" -v e="<!-- $1:end -->" '
    index($0, b) == 1 { f = 1; next }
    index($0, e) == 1 { f = 0 }
    f' "$TRACKER" | sed -nE 's/^\| `(TC-[0-9]{3}-[0-9]{2}(-[A-Z])?)` \|.*/\1/p'
}
for mk in e2e-exceptions e2e-pending e2e-gap; do
  grep -q "<!-- $mk:begin -->" "$TRACKER" && grep -q "<!-- $mk:end -->" "$TRACKER" \
    || fail "$TRACKER 에 <!-- $mk:begin/end --> 마커가 없다"
done
ids_exc="$(ids_between e2e-exceptions)"
ids_pend="$(ids_between e2e-pending)"
ids_gap="$(ids_between e2e-gap)"
ids_match="$(printf '%s' "$declared" | awk '{print $1}')"

n_exc_rows="$(printf '%s\n' "$ids_exc" | grep -c . || true)"
n_pend_rows="$(printf '%s\n' "$ids_pend" | grep -c . || true)"
n_gap_rows="$(printf '%s\n' "$ids_gap" | grep -c . || true)"
[ "$n_exc_rows"  = "$d_exc"  ] || fail "예외 표 행 수($n_exc_rows) 가 집계($d_exc) 와 다르다"
[ "$n_pend_rows" = "$d_pend" ] || fail "구현 대기 표 행 수($n_pend_rows) 가 집계($d_pend) 와 다르다"
[ "$n_gap_rows"  = "$d_gap"  ] || fail "공백 표 행 수($n_gap_rows) 가 집계($d_gap) 와 다르다"

union="$(printf '%s\n%s\n%s\n%s\n' "$ids_match" "$ids_exc" "$ids_pend" "$ids_gap" | grep . | sort)"
dup_union="$(printf '%s\n' "$union" | uniq -d)"
[ -z "$dup_union" ] || fail "한 TC 가 두 표에 걸쳐 있다: $(echo "$dup_union" | tr '\n' ' ')"
unknown="$(comm -13 <(printf '%s\n' "$scenarios") <(printf '%s\n' "$union" | uniq))"
[ -z "$unknown" ] || fail "표에 있는데 docs/tests 에 없는 TC: $(echo "$unknown" | tr '\n' ' ')"
missing="$(comm -23 <(printf '%s\n' "$scenarios") <(printf '%s\n' "$union" | uniq))"
[ -z "$missing" ] || fail "어느 표에도 없는 시나리오: $(echo "$missing" | tr '\n' ' ')
   (매칭 flow 를 만들었거나 시나리오가 추가됐다면 공백/구현 대기 표와 집계를 함께 갱신할 것)"
ok "전수 분류 — $n_scen 개 ID 가 네 표에 정확히 한 번씩 (매칭 $n_match · 예외 $n_exc_rows · 구현 대기 $n_pend_rows · 공백 $n_gap_rows)"

echo "OK: 시나리오 ↔ e2e flow 매핑 정합 (시나리오 $n_scen · 매칭 $n_match · 예외 $d_exc · 구현 대기 $d_pend · 공백 $d_gap)"

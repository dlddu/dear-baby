import { useCallback, useEffect, useState } from "react"

/**
 * 여정 mockup 셸.
 *
 * design-doc-structure-validator 스킬의 "여정 Mockup 페이지의 요건" 8개를 만족시키는
 * 공통 껍데기다. 여정 하나 = 이 셸 + steps 배열 하나 = 페이지 하나.
 *
 *  1 모든 단계 포함      steps 전부를 DOM 에 렌더한다(비활성 단계는 hidden).
 *  2 단계 전환 수단      이전/다음 버튼 + 상단 단계 칩 목록.
 *  3 현재 위치 표시      "n / 전체" 인디케이터.
 *  4 화면 안에서의 전진   폰 화면을 누르면 다음 단계로 넘어간다(부분 충족 — 화면 내
 *                       개별 CTA 배선은 후속. docs/doc-structure-state.md 참조).
 *  5 딥링크             #<step-id> 로 특정 단계를 바로 연다. 전환 시 해시도 갱신.
 *  6 분기 표현          한 단계가 여러 화면을 가지면 화면 탭으로 갈래를 드러낸다.
 *  7 단일 파일 정적 동작  parcel + html-inline 으로 자산을 통째로 인라인해 배포한다.
 *  8 문서 복귀 링크      현재 단계에 맞춰 reader.html?doc=...#<step-id> 로 돌아간다.
 */

export interface JourneyScreen {
  /** 화면 ID (M-NN) — mockup 인덱스와 맞춘다 */
  id: string
  /** 갈래·상태 이름. 한 단계에 화면이 여럿일 때 탭 라벨이 된다 */
  label: string
  Screen: React.ComponentType<{ onBack: () => void }>
}

export interface JourneyStep {
  /** 단계 식별자 — 여정 문서의 제목 앵커와 같은 값이어야 한다 */
  id: string
  title: string
  /** 이 단계에서 사용자가 하는 일 한 줄 */
  summary: string
  screens: JourneyScreen[]
}

export interface JourneyMeta {
  /** 여정 식별자 — 폴더 이름(docs/journeys/<id>/)과 같은 값 */
  id: string
  title: string
  /** 참조 가치 식별자 */
  values: string[]
  /** 여정 문서의 docs/ 기준 경로 */
  docPath: string
  /** 갤러리(전체 화면 색인) 상대 경로 */
  galleryHref: string
  /** 리더 상대 경로 */
  readerHref: string
}

export function JourneyShell({ meta, steps }: { meta: JourneyMeta; steps: JourneyStep[] }) {
  const indexOfHash = useCallback(() => {
    const h = decodeURIComponent(location.hash.replace(/^#/, ""))
    const i = steps.findIndex((s) => s.id === h)
    return i < 0 ? 0 : i
  }, [steps])

  const [cur, setCur] = useState(indexOfHash)
  const [branch, setBranch] = useState(0)

  // 딥링크(요건 5): 로드 시점 해시와 이후 해시 변경을 모두 따라간다.
  useEffect(() => {
    const onHash = () => {
      setCur(indexOfHash())
      setBranch(0)
    }
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [indexOfHash])

  const go = (i: number) => {
    const n = Math.max(0, Math.min(steps.length - 1, i))
    setCur(n)
    setBranch(0)
    history.replaceState(null, "", "#" + steps[n].id)
  }

  const step = steps[cur]
  const screen = step.screens[Math.min(branch, step.screens.length - 1)]
  const docLink = `${meta.readerHref}?doc=${meta.docPath}#${step.id}`

  return (
    <div className="min-h-screen bg-[#E8DFD3]">
      {/* ── 상단 바: 현재 위치(요건 3) · 단계 전환(요건 2) · 문서 복귀(요건 8) ── */}
      <header className="sticky top-0 z-30 bg-[#1a1410] text-cream">
        <div className="mx-auto max-w-[1100px] px-5 py-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-[11px] uppercase tracking-[0.14em] text-peach">여정 mockup</span>
            <h1 className="text-[17px] font-semibold">{meta.title}</h1>
            <code className="rounded bg-white/10 px-2 py-0.5 text-[11px]">{meta.id}</code>
            <span className="text-[12px] text-cream/60">
              참조 가치 {meta.values.join(" · ")}
            </span>
            <span className="flex-1" />
            <a
              className="rounded-full border border-white/25 px-3 py-1 text-[12px] hover:border-peach"
              href={docLink}
            >
              여정 문서에서 이 단계 읽기 →
            </a>
            <a
              className="rounded-full border border-white/25 px-3 py-1 text-[12px] hover:border-peach"
              href={meta.galleryHref}
            >
              전체 화면 갤러리
            </a>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              className="rounded-full border border-white/25 px-3 py-1 text-[12px] disabled:opacity-35"
              onClick={() => go(cur - 1)}
              disabled={cur === 0}
            >
              ← 이전
            </button>
            <span className="tabular-nums text-[12px] text-cream/70">
              {cur + 1} / {steps.length}
            </span>
            <button
              className="rounded-full border border-white/25 px-3 py-1 text-[12px] disabled:opacity-35"
              onClick={() => go(cur + 1)}
              disabled={cur === steps.length - 1}
            >
              다음 →
            </button>
            <span className="mx-1 h-4 w-px bg-white/20" />
            {steps.map((s, i) => (
              <button
                key={s.id}
                onClick={() => go(i)}
                title={s.title}
                className={
                  "rounded-full px-3 py-1 text-[12px] transition " +
                  (i === cur
                    ? "bg-peach text-[#1a1410] font-semibold"
                    : "border border-white/20 text-cream/75 hover:border-peach")
                }
              >
                {i + 1}. {s.title}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── 단계 본문 ── */}
      <main data-journey={meta.id} className="mx-auto max-w-[1100px] px-5 pb-20">
        {steps.map((s, i) => (
          <section key={s.id} data-step={s.id} hidden={i !== cur} id={s.id}>
            <div className="pt-7 pb-3">
              <div className="text-[12px] uppercase tracking-[0.12em] text-ink-sub">
                단계 {i + 1} · <code className="text-[12px]">{s.id}</code>
              </div>
              <h2 className="mt-1 text-[22px] font-semibold text-ink">{s.title}</h2>
              <p className="mt-1 text-[14px] text-ink-sub">{s.summary}</p>
            </div>

            {/* 갈래·상태 (요건 6) */}
            {s.screens.length > 1 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {s.screens.map((sc, bi) => (
                  <button
                    key={sc.id}
                    onClick={() => setBranch(bi)}
                    className={
                      "rounded-full px-3 py-1 text-[12px] transition " +
                      (i === cur && bi === Math.min(branch, s.screens.length - 1)
                        ? "bg-coral text-white font-semibold"
                        : "border border-ink/20 text-ink-sub hover:border-coral")
                    }
                  >
                    {sc.id} · {sc.label}
                  </button>
                ))}
              </div>
            )}

            {i === cur && (
              <>
                {/* 화면 안에서의 전진 (요건 4) */}
                <div
                  className="flex cursor-pointer justify-center py-4"
                  onClick={() => cur < steps.length - 1 && go(cur + 1)}
                  title={cur < steps.length - 1 ? "화면을 누르면 다음 단계로" : undefined}
                >
                  <screen.Screen onBack={() => (location.href = meta.galleryHref)} />
                </div>
                <p className="pb-6 text-center text-[12px] text-ink-sub">
                  {cur < steps.length - 1
                    ? "화면을 누르면 다음 단계로 넘어갑니다."
                    : "여정의 마지막 단계입니다."}
                </p>
              </>
            )}
          </section>
        ))}
      </main>
    </div>
  )
}

import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "../index.css"
import { JourneyShell, type JourneyMeta, type JourneyStep } from "./JourneyShell"
import {
  M36_DiaryListSingle,
  M37_DiaryListMulti,
  M38_DiaryDetail,
  M39_DiaryEmpty,
  M40_DiaryEdit,
  M41_DiaryDeleteConfirm,
  M42_DiaryFilterSheet,
} from "@/screens/Diary"

/**
 * 여정: 일기 열람 (Diary Browsing)
 *
 * 단계 식별자는 여정 문서 docs/user-journeys/diary-browse-journey.md 의
 * 제목 앵커와 같은 값이어야 한다. 문서가 SSOT 이고 이 파일이 따라간다.
 */
const meta: JourneyMeta = {
  id: "diary-browse",
  title: "일기 열람 — 누적된 기록을 다시 만나는 여정",
  values: ["V-001", "V-002", "V-003", "V-007"],
  docPath: "user-journeys/diary-browse-journey.md",
  galleryHref: "../../mockups/index.html",
  readerHref: "../../reader.html",
}

const steps: JourneyStep[] = [
  {
    id: "STP-diary-enter",
    title: "일기 탭 진입",
    summary: "탭바에서 일기 탭을 눌러 지금까지 쌓인 기록을 처음 마주한다.",
    screens: [
      { id: "M-36", label: "기록 있음 (단일 아이)", Screen: M36_DiaryListSingle },
      { id: "M-39", label: "빈 상태 (기록 0건)", Screen: M39_DiaryEmpty },
    ],
  },
  {
    id: "STP-diary-scroll",
    title: "월 그룹 스크롤과 아이 필터",
    summary: "월 단위로 묶인 목록을 훑고, 다자녀면 아이 필터로 좁힌다.",
    screens: [
      { id: "M-37", label: "다자녀 통합 목록", Screen: M37_DiaryListMulti },
      { id: "M-42", label: "아이 필터 시트", Screen: M42_DiaryFilterSheet },
    ],
  },
  {
    id: "STP-diary-detail",
    title: "한 기록의 상세 만남",
    summary: "기록 하나를 열어 그날의 질문·답변·미디어를 다시 읽는다.",
    screens: [{ id: "M-38", label: "기록 상세", Screen: M38_DiaryDetail }],
  },
  {
    id: "STP-diary-manage",
    title: "사후 관리 (선택)",
    summary: "필요하면 기록을 고치거나 지운다. 삭제는 확인 단계를 거친다.",
    screens: [
      { id: "M-40", label: "기록 편집", Screen: M40_DiaryEdit },
      { id: "M-41", label: "삭제 확인", Screen: M41_DiaryDeleteConfirm },
    ],
  },
]

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <JourneyShell meta={meta} steps={steps} />
  </StrictMode>,
)

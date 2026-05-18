// Subject lookup helpers — Record.subject_id 를 사용자 프로필 안의 fetus/
// child 와 매칭해 카드와 상세 화면에서 쓸 (emoji, name, contextLabel) 을
// 만들어준다. 일기 탭은 활성 아이 컨텍스트를 쓰지 않으므로 (PRD-008
// AC-008-01) 화면이 직접 user.fetuses[]·user.children[] 을 훑는다.
//
// "기록 작성 시점 컨텍스트" (예: "임신 28주차") 는 createdAt 기준이 더
// 정확하지만 별도 캐싱이 필요하므로 MVP 에서는 현재 시점 라벨을 사용한다 —
// `record.created_at` 을 기준으로 임신 주차/생후 개월을 다시 계산하는
// 후속 작업은 PRD-008 보강 항목으로 분리.

import type { ChildProfile, FetusProfile, Record, User } from '../../api/types';
import { formatChildAgeLabel, formatPregnancyLabel } from '../../utils/childLabel';

export type SubjectDisplay = {
  emoji: string;
  name: string;
  contextLabel: string | null;
};

const FALLBACK: SubjectDisplay = {
  emoji: '🌱',
  name: '우리 아이',
  contextLabel: null,
};

// describeSubject — 사용자의 fetuses/children 안에서 subjectId 와 매칭되는
// row 를 찾아 표시 정보를 만든다. 매칭 실패 시 (deleted subject 등) 안전한
// 폴백 라벨 반환.
//
// recordCreatedAt 은 컨텍스트 라벨 계산의 기준 시점. 누락 시 현재 시각으로
// 폴백.
export function describeSubject(
  user: User | null,
  subjectId: string,
  recordCreatedAt?: string,
): SubjectDisplay {
  if (!user) return FALLBACK;
  const fetus = user.fetuses?.find((f) => f.subject_id === subjectId);
  if (fetus) {
    return {
      emoji: '🌱',
      name: trimmedOr(fetus.nickname, '우리 아이'),
      contextLabel: fetusContextLabel(fetus, recordCreatedAt),
    };
  }
  const child = user.children?.find((c) => c.subject_id === subjectId);
  if (child) {
    return {
      emoji: '👶',
      name: trimmedOr(child.name, '우리 아이'),
      contextLabel: childContextLabel(child, recordCreatedAt),
    };
  }
  return FALLBACK;
}

function trimmedOr(s: string | null, fallback: string): string {
  const t = s?.trim() ?? '';
  return t.length > 0 ? t : fallback;
}

function fetusContextLabel(f: FetusProfile, isoCreatedAt?: string): string | null {
  const baseLabel = formatPregnancyLabel(
    f.due_date,
    isoCreatedAt ? new Date(isoCreatedAt) : undefined,
  );
  if (!baseLabel) return null;
  // formatPregnancyLabel 은 "28주차" / "D-36" 두 모드를 모두 반환한다.
  // 일기 카드/상세는 "임신 28주차" 톤으로 통일하기 위해 주차 모드에서만
  // 접두사를 단다.
  if (baseLabel.endsWith('주차')) return `임신 ${baseLabel}`;
  return baseLabel;
}

function childContextLabel(c: ChildProfile, isoCreatedAt?: string): string | null {
  return formatChildAgeLabel(
    c.birth_date,
    isoCreatedAt ? new Date(isoCreatedAt) : undefined,
  );
}

// groupRecordsByMonth — 일기 탭의 SectionList 데이터 구조. created_at 의
// 캘린더 월(로컬) 기준으로 묶고, 각 그룹은 내부 정렬을 보존한다 (서버가
// 이미 newest-first 로 보내준다).
export function groupRecordsByMonth(
  records: Record[],
): { title: string; data: Record[] }[] {
  const buckets = new Map<string, Record[]>();
  for (const r of records) {
    const d = new Date(r.created_at);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = [];
      buckets.set(key, bucket);
    }
    bucket.push(r);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, data]) => {
      const [y, m] = key.split('-');
      return { title: `📅 ${y}년 ${Number(m)}월`, data };
    });
}

// formatCardDate — 카드 좌상단 날짜 라벨. "MM/DD (요일)" 패턴 (M-36 기준).
const KO_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
export function formatCardDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd} (${KO_WEEKDAYS[d.getDay()]})`;
}

// formatDetailDate — 상세 화면 상단 메타의 큰 날짜. "YYYY년 MM월 DD일 (요일)".
export function formatDetailDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${KO_WEEKDAYS[d.getDay()]})`;
}

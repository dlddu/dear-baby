// PRD-006 케이스 분기 온보딩 draft. The user's in-progress answers are
// persisted to SecureStore so a kill-and-relaunch mid-funnel resumes
// where they left off rather than restarting at S0. The draft lives
// only until POST /onboarding/complete succeeds, at which point
// `useOnboardingDraft.clear()` wipes it.
//
// Shape rationale: Case B's purposes are per-child (AC-006-03) while A/C
// share one purpose set (AC-006-02 / 04). To keep the schema uniform we
// always store purposes as an array of arrays addressed by the same
// index as `children` — the screens decide whether to expose one
// PurposeSelector or N.

import { useCallback, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

const DRAFT_KEY = 'db_onboarding_draft';

export type DraftCaseAnswers = {
  isPregnant: boolean;
  hasChildren: boolean;
};

// ChildDraft mirrors api/onboarding.ChildSubmit minus the photo upload
// (still TBD), with snake_case wire names so the client can call
// JSON.stringify before POSTing without a transformer.
export type ChildDraft = {
  status: 'parenting' | 'pregnancy';
  name: string | null;
  gender: 'female' | 'male' | 'unknown';
  birth_date: string | null;
  due_date: string | null;
  pregnancy_week: number | null;
  bio: string | null;
  photo_s3_key: string | null;
  is_due_date_undecided: boolean;
};

export type OnboardingDraft = {
  case: DraftCaseAnswers | null;
  multiplePregnancy: boolean | null;
  children: ChildDraft[];
  // Per-child purpose lists. `purposes[i]` belongs to `children[i]`.
  // Case A / C drive every entry to the same value via the screens.
  purposes: string[][];
  // updatedAt lets diagnostics distinguish a recovered draft from an
  // accidentally seeded one. Not surfaced to the UI.
  updatedAt: string;
};

export const emptyDraft: OnboardingDraft = {
  case: null,
  multiplePregnancy: null,
  children: [],
  purposes: [],
  updatedAt: '',
};

async function readDraft(): Promise<OnboardingDraft> {
  const raw = await SecureStore.getItemAsync(DRAFT_KEY);
  if (!raw) return emptyDraft;
  try {
    const parsed = JSON.parse(raw) as Partial<OnboardingDraft>;
    return {
      case: parsed.case ?? null,
      multiplePregnancy: parsed.multiplePregnancy ?? null,
      children: parsed.children ?? [],
      purposes: parsed.purposes ?? [],
      updatedAt: parsed.updatedAt ?? '',
    };
  } catch {
    // Drop malformed payloads silently — the user re-enters S0 once.
    await SecureStore.deleteItemAsync(DRAFT_KEY);
    return emptyDraft;
  }
}

async function writeDraft(draft: OnboardingDraft): Promise<void> {
  const serialized = JSON.stringify({
    ...draft,
    updatedAt: new Date().toISOString(),
  });
  await SecureStore.setItemAsync(DRAFT_KEY, serialized);
}

export async function loadOnboardingDraft(): Promise<OnboardingDraft> {
  return readDraft();
}

export async function clearOnboardingDraft(): Promise<void> {
  await SecureStore.deleteItemAsync(DRAFT_KEY);
}

// useOnboardingDraft is the hook the funnel screens use. It loads the
// draft on mount, exposes an immutable snapshot, and offers patch +
// clear helpers that persist eagerly. Mutations are async so callers
// `await` them before navigating to the next step — guarantees
// SecureStore has the latest state if the user backgrounds the app.
export function useOnboardingDraft() {
  const [draft, setDraft] = useState<OnboardingDraft>(emptyDraft);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const d = await readDraft();
      if (!cancelled) {
        setDraft(d);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(
    async (patch: Partial<OnboardingDraft>) => {
      const next = { ...draft, ...patch };
      setDraft(next);
      await writeDraft(next);
    },
    [draft],
  );

  const clear = useCallback(async () => {
    setDraft(emptyDraft);
    await clearOnboardingDraft();
  }, []);

  return { draft, loaded, update, clear };
}

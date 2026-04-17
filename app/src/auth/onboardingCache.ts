import * as SecureStore from 'expo-secure-store';

// Lightweight local cache of onboarding state. This lets the app stay on the
// correct screen when /me fails on cold boot (airplane mode, backend hiccup)
// instead of dropping the user back into the onboarding funnel or re-showing
// the Stage 2 coachmark. The backend remains the source of truth — this
// cache is only a graceful-fallback hint.

const ONBOARDED_AT_KEY = 'db_onboarded_at';
const DUE_DATE_KEY = 'db_due_date';
const STAGE2_DISMISSED_AT_KEY = 'db_stage2_coachmark_dismissed_at';

export async function getCachedOnboardedAt(): Promise<string | null> {
  return SecureStore.getItemAsync(ONBOARDED_AT_KEY);
}

export async function getCachedDueDate(): Promise<string | null> {
  return SecureStore.getItemAsync(DUE_DATE_KEY);
}

export async function getCachedStage2CoachmarkDismissedAt(): Promise<string | null> {
  return SecureStore.getItemAsync(STAGE2_DISMISSED_AT_KEY);
}

export async function setCachedOnboarding(
  onboardedAt: string | null,
  dueDate: string | null,
  stage2CoachmarkDismissedAt: string | null,
): Promise<void> {
  if (onboardedAt) {
    await SecureStore.setItemAsync(ONBOARDED_AT_KEY, onboardedAt);
  } else {
    await SecureStore.deleteItemAsync(ONBOARDED_AT_KEY);
  }
  if (dueDate) {
    await SecureStore.setItemAsync(DUE_DATE_KEY, dueDate);
  } else {
    await SecureStore.deleteItemAsync(DUE_DATE_KEY);
  }
  if (stage2CoachmarkDismissedAt) {
    await SecureStore.setItemAsync(
      STAGE2_DISMISSED_AT_KEY,
      stage2CoachmarkDismissedAt,
    );
  } else {
    await SecureStore.deleteItemAsync(STAGE2_DISMISSED_AT_KEY);
  }
}

export async function clearOnboardingCache(): Promise<void> {
  await SecureStore.deleteItemAsync(ONBOARDED_AT_KEY);
  await SecureStore.deleteItemAsync(DUE_DATE_KEY);
  await SecureStore.deleteItemAsync(STAGE2_DISMISSED_AT_KEY);
}

import * as SecureStore from 'expo-secure-store';

// Lightweight local cache of onboarding state. This lets the app stay on the
// correct screen when /me fails on cold boot (airplane mode, backend hiccup)
// instead of dropping the user back into the onboarding funnel or re-showing
// the home coachmark. The backend remains the source of truth — this
// cache is only a graceful-fallback hint.

const ONBOARDED_AT_KEY = 'db_onboarded_at';
const DUE_DATE_KEY = 'db_due_date';
const VOICE_COACHMARK_DISMISSED_AT_KEY = 'db_voice_coachmark_dismissed_at';
const FIRST_RECORD_AT_KEY = 'db_first_record_at';
const AI_PREVIEW_KEY = 'db_ai_preview';

export async function getCachedOnboardedAt(): Promise<string | null> {
  return SecureStore.getItemAsync(ONBOARDED_AT_KEY);
}

export async function getCachedDueDate(): Promise<string | null> {
  return SecureStore.getItemAsync(DUE_DATE_KEY);
}

export async function getCachedVoiceCoachmarkDismissedAt(): Promise<string | null> {
  return SecureStore.getItemAsync(VOICE_COACHMARK_DISMISSED_AT_KEY);
}

export async function getCachedFirstRecordAt(): Promise<string | null> {
  return SecureStore.getItemAsync(FIRST_RECORD_AT_KEY);
}

export async function getCachedAiPreview(): Promise<string | null> {
  return SecureStore.getItemAsync(AI_PREVIEW_KEY);
}

export async function setCachedOnboarding(
  onboardedAt: string | null,
  dueDate: string | null,
  voiceCoachmarkDismissedAt: string | null,
  firstRecordAt: string | null,
  aiPreview: string | null,
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
  if (voiceCoachmarkDismissedAt) {
    await SecureStore.setItemAsync(
      VOICE_COACHMARK_DISMISSED_AT_KEY,
      voiceCoachmarkDismissedAt,
    );
  } else {
    await SecureStore.deleteItemAsync(VOICE_COACHMARK_DISMISSED_AT_KEY);
  }
  if (firstRecordAt) {
    await SecureStore.setItemAsync(FIRST_RECORD_AT_KEY, firstRecordAt);
  } else {
    await SecureStore.deleteItemAsync(FIRST_RECORD_AT_KEY);
  }
  if (aiPreview) {
    await SecureStore.setItemAsync(AI_PREVIEW_KEY, aiPreview);
  } else {
    await SecureStore.deleteItemAsync(AI_PREVIEW_KEY);
  }
}

export async function clearOnboardingCache(): Promise<void> {
  await SecureStore.deleteItemAsync(ONBOARDED_AT_KEY);
  await SecureStore.deleteItemAsync(DUE_DATE_KEY);
  await SecureStore.deleteItemAsync(VOICE_COACHMARK_DISMISSED_AT_KEY);
  await SecureStore.deleteItemAsync(FIRST_RECORD_AT_KEY);
  await SecureStore.deleteItemAsync(AI_PREVIEW_KEY);
}

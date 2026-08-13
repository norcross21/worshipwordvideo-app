import type { MemberProfile } from './supabase';

export function accountSetupIsCurrent(profile: MemberProfile | null, termsVersion: string): boolean {
  return Boolean(
    profile?.terms_accepted_at
    && profile.account_emails_acknowledged_at
    && profile.terms_version === termsVersion
  );
}

export function accountSetupPromptKey(userId: string, termsVersion: string): string {
  return `worship_account_setup_prompt:${termsVersion}:${userId}`;
}

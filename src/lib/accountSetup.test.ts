import { describe, expect, it } from 'vitest';
import type { MemberProfile } from './supabase';
import { accountSetupIsCurrent, accountSetupPromptKey } from './accountSetup';

const currentProfile: MemberProfile = {
  user_id: 'member-1',
  email: 'member@example.org',
  display_name: 'Member',
  church_name: null,
  created_at: '2026-08-01T00:00:00.000Z',
  email_confirmed_at: '2026-08-01T00:00:00.000Z',
  last_sign_in_at: '2026-08-13T00:00:00.000Z',
  terms_version: '2026-08-12',
  terms_accepted_at: '2026-08-13T00:00:00.000Z',
  account_emails_acknowledged_at: '2026-08-13T00:00:00.000Z',
  kairos_marketing_opt_in: false,
  kairos_marketing_opt_in_at: null,
  kairos_marketing_opt_out_at: null,
};

describe('account setup reminder', () => {
  it('is complete only when the current terms and essential-email acknowledgement are recorded', () => {
    expect(accountSetupIsCurrent(currentProfile, '2026-08-12')).toBe(true);
    expect(accountSetupIsCurrent({ ...currentProfile, terms_version: '2026-08-08' }, '2026-08-12')).toBe(false);
    expect(accountSetupIsCurrent({ ...currentProfile, account_emails_acknowledged_at: null }, '2026-08-12')).toBe(false);
  });

  it('scopes a durable dismissal to both member and terms version', () => {
    expect(accountSetupPromptKey('member-1', '2026-08-12')).toBe('worship_account_setup_prompt:2026-08-12:member-1');
  });
});

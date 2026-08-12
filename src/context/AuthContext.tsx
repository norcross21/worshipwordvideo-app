import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, supabaseErrorMessage, type MemberProfile } from '../lib/supabase';

export const CURRENT_TERMS_VERSION = '2026-08-12';

export interface SignUpDetails {
  email: string;
  password: string;
  displayName: string;
  churchName?: string;
  kairosMarketingOptIn: boolean;
}

export interface MemberProfileUpdate {
  displayName: string;
  churchName?: string;
  kairosMarketingOptIn: boolean;
  acceptAccountTerms?: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profile: MemberProfile | null;
  profileLoading: boolean;
  adminRole: 'master_admin' | null;
  adminLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (details: SignUpDetails) => Promise<{ error: Error | null; needsEmailVerification?: boolean }>;
  resendConfirmation: (email: string) => Promise<{ error: Error | null }>;
  sendPasswordReset: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
  updateProfile: (details: MemberProfileUpdate) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  profile: null,
  profileLoading: true,
  adminRole: null,
  adminLoading: true,
  signInWithEmail: async () => ({ error: new Error('Supabase not initialized') }),
  signUpWithEmail: async () => ({ error: new Error('Supabase not initialized') }),
  resendConfirmation: async () => ({ error: new Error('Supabase not initialized') }),
  sendPasswordReset: async () => ({ error: new Error('Supabase not initialized') }),
  updatePassword: async () => ({ error: new Error('Supabase not initialized') }),
  updateProfile: async () => ({ error: new Error('Supabase not initialized') }),
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [adminRole, setAdminRole] = useState<'master_admin' | null>(null);
  const [adminLoading, setAdminLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Get initial session
    void supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!active) return;
      if (error) {
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!supabase || !user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    const { data, error } = await supabase
      .from('app_users')
      .select('user_id,email,display_name,church_name,created_at,email_confirmed_at,last_sign_in_at,terms_version,terms_accepted_at,account_emails_acknowledged_at,kairos_marketing_opt_in,kairos_marketing_opt_in_at,kairos_marketing_opt_out_at')
      .eq('user_id', user.id)
      .maybeSingle();
    setProfile(!error && data ? data as MemberProfile : null);
    setProfileLoading(false);
  }, [user]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    let active = true;
    if (!supabase || !user) {
      setAdminRole(null);
      setAdminLoading(false);
      return;
    }

    setAdminLoading(true);
    void supabase
      .from('app_admins')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        setAdminRole(!error && data?.role === 'master_admin' ? 'master_admin' : null);
        setAdminLoading(false);
      });

    return () => { active = false; };
  }, [user]);

  const signInWithEmail = async (email: string, password: string) => {
    if (!supabase) return { error: new Error('Supabase client is missing configuration.') };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUpWithEmail = async ({ email, password, displayName, churchName, kairosMarketingOptIn }: SignUpDetails) => {
    if (!supabase) return { error: new Error('Supabase client is missing configuration.') };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          display_name: displayName.trim(),
          church_name: churchName?.trim() || null,
          terms_accepted: true,
          terms_version: CURRENT_TERMS_VERSION,
          account_emails_acknowledged: true,
          kairos_marketing_opt_in: kairosMarketingOptIn,
          signup_source: 'worshipwordvideo.org',
        },
      },
    });
    const needsEmailVerification = !data.session && !!data.user;
    return { error, needsEmailVerification };
  };

  const resendConfirmation = async (email: string) => {
    if (!supabase) return { error: new Error('Supabase client is missing configuration.') };
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    return { error };
  };

  const sendPasswordReset = async (email: string) => {
    if (!supabase) return { error: new Error('Supabase client is missing configuration.') };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/?reset-password=1`,
    });
    return { error };
  };

  const updatePassword = async (password: string) => {
    if (!supabase) return { error: new Error('Supabase client is missing configuration.') };
    const { error } = await supabase.auth.updateUser({ password });
    return { error };
  };

  const updateProfile = async ({ displayName, churchName, kairosMarketingOptIn, acceptAccountTerms }: MemberProfileUpdate) => {
    if (!supabase || !user) return { error: new Error('You must be signed in to update account details.') };
    const now = new Date().toISOString();
    const previouslyOptedIn = profile?.kairos_marketing_opt_in === true;
    const profileChanges: Record<string, string | boolean | null> = {
      display_name: displayName.trim(),
      church_name: churchName?.trim() || null,
      kairos_marketing_opt_in: kairosMarketingOptIn,
      kairos_marketing_opt_in_at: kairosMarketingOptIn
        ? (previouslyOptedIn ? profile?.kairos_marketing_opt_in_at ?? now : now)
        : null,
      kairos_marketing_opt_out_at: kairosMarketingOptIn ? null : now,
    };
    if (acceptAccountTerms) {
      profileChanges.terms_version = CURRENT_TERMS_VERSION;
      profileChanges.terms_accepted_at = now;
      profileChanges.account_emails_acknowledged_at = now;
    }
    const { error } = await supabase.from('app_users').update(profileChanges).eq('user_id', user.id);
    if (!error) await refreshProfile();
    return { error };
  };

  const signOut = async () => {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw new Error(supabaseErrorMessage(error, 'Unable to sign out.'));
    }
    setUser(null);
    setSession(null);
    setProfile(null);
    setAdminRole(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        profile,
        profileLoading,
        adminRole,
        adminLoading,
        signInWithEmail,
        signUpWithEmail,
        resendConfirmation,
        sendPasswordReset,
        updatePassword,
        updateProfile,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

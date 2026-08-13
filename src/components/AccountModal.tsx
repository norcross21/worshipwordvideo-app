import { useEffect, useState } from 'react';
import { Building2, CheckCircle2, Download, ExternalLink, Heart, ListMusic, Mail, Save, ShieldAlert, Trash2, UserRound, X } from 'lucide-react';
import { CURRENT_TERMS_VERSION, useAuth } from '../context/AuthContext';
import { supabase, supabaseErrorMessage } from '../lib/supabase';
import { LegalModal } from './LegalModal';
import { useAccessibleDialog } from '../hooks/useAccessibleDialog';
import { runMemberAccountAction } from '../lib/memberAccountActions';
import { accountSetupIsCurrent } from '../lib/accountSetup';

interface AccountModalProps {
  savedServiceCount?: number;
  onClose: () => void;
}

export function AccountModal({ savedServiceCount = 0, onClose }: AccountModalProps) {
  const { user, session, profile, profileLoading, adminRole, updateProfile, signOut } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [churchName, setChurchName] = useState('');
  const [kairosMarketingOptIn, setKairosMarketingOptIn] = useState(false);
  const [acceptAccountTerms, setAcceptAccountTerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [downloadingData, setDownloadingData] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [mfaLevel, setMfaLevel] = useState<'aal1' | 'aal2' | null>(null);
  const [mfaFactorId, setMfaFactorId] = useState('');
  const [mfaQrCode, setMfaQrCode] = useState('');
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaMessage, setMfaMessage] = useState('');
  const dialogRef = useAccessibleDialog<HTMLDivElement>(onClose, !showLegalModal);
  const accountTermsAreCurrent = accountSetupIsCurrent(profile, CURRENT_TERMS_VERSION);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? user?.user_metadata?.display_name ?? '');
    setChurchName(profile?.church_name ?? user?.user_metadata?.church_name ?? '');
    setKairosMarketingOptIn(profile?.kairos_marketing_opt_in ?? false);
    setAcceptAccountTerms(accountTermsAreCurrent);
  }, [accountTermsAreCurrent, profile, user]);

  useEffect(() => {
    if (!supabase || adminRole !== 'master_admin') return;
    let active = true;
    void Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]).then(([assurance, factors]) => {
      if (!active) return;
      if (!assurance.error) {
        setMfaLevel(assurance.data.currentLevel === 'aal2' ? 'aal2' : assurance.data.currentLevel === 'aal1' ? 'aal1' : null);
      }
      const verifiedFactor = factors.data?.totp.find((factor) => factor.status === 'verified');
      if (verifiedFactor) setMfaFactorId(verifiedFactor.id);
    });
    return () => { active = false; };
  }, [adminRole]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!displayName.trim()) {
      setError('Please enter your display name.');
      return;
    }
    if (!acceptAccountTerms) {
      setError('Please agree to the account terms and essential account emails.');
      return;
    }
    setSaving(true);
    try {
      const { error: updateError } = await updateProfile({
        displayName,
        churchName,
        kairosMarketingOptIn,
        acceptAccountTerms: !accountTermsAreCurrent,
      });
      if (updateError) setError(updateError.message);
      else setSuccess('Account and email preferences saved.');
    } catch (err: unknown) {
      setError(supabaseErrorMessage(err, 'Unable to save your account details.'));
    } finally {
      setSaving(false);
    }
  };

  const downloadAccountData = async () => {
    if (!supabase || !user) return;
    setError('');
    setDownloadingData(true);
    try {
      const [servicesResult, consentResult] = await Promise.all([
        supabase.from('user_playlists').select('id,title,items,service_date,notes,archived_at,created_at,updated_at').eq('user_id', user.id).order('updated_at', { ascending: false }),
        supabase.from('member_consent_events').select('preference,granted,terms_version,source,recorded_at').eq('user_id', user.id).order('recorded_at', { ascending: false }),
      ]);
      if (servicesResult.error) throw servicesResult.error;
      if (consentResult.error) throw consentResult.error;
      const exportData = {
        exported_at: new Date().toISOString(),
        account: { id: user.id, email: user.email, created_at: user.created_at, profile },
        saved_services: servicesResult.data ?? [],
        consent_history: consentResult.data ?? [],
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `worship-word-video-account-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setSuccess('Your account data has been downloaded to this device.');
    } catch (downloadError) {
      setError(supabaseErrorMessage(downloadError, 'Your account data could not be downloaded.'));
    } finally {
      setDownloadingData(false);
    }
  };

  const deleteAccount = async () => {
    if (!session?.access_token || !user?.email || adminRole === 'master_admin') return;
    setError('');
    setSuccess('');
    setDeletingAccount(true);
    try {
      await runMemberAccountAction({ action: 'delete-own-account', email: deleteEmail, confirmation: deleteConfirmation });
      await signOut().catch(() => undefined);
      window.location.assign('/');
    } catch (deleteError) {
      setError(supabaseErrorMessage(deleteError, 'Your account could not be deleted.'));
      setDeletingAccount(false);
    }
  };

  const beginMfaSetup = async () => {
    if (!supabase) return;
    setMfaBusy(true);
    setMfaMessage('');
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Worship Word Video admin' });
    if (enrollError) setMfaMessage(enrollError.message);
    else {
      setMfaFactorId(data.id);
      setMfaQrCode(data.totp.qr_code);
      setMfaSecret(data.totp.secret);
      setMfaMessage('Scan the code, then enter the six-digit number from your authenticator app.');
    }
    setMfaBusy(false);
  };

  const verifyMfa = async () => {
    if (!supabase || !mfaFactorId || !/^\d{6}$/.test(mfaCode)) return;
    setMfaBusy(true);
    setMfaMessage('');
    const challenge = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
    if (challenge.error) {
      setMfaMessage(challenge.error.message);
      setMfaBusy(false);
      return;
    }
    const verification = await supabase.auth.mfa.verify({ factorId: mfaFactorId, challengeId: challenge.data.id, code: mfaCode });
    if (verification.error) setMfaMessage(verification.error.message);
    else {
      setMfaLevel('aal2');
      setMfaQrCode('');
      setMfaSecret('');
      setMfaCode('');
      setMfaMessage('Authenticator verification is active for this administrator session.');
    }
    setMfaBusy(false);
  };

  return (
    <div className="modal-backdrop" onClick={showLegalModal ? undefined : onClose}>
      <div ref={dialogRef} tabIndex={-1} className="modal-card modal-card--account" role="dialog" aria-modal="true" aria-labelledby="account-dialog-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div><span className="eyebrow"><UserRound size={14} /> Member account</span><h3 id="account-dialog-title">Your details and email choices</h3></div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close account settings"><X size={18} /></button>
        </div>
        <form className="modal-form" onSubmit={handleSave}>
          <div className="account-email"><Mail size={15} /><span>{user?.email}</span><small>{user?.email_confirmed_at ? 'Email confirmed' : 'Awaiting email confirmation'}</small></div>
          {error && <div className="auth-alert auth-alert--error" role="alert">{error}</div>}
          {success && <div className="auth-alert auth-alert--success" role="status"><CheckCircle2 size={16} /> {success}</div>}

          <div className="auth-form-grid">
            <div className="form-group">
              <label htmlFor="account-name">Display name</label>
              <div className="input-with-icon"><UserRound size={16} className="input-icon" /><input id="account-name" required maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" /></div>
            </div>
            <div className="form-group">
              <label htmlFor="account-church">Church or organisation <span>(optional)</span></label>
              <div className="input-with-icon"><Building2 size={16} className="input-icon" /><input id="account-church" maxLength={120} value={churchName} onChange={(event) => setChurchName(event.target.value)} autoComplete="organization" /></div>
            </div>
          </div>

          <div className="membership-consents">
            <label className="terms-consent">
              <input type="checkbox" checked={acceptAccountTerms} onChange={(event) => setAcceptAccountTerms(event.target.checked)} disabled={accountTermsAreCurrent} required />
              <span>I agree to the <button type="button" onClick={() => setShowLegalModal(true)}>Terms, Privacy and Copyright guidance</button> and understand my email is used for essential account and security messages.</span>
            </label>
            <label className="terms-consent terms-consent--optional">
              <input type="checkbox" checked={kairosMarketingOptIn} onChange={(event) => setKairosMarketingOptIn(event.target.checked)} />
              <span><Heart size={14} /> Send me occasional Kairos Housing emails about <strong>Rebuilding lives with dignity</strong>, including news, appeals and ways to donate. This is optional and can be changed here at any time.</span>
            </label>
          </div>

          <p className="account-privacy-note">Account email records are kept while your membership is active and as needed for security or legal duties. Marketing choices are recorded so Kairos can honour your preference.</p>
          <details className="account-data-tools">
            <summary>Your privacy and account data</summary>
            <div className="account-data-tools__body">
              <p>Download a copy of your profile, consent history and saved services at any time.</p>
              <button type="button" className="btn-secondary" onClick={() => void downloadAccountData()} disabled={downloadingData}><Download size={15} /> {downloadingData ? 'Preparing download…' : 'Download my data'}</button>
              {adminRole === 'master_admin' ? (
                <p className="account-data-tools__admin-note"><ShieldAlert size={14} /> The master administrator account is protected from self-deletion.</p>
              ) : (
                <div className="account-delete-panel">
                  <strong>Delete this account</strong>
                  <p>This permanently deletes your membership and every saved service. Download your data first if you need a copy.</p>
                  <label>Email address<input type="email" value={deleteEmail} onChange={(event) => setDeleteEmail(event.target.value)} autoComplete="email" /></label>
                  <label>Type DELETE MY ACCOUNT<input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" /></label>
                  <button type="button" className="account-delete-panel__button" onClick={() => void deleteAccount()} disabled={deletingAccount || deleteEmail.trim().toLowerCase() !== user?.email?.toLowerCase() || deleteConfirmation !== 'DELETE MY ACCOUNT'}><Trash2 size={14} /> {deletingAccount ? 'Deleting account…' : 'Permanently delete account'}</button>
                </div>
              )}
            </div>
          </details>
          {adminRole === 'master_admin' && (
            <section className={`admin-mfa-panel ${mfaLevel === 'aal2' ? 'is-verified' : ''}`} aria-labelledby="admin-mfa-title">
              <div><ShieldAlert size={18} /><span><strong id="admin-mfa-title">Administrator verification</strong><small>{mfaLevel === 'aal2' ? 'Authenticator verified for this session' : 'Required before deleting member accounts'}</small></span></div>
              {mfaLevel !== 'aal2' && !mfaFactorId && <button type="button" className="btn-secondary" onClick={() => void beginMfaSetup()} disabled={mfaBusy}>{mfaBusy ? 'Preparing…' : 'Set up authenticator'}</button>}
              {mfaLevel !== 'aal2' && mfaQrCode && (
                <div className="admin-mfa-panel__setup">
                  <img src={mfaQrCode} alt="QR code for setting up an authenticator app" />
                  <p>Scan with Google Authenticator, Microsoft Authenticator or another TOTP app.</p>
                  <details><summary>Can’t scan?</summary><code>{mfaSecret}</code></details>
                </div>
              )}
              {mfaLevel !== 'aal2' && mfaFactorId && (
                <div className="admin-mfa-panel__verify">
                  <label>Six-digit authenticator code<input value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" /></label>
                  <button type="button" className="btn-primary" onClick={() => void verifyMfa()} disabled={mfaBusy || !/^\d{6}$/.test(mfaCode)}>{mfaBusy ? 'Verifying…' : 'Verify authenticator'}</button>
                </div>
              )}
              {mfaMessage && <p role="status">{mfaMessage}</p>}
            </section>
          )}
          {savedServiceCount >= 3 ? (
            <aside className="account-support-note" aria-label="Optional support for Kairos Housing">
              <span className="account-support-note__icon" aria-hidden="true"><ListMusic size={18} /></span>
              <div>
                <strong>Thank you for planning {savedServiceCount} services with us</strong>
                <p>If the tool is saving your church time, you can make an optional gift to Kairos Housing — <em>Rebuilding lives with dignity</em>.</p>
              </div>
              <a href="https://operations.kairoshousing.org.uk/donate" target="_blank" rel="noreferrer">Support Kairos <ExternalLink size={13} /></a>
            </aside>
          ) : null}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
            <button type="submit" className="btn-primary" disabled={saving || profileLoading}><Save size={15} /> {saving ? 'Saving…' : 'Save account'}</button>
          </div>
        </form>
      </div>
      {showLegalModal && <LegalModal onClose={() => setShowLegalModal(false)} />}
    </div>
  );
}

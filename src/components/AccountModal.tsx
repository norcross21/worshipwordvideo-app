import { useEffect, useState } from 'react';
import { Building2, CheckCircle2, ExternalLink, Heart, ListMusic, Mail, Save, UserRound, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabaseErrorMessage } from '../lib/supabase';
import { LegalModal } from './LegalModal';

interface AccountModalProps {
  savedServiceCount?: number;
  onClose: () => void;
}

export function AccountModal({ savedServiceCount = 0, onClose }: AccountModalProps) {
  const { user, profile, profileLoading, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [churchName, setChurchName] = useState('');
  const [kairosMarketingOptIn, setKairosMarketingOptIn] = useState(false);
  const [acceptAccountTerms, setAcceptAccountTerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showLegalModal, setShowLegalModal] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? user?.user_metadata?.display_name ?? '');
    setChurchName(profile?.church_name ?? user?.user_metadata?.church_name ?? '');
    setKairosMarketingOptIn(profile?.kairos_marketing_opt_in ?? false);
    setAcceptAccountTerms(Boolean(profile?.terms_accepted_at));
  }, [profile, user]);

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
        acceptAccountTerms: !profile?.terms_accepted_at,
      });
      if (updateError) setError(updateError.message);
      else setSuccess('Account and email preferences saved.');
    } catch (err: unknown) {
      setError(supabaseErrorMessage(err, 'Unable to save your account details.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={showLegalModal ? undefined : onClose}>
      <div className="modal-card modal-card--account" role="dialog" aria-modal="true" aria-labelledby="account-dialog-title" onClick={(event) => event.stopPropagation()}>
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
              <input type="checkbox" checked={acceptAccountTerms} onChange={(event) => setAcceptAccountTerms(event.target.checked)} disabled={Boolean(profile?.terms_accepted_at)} required />
              <span>I agree to the <button type="button" onClick={() => setShowLegalModal(true)}>Terms, Privacy and Copyright guidance</button> and understand my email is used for essential account and security messages.</span>
            </label>
            <label className="terms-consent terms-consent--optional">
              <input type="checkbox" checked={kairosMarketingOptIn} onChange={(event) => setKairosMarketingOptIn(event.target.checked)} />
              <span><Heart size={14} /> Send me occasional Kairos Housing emails about <strong>Rebuilding lives with dignity</strong>, including news, appeals and ways to donate. This is optional and can be changed here at any time.</span>
            </label>
          </div>

          <p className="account-privacy-note">Account email records are kept while your membership is active and as needed for security or legal duties. Marketing choices are recorded so Kairos can honour your preference.</p>
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

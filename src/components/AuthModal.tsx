import { useEffect, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Heart,
  KeyRound,
  LogIn,
  Mail,
  RotateCcw,
  UserPlus,
  UserRound,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabaseErrorMessage } from '../lib/supabase';
import { LegalModal } from './LegalModal';

type AuthTab = 'signin' | 'signup' | 'recover' | 'new-password';

interface AuthModalProps {
  onClose: () => void;
  initialTab?: AuthTab;
}

export function AuthModal({ onClose, initialTab = 'signin' }: AuthModalProps) {
  const [tab, setTab] = useState<AuthTab>(initialTab);
  const [displayName, setDisplayName] = useState('');
  const [churchName, setChurchName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [acceptedAccountUse, setAcceptedAccountUse] = useState(false);
  const [kairosMarketingOptIn, setKairosMarketingOptIn] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);

  const {
    signInWithEmail,
    signUpWithEmail,
    resendConfirmation,
    sendPasswordReset,
    updatePassword,
  } = useAuth();

  useEffect(() => setTab(initialTab), [initialTab]);

  const changeTab = (nextTab: AuthTab) => {
    setTab(nextTab);
    setError('');
    setSuccessMessage('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    if (tab !== 'new-password' && !email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    if (tab === 'recover') {
      setLoading(true);
      const { error: resetError } = await sendPasswordReset(email.trim().toLowerCase());
      setLoading(false);
      if (resetError) setError(resetError.message);
      else setSuccessMessage('Password email sent. Open the link in that email to choose a new password.');
      return;
    }

    if (!password || password.length < 8) {
      setError('Use a password of at least 8 characters.');
      return;
    }

    if (tab === 'signup' && !displayName.trim()) {
      setError('Please enter the name you would like shown on your account.');
      return;
    }

    if (tab === 'signup' && !acceptedAccountUse) {
      setError('Please agree to the account terms and essential account emails.');
      return;
    }

    setLoading(true);
    try {
      if (tab === 'signin') {
        const { error: signInError } = await signInWithEmail(email.trim().toLowerCase(), password);
        if (signInError) {
          setError(signInError.message.toLowerCase().includes('invalid login credentials')
            ? 'That email and password do not match. Clear the password field and type it again carefully; passwords are case-sensitive.'
            : signInError.message);
        }
        else onClose();
      } else if (tab === 'new-password') {
        const { error: updateError } = await updatePassword(password);
        if (updateError) setError(updateError.message);
        else {
          window.history.replaceState({}, '', window.location.pathname);
          setSuccessMessage('Password updated. You are signed in and ready to continue.');
          window.setTimeout(onClose, 1400);
        }
      } else {
        const { error: signUpError, needsEmailVerification } = await signUpWithEmail({
          email: email.trim().toLowerCase(),
          password,
          displayName,
          churchName,
          kairosMarketingOptIn,
        });
        if (signUpError) {
          setError(signUpError.message);
        } else if (needsEmailVerification) {
          setSuccessMessage('Confirmation email sent. Check your Inbox, Spam or Junk folder, then select the confirmation link before signing in.');
        } else {
          setSuccessMessage('Account created. Your service playlist tools are now ready.');
          window.setTimeout(onClose, 1400);
        }
      }
    } catch (err: unknown) {
      setError(supabaseErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email.trim()) {
      setError('Enter your email address first.');
      return;
    }
    setLoading(true);
    setError('');
    const { error: resendError } = await resendConfirmation(email.trim().toLowerCase());
    setLoading(false);
    if (resendError) setError(resendError.message);
    else setSuccessMessage('A fresh confirmation email has been sent. Check your Inbox, Spam or Junk folder.');
  };

  const title = tab === 'signin'
    ? 'Welcome back'
    : tab === 'signup'
      ? 'Create your member account'
      : tab === 'recover'
        ? 'Reset your password'
        : 'Choose a new password';

  return (
    <div className="modal-backdrop" onClick={showLegalModal ? undefined : onClose}>
      <div className="modal-card modal-card--auth" role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          {tab === 'signin' || tab === 'signup' ? (
            <div className="auth-tab-switch">
              <button type="button" className={`auth-tab-btn ${tab === 'signin' ? 'is-active' : ''}`} onClick={() => changeTab('signin')}>
                <LogIn size={15} /> Log in
              </button>
              <button type="button" className={`auth-tab-btn ${tab === 'signup' ? 'is-active' : ''}`} onClick={() => changeTab('signup')}>
                <UserPlus size={15} /> Create account
              </button>
            </div>
          ) : <strong className="auth-modal__compact-title"><KeyRound size={16} /> Account security</strong>}
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close account window"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="auth-modal__intro">
            <h3 id="auth-dialog-title">{title}</h3>
            <p>
              {tab === 'signin' && 'Sign in to build, trim, save and reuse service playlists on your devices.'}
              {tab === 'signup' && 'Membership unlocks the service playlist, clean start/stop timing and saved plans.'}
              {tab === 'recover' && 'We will email a secure link so you can choose a new password.'}
              {tab === 'new-password' && 'Enter a new password for your Worship Word Video account.'}
            </p>
          </div>

          {error && <div className="auth-alert auth-alert--error" role="alert">{error}</div>}
          {successMessage && (
            <div className="auth-alert auth-alert--success" role="status">
              <CheckCircle2 size={16} /> <span>{successMessage}</span>
            </div>
          )}

          {tab === 'signup' && (
            <div className="auth-form-grid">
              <div className="form-group">
                <label htmlFor="auth-name">Your display name</label>
                <div className="input-with-icon"><UserRound size={16} className="input-icon" /><input id="auth-name" required maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="e.g. Stephen" autoComplete="name" /></div>
              </div>
              <div className="form-group">
                <label htmlFor="auth-church">Church or organisation <span>(optional)</span></label>
                <div className="input-with-icon"><Building2 size={16} className="input-icon" /><input id="auth-church" maxLength={120} value={churchName} onChange={(event) => setChurchName(event.target.value)} placeholder="e.g. St Mark's Church" autoComplete="organization" /></div>
              </div>
            </div>
          )}

          {tab !== 'new-password' && (
            <div className="form-group">
              <label htmlFor="auth-email">Email address</label>
              <div className="input-with-icon">
                <Mail size={16} className="input-icon" />
                <input type="email" id="auth-email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@church.org" autoComplete="email" />
              </div>
            </div>
          )}

          {tab !== 'recover' && (
            <div className="form-group">
              <label htmlFor="auth-password">{tab === 'new-password' ? 'New password' : 'Password'}</label>
              <div className="input-with-icon">
                <KeyRound size={16} className="input-icon" />
                <input type={showPassword ? 'text' : 'password'} id="auth-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" autoComplete={tab === 'signin' ? 'current-password' : 'new-password'} />
                <button type="button" className="input-eye-btn" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
              {tab === 'signin' && <small className="auth-password-help">Passwords are case-sensitive. Check for extra characters if your browser filled this field.</small>}
            </div>
          )}

          {tab === 'signup' && (
            <div className="membership-consents">
              <label className="terms-consent">
                <input type="checkbox" checked={acceptedAccountUse} onChange={(event) => setAcceptedAccountUse(event.target.checked)} required />
                <span>I agree to the <button type="button" onClick={() => setShowLegalModal(true)}>Terms, Privacy and Copyright guidance</button>. I understand my email is kept to run and secure my account and to send essential account messages.</span>
              </label>
              <label className="terms-consent terms-consent--optional">
                <input type="checkbox" checked={kairosMarketingOptIn} onChange={(event) => setKairosMarketingOptIn(event.target.checked)} />
                <span><Heart size={14} /> I would like occasional emails from Kairos Housing about <strong>Rebuilding lives with dignity</strong>, including charity news, appeals and ways to donate. Optional; I can unsubscribe at any time.</span>
              </label>
            </div>
          )}

          <div className="modal-actions modal-actions--auth">
            {tab === 'recover' || tab === 'new-password' ? <button type="button" className="btn-secondary" onClick={() => changeTab('signin')}>Back to login</button> : <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Please wait…' : tab === 'signin' ? 'Sign in' : tab === 'signup' ? 'Create account' : tab === 'recover' ? 'Email reset link' : 'Save new password'}
            </button>
          </div>

          {tab === 'signin' && <button type="button" className="auth-text-action" onClick={() => changeTab('recover')}><KeyRound size={14} /> Forgot your password?</button>}
          {tab === 'signup' && successMessage && <button type="button" className="auth-text-action" onClick={() => void handleResendConfirmation()} disabled={loading}><RotateCcw size={14} /> Send confirmation again</button>}
        </form>
      </div>
      {showLegalModal && <LegalModal onClose={() => setShowLegalModal(false)} />}
    </div>
  );
}

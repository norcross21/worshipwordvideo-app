import { useState } from 'react';
import { KeyRound, Mail, X, LogIn, UserPlus, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  onClose: () => void;
  initialTab?: 'signin' | 'signup';
}

export function AuthModal({ onClose, initialTab = 'signin' }: AuthModalProps) {
  const [tab, setTab] = useState<'signin' | 'signup'>(initialTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const { signInWithEmail, signUpWithEmail } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      if (tab === 'signin') {
        const { error } = await signInWithEmail(email, password);
        if (error) {
          setError(error.message);
        } else {
          onClose();
        }
      } else {
        const { error, needsEmailVerification } = await signUpWithEmail(email, password);
        if (error) {
          setError(error.message);
        } else if (needsEmailVerification) {
          setSuccessMessage('Account created! Please check your email to confirm your subscription before signing in.');
        } else {
          setSuccessMessage('Account created and signed in successfully!');
          setTimeout(() => onClose(), 1500);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-card--auth" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="auth-tab-switch">
            <button
              type="button"
              className={`auth-tab-btn ${tab === 'signin' ? 'is-active' : ''}`}
              onClick={() => { setTab('signin'); setError(''); setSuccessMessage(''); }}
            >
              <LogIn size={15} /> Log In
            </button>
            <button
              type="button"
              className={`auth-tab-btn ${tab === 'signup' ? 'is-active' : ''}`}
              onClick={() => { setTab('signup'); setError(''); setSuccessMessage(''); }}
            >
              <UserPlus size={15} /> Create Account
            </button>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="auth-modal__intro">
            <h3>{tab === 'signin' ? 'Welcome Back to Worship Word Video' : 'Create Your Free Leader Account'}</h3>
            <p>
              {tab === 'signin'
                ? 'Sign in to access your saved service playlists across devices.'
                : 'Create an account to save, organize, and export your worship video playlists to the cloud.'}
            </p>
          </div>

          {error && (
            <div className="auth-alert auth-alert--error" role="alert">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="auth-alert auth-alert--success" role="status">
              <CheckCircle2 size={16} /> {successMessage}
            </div>
          )}

          <div className="form-group">
            <label>Email Address</label>
            <div className="input-with-icon">
              <Mail size={16} className="input-icon" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@church.org"
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="input-with-icon">
              <KeyRound size={16} className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                className="input-eye-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="modal-actions modal-actions--auth">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading
                ? 'Processing...'
                : tab === 'signin'
                ? 'Sign In'
                : 'Register Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

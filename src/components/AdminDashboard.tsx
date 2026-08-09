import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock3,
  Download,
  Heart,
  ListMusic,
  MailPlus,
  RefreshCw,
  Search,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase, supabaseErrorMessage } from '../lib/supabase';

interface AdminMemberRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
  church_name: string | null;
  created_at: string;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  terms_accepted_at: string | null;
  kairos_marketing_opt_in: boolean;
  kairos_marketing_opt_in_at: string | null;
  saved_playlist_count: number;
}

function formatDate(value: string | null): string {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function csvCell(value: string | number | boolean | null): string {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

export function AdminDashboard() {
  const { adminRole, adminLoading, session } = useAuth();
  const [members, setMembers] = useState<AdminMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'confirmed' | 'awaiting' | 'kairos-emails' | 'recent'>('all');
  const [inviteName, setInviteName] = useState('');
  const [inviteChurch, setInviteChurch] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteExpected, setInviteExpected] = useState(false);
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadMembers = async () => {
    if (!supabase || adminRole !== 'master_admin') return;
    setLoading(true);
    setError('');
    const { data, error: loadError } = await supabase
      .from('app_users')
      .select('user_id,email,display_name,church_name,created_at,email_confirmed_at,last_sign_in_at,terms_accepted_at,kairos_marketing_opt_in,kairos_marketing_opt_in_at,saved_playlist_count')
      .order('created_at', { ascending: false });
    if (loadError) setError(supabaseErrorMessage(loadError, 'Unable to load members.'));
    else setMembers((data ?? []) as AdminMemberRow[]);
    setLoading(false);
  };

  useEffect(() => { void loadMembers(); }, [adminRole]);

  const confirmedCount = useMemo(() => members.filter((item) => item.email_confirmed_at).length, [members]);
  const marketingCount = useMemo(() => members.filter((item) => item.kairos_marketing_opt_in).length, [members]);
  const recentCount = useMemo(() => {
    const threshold = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return members.filter((item) => item.last_sign_in_at && new Date(item.last_sign_in_at).getTime() >= threshold).length;
  }, [members]);
  const playlistCount = useMemo(() => members.reduce((sum, item) => sum + Number(item.saved_playlist_count || 0), 0), [members]);
  const visibleMembers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const recentThreshold = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return members.filter((item) => {
      if (needle && !`${item.display_name ?? ''} ${item.church_name ?? ''} ${item.email ?? ''}`.toLowerCase().includes(needle)) return false;
      if (status === 'confirmed' && !item.email_confirmed_at) return false;
      if (status === 'awaiting' && item.email_confirmed_at) return false;
      if (status === 'kairos-emails' && !item.kairos_marketing_opt_in) return false;
      if (status === 'recent' && (!item.last_sign_in_at || new Date(item.last_sign_in_at).getTime() < recentThreshold)) return false;
      return true;
    });
  }, [members, query, status]);

  const downloadMembers = () => {
    const headings = ['Display name', 'Church', 'Email', 'Email confirmed', 'Joined', 'Last sign-in', 'Terms accepted', 'Kairos email opt-in', 'Kairos opt-in recorded', 'Saved services'];
    const rows = visibleMembers.map((item) => [
      item.display_name,
      item.church_name,
      item.email,
      item.email_confirmed_at,
      item.created_at,
      item.last_sign_in_at,
      item.terms_accepted_at,
      item.kairos_marketing_opt_in,
      item.kairos_marketing_opt_in_at,
      item.saved_playlist_count,
    ]);
    const csv = [headings, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `worship-word-video-members-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const inviteMember = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInviteMessage(null);

    if (!session?.access_token) {
      setInviteMessage({ type: 'error', text: 'Your secure administrator session has expired. Please sign in again.' });
      return;
    }

    if (!inviteExpected) {
      setInviteMessage({ type: 'error', text: 'Please confirm that this person expects the invitation.' });
      return;
    }

    setInviteSending(true);
    try {
      const response = await fetch('/api/admin/invite-member', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          displayName: inviteName,
          churchName: inviteChurch,
          email: inviteEmail,
        }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(result.error || 'The invitation could not be sent.');
      }

      setInviteMessage({ type: 'success', text: result.message || `Invitation sent to ${inviteEmail.trim().toLowerCase()}.` });
      setInviteName('');
      setInviteChurch('');
      setInviteEmail('');
      setInviteExpected(false);
      await loadMembers();
    } catch (inviteError) {
      setInviteMessage({ type: 'error', text: supabaseErrorMessage(inviteError, 'The invitation could not be sent.') });
    } finally {
      setInviteSending(false);
    }
  };

  if (adminLoading) return <div className="admin-state">Checking administrator access…</div>;
  if (adminRole !== 'master_admin') return <div className="admin-state"><ShieldCheck size={32} /><h2>Administrator access required</h2><p>This area is protected by your verified account role.</p></div>;

  return (
    <section className="admin-dashboard" aria-labelledby="admin-title">
      <div className="admin-dashboard__heading">
        <div><span className="eyebrow"><ShieldCheck size={14} /> Master administrator</span><h2 id="admin-title">Member management</h2><p>Protected account oversight for stephen@kairoshousing.org.uk. Passwords and login secrets are never available here.</p></div>
        <div className="admin-dashboard__actions">
          <button type="button" className="btn-secondary" onClick={downloadMembers} disabled={!visibleMembers.length}><Download size={15} /> Export</button>
          <button type="button" className="btn-secondary" onClick={() => void loadMembers()} disabled={loading}><RefreshCw size={15} /> Refresh</button>
        </div>
      </div>

      <div className="admin-summary">
        <article><UsersRound size={20} /><strong>{members.length}</strong><span>Total members</span></article>
        <article><CheckCircle2 size={20} /><strong>{confirmedCount}</strong><span>Email confirmed</span></article>
        <article><Activity size={20} /><strong>{recentCount}</strong><span>Active in 30 days</span></article>
        <article><ListMusic size={20} /><strong>{playlistCount}</strong><span>Saved services</span></article>
        <article><Heart size={20} /><strong>{marketingCount}</strong><span>Kairos email opt-ins</span></article>
      </div>

      <section className="admin-invite" aria-labelledby="admin-invite-title">
        <div className="admin-invite__intro">
          <span className="eyebrow"><MailPlus size={14} /> Account invitation</span>
          <h3 id="admin-invite-title">Invite a member</h3>
          <p>The person receives a secure link to set their own password. They must then accept the account terms and make their own optional Kairos email choice.</p>
          <span className="admin-invite__delivery-note">Invitations are sent securely through the Worship Word Video account email service. This facility is for expected, individual invitations only.</span>
        </div>
        <form className="admin-invite__form" onSubmit={inviteMember}>
          <div className="admin-invite__fields">
            <label><span>Name</span><input required maxLength={80} value={inviteName} onChange={(event) => setInviteName(event.target.value)} placeholder="Member's name" autoComplete="off" /></label>
            <label><span>Email</span><input required type="email" maxLength={254} value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="name@church.org" autoComplete="off" /></label>
            <label><span>Church or organisation <small>(optional)</small></span><input maxLength={120} value={inviteChurch} onChange={(event) => setInviteChurch(event.target.value)} placeholder="Church or organisation" autoComplete="off" /></label>
          </div>
          <label className="admin-invite__consent">
            <input type="checkbox" checked={inviteExpected} onChange={(event) => setInviteExpected(event.target.checked)} required />
            <span>I confirm this person asked to join or otherwise expects this account invitation. This must not be used for unsolicited or bulk email.</span>
          </label>
          {inviteMessage && <div className={`auth-alert auth-alert--${inviteMessage.type}`} role={inviteMessage.type === 'error' ? 'alert' : 'status'}>{inviteMessage.text}</div>}
          <button type="submit" className="btn-primary admin-invite__submit" disabled={inviteSending}>{inviteSending ? 'Sending invitation…' : <><MailPlus size={15} /> Send secure invitation</>}</button>
        </form>
      </section>

      {error && <div className="auth-alert auth-alert--error" role="alert">{error}</div>}
      <div className="admin-tools">
        <label className="admin-search"><Search size={16} /><span className="sr-only">Search members</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, church or email…" /></label>
        <label className="admin-status-filter"><span className="sr-only">Member status</span><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">All members</option><option value="confirmed">Email confirmed</option><option value="awaiting">Awaiting confirmation</option><option value="recent">Active in 30 days</option><option value="kairos-emails">Kairos email opt-in</option></select></label>
        <span className="admin-tools__count">Showing {visibleMembers.length} of {members.length}</span>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Member</th><th>Email status</th><th>Kairos emails</th><th>Saved</th><th>Joined</th><th>Last sign-in</th></tr></thead>
          <tbody>
            {visibleMembers.map((item) => (
              <tr key={item.user_id}>
                <td><strong>{item.display_name || item.email || 'Unnamed member'}</strong>{item.church_name && <span>{item.church_name}</span>}<small>{item.email}</small></td>
                <td>{item.email_confirmed_at ? <span className="status-ok"><CheckCircle2 size={13} /> Confirmed</span> : <span className="status-wait"><Clock3 size={13} /> Awaiting</span>}</td>
                <td>{item.kairos_marketing_opt_in ? <span className="status-ok"><Heart size={13} /> Opted in</span> : <span className="status-neutral">Not opted in</span>}</td>
                <td>{item.saved_playlist_count}</td>
                <td>{formatDate(item.created_at)}</td>
                <td>{formatDate(item.last_sign_in_at)}</td>
              </tr>
            ))}
            {!loading && visibleMembers.length === 0 && <tr><td colSpan={6}>{members.length ? 'No members match these filters.' : 'No members have registered yet.'}</td></tr>}
          </tbody>
        </table>
        {loading && <div className="admin-table__loading">Loading members…</div>}
      </div>
      <p className="admin-safety-note">This first management release is deliberately non-destructive. Account deletion or suspension should only be added with multi-factor authentication and an audit trail.</p>
    </section>
  );
}

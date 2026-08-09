import { createClient } from '@supabase/supabase-js';

const MASTER_ADMIN_EMAIL = 'stephen@kairoshousing.org.uk';
const APP_URL = 'https://www.worshipwordvideo.org';

interface InviteRequestBody {
  displayName?: unknown;
  churchName?: unknown;
  email?: unknown;
}

function json(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'",
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function requiredText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new Error(`${label} is too long.`);
  return trimmed;
}

function optionalText(value: unknown, label: string, maxLength: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new Error(`${label} is not valid.`);
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) throw new Error(`${label} is too long.`);
  return trimmed;
}

function normaliseEmail(value: unknown): string {
  const email = requiredText(value, 'Email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  return email;
}

export async function POST(request: Request): Promise<Response> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    return json({ error: 'Member invitations are prepared but not active yet. Complete the approved email and secure server setup first.' }, 503);
  }

  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get('origin');
  if (origin && origin !== requestOrigin && origin !== APP_URL && origin !== 'https://worshipwordvideo.org') {
    return json({ error: 'This invitation request was not accepted.' }, 403);
  }

  const authorization = request.headers.get('authorization');
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return json({ error: 'Administrator sign-in is required.' }, 401);

  const adminClient = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });

  const { data: userData, error: userError } = await adminClient.auth.getUser(accessToken);
  const currentUser = userData.user;
  if (userError || !currentUser) return json({ error: 'Your administrator session is not valid. Please sign in again.' }, 401);

  const { data: adminRole, error: roleError } = await adminClient
    .from('app_admins')
    .select('role')
    .eq('user_id', currentUser.id)
    .eq('role', 'master_admin')
    .maybeSingle();

  if (roleError) {
    console.error('Member invitation role lookup failed', { code: roleError.code });
    return json({ error: 'Administrator access could not be verified.' }, 500);
  }

  if (currentUser.email?.trim().toLowerCase() !== MASTER_ADMIN_EMAIL || adminRole?.role !== 'master_admin') {
    return json({ error: 'Master administrator access is required.' }, 403);
  }

  let body: InviteRequestBody;
  try {
    body = await request.json() as InviteRequestBody;
  } catch {
    return json({ error: 'The invitation details were not valid.' }, 400);
  }

  let displayName: string;
  let churchName: string | null;
  let email: string;
  try {
    displayName = requiredText(body.displayName, 'Name', 80);
    churchName = optionalText(body.churchName, 'Church or organisation', 120);
    email = normaliseEmail(body.email);
  } catch (validationError) {
    return json({ error: validationError instanceof Error ? validationError.message : 'Check the invitation details.' }, 400);
  }

  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${APP_URL}/?invite=1`,
    data: {
      display_name: displayName,
      church_name: churchName,
      terms_accepted: false,
      account_emails_acknowledged: false,
      kairos_marketing_opt_in: false,
      signup_source: 'master_admin_invite',
    },
  });

  if (inviteError) {
    console.error('Member invitation failed', { status: inviteError.status, code: inviteError.code });
    return json({ error: inviteError.message || 'The invitation could not be sent.' }, inviteError.status === 422 ? 409 : 502);
  }

  console.info('Member invitation created', { invitedUserId: invited.user?.id, invitedBy: currentUser.id });
  return json({ message: `Secure invitation sent to ${email}.` }, 201);
}

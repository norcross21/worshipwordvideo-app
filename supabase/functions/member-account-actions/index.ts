import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const MASTER_ADMIN_EMAIL = 'stephen@kairoshousing.org.uk';
const APP_URL = 'https://www.worshipwordvideo.org';
const ALLOWED_ORIGINS = new Set([
  APP_URL,
  'https://worshipwordvideo.org',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

function response(request: Request, body: Record<string, unknown>, status = 200): Response {
  const origin = request.headers.get('origin') ?? APP_URL;
  return Response.json(body, {
    status,
    headers: {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : APP_URL,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Cache-Control': 'no-store',
      'Vary': 'Origin',
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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return response(request, {}, 204);
  if (request.method !== 'POST') return response(request, { error: 'Method not allowed.' }, 405);
  const origin = request.headers.get('origin');
  if (origin && !ALLOWED_ORIGINS.has(origin)) return response(request, { error: 'This request was not accepted.' }, 403);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return response(request, { error: 'Account administration is temporarily unavailable.' }, 503);
  const accessToken = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return response(request, { error: 'Please sign in again.' }, 401);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const { data: userData, error: userError } = await adminClient.auth.getUser(accessToken);
  const currentUser = userData.user;
  if (userError || !currentUser?.email) return response(request, { error: 'Your session is not valid. Please sign in again.' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return response(request, { error: 'The request details were not valid.' }, 400);
  }
  const action = body.action;

  if (action === 'delete-own-account') {
    if (typeof body.email !== 'string' || body.email.trim().toLowerCase() !== currentUser.email.toLowerCase()) {
      return response(request, { error: 'Enter the email address for this account exactly.' }, 400);
    }
    if (body.confirmation !== 'DELETE MY ACCOUNT') return response(request, { error: 'Enter DELETE MY ACCOUNT to confirm.' }, 400);
    const { data: role, error: roleError } = await adminClient.from('app_admins').select('role').eq('user_id', currentUser.id).maybeSingle();
    if (roleError) return response(request, { error: 'Account permissions could not be checked.' }, 500);
    if (role?.role === 'master_admin') return response(request, { error: 'The master administrator account cannot be deleted here.' }, 403);
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(currentUser.id);
    if (deleteError) return response(request, { error: 'The account could not be deleted. Please contact support.' }, 502);
    return response(request, { message: 'Your account and saved services were deleted.' });
  }

  const { data: role, error: roleError } = await adminClient
    .from('app_admins')
    .select('role')
    .eq('user_id', currentUser.id)
    .eq('role', 'master_admin')
    .maybeSingle();
  if (roleError) return response(request, { error: 'Administrator access could not be verified.' }, 500);
  if (currentUser.email.toLowerCase() !== MASTER_ADMIN_EMAIL || role?.role !== 'master_admin') {
    return response(request, { error: 'Master administrator access is required.' }, 403);
  }

  if (action === 'invite-member') {
    let displayName: string;
    let churchName: string | null;
    let email: string;
    try {
      displayName = requiredText(body.displayName, 'Name', 80);
      churchName = optionalText(body.churchName, 'Church or organisation', 120);
      email = normaliseEmail(body.email);
    } catch (validationError) {
      return response(request, { error: validationError instanceof Error ? validationError.message : 'Check the invitation details.' }, 400);
    }
    const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
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
    if (inviteError) return response(request, { error: inviteError.message || 'The invitation could not be sent.' }, inviteError.status === 422 ? 409 : 502);
    return response(request, { message: `Secure invitation sent to ${email}.` }, 201);
  }

  if (action === 'delete-member') {
    const assurance = await adminClient.auth.mfa.getAuthenticatorAssuranceLevel(accessToken);
    if (assurance.error) return response(request, { error: 'Authenticator verification could not be checked.' }, 500);
    if (assurance.data.currentLevel !== 'aal2') return response(request, { error: 'Verify with your authenticator app before deleting a member.' }, 403);
    const targetUserId = typeof body.targetUserId === 'string' ? body.targetUserId.trim() : '';
    const targetEmail = typeof body.targetEmail === 'string' ? body.targetEmail.trim().toLowerCase() : '';
    if (!/^[0-9a-f-]{36}$/i.test(targetUserId) || !targetEmail || body.confirmation !== targetEmail) {
      return response(request, { error: 'Enter the member email exactly to confirm deletion.' }, 400);
    }
    if (targetUserId === currentUser.id || targetEmail === MASTER_ADMIN_EMAIL) return response(request, { error: 'The master administrator account cannot be deleted.' }, 403);
    const { data: target, error: targetError } = await adminClient.from('app_users').select('user_id,email,saved_playlist_count').eq('user_id', targetUserId).maybeSingle();
    if (targetError) return response(request, { error: 'The member could not be checked.' }, 500);
    if (!target || target.email?.toLowerCase() !== targetEmail) return response(request, { error: 'The selected member no longer matches that email.' }, 409);
    const { error: auditError } = await adminClient.from('admin_member_actions').insert({
      actor_user_id: currentUser.id,
      action: 'delete_member',
      target_user_id: targetUserId,
      target_email: targetEmail,
      target_playlist_count: target.saved_playlist_count ?? 0,
    });
    if (auditError) return response(request, { error: 'The deletion was stopped because its audit record could not be saved.' }, 500);
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetUserId);
    if (deleteError) return response(request, { error: 'The member account could not be deleted.' }, 502);
    return response(request, { message: `Deleted ${targetEmail} and their saved services.` });
  }

  return response(request, { error: 'Unknown account action.' }, 400);
});

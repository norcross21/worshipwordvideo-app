import { supabase } from './supabase';

interface ActionResult {
  message?: string;
  error?: string;
}

export async function runMemberAccountAction(body: Record<string, unknown>): Promise<string> {
  if (!supabase) throw new Error('Account services are not configured.');
  const { data, error } = await supabase.functions.invoke<ActionResult>('member-account-actions', { body });
  if (error) {
    let detail = error.message;
    if ('context' in error && error.context instanceof Response) {
      try {
        const responseBody = await error.context.clone().json() as ActionResult;
        detail = responseBody.error || detail;
      } catch {
        // Keep the safe function error when the response has no JSON body.
      }
    }
    throw new Error(detail || 'The account action could not be completed.');
  }
  if (data?.error) throw new Error(data.error);
  return data?.message ?? 'Completed.';
}

import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL as string;
const anon = process.env.VITE_SUPABASE_ANON_KEY as string;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;

async function getUserFromAuthHeader(event: any) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : '';
  if (!token) return null;
  const supabase = createClient(url, anon);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

async function isAdmin(userId: string): Promise<boolean> {
  const supabase = createClient(url, service || anon);
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return false;
  return data?.role === 'admin';
}

export const handler = async (event: any) => {
  try {
    if (event.httpMethod === 'GET') {
      // Public read for login toggles: fetch via service/anon (service preferred)
      const supabase = createClient(url, service || anon);
      const { data, error } = await supabase
        .from('app_settings')
        .select('registration_open, google_oauth_open')
        .limit(1)
        .maybeSingle();
      if (error) return { statusCode: 200, body: JSON.stringify({ registration_open: true, google_oauth_open: true }) };
      return { statusCode: 200, body: JSON.stringify(data || { registration_open: true, google_oauth_open: true }) };
    }

    if (event.httpMethod === 'POST') {
      const user = await getUserFromAuthHeader(event);
      if (!user) return { statusCode: 401, body: 'Unauthorized' };
      if (!(await isAdmin(user.id))) return { statusCode: 403, body: 'Forbidden' };

      const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
      const registration_open = typeof body.registration_open === 'boolean' ? body.registration_open : undefined;
      const google_oauth_open = typeof body.google_oauth_open === 'boolean' ? body.google_oauth_open : undefined;
      if (registration_open === undefined && google_oauth_open === undefined) {
        return { statusCode: 400, body: 'No toggles provided' };
      }
      const supabase = createClient(url, service || anon);
      // Upsert single row; use a constant id
      const up = {
        id: '00000000-0000-0000-0000-000000000001',
        registration_open,
        google_oauth_open,
        updated_at: new Date().toISOString(),
      } as any;
      const { error } = await supabase.from('app_settings').upsert(up, { onConflict: 'id' });
      if (error) return { statusCode: 500, body: error.message };
      return { statusCode: 200, body: 'OK' };
    }

    return { statusCode: 405, body: 'Method Not Allowed' };
  } catch (e: any) {
    return { statusCode: 500, body: e?.message || 'Server error' };
  }
};


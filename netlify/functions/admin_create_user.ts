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
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.role === 'admin';
}

export const handler = async (event: any) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
    if (!service) return { statusCode: 500, body: 'Missing service role key' };

    const me = await getUserFromAuthHeader(event);
    if (!me) return { statusCode: 401, body: 'Unauthorized' };
    if (!(await isAdmin(me.id))) return { statusCode: 403, body: 'Forbidden' };

    const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
    const email = String(body.email || '').trim();
    const password = body.password ? String(body.password) : undefined;
    const sendInvite = Boolean(body.invite);
    const daily_limit = Number.isFinite(Number(body.daily_limit)) ? Number(body.daily_limit) : undefined;
    if (!email) return { statusCode: 400, body: 'email required' };

    const admin = createClient(url, service);

    let createdUserId: string | undefined;
    if (sendInvite) {
      // send magic link
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        // redirectTo can be provided if needed
      } as any);
      if (error) return { statusCode: 500, body: error.message };
      createdUserId = (data as any)?.user?.id;
    } else {
      if (!password) return { statusCode: 400, body: 'password required without invite' };
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      } as any);
      if (error) return { statusCode: 500, body: error.message };
      createdUserId = (data as any)?.user?.id;
    }

    if (!createdUserId) return { statusCode: 500, body: 'User creation failed' };

    // set default role and quota
    const { error: roleErr } = await admin.from('user_roles').upsert({ user_id: createdUserId, role: 'user' }, { onConflict: 'user_id' });
    if (roleErr) return { statusCode: 500, body: roleErr.message };

    if (daily_limit !== undefined) {
      const { error: qErr } = await admin
        .from('apify_quotas')
        .upsert({ user_id: createdUserId, daily_limit, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (qErr) return { statusCode: 500, body: qErr.message };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: createdUserId, email, daily_limit }),
    };
  } catch (e: any) {
    return { statusCode: 500, body: e?.message || 'Server error' };
  }
};


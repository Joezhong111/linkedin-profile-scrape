import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL as string;
const anon = process.env.VITE_SUPABASE_ANON_KEY as string;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getUserFromAuthHeader(event: any) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : '';
  if (!token) return null;
  const supabase = createClient(url, anon);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return { id: data.user.id };
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
    const me = await getUserFromAuthHeader(event);
    if (!me) return { statusCode: 401, body: 'Unauthorized' };
    const admin = await isAdmin(me.id);

    if (event.httpMethod === 'GET') {
      const day = (event.queryStringParameters?.day as string) || utcDay();
      const qUser = event.queryStringParameters?.user_id as string | undefined;
      const supabase = createClient(url, (admin && service) ? service : anon);

      if (qUser) {
        const { data: quota } = await supabase
          .from('apify_quotas')
          .select('user_id,daily_limit')
          .eq('user_id', qUser)
          .maybeSingle();
        const { data: usage } = await supabase
          .from('apify_usage')
          .select('used_count')
          .eq('user_id', qUser)
          .eq('day', day)
          .maybeSingle();
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: qUser,
            daily_limit: quota?.daily_limit ?? 0,
            used_count: usage?.used_count ?? 0,
            day,
          }),
        };
      }

      // list first N users with quotas (admin only)
      if (!admin) return { statusCode: 403, body: 'Forbidden' };
      const { data: quotas } = await supabase
        .from('apify_quotas')
        .select('user_id,daily_limit')
        .limit(200);
      const result: any[] = [];
      for (const q of quotas || []) {
        const { data: u } = await supabase
          .from('apify_usage')
          .select('used_count')
          .eq('user_id', q.user_id)
          .eq('day', day)
          .maybeSingle();
        result.push({ user_id: q.user_id, daily_limit: q.daily_limit, used_count: u?.used_count ?? 0, day });
      }
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result) };
    }

    if (event.httpMethod === 'POST') {
      if (!admin) return { statusCode: 403, body: 'Forbidden' };
      const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
      const user_id = body.user_id as string;
      const daily_limit = Number(body.daily_limit);
      if (!user_id || !Number.isFinite(daily_limit)) return { statusCode: 400, body: 'user_id and daily_limit required' };
      const supabase = createClient(url, service || anon);
      const { error } = await supabase.from('apify_quotas').upsert({ user_id, daily_limit, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (error) return { statusCode: 500, body: error.message };
      return { statusCode: 200, body: 'OK' };
    }

    return { statusCode: 405, body: 'Method Not Allowed' };
  } catch (e: any) {
    return { statusCode: 500, body: e?.message || 'Server error' };
  }
};


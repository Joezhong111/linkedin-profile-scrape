import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL as string;
const anon = process.env.VITE_SUPABASE_ANON_KEY as string;

export const handler = async (event: any) => {
  try {
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : '';

    if (!token) return { statusCode: 401, body: 'Missing Authorization' };

    const supabaseAuth = createClient(url, anon);
    const { data: userRes, error } = await supabaseAuth.auth.getUser(token);
    if (error || !userRes?.user) return { statusCode: 401, body: 'Invalid token' };

    const userId = userRes.user.id;

    // Query role for this user (RLS allows reading own record by policy)
    const supabase = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: ur, error: roleErr } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();
    if (roleErr) return { statusCode: 500, body: roleErr.message };

    const role = ur?.role || 'user';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, role, isAdmin: role === 'admin' }),
    };
  } catch (e: any) {
    return { statusCode: 500, body: e?.message || 'Server error' };
  }
};


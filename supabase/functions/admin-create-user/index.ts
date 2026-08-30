// ============================================
// EDGE FUNCTION: admin-create-user
// Dipanggil dari js/admin.js (supabase.functions.invoke).
//
// Kenapa harus lewat Edge Function, bukan langsung dari browser?
// Membuat auth user (supabase.auth.admin.createUser) butuh SERVICE ROLE
// KEY, yang punya akses penuh bypass RLS. Key itu TIDAK BOLEH pernah
// dikirim ke browser/frontend (siapapun yang buka DevTools bisa
// mencurinya). Jadi service role key hanya hidup di sini, di server
// Supabase (Edge Function), sebagai secret.
//
// Alur:
//  1. Cek caller (yang manggil function ini) adalah developer yang login
//     & aktif — pakai JWT yang otomatis disisipkan Supabase client di
//     header Authorization.
//  2. Kalau valid, baru pakai service role client untuk benar-benar
//     membuat user baru di auth.users.
//  3. Trigger on_auth_user_created (lihat SQL Schema.sql) otomatis bikin
//     baris di public.profiles dengan role='customer'. Kalau developer
//     minta role='developer', kita update baris itu setelahnya.
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // ---------- 1. Verifikasi caller = developer yang aktif ----------
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace('Bearer ', '');
    if (!jwt) {
      return json({ error: 'Missing auth token.' }, 401);
    }

    // Client "atas nama caller" — pakai token si pemanggil, bukan service role.
    // Ini supaya getUser() benar-benar validasi token tsb ke Supabase Auth.
    const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser }, error: callerErr } = await callerClient.auth.getUser(jwt);
    if (callerErr || !callerUser) {
      return json({ error: 'Invalid or expired session. Please log in again.' }, 401);
    }

    // Service role client — dipakai untuk semua operasi privileged di bawah ini.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: callerProfile, error: profErr } = await admin
      .from('profiles').select('role, status').eq('id', callerUser.id).single();

    if (profErr || !callerProfile) {
      return json({ error: 'Caller profile not found.' }, 403);
    }
    if (callerProfile.role !== 'developer') {
      return json({ error: 'Forbidden: developer only.' }, 403);
    }
    if (callerProfile.status === 'locked') {
      return json({ error: 'Forbidden: your account is locked.' }, 403);
    }

    // ---------- 2. Validasi input ----------
    const body = await req.json();
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';
    const full_name = (body.full_name || '').trim();
    const role = body.role === 'developer' ? 'developer' : 'customer';

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return json({ error: 'Invalid email address.' }, 400);
    }
    if (!password || password.length < 6) {
      return json({ error: 'Password must be at least 6 characters.' }, 400);
    }

    // ---------- 3. Buat user di auth.users ----------
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // langsung dianggap terverifikasi (tidak ada alur signup publik)
      user_metadata: { full_name },
    });

    if (createErr) {
      // Pesan Supabase untuk email sudah terdaftar biasanya cukup jelas,
      // diteruskan apa adanya ke UI admin (bukan ke calon user, jadi aman).
      return json({ error: createErr.message }, 400);
    }

    const newUserId = created.user.id;

    // ---------- 4. Lengkapi profile ----------
    // Trigger on_auth_user_created sudah bikin baris profiles (role default
    // 'customer', status 'active'). Kita update full_name, dan role kalau
    // developer memilih 'developer'.
    const { error: updateErr } = await admin
      .from('profiles')
      .update({ full_name, role })
      .eq('id', newUserId);

    if (updateErr) {
      // User auth-nya sudah terlanjur dibuat; jangan gagal total, cukup
      // laporkan supaya admin tahu perlu perbaikan manual.
      return json({
        warning: `User created but profile update failed: ${updateErr.message}`,
        user_id: newUserId,
      }, 200);
    }

    return json({ user_id: newUserId, email }, 200);

  } catch (e) {
    return json({ error: e?.message || 'Unexpected server error.' }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

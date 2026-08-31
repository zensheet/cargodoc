// ============================================
// KONFIGURASI — ganti sesuai project Supabase Anda
// ============================================
// Dashboard Supabase -> Settings -> API

const SUPABASE_URL = 'https://ynuoymtktlolhdwmphze.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ntXGp__JVOsbBadLv_HVGQ_frRuuZbh'; // ANON/PUBLIC key — BUKAN service_role!

// Hanya anon key di frontend. Service role key TIDAK PERNAH diletakkan di sini
// (sesuai PRD §Security: RLS + anon key-only).

// ---------- KONTAK ADMIN (PRD §74 — Account Activation popup) ----------
// Satu tempat saja -- dipakai js/guard.js (showActivationModal) supaya
// gampang ganti nomor/email tanpa cari-cari di banyak file.
const SUPPORT_WHATSAPP_DISPLAY = '0812-9065-0963'; // format tampil ke user
const SUPPORT_WHATSAPP_INTL = '6281290650963';     // format wa.me (62 = kode negara, tanpa 0 di depan)
const SUPPORT_EMAIL = 'admin@zensheet.my.id';

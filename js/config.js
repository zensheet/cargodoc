// ============================================
// KONFIGURASI — ganti sesuai project Supabase Anda
// ============================================
// Dashboard Supabase -> Settings -> API

const SUPABASE_URL = 'https://XXXXXXXX.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOi...'; // ANON/PUBLIC key — BUKAN service_role!

// Hanya anon key di frontend. Service role key TIDAK PERNAH diletakkan di sini
// (sesuai PRD §Security: RLS + anon key-only).

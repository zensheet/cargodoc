# Deploy `admin-create-user`

Function ini yang benar-benar membuat akun client baru (dipanggil tombol
"Create User" di `admin.html`). Harus di-deploy ke Supabase dulu sebelum
tombolnya berfungsi — tidak bisa cukup upload file HTML/JS saja.

## 1. Install Supabase CLI (sekali saja)

```bash
npm install -g supabase
```

## 2. Login & hubungkan ke project

```bash
supabase login
supabase link --project-ref <PROJECT_REF>
```

`<PROJECT_REF>` dilihat di URL dashboard Supabase kamu, contoh:
`https://supabase.com/dashboard/project/ynuoymtktlolhdwmphze` → project ref
= `ynuoymtktlolhdwmphze` (sama dengan subdomain di `SUPABASE_URL` pada
`js/config.js`).

## 3. Deploy function

Dari root folder project (folder yang berisi `supabase/`):

```bash
supabase functions deploy admin-create-user
```

## 4. Pastikan secret service role tersedia

Supabase otomatis menyediakan `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY`
sebagai env var built-in untuk semua Edge Function — **tidak perlu** kamu set
manual. Service role key ini beda dari anon key yang dipakai di
`js/config.js`; jangan pernah copy service role key itu ke file JS
manapun di frontend.

Kalau mau cek nilainya (opsional, untuk debug), lihat di:
Dashboard → Project Settings → API → `service_role` (secret).

## 5. Test

1. Login ke `index.html` sebagai developer → otomatis ke `admin.html`.
2. Isi form "Create New User", submit.
3. Kalau sukses: muncul "✅ User created." dan baris baru muncul di tabel.
4. Coba logout, login pakai email+password yang baru dibuat → harus masuk
   ke `app.html` (kalau role customer) sesuai fitur yang sudah kamu toggle.

## Troubleshooting

- **"Forbidden: developer only."** → akun yang dipakai login ke admin.html
  bukan role `developer` di tabel `profiles`. Cek/ubah manual lewat
  Supabase Table Editor untuk akun developer pertama (chicken-and-egg:
  akun developer pertama harus dibuat manual via Dashboard → Authentication
  → Add User, lalu update `profiles.role` jadi `'developer'`).
- **"Edge Function returned a non-2xx status code" tanpa detail** → cek log
  function: `supabase functions logs admin-create-user`.
- **CORS error di console browser** → pastikan deploy ulang setelah edit
  function; header CORS sudah di-handle di `index.ts`.

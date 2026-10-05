# Maju Jaya Grosir

Website pembeli, piutang, pembayaran, dan pengiriman. Frontend statis di GitHub Pages; autentikasi serta data di Supabase.

## Login wajib

- Layar login menggunakan username dan password. Username `majujaya` dipetakan secara internal ke `majujaya@accounts.majujaya.invalid`; email internal tidak ditampilkan.
- Tidak ada pendaftaran mandiri. Akun harus dibuat di Supabase Auth dan dimasukkan ke tabel `approved_accounts` oleh pengelola.
- Setiap akun hanya mengakses data miliknya melalui RLS. Belum ada berbagi data antar-akun/staf.
- Reset password dikelola admin; email internal bukan kotak email untuk menerima tautan.
- Tanpa konfigurasi Supabase, sistem tetap terkunci. Tidak ada fallback data lokal.

## Setup Supabase baru

1. Buat proyek, simpan password database, aktifkan RLS otomatis.
2. Jalankan `supabase/schema.sql` sekali pada proyek baru melalui SQL Editor. Script transaksional; tidak menghapus tabel yang sudah ada.
3. Authentication → konfigurasi: nonaktifkan **Allow new users to sign up** dan anonymous sign-ins.
4. Buat user Auth `majujaya@accounts.majujaya.invalid` dengan password yang dimasukkan sendiri dan konfirmasi email otomatis.
5. Tambahkan UUID user itu ke `public.approved_accounts` (enabled=true), hanya dari dashboard/SQL Editor. Klien tidak dapat mengubah daftar ini.
6. Isi `dist/config.js` dengan Project URL dan publishable/anon key. Jangan pernah memasukkan service-role key, password, atau access token.
7. Set Site URL ke URL GitHub Pages. Login memakai password, tanpa OAuth redirect.

## Deployment

Repository baru khusus aplikasi ini. Workflow `.github/workflows/pages.yml` menguji kode lalu menerbitkan `dist/` ke GitHub Pages. Settings → Pages → Source: GitHub Actions.

## Data lama

Data dari versi lokal masih ada pada browser/origin lama. Tidak otomatis dikirim ke server. Ekspor cadangan JSON dari versi lokal sebelum migrasi. Jangan commit data pelanggan atau cadangan ke repository publik. Migrasi membutuhkan pemetaan akun pemilik serta pelengkapan data lama dan dilakukan terpisah.

## Pengujian

`node tests/ledger.cjs` memeriksa logika nominal, cicilan, limit, tanggal, status pengiriman, total historis, dan filter menggunakan mock penyimpanan cloud. `node tests/cloud.cjs` menguji autentikasi/penyimpanan dengan mock SDK bila tersedia. Pengujian database RLS dilakukan terpisah; lolos tes UI bukan bukti kebijakan server sudah dipasang.

Jalankan `python3 -m http.server 8768 --directory dist` untuk preview. Konfigurasi Supabase diperlukan agar bisa masuk.

Supabase JS 2.117.2 disertakan di `dist/vendor/` dengan lisensi MIT.

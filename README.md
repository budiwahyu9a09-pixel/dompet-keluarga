# 💰 Dompet Keluarga

Aplikasi keuangan rumah tangga: pemasukan & pengeluaran, kantong tabungan, goals, kalender, catatan harian, beberapa **pos** (mis. Rumah Tangga & Budi Personal), dan tema Pastel / Pantai / Bunga / Galaksi / Gunung.

🌐 **App:** https://budiwahyu9a09-pixel.github.io/dompet-keluarga/

## Cara pakai pertama kali
1. Buka link app → **Daftar** dengan email & password. Akun pertama otomatis jadi anggota keluarga.
2. Tambahkan email pasangan di ⚙️ → **Anggota keluarga**, lalu minta dia buka app dan **Daftar**.
3. Di HP: menu browser → **Tambahkan ke Layar Utama** supaya terasa seperti aplikasi.

## Publish otomatis
Setiap push ke branch `main` menjalankan GitHub Actions (`.github/workflows/deploy.yml`):
`python build.py` → hasilnya dipublish ke branch `gh-pages` → tampil di GitHub Pages.

## Struktur
| Path | Isi |
|---|---|
| `src/app.html` | Aplikasinya (sama persis dengan versi di claude.ai) |
| `web/host.js` | Penghubung ke Supabase: login, penyimpanan, realtime, anggota keluarga |
| `web/config.js` | URL & publishable key Supabase (aman dipublikasikan, data dilindungi RLS) |
| `web/static/` | Ikon & manifest (bisa dipasang di layar utama HP) |
| `supabase/schema.sql` | Skema database & aturan keamanan |
| `build.py` | Menggabungkan semuanya jadi `dist/index.html` |

## Keamanan data
- Pos **Bersama** hanya bisa dibaca/diubah oleh email yang terdaftar di tabel `members`.
- Pos **Pribadi** disimpan di `data/users/<id pengguna>/…` dan hanya bisa diakses pemiliknya.

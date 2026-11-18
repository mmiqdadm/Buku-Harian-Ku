# Buku Harian Ku

Aplikasi buku harian berbasis web untuk anak usia 6 sampai 10 tahun, dirancang untuk layar mendatar (tablet dengan wireless keyboard dan browser laptop).

## Fitur Utama
- **Pilih Akun Horizontal**: Akun bawaan **Umar** dan **Utsman**, plus tombol **Tambah Akun Baru** untuk anak berikutnya. Setiap akun memiliki foto profil (galeri atau kamera selfie) serta biodata lengkap (nama panggilan, tanggal lahir, hobi, makanan favorit, warna favorit, cita-cita, tentang aku).
- **Tampilan Buku Tulis Klasik + Menu Samping**: Folderisasi bulanan di sisi kiri (dikelompokkan per tahun dan bulan) dan area kanan khusus fokus membaca atau menulis, lengkap dengan breadcrumb.
- **Langsung Menulis Cerita (Tanpa Judul)**: Anak langsung mengetik cerita hariannya pada kertas bergaris tanpa perlu memikirkan judul.
- **Aturan Tanggal Hari Ini**: Menulis cerita baru hanya dapat dilakukan untuk tanggal hari ini. Cerita yang sudah ada tetap bisa dibaca atau diedit.
- **Mode Orang Tua**: Semua tombol hapus (hapus cerita, hapus foto/voice note, hapus foto profil, dan hapus akun anak) terkunci dan hanya muncul saat **Mode Orang Tua** dibuka menggunakan kata sandi orang tua.
- **Kartu Ide (Butuh Ide? / Hint)**: Popup pertanyaan acak (30 pertanyaan terkurasi dalam 4 kategori) untuk memancing ide anak tanpa menuliskan otomatis.
- **Lampiran Media**: Tambah foto dari galeri, ambil foto langsung lewat kamera selfie, dan rekam voice note langsung dari browser.
- **Pencarian**: Cari cerita berdasarkan isi tulisan atau tanggal di semua bulan.
- **Export Word (.docx)**: Unduh kumpulan cerita anak dalam format Microsoft Word dengan filter rentang tanggal, lengkap dengan biodata dan foto terlampir.
- **Offline-First + Auto-Sync Firebase**: Terhubung otomatis ke Cloud Firestore (`formal-office-ndw25`) melalui file `.env`. Jika tablet sedang offline, cerita tersimpan aman di perangkat (IndexedDB + PWA offline cache) dan otomatis terunggah ke Firebase begitu terhubung ke internet tanpa tombol switching manual.

## Menjalankan Secara Lokal

```bash
npm install
npm run dev
```

Buka `http://127.0.0.1:5173/`.

## Build & Deploy

```bash
npm run build
```

Hasil build produksi tersimpan di folder `dist/`.
Aturan Firestore tersimpan di `firestore.rules` (koleksi `bhk_profiles`, `bhk_entries`, `bhk_media` berdampingan aman dengan koleksi lain di project `formal-office-ndw25`).

# 🚀 AM Generator Premium — Local CLI & Server Edition

AM Generator Premium adalah skrip otomasi tangguh berbasis **Node.js** yang dirancang untuk membypass pengamanan Cloudflare Turnstile, memverifikasi Magic Link secara otomatis, mengeksekusi bypass 5 langkah iklan otomatis, serta mengklaim VIP/Premium secara langsung.

Versi *Local Only* ini didesain khusus agar kamu bisa langsung menjalankan sistem di laptop/komputer pribadi secara instan tanpa perlu pengaturan server (seperti Docker atau Railway).

---

## 💻 Cara Menjalankan di Lokal (PC / Laptop)

1. Pastikan kamu sudah menginstal **Node.js** di komputermu (versi 18+ direkomendasikan) dan **Google Chrome** (untuk otomasi browser).
2. Buka folder ini di Terminal atau Command Prompt.
3. Jalankan perintah instalasi dependensi (hanya perlu dilakukan sekali):
   ```bash
   npm install
   ```
4. Jalankan aplikasi menggunakan perintah berikut:
   ```bash
   node app.js
   ```
5. Sebuah menu interaktif akan muncul. Silakan ikuti instruksi di layar.

---

## 🕹️ Mode CLI Terminal (Bypass Menu Interaktif)

Jika kamu ingin mengeksekusi bot secara langsung via Terminal tanpa harus melewati menu pilihan awal, gunakan perintah-perintah berikut:

```bash
# Mengeksekusi verifikasi Magic Link & Klaim VIP (Tahap Utama)
node app.js verify_and_claim "emailkamu@gmail.com" "https://link-magic-firebase-kamu..."

# Hanya mengeksekusi Klaim VIP (Untuk akun yang sudah terverifikasi sebelumnya)
node app.js claim_only

# Mengirim ulang Magic Link dari Server ke Email
node app.js send "emailkamu@gmail.com"

# Menjalankan sebagai REST API Server di background lokal (Port 3000 default)
node app.js --api
```

---

## 🌐 Daftar Endpoint (Jika Dijalankan Sebagai API Server Lokal)

Jika kamu memilih opsi `[3]` di menu atau menggunakan perintah `node app.js --api`, sistem akan berubah menjadi server REST API yang siap ditembak dari aplikasi apa pun (Postman, Python, CURL, dll) di URL `http://localhost:3000`.

| Method | Endpoint | Fungsi | Contoh Payload JSON |
| :---: | :--- | :--- | :--- |
| **GET** | `/` | Cek status & Dokumentasi JSON | `-` |
| **GET** | `/api/status` | Mengecek uptime server dan status bot | `-` |
| **POST** | `/api/keepalive` | Melakukan refresh session & Bypass CF Manual | `-` |
| **POST** | `/api/send` | Mengirim Magic Link ke email yang di-input | `{"email": "lanncrop@gmail.com"}` |
| **POST** | `/api/verify` | **(UTAMA)** Verifikasi Link, Bypass Iklan, Klaim VIP | `{"email": "lanncrop@gmail.com", "magicLink": "https://..."}` |
| **POST** | `/api/claim` | Bypass Iklan & Klaim VIP untuk session aktif saat ini | `{}` |

---

*Script Automation Crafted & Maintained by **lanncodex** | Assisted by **Antigravity AI***

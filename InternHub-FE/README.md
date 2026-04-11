# InternHub - Frontend

Aplikasi frontend untuk **InternHub**, sistem manajemen magang (internship) yang dibangun dengan **React 18** dan **Vite**. Aplikasi ini mendukung tiga peran utama: **Admin**, **Mentor**, dan **Magang (Intern)**.

---

## Tech Stack

| Teknologi | Versi | Keterangan |
|---|---|---|
| [React](https://react.dev/) | 18.x | Library UI |
| [Vite](https://vitejs.dev/) | 7.x | Build tool & dev server |
| [Tailwind CSS](https://tailwindcss.com/) | 3.x | Utility-first CSS framework |
| [React Router DOM](https://reactrouter.com/) | 6.x | Client-side routing |
| [Axios](https://axios-http.com/) | 1.x | HTTP client |
| [Laravel Echo](https://laravel.com/docs/broadcasting) + [Pusher](https://pusher.com/) | - | Real-time broadcasting |
| [Recharts](https://recharts.org/) | 3.x | Chart / grafik |
| [Leaflet](https://leafletjs.com/) + [React Leaflet](https://react-leaflet.js.org/) | - | Peta interaktif |
| [Framer Motion](https://www.framer.com/motion/) | 10.x | Animasi |
| [Lucide React](https://lucide.dev/) | - | Ikon |
| [SweetAlert2](https://sweetalert2.github.io/) | 11.x | Dialog / alert |
| [jsPDF](https://github.com/parallax/jsPDF) + [html2canvas](https://html2canvas.hertzen.com/) | - | Generate PDF |
| [react-pdf](https://github.com/wojtekmaj/react-pdf) | 10.x | Viewer PDF |
| [PapaParse](https://www.papaparse.com/) | 5.x | Parsing CSV |
| [xlsx (SheetJS)](https://sheetjs.com/) | 0.18 | Parsing Excel |
| [react-webcam](https://github.com/mozmorris/react-webcam) | 7.x | Akses webcam |
| [Playwright](https://playwright.dev/) | 1.x | E2E testing |

---

## Prasyarat (Prerequisites)

Pastikan tools berikut sudah terinstal di mesin Anda:

- **Node.js** >= 18.x — [Download](https://nodejs.org/)
- **npm** >= 9.x (bawaan Node.js) atau **yarn**
- **Git** — [Download](https://git-scm.com/)
- Backend **InternHub API** (Laravel) sudah berjalan

---

## Instalasi

### 1. Clone Repository

```bash
git clone https://github.com/PT-Surabaya-Industrial-Estate-Rungkut/InternHub-FE.git
cd InternHub-FE
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Konfigurasi Environment

Salin file `.env.example` (jika ada) atau buat file `.env` baru di root project:

```bash
cp .env.example .env
```

Isi variabel environment berikut di file `.env`:

```env
# URL base API backend (digunakan oleh Axios)
VITE_API_BASE_URL=http://localhost:8000/api

# Target proxy untuk dev server (backend Laravel)
VITE_PROXY_TARGET=http://localhost:8000

# Pusher / Laravel Echo (real-time notifications)
VITE_PUSHER_APP_KEY=your_pusher_app_key
VITE_PUSHER_APP_CLUSTER=your_pusher_app_cluster
```

> **Catatan:** Semua variabel environment untuk Vite **harus** diawali dengan prefix `VITE_`.

### 4. Jalankan Development Server

```bash
npm run dev
```

Aplikasi akan berjalan di **http://localhost:5173** secara default.

---

## Scripts

| Perintah | Keterangan |
|---|---|
| `npm run dev` | Menjalankan development server (Vite) |
| `npm run build` | Build production ke folder `dist/` |
| `npm run preview` | Preview hasil build production |
| `npm run lint` | Jalankan ESLint untuk cek kualitas kode |
| `npm run test:e2e` | Jalankan E2E test dengan Playwright |
| `npm run test:e2e:ui` | Jalankan E2E test dengan Playwright UI mode |

---

## Struktur Folder

```
InternHub-FE/
├── public/                  # Aset statis
├── e2e/                     # E2E test (Playwright)
│   └── helpers/             # Helper untuk E2E test
├── src/
│   ├── api/                 # Konfigurasi Axios
│   ├── assets/              # Gambar, font, dll.
│   ├── components/          # Komponen reusable
│   ├── hooks/               # Custom React hooks
│   ├── Layout/              # Layout wrapper (Admin, Mentor, Magang, Auth)
│   ├── pages/
│   │   ├── Admin/           # Halaman Admin
│   │   │   └── Masterdata/  # CRUD data master
│   │   ├── Auth/            # Login, Forgot Password, OTP, dll.
│   │   ├── Magang/          # Halaman Intern/Magang
│   │   └── Mentor/          # Halaman Mentor
│   ├── routes/              # Konfigurasi routing (AppRoutes)
│   ├── services/            # Service layer
│   └── utils/               # Utility / helper functions
├── .env                     # Environment variables (tidak di-commit)
├── vite.config.js           # Konfigurasi Vite
├── tailwind.config.js       # Konfigurasi Tailwind CSS
├── postcss.config.js        # Konfigurasi PostCSS
├── playwright.config.js     # Konfigurasi Playwright
└── package.json
```

---

## Fitur Utama

### Admin
- Dashboard & monitoring intern
- Manajemen master data (profil intern, lokasi kantor, jadwal kerja, role, permission, evaluasi, mapping)
- Logbook, absensi, izin, koreksi
- Generate sertifikat
- Evaluasi & laporan
- Notifikasi intern yang segera berakhir

### Mentor
- Dashboard & monitoring intern
- Review logbook, izin, koreksi
- Evaluasi intern
- Laporan & log aktivitas

### Magang (Intern)
- Dashboard pribadi
- Absensi (dengan webcam)
- Logbook harian
- Pengajuan izin & koreksi
- Lihat hasil evaluasi
- Profil & riwayat

---

## Build Production

```bash
npm run build
```

Hasil build akan tersedia di folder `dist/`. Folder ini dapat di-deploy ke web server seperti **Nginx**, **Apache**, atau platform hosting statis lainnya.

### Contoh Konfigurasi Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/InternHub-FE/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

> **Penting:** Karena aplikasi ini menggunakan client-side routing (React Router), pastikan semua request di-redirect ke `index.html`.

---

## E2E Testing

Aplikasi ini menggunakan [Playwright](https://playwright.dev/) untuk end-to-end testing.

```bash
# Install browser Playwright (pertama kali)
npx playwright install

# Jalankan semua test
npm run test:e2e

# Jalankan test dengan UI mode
npm run test:e2e:ui
```

Test berjalan pada browser **Chromium** dengan base URL `http://localhost:5173`. Pastikan dev server sudah berjalan sebelum menjalankan test.

---

## Environment Variables

| Variabel | Wajib | Keterangan |
|---|---|---|
| `VITE_API_BASE_URL` | Ya | Base URL API backend |
| `VITE_PROXY_TARGET` | Ya | Target proxy dev server ke backend |
| `VITE_PUSHER_APP_KEY` | Ya | Pusher App Key untuk real-time |
| `VITE_PUSHER_APP_CLUSTER` | Ya | Pusher Cluster |

---

## Lisensi

Hak cipta &copy; PT Surabaya Industrial Estate Rungkut. All rights reserved.

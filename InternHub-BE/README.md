# InternHub Backend (SIP SIER)

Sistem Informasi Praktik (SIP) — Backend API untuk manajemen magang di PT Surabaya Industrial Estate Rungkut (SIER). Dibangun menggunakan **Laravel 10** dengan autentikasi **Laravel Sanctum**.

## Fitur Utama

- **Autentikasi & SSO** — Login dengan token Sanctum, integrasi SSO SIER
- **Manajemen Pengguna** — CRUD user dengan role & permission (RBAC)
- **Absensi** — Check-in/check-out dengan geolokasi, riwayat kehadiran, kalender
- **Logbook** — Pencatatan kegiatan harian oleh peserta magang
- **Izin & Koreksi Absensi** — Pengajuan izin dan koreksi kehadiran
- **Evaluasi** — Penilaian performa magang oleh mentor
- **Sertifikat** — Pembuatan sertifikat magang (PDF via DomPDF)
- **Laporan & Ekspor** — Ekspor laporan absensi, logbook, tunjangan (Excel/PDF)
- **Notifikasi Real-time** — Push notification via Pusher
- **Import Massal** — Import data user/jadwal dari file Excel

---

## Prasyarat (Requirements)

Pastikan tools berikut sudah terinstal di sistem:

| Tool | Versi Minimum | Keterangan |
|------|---------------|------------|
| **PHP** | >= 8.1 | Dengan ekstensi: `mbstring`, `xml`, `ctype`, `json`, `bcmath`, `gd`, `zip` |
| **Composer** | >= 2.x | PHP dependency manager |
| **MySQL** | >= 5.7 / 8.0 | Database server |
| **Node.js** | >= 18.x | Untuk Vite asset bundler |
| **npm** | >= 9.x | Node package manager |
| **Git** | Terbaru | Version control |

---

## Instalasi

### 1. Clone Repository

```bash
git clone https://github.com/PT-Surabaya-Industrial-Estate-Rungkut/InternHub-BE.git
cd InternHub-BE
```

### 2. Install Dependency PHP

```bash
composer install
```

### 3. Install Dependency Node.js

```bash
npm install
```

### 4. Konfigurasi Environment

Salin file `.env.example` menjadi `.env`:

```bash
cp .env.example .env
```

Lalu edit file `.env` dan sesuaikan konfigurasi berikut:

```dotenv
# Aplikasi
APP_NAME=Laravel
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost

# URL Frontend (untuk CORS)
FRONTEND_URL=http://localhost:5173

# Database
DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=sip_sier
DB_USERNAME=root
DB_PASSWORD=

# Logging
LOG_CHANNEL=stack
LOG_LEVEL=debug

# Session & Sanctum
SESSION_LIFETIME=180
SANCTUM_EXPIRATION=180

# Cache & Queue
CACHE_DRIVER=file
QUEUE_CONNECTION=sync
FILESYSTEM_DISK=local

# Pusher (Real-time Notification)
BROADCAST_DRIVER=pusher
PUSHER_APP_ID=
PUSHER_APP_KEY=
PUSHER_APP_SECRET=
PUSHER_APP_CLUSTER=

# Mail Configuration
MAIL_MAILER=smtp
MAIL_HOST=127.0.0.1
MAIL_PORT=1025
MAIL_FROM_ADDRESS=SIP@noreply.com
MAIL_FROM_NAME="SIP SIER"

# SSO SIER Configuration
SSO_LOGIN_URL=
SSO_CREDENTIAL_URL=
SSO_API_URL=
SIER_ADMIN_USER=your_admin_user
SIER_ADMIN_PASS=your_admin_password
CLIENT_ID=your_client_id
CLIENT_SECRET=your_client_secret
```

### 5. Generate Application Key

```bash
php artisan key:generate
```

### 6. Buat Database

Buat database MySQL baru dengan nama `sip_sier` (atau sesuai konfigurasi `DB_DATABASE` di `.env`):

```sql
CREATE DATABASE sip_sier CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 7. Jalankan Migrasi Database

```bash
php artisan migrate
```

### 8. Jalankan Seeder Manual (Production Required)

Jalankan seeder penting satu per satu untuk memastikan data yang diperlukan ter-seed dengan benar:

```bash
# 1. Role - Sistem role (admin, mentor, intern)
php artisan db:seed --class=RoleSeeder

# 2. Permission - Akses/permission setiap role
php artisan db:seed --class=PermissionSeeder

# 3. Role Permission - Hubungan antara role & permission
php artisan db:seed --class=RolePermissionSeeder

# 4. Work Schedule - Jadwal kerja default
php artisan db:seed --class=WorkScheduleSeeder

# 5. Komponen - Komponen evaluasi magang
php artisan db:seed --class=KomponenSeeder

# 6. Certificate Template - Template sertifikat magang
php artisan db:seed --class=CertificateTemplateSeeder

# 7. Seeder User pertama untuk login
php artisan db:seed --class=AdminUserSeeder
```

**Urutan seeder harus sesuai di atas agar tidak ada dependency error!**

### 9. Buat Symbolic Link untuk Storage

```bash
php artisan storage:link
```

---

## Menjalankan Aplikasi

### Development Server (Sederhana)

```bash
php artisan serve
```

Server akan berjalan di `http://localhost:8000`.

### Development Server (Lengkap — dengan Queue & Vite)

```bash
composer dev
```

Perintah ini akan menjalankan secara bersamaan:
- **Laravel Server** — `http://localhost:8000`
- **Queue Listener** — untuk memproses job (notifikasi, email, dll)
- **Vite Dev Server** — untuk hot-reload asset frontend

---

## Struktur Direktori Penting

```
├── app/
│   ├── Console/                # Artisan commands
│   ├── Exceptions/             # Exception handlers
│   ├── Http/
│   │   ├── Controllers/        # API controllers
│   │   ├── Kernel.php          # HTTP Kernel
│   │   ├── Middleware/         # HTTP middleware
│   │   └── Requests/           # Form requests & validation
│   ├── Jobs/                   # Queued jobs (email, notification)
│   ├── Models/                 # Eloquent models
│   ├── Notifications/          # Notification classes
│   ├── Policies/               # Authorization policies
│   ├── Providers/              # Service providers
│   └── Services/               # Business logic layer
├── bootstrap/                  # Application bootstrap files
├── config/                     # Configuration files
├── database/
│   ├── factories/              # Model factories
│   ├── migrations/             # Database migrations
│   └── seeders/                # Database seeders
├── docs/                       # API documentation
├── public/                     # Web root directory
├── resources/                  # Frontend resources (blade, CSS, JS)
├── routes/
│   ├── api.php                 # API routes (prefix /api)
│   ├── web.php                 # Web routes
│   └── console.php             # Console commands
├── storage/                    # File uploads, logs, cache
├── tests/                      # Unit & feature tests
└── vendor/                     # Composer dependencies
```

---

## API Endpoint Utama

Semua endpoint API berada di prefix `/api`. Autentikasi menggunakan **Bearer Token** (Laravel Sanctum).

| Grup | Endpoint | Keterangan |
|------|----------|------------|
| Auth | `POST /api/login` | Login & mendapat token |
| Profile | `GET /api/profile` | Data profil user |
| Absensi | `POST /api/absensi/check-in` | Check-in kehadiran |
| Absensi | `POST /api/absensi/check-out` | Check-out kehadiran |
| Logbook | `GET/POST /api/logbook` | CRUD logbook |
| Izin | `GET/POST /api/izin` | Pengajuan izin |
| Evaluasi | `GET /api/intern/my-evaluation` | Lihat evaluasi (intern) |
| Mentor | `GET /api/mentor/*` | Endpoint khusus mentor |
| Admin | `GET /api/admin/*` | Endpoint khusus admin |

Dokumentasi API lebih lengkap dapat dilihat di folder `docs/`.

---

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| `SQLSTATE[HY000] [2002]` | Pastikan MySQL berjalan dan konfigurasi `DB_*` di `.env` benar |
| `The key ... is not valid` | Jalankan `php artisan key:generate` |
| `Permission denied` pada storage | Jalankan `chmod -R 775 storage bootstrap/cache` (Linux/Mac) |
| `Class not found` | Jalankan `composer dump-autoload` |
| `Vite manifest not found` | Jalankan `npm run build` atau gunakan `composer dev` |

---

## Teknologi yang Digunakan

- **[Laravel 10](https://laravel.com/)** — PHP Web Framework
- **[Laravel Sanctum](https://laravel.com/docs/10.x/sanctum)** — API Token Authentication
- **[Pusher](https://pusher.com/)** — Real-time Notifications
- **[DomPDF](https://github.com/barryvdh/laravel-dompdf)** — PDF Generation (Sertifikat)
- **[PhpSpreadsheet](https://phpspreadsheet.readthedocs.io/)** — Excel Import/Export
- **[Pest](https://pestphp.com/)** — Testing Framework
- **[Vite](https://vitejs.dev/)** — Frontend Asset Bundler
- **[Resend](https://resend.com/)** — Email Service (opsional)

---

## Lisensi

Proyek ini bersifat privat dan dimiliki oleh **PT Surabaya Industrial Estate Rungkut (SIER)**.

# API Dokumentasi - Workflow Mahasiswa & Assign Role

## Overview

Workflow baru untuk membuat mahasiswa dan assign role:

1. **Step 1:** Admin buat profil mahasiswa → `POST /api/intern-profiles`
2. **Step 2:** Admin assign role ke mahasiswa → `POST /api/admin/users`
   - Saat assign role, sistem otomatis:
     - Buat user record
     - Generate password (12 karakter)
     - Send email dengan password

---

## Step 1: Create Mahasiswa Profile

**Endpoint:** `POST /api/intern-profiles`

### Deskripsi
Membuat profil mahasiswa **tanpa membuat user record**. Profil disimpan ke `students` dengan `user_id = NULL`. Nanti di-assign role melalui halaman "User & Role".

### Request Headers
```
Authorization: Bearer {token}
Content-Type: application/json
```

### Request Body (Semua field optional)

| Field | Tipe | Keterangan |
|-------|------|-----------|
| `universitas` | string | Nama universitas |
| `jurusan` | string | Program studi |
| `mulai_magang` | date | Format: YYYY-MM-DD |
| `akhir_magang` | date | Format: YYYY-MM-DD, harus >= mulai_magang |
| `tempat_lahir` | string | Tempat lahir |
| `tanggal_lahir` | date | Format: YYYY-MM-DD |
| `nik` | string | Nomor Identitas Kependudukan |
| `job_position` | string | Posisi/Jabatan |
| `division` | string | Divisi/Bagian |
| `alamat` | string | Alamat lengkap |
| `jenjang_pendidikan` | string | S1, S2, D3, etc |
| `gender` | string | L (Laki-laki) atau P (Perempuan) |
| `semester` | integer | Semester/tahun (min 1) |
| `nomor_darurat` | string | Nomor kontak darurat |
| `nama_kontak_darurat` | string | Nama kontak darurat |
| `bank_name` | string | Nama bank |
| `bank_account_name` | string | Nama pemilik rekening |
| `bank_account_number` | string | Nomor rekening |
| `id_site` | integer | ID site/lokasi |

### Contoh Request

```json
POST /api/intern-profiles
{
  "universitas": "Universitas Indonesia",
  "jurusan": "Teknik Informatika",
  "mulai_magang": "2024-01-01",
  "akhir_magang": "2024-06-30",
  "tempat_lahir": "Jakarta",
  "tanggal_lahir": "2003-05-15",
  "nik": "3173101203050001",
  "job_position": "Frontend Developer",
  "division": "Product",
  "alamat": "Jl. Merdeka No. 123, Jakarta",
  "jenjang_pendidikan": "S1",
  "gender": "L",
  "semester": 4,
  "nomor_darurat": "081987654321",
  "nama_kontak_darurat": "Ibnu Wijaya",
  "bank_name": "Bank Mandiri",
  "bank_account_name": "Ahmad Wijaya",
  "bank_account_number": "1234567890",
  "id_site": 1
}
```

### Response Success (201)

```json
{
  "success": true,
  "message": "Profil mahasiswa berhasil dibuat. Selanjutnya atur di halaman User & Role.",
  "data": {
    "id_mahasiswa": 45,
    "universitas": "Universitas Indonesia",
    "jurusan": "Teknik Informatika",
    "mulai_magang": "2024-01-01",
    "akhir_magang": "2024-06-30",
    "job_position": "Frontend Developer",
    "division": "Product",
    "tempat_lahir": "Jakarta",
    "tanggal_lahir": "2003-05-15",
    "nik": "3173101203050001",
    "gender": "L",
    "semester": 4,
    "jenjang_pendidikan": "S1",
    "alamat": "Jl. Merdeka No. 123, Jakarta",
    "nomor_darurat": "081987654321",
    "nama_kontak_darurat": "Ibnu Wijaya",
    "bank_name": "Bank Mandiri",
    "bank_account_name": "Ahmad Wijaya",
    "bank_account_number": "1234567890",
    "user_id": null,
    "created_at": "2024-02-04T10:30:00Z",
    "updated_at": "2024-02-04T10:30:00Z"
  }
}
```

---

## Step 2: Assign Role & Create User

**Endpoint:** `POST /api/admin/users`

### Deskripsi
Assign role ke mahasiswa yang sudah ada (langkah 1). Saat assign role, sistem otomatis:
- Buat user record
- Generate password random (12 karakter)
- Assign role(s)
- Update mahasiswa.user_id
- Send email dengan password

**Input minimal:** `id_mahasiswa`, `identifier`, `email`, `roles`

### Request Headers
```
Authorization: Bearer {token}
Content-Type: application/json
```

### Request Body

| Field | Wajib | Keterangan |
|-------|-------|-----------|
| `id_mahasiswa` | ✅ | ID mahasiswa dari students |
| `identifier` | ✅ | NIM/NIP user - Harus unik |
| `email` | ✅ | Email user - Harus unik |
| `roles` | ✅ | Array: ["intern"], ["mentor"], ["admin"], atau kombinasi |

### Contoh Request

#### Single Role
```json
POST /api/admin/users
{
  "id_mahasiswa": 45,
  "identifier": "20240001",
  "email": "ahmad@student.univ.ac.id",
  "roles": ["intern"]
}
```

#### Multiple Roles
```json
POST /api/admin/users
{
  "id_mahasiswa": 45,
  "identifier": "20240001",
  "email": "ahmad@student.univ.ac.id",
  "roles": ["intern", "mentor", "admin"]
}
```

### Response Success (201)

```json
{
  "success": true,
  "message": "User berhasil dibuat dan role di-assign. Password telah dikirim ke email.",
  "data": {
    "user": {
      "user_id": 45,
      "nama": "Ahmad Wijaya",
      "identifier": "20240001",
      "email": "ahmad@student.univ.ac.id"
    },
    "mahasiswa": {
      "id_mahasiswa": 45,
      "user_id": 45,
      "universitas": "Universitas Indonesia",
      "job_position": "Frontend Developer"
    },
    "roles": ["intern"]
  }
}
```

### Response Error (400)

#### Mahasiswa Sudah Punya User
```json
{
  "success": false,
  "message": "Mahasiswa ini sudah memiliki akun user"
}
```

#### Missing Required Field (422)
```json
{
  "success": false,
  "message": "Identifier dan email harus diisi untuk assign role",
  "fields_required": {
    "identifier": "Wajib diisi",
    "email": null
  }
}
```

#### Identifier atau Email Tidak Unik (422)
```json
{
  "success": false,
  "message": "The identifier has already been taken.",
  "errors": {
    "identifier": ["The identifier has already been taken."]
  }
}
```

#### Mahasiswa Tidak Ditemukan (404)
```json
{
  "success": false,
  "message": "The selected id_mahasiswa is invalid."
}
```

---

## Password Management

### Password Auto-Generation

✅ **Password digenerate otomatis** oleh sistem saat assign role
- Panjang: 12 karakter (kombinasi huruf, angka, simbol)
- **Bukan dari user input** → aman dan unik
- **Dikirim via email** → user mendapat password saat role di-assign
- Contoh: `kL9mP@xvR2qZ`

### Cara User Mengganti Password

Setelah login, user bisa mengubah password melalui endpoint:
```
PUT /api/profile/change-password
{
  "current_password": "kL9mP@xvR2qZ",
  "new_password": "passwordBaru123!",
  "password_confirmation": "passwordBaru123!"
}
```

---

## Validasi & Rules

### id_mahasiswa
- Wajib ada di tabel `students`
- Mahasiswa belum boleh punya `user_id` (belum assign role sebelumnya)
- Validasi error: 404 (Mahasiswa tidak ditemukan), 400 (Mahasiswa sudah punya user)

### identifier
- Wajib diisi saat assign role
- Max 50 karakter
- Harus unik di tabel `users`
- Contoh: "20240001", "nip-12345", "INTERN-001"
- Validasi error: 422 (Duplicate)

### email
- Wajib diisi saat assign role
- Format email valid
- Harus unik di tabel `users`
- Validasi error: 422 (Duplicate atau format invalid)

### roles
- Wajib array
- Minimal 1 role
- Allowed values: `intern`, `mentor`, `admin`
- Validasi error: 422 (Invalid atau empty)

---

## Flow Chart

```
                    ┌─────────────────────────────┐
                    │    Admin Dashboard          │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
           ┌────────▼────────┐          ┌─────────▼──────────┐
           │ 1. Add Mahasiswa│          │ 2. User & Role     │
           │ (Step 1)        │          │ (Step 2)           │
           └────────┬────────┘          └─────────┬──────────┘
                    │                             │
                    │ POST /api/intern-profiles   │
                    │ (create tanpa user)         │
                    │                             │
                    ▼                             │
           ┌─────────────────┐                   │
           │ students   │                   │
           │ id_mahasiswa, .. │                   │
           │ user_id = NULL   │                   │
           └────────┬────────┘                   │
                    │                             │
                    │◄────────────────────────────┘
                    │
                    │ SELECT mahasiswa WHERE user_id IS NULL
                    │ (dropdown list mahasiswa tanpa user)
                    │
           ┌────────▼──────────────────────┐
           │ Pilih mahasiswa + assign role  │
           │ (checkbox: intern/mentor/admin)│
           └────────┬──────────────────────┘
                    │
                    │ POST /api/admin/users
                    │ {id_mahasiswa, identifier, email, roles}
                    │
      ┌─────────────┼──────────────┬──────────────┐
      │             │              │              │
      ▼             ▼              ▼              ▼
   ┌─────────┐ ┌─────────┐ ┌────────────┐ ┌──────────┐
   │ users   │ │tbl_mah..│ │role_user   │ │Send Email│
   │(buat)   │ │user_id  │ │(attach)    │ │(password)│
   └─────────┘ │(update) │ └────────────┘ └──────────┘
               └─────────┘
                    │
                    ▼
           ┌─────────────────┐
           │ User Created ✅  │
           │ Role Assigned ✅ │
           │ Email Sent ✅    │
           └─────────────────┘
```

---

## Contoh Implementasi Curl

### Step 1: Create Mahasiswa
```bash
curl -X POST http://localhost:8000/api/intern-profiles \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "universitas": "Universitas Indonesia",
    "jurusan": "Teknik Informatika",
    "job_position": "Frontend Developer",
    "division": "Product",
    "mulai_magang": "2024-01-01",
    "akhir_magang": "2024-06-30"
  }'
```

### Step 2: Assign Role
```bash
curl -X POST http://localhost:8000/api/admin/users \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id_mahasiswa": 45,
    "identifier": "20240001",
    "email": "ahmad@univ.ac.id",
    "roles": ["intern"]
  }'
```

---

## Summary

| Aspek | Detail |
|-------|--------|
| **Step 1** | Create mahasiswa profile via `/api/intern-profiles` (user_id = NULL) |
| **Step 2** | Assign role via `/api/admin/users` (creates user + send password email) |
| **Password** | Auto-generated (12 char), sent via email, user can change later |
| **Atomicity** | Both endpoints use DB transactions (rollback on error) |
| **Validation** | identifier & email unique, mahasiswa exists, roles valid |
| **Email** | Sent via Laravel Mail, doesn't fail request if delivery fails |
| **Recommended** | Use Step 1 + Step 2 flow for better UX (separate mahasiswa & user creation)

## Endpoint 2: POST /api/admin/users

### Deskripsi
Membuat user baru dengan fitur:
- **2 mode**: Dari mahasiswa existing (dengan `id_mahasiswa`) atau create mahasiswa + user baru
- **Generate password otomatis** (12 karakter random)
- **Support multiple roles** (via checkbox) untuk mode pertama
- **Mengirim email** dengan kredensial login ke user

---

## Mode A: Create User dari Mahasiswa Existing (Recommended)

Digunakan saat mahasiswa sudah ada di `students` (dari halaman Intern Profile) dan ingin di-assign ke user.

### Request Headers
```
Authorization: Bearer {token}
Content-Type: application/json
```

### Request Body

| Field | Wajib | Keterangan |
|-------|-------|-----------|
| `id_mahasiswa` | ✅ | ID mahasiswa dari students |
| `identifier` | ✅ | NIM/NIP user - Harus unik |
| `email` | ✅ | Email user - Harus unik |
| `nama` | ✅ | Nama lengkap |
| `roles` | ✅ | Array: ["intern"], ["mentor"], ["admin"], atau multiple |
| `no_telp` | ❌ | Nomor telepon |
| `status` | ❌ | "active" (default) atau "inactive" |

### Contoh Request (Mode A)

```json
POST /api/admin/users
{
  "id_mahasiswa": 45,
  "identifier": "20240001",
  "email": "ahmad@student.univ.ac.id",
  "nama": "Ahmad Wijaya",
  "roles": ["intern"],
  "no_telp": "081234567890",
  "status": "active"
}
```

#### Multiple Roles
```json
{
  "id_mahasiswa": 45,
  "identifier": "20240001",
  "email": "ahmad@student.univ.ac.id",
  "nama": "Ahmad Wijaya",
  "roles": ["intern", "mentor"],
  "status": "active"
}
```

### Response Success (201) - Mode A

```json
{
  "success": true,
  "message": "User berhasil dibuat dari profil mahasiswa. Email dengan password telah dikirim.",
  "data": {
    "user": {
      "user_id": 45,
      "nama": "Ahmad Wijaya",
      "identifier": "20240001",
      "email": "ahmad@student.univ.ac.id",
      "status": "active"
    },
    "mahasiswa": {
      "id_mahasiswa": 45,
      "user_id": 45,
      "universitas": "Universitas Indonesia",
      "jurusan": "Teknik Informatika",
      "mulai_magang": "2024-01-01",
      "akhir_magang": "2024-06-30",
      "job_position": "Frontend Developer",
      "division": "Product"
    },
    "roles": ["intern"]
  }
}
```

---

## Mode B: Create User + Mahasiswa Baru (Legacy)

## Mode B: Create User + Mahasiswa Baru (Legacy)

Untuk backward compatibility, masih support membuat user + mahasiswa sekaligus. Tidak perlu kirim `id_mahasiswa`.

### Request Body

| Field | Wajib | Keterangan |
|-------|-------|-----------|
| `nama` | ✅ | Nama lengkap user |
| `identifier` | ✅ | NIM/NIP user - Harus unik |
| `email` | ✅ | Email user - Harus unik |
| `role` | ✅ | "intern", "mentor", atau "admin" (single role) |
| `no_telp` | ❌ | Nomor telepon |
| `id_site` | ❌ | ID site/lokasi |
| `status` | ❌ | "active" (default) atau "inactive" |
| **Mahasiswa fields (jika role=intern)** | | |
| `universitas` | ❌ | Nama universitas |
| `jurusan` | ❌ | Program studi |
| `mulai_magang` | ❌ | Tanggal mulai (YYYY-MM-DD) |
| `akhir_magang` | ❌ | Tanggal akhir (YYYY-MM-DD) |
| `job_position` | ❌ | Posisi/Jabatan |
| `division` | ❌ | Divisi/Bagian |
| `tempat_lahir` | ❌ | Tempat lahir |
| `tanggal_lahir` | ❌ | Tanggal lahir (YYYY-MM-DD) |
| `nik` | ❌ | Nomor Identitas |
| `gender` | ❌ | L atau P |
| `semester` | ❌ | Semester (integer) |
| `alamat` | ❌ | Alamat lengkap |
| `jenjang_pendidikan` | ❌ | S1, S2, D3, etc |
| `nomor_darurat` | ❌ | Nomor kontak darurat |
| `nama_kontak_darurat` | ❌ | Nama kontak darurat |
| `bank_name` | ❌ | Nama bank |
| `bank_account_name` | ❌ | Nama pemilik rekening |
| `bank_account_number` | ❌ | Nomor rekening |

### Contoh Request (Mode B)

#### Intern dengan data mahasiswa
```json
POST /api/admin/users
{
  "nama": "Ahmad Wijaya",
  "identifier": "20240001",
  "email": "ahmad@student.univ.ac.id",
  "role": "intern",
  "no_telp": "081234567890",
  "status": "active",
  "id_site": 1,
  "universitas": "Universitas Indonesia",
  "jurusan": "Teknik Informatika",
  "mulai_magang": "2024-01-01",
  "akhir_magang": "2024-06-30",
  "tempat_lahir": "Jakarta",
  "tanggal_lahir": "2003-05-15",
  "nik": "3173101203050001",
  "job_position": "Frontend Developer",
  "division": "Product",
  "alamat": "Jl. Merdeka No. 123, Jakarta",
  "jenjang_pendidikan": "S1",
  "gender": "L",
  "semester": 4,
  "nomor_darurat": "081987654321",
  "nama_kontak_darurat": "Ibnu Wijaya",
  "bank_name": "Bank Mandiri",
  "bank_account_name": "Ahmad Wijaya",
  "bank_account_number": "1234567890"
}
```

#### Mentor (tanpa mahasiswa data)
```json
POST /api/admin/users
{
  "nama": "Dr. Budi Santoso",
  "identifier": "198705151",
  "email": "budi.santoso@company.com",
  "role": "mentor",
  "no_telp": "081234567890",
  "status": "active",
  "id_site": 1
}
```

### Response Success (201) - Mode B

```json
{
  "success": true,
  "message": "User berhasil dibuat. Email dengan password telah dikirim.",
  "data": {
    "user": {
      "user_id": 45,
      "nama": "Ahmad Wijaya",
      "identifier": "20240001",
      "email": "ahmad@student.univ.ac.id",
      "status": "active"
    },
    "mahasiswa": {
      "id_mahasiswa": 23,
      "user_id": 45,
      "universitas": "Universitas Indonesia",
      "jurusan": "Teknik Informatika",
      "mulai_magang": "2024-01-01",
      "akhir_magang": "2024-06-30",
      "job_position": "Frontend Developer",
      "division": "Product"
    },
    "role": "intern"
  }
}
```

### Response Error

#### Validation Error (422)
```json
{
  "message": "The given data was invalid.",
  "errors": {
    "email": ["The email has already been taken."],
    "identifier": ["The identifier has already been taken."]
  }
}
```

#### Mahasiswa sudah punya user (400)
```json
{
  "success": false,
  "message": "Mahasiswa ini sudah memiliki akun user"
}
```

#### Server Error (400/500)
```json
{
  "success": false,
  "message": "Gagal membuat user: {error_message}"
}
```

Setiap user baru akan menerima email berisi:
- **Email**: Email user yang digunakan untuk login
- **Identifier**: NIM/NIP user
- **Password**: Password random yang di-generate (12 karakter)
- **Role**: Role/jabatan user (Intern, Mentor, Admin)
- **Instruksi**: User diminta untuk segera login dan mengubah password ke password yang lebih aman

⚠️ **Catatan Penting:**
- Password di-generate otomatis, tidak perlu dikirim oleh frontend
- Email akan gagal dikirim jika mail service tidak dikonfigurasi dengan benar
- Jika email gagal, request tetap berhasil (tidak return error) tapi akan di-log
- User dapat menggunakan "Lupa Password" jika email tidak diterima

### Proses Internal

#### Workflow Recommended (Mode A + Mode 1)
```
┌─────────────────────────────────┐
│  Halaman: Intern Profile        │
│  POST /api/intern-profiles      │
└────────────────┬────────────────┘
                 │
                 ▼
    ┌────────────────────────────┐
    │ Buat record di students│
    │ (user_id = null)           │
    └────────────────┬───────────┘
                     │
                     ▼
    ┌────────────────────────────┐
    │ Halaman: User & Role       │
    │ (Lihat daftar mahasiswa)   │
    └────────────────┬───────────┘
                     │
                     ▼
    ┌────────────────────────────────────────┐
    │ POST /api/admin/users                  │
    │ (dengan id_mahasiswa + roles checkbox) │
    └────────────────┬───────────────────────┘
                     │
                     ▼
    ┌────────────────────────────────┐
    │ Buat User record              │
    │ Update mahasiswa.user_id      │
    │ Assign roles (multiple ok)    │
    │ Generate password random      │
    │ Send email                    │
    └────────────────────────────────┘
```

#### Workflow Legacy (Mode B)
```
┌──────────────────────────────────────┐
│ POST /api/admin/users                │
│ (tanpa id_mahasiswa, dengan role)    │
└─────────────┬──────────────────────┘
              │
              ▼
   ┌──────────────────────────┐
   │ Buat mahasiswa (opsional)│
   │ Buat User record         │
   │ Assign role (single)     │
   │ Generate password        │
   │ Send email               │
   └──────────────────────────┘
```

### Error Code & Pesan

| Status | Pesan | Penyebab |
|--------|-------|---------|
| 422 | `The email has already been taken` | Email sudah digunakan user lain |
| 422 | `The identifier has already been taken` | NIM/NIP sudah digunakan user lain |
| 422 | `The given data was invalid` | Field wajib kosong atau format tidak valid |
| 422 | `The end date must be after start date` | akhir_magang < mulai_magang |
| 400 | `Gagal membuat user: ...` | Error database/sistem |
| 500 | `Gagal membuat user: ...` | Error tidak terduga |

### Testing

Lihat file: `tests/Feature/AdminUserStoreTest.php` untuk contoh test cases.

Jalankan dengan:
```bash
php artisan test tests/Feature/AdminUserStoreTest.php
```

### Architecture Notes

1. **Mahasiswa record dibuat TERLEBIH DAHULU** di endpoint `/api/intern-profiles` sebelum ke halaman User & Role
2. **Password TIDAK pernah dikirim ulang** - hanya saat user pertama kali dibuat
3. **Email dapat dikustomisasi** di file: `resources/views/emails/welcome.blade.php`
4. **Foto tidak bisa diupload** saat membuat user - harus diupload terpisah via endpoint update
5. **Multiple roles support** - untuk Mode A, roles dikirim sebagai array dan semua roles akan di-assign
6. **Integrity**: Jika ada error, seluruh transaksi di-rollback (user + mahasiswa + roles)

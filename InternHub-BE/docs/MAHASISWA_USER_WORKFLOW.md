# Workflow: Membuat Mahasiswa & Assign Role

## Alur Kerja (2 Langkah)

### Langkah 1: Admin Buat Profil Mahasiswa
**Endpoint:** `POST /api/intern-profiles`

Admin membuat data mahasiswa **tanpa membuat user record**. Data disimpan ke table `students` dengan `user_id = NULL`.

**Scenario:**
- Admin di halaman "Intern Profile" / "Daftar Mahasiswa"
- Click "Tambah Mahasiswa"
- Isi data mahasiswa: universitas, jurusan, posisi, divisi, dll
- Submit → Mahasiswa record dibuat, `user_id = NULL`

```bash
curl -X POST http://localhost:8000/api/intern-profiles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "universitas": "Universitas Indonesia",
    "jurusan": "Teknik Informatika",
    "mulai_magang": "2024-01-01",
    "akhir_magang": "2024-06-30",
    "job_position": "Frontend Developer",
    "division": "Product",
    "gender": "L",
    "semester": 4,
    "bank_name": "Bank Mandiri",
    "bank_account_name": "Ahmad Wijaya",
    "bank_account_number": "1234567890"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Profil mahasiswa berhasil dibuat. Selanjutnya atur di halaman User & Role.",
  "data": {
    "id_mahasiswa": 45,
    "universitas": "Universitas Indonesia",
    "user_id": null,
    ...
  }
}
```

---

### Langkah 2: Admin Assign Role ke Mahasiswa
**Endpoint:** `POST /api/admin/users`

Admin di halaman "User & Role" / "Assign Role":
1. Lihat daftar mahasiswa yang **belum punya user** (`user_id = NULL`)
2. Pilih mahasiswa
3. Pilih role(s) via checkbox (intern, mentor, admin)
4. Input identifier (NIM/NIP) dan email
5. Submit → Sistem otomatis:
   - Buat user record
   - Generate password random (12 karakter)
   - Assign role
   - Kirim email dengan password

**Input minimal:**
```bash
curl -X POST http://localhost:8000/api/admin/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "id_mahasiswa": 45,
    "identifier": "20240001",
    "email": "ahmad@student.univ.ac.id",
    "roles": ["intern"]
  }'
```

**Response:**
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
---

## Alur Legacy (Backward Compatible - Tidak Recommended)

Jika masih perlu create user + mahasiswa sekaligus, endpoint ini masih support. Tapi workflow ini tidak recommended karena tidak terstruktur.

---

## Fitur Utama

### 1. Password Auto-Generate
- Password **di-generate otomatis** saat assign role (12 karakter random)
- **Tidak pernah dikirim di request**
- Dikirim via email ke user
- User dapat reset via "Lupa Password" jika email tidak diterima

### 2. Email Notification
Setiap user baru menerima email berisi:
- Email user
- Identifier (NIM/NIP)
- Password (random-generated)
- Role(s) yang di-assign
- Instruksi untuk login & ubah password

Contoh: `resources/views/emails/welcome.blade.php`

### 3. Multiple Roles Support
```json
{
  "id_mahasiswa": 45,
  "identifier": "20240001",
  "email": "ahmad@student.univ.ac.id",
  "roles": ["intern", "mentor", "admin"]
}
```
Semua roles akan di-assign ke user.

### 4. Data Integrity
- **User_id NULL** sampai role di-assign
- **Transaction rollback** jika ada error (user + mahasiswa + roles)
- **Unique constraints** pada identifier & email
- **Validation** identifier & email harus diisi saat assign role

### 5. Flow Overview
```
┌─────────────────────────────────────────┐
│  Step 1: Admin Buat Mahasiswa            │
│  POST /api/intern-profiles              │
│  Input: universitas, jurusan, posisi... │
└────────────────┬────────────────────────┘
                 │
                 ▼
        ┌────────────────────┐
        │ students      │
        │ user_id = NULL     │
        └────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Step 2: Admin Assign Role              │
│  POST /api/admin/users                  │
│  Input: id_mahasiswa, identifier,       │
│         email, roles[]                  │
└────────────────┬────────────────────────┘
                 │
                 ├─→ Buat user record
                 ├─→ Update mahasiswa.user_id
                 ├─→ Assign roles
                 ├─→ Generate password
                 └─→ Send email
                 │
                 ▼
        ┌────────────────────┐
        │ User created       │
        │ Password sent      │
        │ Ready to login     │
        └────────────────────┘
```

---

## API Endpoints

### POST /api/intern-profiles (Create Mahasiswa)
**Request Body:**
```json
{
  "universitas": "string",
  "jurusan": "string",
  "mulai_magang": "date",
  "akhir_magang": "date",
  "job_position": "string",
  "division": "string",
  "tempat_lahir": "string",
  "tanggal_lahir": "date",
  "gender": "L|P",
  "semester": "integer",
  "alamat": "string",
  "jenjang_pendidikan": "string",
  "nik": "string",
  "nomor_darurat": "string",
  "nama_kontak_darurat": "string",
  "bank_name": "string",
  "bank_account_name": "string",
  "bank_account_number": "string",
  "id_site": "integer (optional)"
}
```

**Response:** 201 Created

---

### POST /api/admin/users (Assign Role & Create User)
**Request Body:**
```json
{
  "id_mahasiswa": "integer (required)",
  "identifier": "string (required)",
  "email": "email (required)",
  "roles": ["array of role names, min 1"]
}
```

**Valid Roles:** `"intern"`, `"mentor"`, `"admin"`

**Response:** 201 Created

**Error Cases:**
- 400: Mahasiswa sudah punya user
- 422: Validation error (identifier/email kosong, duplicate, atau roles kosong)

---

## Testing

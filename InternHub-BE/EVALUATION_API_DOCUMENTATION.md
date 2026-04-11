# DOKUMENTASI EVALUATION COMPONENTS - UNTUK FRONTEND

## 1. STRUKTUR DATA

### A. Komponen Penilaian (Master Data)
```json
{
  "id": 1,
  "nama_komponen": "Integritas (etika, moral dan kesungguhan)",
  "created_at": "2026-02-09T10:00:00Z",
  "updated_at": "2026-02-09T10:00:00Z"
}
```

### B. Evaluation (Utama)
```json
{
  "id_evaluation": 1,
  "user_id": 101,
  "mentor_id": 5,
  "periode": "2026-01-01 to 2026-02-09",
  "status": "draft|final",
  "mentor_notes": "Catatan mentor",
  "evaluation_date": "2026-02-09",
  "final_score_numeric": 88.14,
  "final_score_letter": "A",
  "admin_reviewed": false,
  "admin_id": null,
  "admin_reviewed_at": null,
  "created_at": "2026-02-09T10:00:00Z",
  "updated_at": "2026-02-09T10:00:00Z"
}
```

### C. Evaluation Component (Pivot + Snapshot)
```json
{
  "id": 1,
  "id_evaluation": 1,
  "komponen_id": 1,
  "nama_komponen": "Integritas (etika, moral dan kesungguhan)",  // SNAPSHOT
  "score": 85,
  "created_at": "2026-02-09T10:00:00Z",
  "updated_at": "2026-02-09T10:00:00Z"
}
```

---

## 2. API ENDPOINTS

### A. KOMPONEN PENILAIAN (Master Data)

#### GET - List Semua Komponen
```http
GET /api/komponen-penilaian
```
**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "nama_komponen": "Integritas (etika, moral dan kesungguhan)"
    },
    {
      "id": 2,
      "nama_komponen": "Ketepatan waktu dalam bekerja"
    }
    // ... 7 komponen total
  ]
}
```

#### POST - Tambah Komponen (Admin Only)
```http
POST /api/komponen-penilaian
Content-Type: application/json
Authorization: Bearer {token}

{
  "nama_komponen": "Leadership"
}
```
**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": 8,
    "nama_komponen": "Leadership"
  }
}
```

#### PUT - Update Komponen (Admin Only)
```http
PUT /api/komponen-penilaian/1
Content-Type: application/json
Authorization: Bearer {token}

{
  "nama_komponen": "Integritas Moral (Updated)"
}
```
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "nama_komponen": "Integritas Moral (Updated)"
  }
}
```

#### DELETE - Hapus Komponen (Admin Only)
```http
DELETE /api/komponen-penilaian/1
Authorization: Bearer {token}
```
**Response (200 OK):**
```json
{
  "success": true,
  "message": "Komponen deleted successfully"
}
```

---

### B. EVALUATION (Main CRUD)

#### GET - List Evaluasi Mentor
```http
GET /api/evaluations?status=draft|final&intern_id=101
Authorization: Bearer {token}
```
**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id_evaluation": 1,
      "user_id": 101,
      "user": {
        "user_id": 101,
        "nama": "Budi Santoso"
      },
      "mentor_id": 5,
      "mentor": {
        "user_id": 5,
        "nama": "Mr. Setiawan"
      },
      "periode": "2026-01-01 to 2026-02-09",
      "status": "draft",
      "components": [
        {
          "id": 1,
          "komponen_id": 1,
          "nama_komponen": "Integritas (etika, moral dan kesungguhan)",
          "score": 85
        },
        {
          "id": 2,
          "komponen_id": 2,
          "nama_komponen": "Ketepatan waktu dalam bekerja",
          "score": 90
        }
        // ... 7 total
      ],
      "final_score_numeric": 88.14,
      "final_score_letter": "A",
      "mentor_notes": "Bagus sekali",
      "admin_reviewed": false,
      "admin_review_status": "need_review"
    }
  ]
}
```

#### GET - Detail Evaluasi
```http
GET /api/evaluations/1
Authorization: Bearer {token}
```
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id_evaluation": 1,
    "user_id": 101,
    "user": { ... },
    "mentor_id": 5,
    "mentor": { ... },
    "periode": "2026-01-01 to 2026-02-09",
    "status": "draft",
    "components": [
      {
        "id": 1,
        "komponen_id": 1,
        "nama_komponen": "Integritas (etika, moral dan kesungguhan)",
        "score": 85
      },
      // ... semua 7 komponen
    ],
    "final_score_numeric": 88.14,
    "final_score_letter": "A",
    "mentor_notes": "Catatan mentor",
    "evaluation_date": "2026-02-09",
    "admin_reviewed": false,
    "admin_review_status": "not_yet|need_review|done",
    "created_at": "2026-02-09T10:00:00Z"
  }
}
```

#### POST - Buat Evaluasi Baru (Mentor)
```http
POST /api/evaluations
Content-Type: application/json
Authorization: Bearer {token}

{
  "user_id": 101,
  "periode": "2026-01-01 to 2026-02-09",
  "mentor_notes": "Catatan awal",
  "components": [
    { "komponen_id": 1, "score": 85 },
    { "komponen_id": 2, "score": 90 },
    { "komponen_id": 3, "score": 88 },
    { "komponen_id": 4, "score": 92 },
    { "komponen_id": 5, "score": 87 },
    { "komponen_id": 6, "score": 89 },
    { "komponen_id": 7, "score": 86 }
  ]
}
```
**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id_evaluation": 1,
    "user_id": 101,
    "mentor_id": 5,
    "periode": "2026-01-01 to 2026-02-09",
    "status": "draft",
    "components": [
      {
        "id": 1,
        "komponen_id": 1,
        "nama_komponen": "Integritas (etika, moral dan kesungguhan)",
        "score": 85
      },
      // ... semua 7
    ],
    "final_score_numeric": 88.14,
    "final_score_letter": "A"
  }
}
```

#### PUT - Update Evaluasi (Mentor - hanya draft)
```http
PUT /api/evaluations/1
Content-Type: application/json
Authorization: Bearer {token}

{
  "mentor_notes": "Catatan yang diperbarui",
  "components": [
    { "komponen_id": 1, "score": 87 },
    { "komponen_id": 2, "score": 92 },
    // ... update components yang perlu diubah
  ]
}
```
**Response (200 OK):**
```json
{
  "success": true,
  "data": { ... }
}
```

#### PUT - Submit Evaluasi (Mentor - change status to final)
```http
PUT /api/evaluations/1/submit
Authorization: Bearer {token}
```
**Response (200 OK):**
```json
{
  "success": true,
  "message": "Evaluation submitted successfully",
  "data": {
    "status": "final",
    "admin_review_status": "need_review"
  }
}
```

#### DELETE - Hapus Evaluasi (Mentor - hanya draft)
```http
DELETE /api/evaluations/1
Authorization: Bearer {token}
```
**Response (200 OK):**
```json
{
  "success": true,
  "message": "Evaluation deleted successfully"
}
```

---

### C. ADMIN REVIEW

#### PUT - Review Evaluasi (Admin Only)
```http
PUT /api/evaluations/1/admin-review
Content-Type: application/json
Authorization: Bearer {token}

{
  "mentor_notes": "Catatan admin (optional)",
  "approved": true
}
```
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "admin_reviewed": true,
    "admin_id": 1,
    "admin_reviewed_at": "2026-02-09T15:30:00Z",
    "admin_review_status": "done"
  }
}
```

#### GET - List Evaluasi untuk Admin Review (Admin Only)
```http
GET /api/evaluations/admin/pending-review
Authorization: Bearer {token}
```
**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id_evaluation": 1,
      "user": { nama: "Budi" },
      "mentor": { nama: "Mr. Setiawan" },
      "final_score_letter": "A",
      "final_score_numeric": 88.14,
      "admin_review_status": "need_review"
    }
    // ... semua pending review
  ]
}
```

---

## 3. VALIDASI & CONSTRAINTS

### A. Komponen Penilaian
- ✓ `nama_komponen` required, string, unique
- ✓ Max 255 characters
- ✓ Minimal 7 komponen harus ada untuk evaluasi

### B. Evaluation
- ✓ `user_id` required, foreign key ke users
- ✓ `periode` format: "YYYY-MM-DD to YYYY-MM-DD"
- ✓ Status hanya: "draft" atau "final"
- ✓ Jika status "final", tidak boleh di-edit (read-only)
- ✓ Hanya mentor-nya atau admin yang bisa akses

### C. Evaluation Component
- ✓ `score` required, decimal 0-100
- ✓ `komponen_id` harus valid reference
- ✓ Unique constraint: (id_evaluation, komponen_id)
- ✓ Minimal 7 components per evaluation (all komponens required)

---

## 4. ERROR RESPONSES

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "score": ["Score harus antara 0-100"],
    "komponen_id": ["Komponen tidak ditemukan"]
  }
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Anda tidak memiliki akses untuk operasi ini",
  "error": "Unauthorized"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Evaluation tidak ditemukan"
}
```

### 422 Unprocessable Entity
```json
{
  "success": false,
  "message": "Evaluasi sudah final dan tidak bisa diedit"
}
```

---

## 5. FRONTEND WORKFLOW

### Scenario 1: Mentor Buat Evaluasi Baru
```
1. GET /api/komponen-penilaian
   → Display form dengan 7 komponen

2. Mentor input scores untuk setiap komponen (0-100)

3. POST /api/evaluations
   → Simpan sebagai "draft"
   → Display: "Evaluasi disimpan sebagai draft"

4. Mentor bisa edit/hapus selama status "draft"
   → PUT /api/evaluations/1
   → DELETE /api/evaluations/1

5. Mentor submit final
   → PUT /api/evaluations/1/submit
   → Display: "Evaluasi submitted untuk review"
   → Status berubah ke "final"
```

### Scenario 2: Admin Review Evaluasi
```
1. GET /api/evaluations/admin/pending-review
   → List semua evaluasi dengan status = "final" dan belum di-review

2. Admin klik salah satu
   → GET /api/evaluations/1
   → Display detail + semua komponen

3. Admin approve/reject
   → PUT /api/evaluations/1/admin-review
   → Status berubah ke "reviewed"
```

### Scenario 3: Admin Update Komponen Penilaian
```
1. GET /api/komponen-penilaian
   → List semua komponen (untuk master data management)

2. Admin klik edit komponen 1
   → PUT /api/komponen-penilaian/1
   → { "nama_komponen": "Integritas Moral" }

3. Evaluasi lama tetap pakai nama lama (SNAPSHOT)
   → Historical data tetap valid
```

---

## 6. FIELD YANG HARUS DITAMPILKAN FE

### Di Evaluation List:
- [ ] Nama Intern
- [ ] Universitas/Jurusan
- [ ] Periode
- [ ] Status (Draft / Final / Reviewed)
- [ ] Final Score (Numeric + Letter)
- [ ] Action (Edit/Delete/Submit jika draft, View jika final)

### Di Evaluation Detail:
- [ ] Mentor Notes
- [ ] Tabel komponen dengan:
  - Nama Komponen
  - Score (0-100)
  - Edit button (jika draft)
- [ ] Final Score (Auto-calculated)
- [ ] Status badge
- [ ] Admin review status (if applicable)
- [ ] Submit button (jika draft + semua score filled)
- [ ] Delete button (jika draft)

### Di Evaluation Form (Create/Edit):
- [ ] Dropdown: Select Intern
- [ ] Input: Periode (date range picker)
- [ ] Textarea: Mentor Notes
- [ ] Form Grid: Komponen + Score input (0-100)
- [ ] Real-time: Final Score calculation display
- [ ] Button: Save as Draft / Submit Final

---

## 7. CATATAN PENTING

⚠️ **Jangan lupa:**
1. Validasi score 0-100 di FE sebelum submit
2. Tampilkan warning jika ada komponen yang belum di-isi
3. Disable edit jika status = "final"
4. Show confirmation dialog sebelum delete evaluation
5. Cache komponen-penilaian di FE (jarang berubah)
6. Handle snapshot - jangan query nama dari master saat display
7. Real-time calculate final_score = average dari semua components

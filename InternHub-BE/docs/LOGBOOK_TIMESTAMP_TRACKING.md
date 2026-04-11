# Logbook Timestamp Tracking Guide

Dokumentasi lengkap mengenai timestamp tracking di Logbook untuk Frontend Development.

## 📋 Kolom-Kolom Timestamp

| Kolom | Tipe | Deskripsi | Set Kapan |
|-------|------|-----------|----------|
| `created_at` | datetime | Waktu logbook pertama kali dibuat | Create logbook (tidak bisa diubah) |
| `submitted_at` | datetime | Waktu terakhir kali di-submit untuk verifikasi | Submit baru / Resubmit setelah revisi |
| `verified_at` | datetime | Waktu logbook diverifikasi mentor/admin | Mentor/Admin memberikan status verified/revision_needed |
| `revision_at` | datetime | Waktu dimulai proses revision | Mentor meminta revisi (status: revision_needed) |

### Relasi Pengguna Timestamp

| Kolom | Relasi User | Deskripsi |
|-------|------------|-----------|
| `verified_by` | FK ke users | User ID mentor/admin yang verifikasi |
| `revision_by` | FK ke users | User ID mentor/admin yang meminta revisi |

---

## 🔄 Workflow & Timeline

### Scenario 1: Submit → Verified ✅

```
1. Create & Submit
   ├─ created_at: 2026-02-06 10:00:00 (now)
   ├─ submitted_at: 2026-02-06 10:00:00 (now)
   └─ status_verifikasi: pending

2. Mentor Approves
   ├─ verified_at: 2026-02-06 11:00:00 (now)
   ├─ verified_by: 2 (mentor_id)
   └─ status_verifikasi: verified
```

### Scenario 2: Submit → Revision → Resubmit → Verified ✅

```
1. Create & Submit
   ├─ created_at: 2026-02-06 10:00:00
   ├─ submitted_at: 2026-02-06 10:00:00
   └─ status_verifikasi: pending

2. Mentor Asks Revision
   ├─ revision_at: 2026-02-06 11:00:00 (now)
   ├─ revision_by: 2 (mentor_id)
   ├─ verified_at: 2026-02-06 11:00:00
   ├─ verified_by: 2
   └─ status_verifikasi: revision_needed
   └─ feedback: "Harap tambahkan detail kegiatan..."

3. Intern Resubmit (Edit & Submit)
   ├─ submitted_at: 2026-02-06 14:30:00 (UPDATED - now)
   ├─ status_verifikasi: pending
   └─ feedback: null (cleared)

4. Mentor Approves
   ├─ verified_at: 2026-02-06 15:00:00 (UPDATED - now)
   ├─ verified_by: 2
   └─ status_verifikasi: verified
   
Result: Semua timestamp tercatat dengan baik
```

### Scenario 3: Save as Draft

```
1. Create as Draft
   ├─ created_at: 2026-02-06 10:00:00
   ├─ submitted_at: null (NOT SET - ini draft)
   └─ status_verifikasi: draft

2. Later: Edit & Submit Draft
   ├─ submitted_at: 2026-02-06 14:00:00 (now - first submission)
   └─ status_verifikasi: pending
```

---

## 📤 API Response Structure

### GET `/api/logbook/{id}` atau LIST logbook

```json
{
  "success": true,
  "data": {
    "id_logbook": 193,
    "user_id": 10,
    "tanggal": "2026-02-06",
    "deskripsi_kegiatan": "Implementasi fitur login...",
    "bukti_kegiatan": ["storage/logbooks/file1.pdf"],
    "status_verifikasi": "revision_needed",
    
    "created_at": "2026-02-06T10:00:00.000000Z",
    "submitted_at": "2026-02-06T10:00:00.000000Z",
    "verified_at": "2026-02-06T11:00:00.000000Z",
    "verified_by": 2,
    "revision_at": "2026-02-06T11:00:00.000000Z",
    "revision_by": 2,
    
    "feedback": "Harap tambahkan dokumentasi...",
    "user": { "user_id": 10, "nama": "Budi Santoso" },
    "verifier": { "user_id": 2, "nama": "Mentor Name" }
  }
}
```

---

## 🎯 Frontend Usage Tips

### 1. Display Status dengan Timestamp

```javascript
// Show "Awaiting Review Since" untuk pending
if (logbook.status_verifikasi === 'pending') {
  console.log(`Menunggu verifikasi sejak ${logbook.submitted_at}`);
}

// Show "Revision Requested" dengan tanggal
if (logbook.status_verifikasi === 'revision_needed') {
  console.log(`Revisi diminta pada ${logbook.revision_at}`);
  console.log(`Feedback: ${logbook.feedback}`);
}

// Show "Verified" dengan tanggal & verifier
if (logbook.status_verifikasi === 'verified') {
  console.log(`Diverifikasi pada ${logbook.verified_at}`);
  console.log(`Oleh: ${logbook.verifier.nama}`);
}
```

### 2. Timeline Display

```javascript
// Build timeline dari timestamps
const timeline = [
  { 
    time: logbook.created_at, 
    label: "Dibuat", 
    status: "info" 
  },
  { 
    time: logbook.submitted_at, 
    label: "Disubmit", 
    status: "warning" 
  },
  ...(logbook.revision_at ? [{ 
    time: logbook.revision_at, 
    label: "Diminta Revisi", 
    status: "danger" 
  }] : []),
  ...(logbook.verified_at ? [{ 
    time: logbook.verified_at, 
    label: "Diverifikasi", 
    status: "success" 
  }] : [])
];
```

### 3. Show Resubmission Info

```javascript
// Jika submitted_at > created_at dan revision_at ada = resubmitted
const isResubmitted = 
  logbook.revision_at && 
  new Date(logbook.submitted_at) > new Date(logbook.revision_at);

if (isResubmitted) {
  console.log('Ini adalah resubmission setelah revisi');
  console.log(`Direvisi pada: ${logbook.revision_at}`);
  console.log(`Diresubmit pada: ${logbook.submitted_at}`);
}
```

### 4. Editable Status Indicator

```javascript
// Bisa di-edit jika: draft, revision_needed
const isEditable = ['draft', 'revision_needed'].includes(
  logbook.status_verifikasi
);

// Tampilkan alert jika sedang menunggu verifikasi
if (logbook.status_verifikasi === 'pending') {
  console.log('⏳ Logbook sedang menunggu verifikasi, tidak bisa diedit');
}
```

---

## 🔧 API Endpoints yang Berubah

### POST `/api/logbook` (Create & Submit)
- Jika `is_draft=false`: Set `submitted_at = now()`
- Jika `is_draft=true`: `submitted_at = null`

### PUT `/api/logbook/{id}` (Update & Resubmit)
- Jika `is_draft=false` (submit): Set `submitted_at = now()`
- Jika `is_draft=true` (save draft): Tidak ubah `submitted_at`

### POST `/api/logbook/{id}/verify` (Mentor Verification)
- Untuk status `revision_needed`: Set `revision_at = now()` & `revision_by = user_id`
- Untuk status `verified`: Set `verified_at = now()` & `verified_by = user_id`

---

## ⚠️ Important Notes

1. **`submitted_at` tidak pernah null saat pending/verified** - Selalu ada riwayat submission
2. **`revision_at` hanya ada saat `revision_needed`** - Indikasi ada feedback dari mentor
3. **Timestamps tidak dapat diedit manual** - Semua auto-generated oleh backend
4. **Timezone**: Semua timestamp dalam UTC (Z), sesuaikan di FE dengan timezone local jika perlu
5. **Resubmission tracking**: Bandingkan `submitted_at` dengan `revision_at` untuk tahu ada resubmission

---

## 📊 Summary Table

| Aksi | created_at | submitted_at | verified_at | revision_at |
|------|-----------|--------------|-------------|------------|
| Create Draft | ✅ SET | ❌ NULL | ❌ NULL | ❌ NULL |
| Create & Submit | ✅ SET | ✅ SET | ❌ NULL | ❌ NULL |
| Edit Draft | ✅ SAME | ❌ NULL | ❌ NULL | ❌ NULL |
| Resubmit Draft | ✅ SAME | ✅ SET | ❌ NULL | ❌ NULL |
| Mentor Approves | ✅ SAME | ✅ SAME | ✅ SET | ❌ NULL |
| Mentor Asks Revision | ✅ SAME | ✅ SAME | ✅ SET | ✅ SET |
| Resubmit After Revision | ✅ SAME | ✅ UPDATE | ✅ SAME | ✅ SAME |
| Final Approval | ✅ SAME | ✅ SAME | ✅ UPDATE | ✅ SAME |

---

**Last Updated**: 2026-02-06  
**Version**: 1.0

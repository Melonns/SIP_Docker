# Multiple Koreksi Absensi (Check-in & Check-out Bersamaan)

## Overview
Fitur ini memungkinkan intern untuk submit koreksi check-in dan check-out **dalam satu pengajuan** untuk tanggal yang sama, daripada harus submit 2 kali terpisah.

## Endpoint
```
POST /api/koreksi/store
```

## Format Request

### 1. Single Koreksi (Backward Compatible)
Seperti sebelumnya, kirim satu koreksi per request:

```json
{
  "jenis_koreksi": "lupa_absen_masuk",
  "tanggal": "2026-02-09",
  "jam_koreksi": "09:00",
  "alasan": "Lupa scan masuk karena terburu-buru"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Pengajuan koreksi absensi berhasil dikirim",
  "data": {
    "id_koreksi": 1,
    "user_id": 8,
    "jenis_koreksi": "lupa_absen_masuk",
    "tanggal": "2026-02-09",
    "jam_koreksi": "09:00",
    "alasan": "Lupa scan masuk karena terburu-buru",
    "status": "pending",
    ...
  }
}
```

---

### 2. Multiple Koreksi (NEW)
Kirim array koreksi untuk submit check-in dan check-out sekaligus:

```json
{
  "koreksi": [
    {
      "jenis_koreksi": "lupa_absen_masuk",
      "tanggal": "2026-02-09",
      "jam_koreksi": "09:00",
      "alasan": "Lupa scan masuk karena terburu-buru"
    },
    {
      "jenis_koreksi": "lupa_absen_pulang",
      "tanggal": "2026-02-09",
      "jam_koreksi": "17:30",
      "alasan": "Lupa scan pulang karena tergesa"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Pengajuan koreksi absensi berhasil dikirim (2 item)",
  "data": [
    {
      "id_koreksi": 2,
      "jenis_koreksi": "lupa_absen_masuk",
      "tanggal": "2026-02-09",
      "jam_koreksi": "09:00",
      ...
    },
    {
      "id_koreksi": 3,
      "jenis_koreksi": "lupa_absen_pulang",
      "tanggal": "2026-02-09",
      "jam_koreksi": "17:30",
      ...
    }
  ]
}
```

---

## Validasi

| Field | Rule | Keterangan |
|-------|------|-----------|
| `jenis_koreksi` | required, in:(lupa_absen_masuk, lupa_absen_pulang, pulang_cepat) | - |
| `tanggal` | required, date, before_or_equal:today | Tidak bisa koreksi hari depan |
| `jam_koreksi` | required, format:H:i | Format 24 jam (09:00, 17:30, dll) |
| `alasan` | required, max:1000 karakter | Wajib dijelaskan alasannya |

---

## Upload File (Optional)
Lampiran file bisa di-share untuk semua koreksi dalam satu submission:

### Single Koreksi dengan File:
```bash
curl -X POST http://localhost:8000/api/koreksi/store \
  -H "Authorization: Bearer TOKEN" \
  -F "jenis_koreksi=lupa_absen_masuk" \
  -F "tanggal=2026-02-09" \
  -F "jam_koreksi=09:00" \
  -F "alasan=Lupa scan" \
  -F "lampiran=@file1.pdf" \
  -F "lampiran=@file2.jpg"
```

### Multiple Koreksi dengan File:
```bash
curl -X POST http://localhost:8000/api/koreksi/store \
  -H "Authorization: Bearer TOKEN" \
  -F 'koreksi[0][jenis_koreksi]=lupa_absen_masuk' \
  -F 'koreksi[0][tanggal]=2026-02-09' \
  -F 'koreksi[0][jam_koreksi]=09:00' \
  -F 'koreksi[0][alasan]=Lupa scan masuk' \
  -F 'koreksi[1][jenis_koreksi]=lupa_absen_pulang' \
  -F 'koreksi[1][tanggal]=2026-02-09' \
  -F 'koreksi[1][jam_koreksi]=17:30' \
  -F 'koreksi[1][alasan]=Lupa scan pulang' \
  -F "lampiran=@buktilaporanmasuk.pdf" \
  -F "lampiran=@buktilaporanpulang.jpg"
```

---

## Approval Flow (Tetap Sama)

Setiap koreksi tetap di-approve secara **berjenjang**:

1. **Mentor Approval** → Cek apakah alasan valid
2. **Admin Approval** → Setelah mentor approve, admin proses
3. **Attendance Update** → Jika admin approve, `attendances` otomatis update

Masing-masing koreksi punya `id_koreksi` sendiri, jadi mentor/admin bisa approve/reject dengan granular (bisa terima check-in tapi tolak check-out).

---

## Migration/Database

Tidak ada perubahan struktur tabel. Table `attendance_corrections` tetap sama:
- Setiap record koreksi adalah row terpisah
- Multiple koreksi = multiple rows dengan user_id & tanggal yang sama

---

## Keuntungan

✅ **Lebih efisien**: User bisa submit check-in + check-out sekaligus  
✅ **Backward compatible**: Single koreksi masih berfungsi seperti sebelumnya  
✅ **Per-item approval**: Mentor/admin bisa approve/reject tiap item secara independen  
✅ **Same day correction**: Bisa koreksi masuk & pulang pada hari yang sama  

---

## Contoh Use Case

**Scenario**: Intern lupa scan masuk & pulang pada tanggal 9 Februari

**Sebelumnya** (2 request):
1. Submit koreksi masuk
2. Tunggu approval mentor
3. Submit koreksi pulang
4. Tunggu approval mentor

**Sekarang** (1 request):
1. Submit kedua koreksi sekaligus
2. Tunggu approval mentor (untuk kedua item)

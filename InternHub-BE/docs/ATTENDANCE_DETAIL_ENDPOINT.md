# Attendance Detail Complete Endpoint Documentation

## Endpoint
```
GET /api/mentor/interns/{id}/attendance-detail
GET /api/admin/interns/{id}/attendance-detail
```

## Description
Retrieve detailed attendance records for an intern with complete information including clock in/out details, location coordinates, photos, and all absence reasons (izin/sakit, koreksi).

## Authorization
- Require: `mentor` or `admin` role
- Mentor can only access their own assigned interns
- Admin can access all interns

## Parameters

### Path Parameters
- `{id}` (required, integer): Intern user ID

### Query Parameters
- `start_date` (optional, string): Start date in format `YYYY-MM-DD` or `YYYY-MM` (default: intern's mulai_magang)
- `end_date` (optional, string): End date in format `YYYY-MM-DD` or `YYYY-MM` (default: today)
- `tanggal` (optional, string): Single date filter in format `YYYY-MM-DD` (overrides start_date/end_date)
- `page` (optional, integer): Page number for pagination (default: 1)
- `per_page` (optional, integer): Records per page (default: 20)

## Response

### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "intern": {
      "id": 4,
      "nama": "Alvian Maulana",
      "identifier": "NIM123456"
    },
    "period": {
      "start": "2026-01-05",
      "end": "2026-02-05"
    },
    "attendance_records": [
      {
        "tanggal": "2026-02-05",
        "hari": "Thursday",
        "is_weekend": false,
        "is_libur": false,
        "attendance_status": "ontime",
        "clock_in": {
          "waktu": "07:42:00",
          "latitude": -7.329588,
          "longitude": 112.758653,
          "foto": "http://localhost:5173/storage/...",
          "foto_filename": "attendance_20260205_074200.jpg",
          "lama_telat": 0,
          "is_valid_area": 1
        },
        "clock_out": {
          "waktu": "17:19:00",
          "latitude": -7.329588,
          "longitude": 112.758653,
          "foto": "http://localhost:5173/storage/...",
          "foto_filename": "attendance_20260205_171900.jpg",
          "early": 0,
          "remark": null
        },
        "work_duration": {
          "formatted": "09:37",
          "minutes": 577
        },
        "izin": null,
        "koreksi": null
      },
      {
        "tanggal": "2026-01-26",
        "hari": "Monday",
        "is_weekend": false,
        "is_libur": false,
        "attendance_status": "sick",
        "clock_in": null,
        "clock_out": null,
        "work_duration": {
          "formatted": null,
          "minutes": null
        },
        "izin": {
          "id": 5,
          "jenis": "sakit",
          "tanggal_mulai": "2026-01-26",
          "tanggal_selesai": "2026-01-26",
          "durasi_hari": 1,
          "keterangan": "Demam",
          "status": "approved"
        },
        "koreksi": null
      },
      {
        "tanggal": "2026-02-04",
        "hari": "Wednesday",
        "is_weekend": false,
        "is_libur": false,
        "attendance_status": "corrected",
        "clock_in": {
          "waktu": "07:37:00",
          "latitude": -7.330288,
          "longitude": 112.759053,
          "foto": null,
          "foto_filename": null,
          "lama_telat": 0,
          "is_valid_area": 1
        },
        "clock_out": {
          "waktu": "17:03:00",
          "latitude": -7.330288,
          "longitude": 112.759053,
          "foto": null,
          "foto_filename": null,
          "early": 0,
          "remark": null
        },
        "work_duration": {
          "formatted": "09:26",
          "minutes": 566
        },
        "izin": null,
        "koreksi": {
          "id": 1,
          "alasan": "Terburu-buru pulang ada urusan keluarga",
          "status": "approved",
          "diverifikasi_oleh": 2,
          "tanggal_verifikasi": "2026-02-05"
        }
      }
    ],
    "pagination": {
      "total": 26,
      "per_page": 20,
      "current_page": 1,
      "last_page": 2,
      "from": 1,
      "to": 20
    }
  }
}
```

### Error Responses

#### 404 Not Found
```json
{
  "success": false,
  "message": "Intern tidak ditemukan"
}
```

#### 403 Forbidden
```json
{
  "success": false,
  "message": "You do not have access to this intern"
}
```

## Attendance Status Values
- `ontime`: Attended on time (clock in before or at schedule time)
- `late`: Attended but late (clock in after schedule time)
- `incomplete`: Only partial attendance (either clock in or clock out missing)
- `absent`: No attendance record for the day
- `sick`: Approved sick leave (izin sakit)
- `on_leave`: Approved leave request (izin)
- `corrected`: Has approved koreksi/correction
- `weekend`: Saturday or Sunday
- `holiday`: Public holiday (holidays)
- `not_submitted`: No attendance data submitted

## Usage Examples

### Get complete attendance for last 30 days
```
GET /api/mentor/interns/4/attendance-detail?page=1&per_page=10
```

### Get attendance for specific date range
```
GET /api/mentor/interns/4/attendance-detail?start_date=2026-01-01&end_date=2026-02-05&per_page=15
```

### Get single date attendance
```
GET /api/mentor/interns/4/attendance-detail?tanggal=2026-02-03
```

### Get second page with 20 records per page
```
GET /api/mentor/interns/4/attendance-detail?page=2&per_page=20
```

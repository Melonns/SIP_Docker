# Intern Profile CSV Import

## Overview
This feature lets Admins import Intern Profiles using a CSV template (documents are excluded). The preview focuses only on **Internship & Placement** fields to keep mapping clean.

## How to Use (Admin)
1. Go to **Admin → Intern Profiles**.
2. Click **Import CSV**.
3. Download the template and fill it.
4. Upload the CSV and click **Preview**.
5. Review Internship & Placement fields in the preview.
6. Use **Auto-fix All** to normalize Division, Placement, and Work Schedule.
7. Click **Confirm Import**.

## Template Columns
The CSV must include these headers **in this order**:
- Full Name
- NIK
- NIM/NIP
- Education Level
- Institution
- Major
- Email
- WhatsApp Number
- Residential Address
- Position
- Division
- Placement Location
- Internship Start
- Internship End
- Work Schedule
- Emergency Contact Name
- Emergency Contact Number
- Bank Name
- Account Holder
- Account Number

## Admin Filling Guide
- Use **real names** and **valid NIM/NIP** (no spaces).
- **Education Level**: SMK/SMA, D3, D4, S1, S2.
- **Division**: can be typed freely. If not in list, it will be kept and auto-added during preview.
- **Placement Location**: must match Office Location names; Auto-fix will correct case or set default.
- **Work Schedule**: must match Working Schedule names; Auto-fix will correct case or set default.
- **Dates**: use `MM/DD/YYYY` (example: `01/01/2026`).
- **Documents are excluded** (photo, student ID).

## Notes
- Placement and Work Schedule are normalized in preview only.
- If a row is missing critical fields, fix them in preview before confirming.

## Auto-fix Rules
- Placement Location: case-insensitive match to Office Locations, otherwise defaults to the first site.
- Work Schedule: case-insensitive match to schedules, otherwise defaults to the first schedule.
- Division: case-insensitive match to existing divisions; if not found, it stays as typed and is added for preview.

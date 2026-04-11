<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;
use App\Models\TblMahasiswa;
use App\Models\Role;
use App\Models\TblSite;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as PhpSpreadsheetDate;

class UserImportController extends Controller
{
    /**
     * Download Excel Template for User Import
     */
    public function downloadTemplate()
    {
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('User Import Template');

        // Headers
        $headers = [
            'name', 'nip_nim', 'email', 'role', 'status', 
            'job_position', 'division', 'office_location', 
            'period_start', 'period_end'
        ];
        $sheet->fromArray($headers, null, 'A1');

        // Example Data
        $examples = [
            [
                'John Doe', '12345678', 'john.doe@example.com', 'mentor', 'active', 
                'Senior Developer', 'IT', 'Head Office', 
                '', ''
            ],
            [
                'Jane Intern', '20240001', 'jane.intern@student.univ.ac.id', 'intern', 'active', 
                'Intern Frontend', 'Product', 'Branch Bandung', 
                '2024-01-01', '2024-06-30'
            ]
        ];
        $sheet->fromArray($examples, null, 'A2');

        // Auto-size columns
        foreach (range('A', 'K') as $columnID) {
            $sheet->getColumnDimension($columnID)->setAutoSize(true);
        }

        $writer = new Xlsx($spreadsheet);
        $filename = 'user_import_template.xlsx';

        return response()->streamDownload(function() use ($writer) {
            $writer->save('php://output');
        }, $filename);
    }

    /**
     * Preview Import File
     */
    public function preview(Request $request)
    {
        $file = $request->file('file');
        if (!$file || !$file->isValid()) {
            return response()->json(['ok' => false, 'message' => 'File valid tidak ditemukan'], 422);
        }

        try {
            $spreadsheet = IOFactory::load($file->getRealPath());
            $sheet = $spreadsheet->getActiveSheet();
            $rows = $sheet->toArray(null, true, true, true);
        } catch (\Exception $e) {
            return response()->json(['ok' => false, 'message' => 'Gagal membaca file: ' . $e->getMessage()], 400);
        }

        if (count($rows) < 2) {
            return response()->json(['ok' => false, 'message' => 'File kosong atau tidak ada header'], 422);
        }

        // Parse Headers
        $headerRow = array_shift($rows); // Remove first row
        $map = $this->mapHeaders($headerRow);

        if (!$map['name'] || !$map['nip_nim'] || !$map['email'] || !$map['role']) {
            return response()->json([
                'ok' => false, 
                'message' => 'Kolom wajib (name, nip_nim, email, role) tidak ditemukan. Pastikan menggunakan template yang benar.'
            ], 422);
        }

        // Pre-fetch related data for validation
        $existingEmails = User::pluck('email')->toArray();
        // Existing identifiers should be read from profile tables (students.nim, employees.nip)
        $existingIdentifiers = array_merge(
            TblMahasiswa::whereNotNull('nim')->pluck('nim')->toArray(),
            \App\Models\TblKaryawan::whereNotNull('nip')->pluck('nip')->toArray()
        );
        $sites = TblSite::pluck('id_site', 'nama_site')->toArray(); // name => id
        // Case-insensitive site matching helper
        $siteMap = [];
        foreach ($sites as $name => $id) {
            $siteMap[strtolower(trim($name))] = $id;
        }

        // Work schedule lookup (name => id) - allow CSV to provide either id or name
        $workSchedules = \App\Models\WorkSchedule::pluck('id', 'name')->toArray();
        $workScheduleMap = [];
        foreach ($workSchedules as $name => $id) {
            $workScheduleMap[strtolower(trim($name))] = $id;
        }

        $parsedRows = [];
        $headerErrors = [];
        $parsedCount = 0;
        $errorCount = 0;

        foreach ($rows as $idx => $row) {
            $rowNum = $idx + 1; // Original Excel row number (since we shifted header is row 1, so data starts row 2, but array key is preserved from toArray if used differently.. toArray(true, true, true, true) returns indexed by A,B,C.. wait, toArray returns arrays. 
            // Correct way with toArray(null, true, true, true) is row index is preserved? No, array_shift reindexes if numerical keys, but $rows from toArray with true,true,true returning keys as 1,2,3? actually toArray format depends.
            // Let's assume numerical index from array_values logic if needed, but simpler:
            // The $rows from $sheet->toArray(...) returns [1 => [A=>val, B=>val], 2=>...] if mapped.
            // Wait, I used array_shift, so keys might be messed up if I am not careful.
            
            // Let's reload to be safe and use explicit iteration
            // We already shifted. The keys in $rows likely preserved if they were 2,3,4... let's assume standard behavior.
            // Actually, let's just use a counter.
            
            $isEmpty = true;
            foreach ($row as $cell) {
                if (trim((string)$cell) !== '') {
                    $isEmpty = false;
                    break;
                }
            }
            if ($isEmpty) continue; // Skip blank rows

            $rowData = [
                'name' => trim((string)($row[$map['name']] ?? '')),
                'nip_nim' => trim((string)($row[$map['nip_nim']] ?? '')),
                'email' => trim((string)($row[$map['email']] ?? '')),
                'role' => strtolower(trim((string)($row[$map['role']] ?? ''))),
                'status' => strtolower(trim((string)($row[$map['status']] ?? 'active'))),
                'job_position' => trim((string)($row[$map['job_position']] ?? '')),
                'division' => trim((string)($row[$map['division']] ?? '')),
                'office_location' => trim((string)($row[$map['office_location']] ?? '')),
                'period_start' => $this->parseDate($row[$map['period_start']] ?? null),
                'period_end' => $this->parseDate($row[$map['period_end']] ?? null),
                // FE header "Work Schedule" -> resolve to work_schedule_id (optional)
                'work_schedule' => trim((string)($row[$map['work_schedule']] ?? '')),
                'work_schedule_id' => null,
            ];

            $errors = [];

            // Validations
            if (!$rowData['name']) $errors[] = 'Nama wajib diisi';
            if (!$rowData['nip_nim']) $errors[] = 'NIP/NIM wajib diisi';
            if (!$rowData['email']) $errors[] = 'Email wajib diisi';
            if (!$rowData['role']) $errors[] = 'Role wajib diisi';

            // Check Uniqueness (Basic check against DB snapshot, simplified)
            if (in_array($rowData['email'], $existingEmails)) {
                 // Note: We might decide to update, so maybe just a warning or info? 
                 // For now, let's flag it as "Will Update" or "Duplicate" depending on policy.
                 // User request didn't specify. Let's assume we allow updating if identifier matches, or fail if email matches different user.
                 // For simplicity in preview:
                 $errors[] = 'Email sudah digunakan (akan di-skip/update)'; 
            }
            if (in_array($rowData['nip_nim'], $existingIdentifiers)) {
                 $errors[] = 'NIP/NIM sudah digunakan (akan di-skip/update)';
            }

            // Site Validation
            $siteId = null;
            if ($rowData['office_location']) {
                $siteKey = strtolower($rowData['office_location']);
                if (isset($siteMap[$siteKey])) {
                    $siteId = $siteMap[$siteKey];
                } else {
                    $errors[] = "Lokasi kantor '{$rowData['office_location']}' tidak ditemukan";
                }
            }
            $rowData['id_site'] = $siteId;

            // Work schedule validation / resolution (FE may send name or numeric id)
            if (!empty($rowData['work_schedule'])) {
                $wsVal = $rowData['work_schedule'];
                $wsId = null;
                if (is_numeric($wsVal)) {
                    $ws = \App\Models\WorkSchedule::find((int)$wsVal);
                    if ($ws) $wsId = $ws->id;
                } else {
                    $key = strtolower(trim($wsVal));
                    if (isset($workScheduleMap[$key])) $wsId = $workScheduleMap[$key];
                }

                if ($wsId) {
                    $rowData['work_schedule_id'] = $wsId;
                } else {
                    $errors[] = "Work schedule '{$rowData['work_schedule']}' tidak ditemukan";
                }
            }

            // Role Validation
            if (!in_array($rowData['role'], ['admin', 'mentor', 'intern'])) {
                $errors[] = "Role '{$rowData['role']}' tidak valid (gunakan: admin, mentor, intern)";
            }

            // Intern specific checks — align with Admin single-add (`storeAdminProfile`)
            if ($rowData['role'] === 'intern') {
                // period start/end must be present (preview already enforced)
                if (!$rowData['period_start']) $errors[] = 'Tanggal mulai magang wajib untuk intern';
                if (!$rowData['period_end']) $errors[] = 'Tanggal akhir magang wajib untuk intern';

                // Require job position, division and office location (maps to id_site)
                if (!$rowData['job_position']) $errors[] = 'Job position wajib diisi untuk intern (sama seperti add intern manual)';
                if (!$rowData['division']) $errors[] = 'Division wajib diisi untuk intern (sama seperti add intern manual)';
                if (!$rowData['office_location']) $errors[] = 'Office location (id_site) wajib diisi untuk intern';

                // Ensure site mapping exists for provided office_location
                if ($rowData['office_location'] && empty($rowData['id_site'])) {
                    $errors[] = "Lokasi kantor '{$rowData['office_location']}' tidak ditemukan (harus cocok dengan sites)";
                }
            }

            $parsedRow = [
                'row' => $idx + 1, // Approximation
                'data' => $rowData,
                'errors' => $errors
            ];
            
            $parsedRows[] = $parsedRow;
            
            if (!empty($errors)) {
                $errorCount++;
            } else {
                $parsedCount++;
            }
        }

        // Cache result for import
        $token = Str::random(40);
        Cache::put('user_import_' . $token, $parsedRows, now()->addMinutes(30));

        return response()->json([
            'ok' => true,
            'preview' => $parsedRows,
            'summary' => [
                'total' => count($parsedRows),
                'valid' => $parsedCount,
                'invalid' => $errorCount
            ],
            'preview_token' => $token
        ]);
    }

    /**
     * Execute Import
     */
    public function import(Request $request)
    {
        $rows = [];

        // Option 1: Direct Data (e.g. from Frontend fixed grid)
        if ($request->has('data') && is_array($request->input('data'))) {
            $rawData = $request->input('data');
            foreach ($rawData as $idx => $d) {
                // Ensure structure matches what the loop expects
                // Normalize incoming row keys from frontend (e.g. nama_lengkap, identifier, mulai_magang)
                $normalized = $this->normalizeIncomingRow($d);
                $rows[] = [
                    'row' => $idx + 1,
                    'data' => $normalized,
                    'errors' => [] // Assume FE has done some validation or user is forcing it
                ];
            }
        } 
        // Option 2: Via Token (Cached from Preview)
        elseif ($request->has('preview_token')) {
            $token = $request->input('preview_token');
            $rows = Cache::get('user_import_' . $token);
            
            if (!$rows) {
                return response()->json(['ok' => false, 'message' => 'Data import kadaluarsa, silakan upload ulang'], 400);
            }
        } 
        else {
            return response()->json(['ok' => false, 'message' => 'Data import tidak ditemukan (kirim `data` json atau `preview_token`)'], 400);
        }

        $imported = 0;
        $updated = 0;
        $failed = 0;
        $errors = [];

        DB::beginTransaction();
        try {
            foreach ($rows as $item) {
                // Skip rows with fatal errors from preview
                // Or try to process if they are soft errors (like duplicates that we handle as updates)
                // For safety, let's filter only valid-ish rows or handle explicitly.
                // Let's retry valid rows.
                
                $d = $item['data'];
                $errs = $item['errors'];

                // Filter out non-recoverable errors
                $hasFatal = false;
                foreach ($errs as $e) {
                    if (strpos($e, 'wajib') !== false || strpos($e, 'tidak valid') !== false || strpos($e, 'tidak ditemukan') !== false) {
                        $hasFatal = true;
                        break;
                    }
                }
                if ($hasFatal) {
                    $failed++;
                    $errors[] = [
                        'row' => $item['row'],
                        'errors' => $errs,
                        'data' => $d // Optional: return data to help identify the row
                    ];
                    continue;
                }

                // Check existence by email first, then profile NIM/NIP
                $user = User::where('email', $d['email'])->first();
                if (!$user) {
                    $mahasiswa = TblMahasiswa::where('nim', $d['nip_nim'])->first();
                    if ($mahasiswa && $mahasiswa->user_id) {
                        $user = User::find($mahasiswa->user_id);
                    } else {
                        $karyawan = \App\Models\TblKaryawan::where('nip', $d['nip_nim'])->first();
                        if ($karyawan && $karyawan->user_id) {
                            $user = User::find($karyawan->user_id);
                        }
                    }
                }

                if ($user) {
                    // UPDATE check
                    // Verify that profile identifier matches requested NIP/NIM (if role provided)
                    $existingIdentifier = $user->mahasiswa?->nim ?? $user->karyawan?->nip ?? null;
                    if ($existingIdentifier && $existingIdentifier !== $d['nip_nim']) {
                        $errors[] = "Row {$item['row']}: Conflict - Email {$d['email']} belongs to another NIP";
                        $failed++;
                        continue;
                    }

                    // Update fields (login-only); profile fields go to students/employees
                    $user->nama = $d['name'];
                    $user->status = $d['status'];

                    $user->save();

                    // Update profile fields
                    if (strtolower($d['role']) === 'intern') {
                        $mahasiswa = TblMahasiswa::where('user_id', $user->user_id)->first();
                        if ($mahasiswa) {
                            $mahasiswa->job_position = $d['job_position'];
                            $mahasiswa->division = $d['division'];
                            $mahasiswa->mulai_magang = !empty($d['period_start']) ? $d['period_start'] : null;
                            $mahasiswa->akhir_magang = !empty($d['period_end']) ? $d['period_end'] : null;

                            // prefer explicit id_site, otherwise try to guess from division (same logic as admin flow)
                            $siteId = $d['id_site'] ?? $this->guessSiteIdFromDivision($d['division']);
                            if (! empty($siteId)) {
                                $mahasiswa->id_site = $siteId;
                            }

                            // apply work schedule if provided
                            if (! empty($d['work_schedule_id'])) {
                                $mahasiswa->work_schedule_id = $d['work_schedule_id'];
                            }

                            $mahasiswa->save();
                        } else {
                            // Create mahasiswa record if missing — require/guess id_site like admin
                            $siteId = $d['id_site'] ?? $this->guessSiteIdFromDivision($d['division']);
                            if (empty($siteId)) {
                                $failed++;
                                $errors[] = [
                                    'row' => $item['row'],
                                    'errors' => ['id_site (office_location) diperlukan / tidak ditemukan'],
                                    'data' => $d
                                ];
                                continue;
                            }

                            TblMahasiswa::create([
                                'user_id' => $user->user_id,
                                'nim' => $d['nip_nim'],
                                'nama' => $d['name'],
                                'job_position' => $d['job_position'],
                                'division' => $d['division'],
                                'mulai_magang' => !empty($d['period_start']) ? $d['period_start'] : null,
                                'akhir_magang' => !empty($d['period_end']) ? $d['period_end'] : null,
                                'id_site' => $siteId,
                                'work_schedule_id' => $d['work_schedule_id'] ?? null,
                            ]);
                        }
                    } else {
                        // Employee/profile update
                        $karyawan = \App\Models\TblKaryawan::where('user_id', $user->user_id)->first();
                        if ($karyawan) {
                            $karyawan->job_position = $d['job_position'];
                            $karyawan->division = $d['division'];
                            $karyawan->division_id = \App\Models\Division::findOrCreateByName($d['division'])?->id_division ?? $karyawan->division_id;
                            $karyawan->nama = $d['name'] ?? $karyawan->nama;
                            $karyawan->email = $d['email'] ?? $karyawan->email;
                            $karyawan->gender = $d['gender'] ?? $karyawan->gender;
                            if (! empty($d['id_site'])) {
                                $karyawan->id_site = $d['id_site'];
                            } else {
                                $karyawan->id_site = $this->guessSiteIdFromDivision($d['division']) ?? $karyawan->id_site;
                            }
                            $karyawan->save();
                        } else {
                            \App\Models\TblKaryawan::create([
                                'user_id' => $user->user_id,
                                'nip' => $d['nip_nim'],
                                'nama' => $d['name'] ?? null,
                                'email' => $d['email'] ?? null,
                                'gender' => $d['gender'] ?? null,
                                'job_position' => $d['job_position'],
                                'division' => $d['division'],                                'division_id' => \App\Models\Division::findOrCreateByName($d['division'])?->id_division,                                'id_site' => $d['id_site'] ?? $this->guessSiteIdFromDivision($d['division']),
                            ]);
                        }
                    }

                    $this->assignRole($user, $d['role']);
                    $updated++;

                } else {
                    // CREATE
                    // Create minimal user (login info only). Profile data stored in students/employees
                    $newUser = new User();
                    $newUser->nama = $d['name'];
                    $newUser->email = $d['email'];
                    $newUser->status = $d['status'];
                    $newUser->password = Hash::make('password123');
                    $newUser->save();

                    // Create profile in students for interns with profile fields
                    if (strtolower($d['role']) === 'intern') {
                        // Ensure id_site exists (prefer explicit, otherwise try to guess from division)
                        $siteId = $d['id_site'] ?? $this->guessSiteIdFromDivision($d['division']);
                        if (empty($siteId)) {
                            $failed++;
                            $errors[] = [
                                'row' => $item['row'],
                                'errors' => ['id_site (office_location) diperlukan / tidak ditemukan'],
                                'data' => $d
                            ];
                            continue;
                        }

                        TblMahasiswa::create([
                            'user_id' => $newUser->user_id,
                            'nim' => $d['nip_nim'],
                            'nama' => $d['name'],
                            'job_position' => $d['job_position'],
                            'division' => $d['division'],
                            'mulai_magang' => !empty($d['period_start']) ? $d['period_start'] : null,
                            'akhir_magang' => !empty($d['period_end']) ? $d['period_end'] : null,
                            'id_site' => $siteId,
                                'work_schedule_id' => $d['work_schedule_id'] ?? null,
                        ]);
                    } else {
                        // Create employee profile
                        \App\Models\TblKaryawan::updateOrCreate(
                            ['user_id' => $newUser->user_id],
                            [
                                'nip' => $d['nip_nim'],
                                'nama' => $d['name'] ?? null,
                                'email' => $d['email'] ?? null,
                                'gender' => $d['gender'] ?? null,
                                'job_position' => $d['job_position'],
                                'division' => $d['division'],
                                'id_site' => $d['id_site'] ?? null,
                            ]
                        );
                    }
                    
                    $this->assignRole($newUser, $d['role']);
                    $imported++;
                }
            }
            
            DB::commit();
            
            // Clear cache if token was used
            if (isset($token) && $token) {
                Cache::forget('user_import_' . $token);
            }

            $totalSuccess = $imported + $updated;

            return response()->json([
                'ok' => true,
                'message' => "Import selesai. Berhasil: {$totalSuccess}, Gagal: {$failed}",
                'details' => $errors
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['ok' => false, 'message' => 'Terjadi kesalahan sistem: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Guess id_site from division using config/site_mappings.php (same logic as SyncSierEmployees)
     */
    protected function guessSiteIdFromDivision(?string $division)
    {
        if (empty($division)) return null;
        $divisionLow = mb_strtolower($division);
        $patterns = config('site_mappings.patterns', []);

        foreach ($patterns as $siteName => $keywords) {
            foreach ($keywords as $kw) {
                $kw = mb_strtolower($kw);
                if ($kw === '') continue;
                if (mb_strpos($divisionLow, $kw) !== false) {
                    $site = \App\Models\TblSite::where('nama_site', 'like', "%{$siteName}%")->first();
                    if ($site) return $site->id_site;
                    $site2 = \App\Models\TblSite::where('nama_site', 'like', "%{$kw}%")->first();
                    if ($site2) return $site2->id_site;
                }
            }
        }

        $defaultName = config('site_mappings.default_site_name');
        if (! empty($defaultName)) {
            $s = \App\Models\TblSite::where('nama_site', 'like', "%{$defaultName}%")->first();
            if ($s) return $s->id_site;
        }

        return null;
    }

    private function assignRole($user, $roleName)
    {
        // Simple role assignment
        try {
            $role = Role::where('name', $roleName)->first();
            if ($role) {
                // Sync roles? Or add? 
                // Requirement implies single role column. Let's sync to ensure it matches input.
                $user->roles()->sync([$role->role_id]);
            }
        } catch (\Exception $e) {
            // ignore
        }
    }

    /**
     * Normalize incoming row payloads from frontend to controller-internal keys.
     * Accepts variations like `nama_lengkap`, `identifier`, `mulai_magang`, `akhir_magang`, `work_schedule`, etc.
     */
    private function normalizeIncomingRow(array $r)
    {
        $out = [];

        // name
        $out['name'] = trim((string)($r['nama'] ?? $r['nama_lengkap'] ?? $r['full_name'] ?? $r['name'] ?? ''));

        // identifier / nim / nip
        $out['nip_nim'] = trim((string)($r['identifier'] ?? $r['nim'] ?? $r['nip'] ?? $r['nip_nim'] ?? ''));

        // email
        $out['email'] = trim((string)($r['email'] ?? ''));

        // role (default to intern)
        $out['role'] = strtolower(trim((string)($r['role'] ?? 'intern')) ?: 'intern');

        // status
        $out['status'] = strtolower(trim((string)($r['status'] ?? $r['user_status'] ?? 'active')) ?: 'active');

        // job position / division
        $out['job_position'] = trim((string)($r['job_position'] ?? $r['position'] ?? ''));
        $out['division'] = trim((string)($r['division'] ?? $r['divisi'] ?? ''));

        // office location / id_site
        $out['office_location'] = trim((string)($r['office_location'] ?? $r['placement_location'] ?? $r['placement'] ?? ''));
        $out['id_site'] = $r['id_site'] ?? $r['site_id'] ?? null;

        // period start / end (map dari berbagai key atau langsung nilai periode jika sudah)
        $out['period_start'] = $this->parseDate($r['period_start'] ?? $r['mulai_magang'] ?? $r['internship_start'] ?? $r['internshipstart'] ?? $r['Internship Start'] ?? null);
        $out['period_end'] = $this->parseDate($r['period_end'] ?? $r['akhir_magang'] ?? $r['internship_end'] ?? $r['internshipend'] ?? $r['Internship End'] ?? null);

        // work schedule (may be id or name)
        $wsVal = $r['work_schedule_id'] ?? $r['work_schedule'] ?? $r['work schedule'] ?? null;
        $out['work_schedule_id'] = null;
        if (!empty($wsVal)) {
            if (is_numeric($wsVal)) {
                $out['work_schedule_id'] = (int)$wsVal;
            } else {
                $ws = \App\Models\WorkSchedule::where('name', $wsVal)->orWhere('name', 'like', "%{$wsVal}%")->first();
                if ($ws) $out['work_schedule_id'] = $ws->id;
            }
        }

        // pass-through other optional student fields if present
        $out['universitas'] = $r['universitas'] ?? $r['university'] ?? null;
        $out['jurusan'] = $r['jurusan'] ?? $r['major'] ?? null;
        $out['alamat'] = $r['alamat'] ?? null;
        $out['no_telp'] = $r['no_telp'] ?? $r['phone'] ?? null;
        $out['nik'] = $r['nik'] ?? null;
        $out['jenjang_pendidikan'] = $r['jenjang_pendidikan'] ?? null;

        return $out;
    }

    private function mapHeaders($row)
    {
        $map = [
            'name' => null, 'nip_nim' => null, 'email' => null, 'role' => null, 'status' => null,
            'job_position' => null, 'division' => null, 'office_location' => null,
            'period_start' => null, 'period_end' => null, 'work_schedule' => null
        ];

        foreach ($row as $colKey => $colVal) {
            $h = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', trim($colVal)));
            
            if (str_contains($h, 'name') || str_contains($h, 'nama') || str_contains($h, 'fullname')) $map['name'] = $colKey;
            elseif (str_contains($h, 'nip') || str_contains($h, 'nim') || str_contains($h, 'identifier')) $map['nip_nim'] = $colKey;
            elseif (str_contains($h, 'email')) $map['email'] = $colKey;
            elseif (str_contains($h, 'role') || str_contains($h, 'peran')) $map['role'] = $colKey;
            elseif (str_contains($h, 'status')) $map['status'] = $colKey;
            elseif (str_contains($h, 'job') || str_contains($h, 'position') || str_contains($h, 'posisi')) $map['job_position'] = $colKey;
            elseif (str_contains($h, 'divisi') || str_contains($h, 'division')) $map['division'] = $colKey;
            elseif (str_contains($h, 'office') || str_contains($h, 'location') || str_contains($h, 'site') || str_contains($h, 'placement')) $map['office_location'] = $colKey;
            elseif (str_contains($h, 'start') || str_contains($h, 'mulai') || str_contains($h, 'internshipstart') || str_contains($h, 'internship')) $map['period_start'] = $colKey;
            elseif (str_contains($h, 'end') || str_contains($h, 'akhir') || str_contains($h, 'selesai') || str_contains($h, 'internshipend')) $map['period_end'] = $colKey;
            elseif (str_contains($h, 'work') || str_contains($h, 'schedule')) $map['work_schedule'] = $colKey;
        }

        return $map;
    }

    private function parseDate($value)
    {
        if (!$value) return null;
        
        try {
            if (is_numeric($value)) {
                return PhpSpreadsheetDate::excelToDateTimeObject($value)->format('Y-m-d');
            }
            return date('Y-m-d', strtotime($value));
        } catch (\Exception $e) {
            return null;
        }
    }
}
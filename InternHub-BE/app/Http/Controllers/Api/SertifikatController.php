<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;
use App\Models\Evaluation;
use App\Models\CertificateTemplate;
use Carbon\Carbon;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Barryvdh\DomPDF\Facade\Pdf;

class SertifikatController extends Controller
{
    /**
     * Generate PDF Certificate
     * Route: POST /api/sertifikat/generate
     *
     * Supports two rendering paths:
     * - Browsershot (recommended): renders HTML via headless Chrome for pixel-perfect match with FE.
     * - DomPDF (fallback): uses inline CSS + base64 background if Browsershot is not available.
     *
     * To have the same background as the frontend, pass either:
     * - background_url (string): absolute URL to FE-hosted background image (Browsershot will use it directly; DomPDF will attempt to fetch and embed it), OR
     * - background_image (file upload): an image file (jpeg/png) to embed.
     *
     * Browsershot requires the `spatie/browsershot` package and a headless Chrome/Chromium binary available on the server.
     */
    public function generate(Request $request)
    {
        set_time_limit(300); // Increase timeout to 5 minutes for heavy PDF generation
        ini_set('memory_limit', '512M'); // Increase memory limit for DomPDF processing
        \Log::info('SertifikatController::generate started', ['ids' => $request->user_ids ?? [$request->user_id]]);
        $user = auth('sanctum')->user();
        // 2. Validation
        $request->validate([
            'user_id' => 'nullable|exists:users,user_id',
            'user_ids' => 'nullable|array',
            'user_ids.*' => 'string',
            'cert_number' => 'nullable|string',
            // Accept either a single background or separate front/back images (file uploads or URLs)
            'background_image' => 'nullable|file|mimes:jpeg,png,jpg|max:5120', // 5MB max - used for both front/back
            'background_front_image' => 'nullable|file|mimes:jpeg,png,jpg|max:5120',
            'background_image_front' => 'nullable|file|mimes:jpeg,png,jpg|max:5120',
            'background_back_image' => 'nullable|file|mimes:jpeg,png,jpg|max:5120',
            'background_image_back' => 'nullable|file|mimes:jpeg,png,jpg|max:5120',
            // Accept base64/data-uri strings from FE
            'background_front' => 'nullable|string',
            'background_back' => 'nullable|string',
            'background_url' => 'nullable|url',
            'background_front_url' => 'nullable|url',
            'background_back_url' => 'nullable|url',
            // Optional signer (kepala divisi) fields provided by FE
            'signer' => 'nullable|string|max:255',
            'signer_title' => 'nullable|string|max:255',
            // Optional cert numbers sheet for bulk generation (first row header/title, following rows numbers)
            'cert_numbers_file' => 'nullable|file|mimes:xlsx,xls,csv,txt|mimetypes:text/plain,text/csv,application/vnd.ms-excel,application/csv|max:10240'
        ]);

        // Determine requested user(s): support single user_id or array user_ids for bulk generation
        $requestedIds = [];
        if ($request->filled('user_ids') && is_array($request->input('user_ids'))) {
            $requestedIds = $request->input('user_ids');
        } elseif ($request->filled('user_id')) {
            $requestedIds = [$request->input('user_id')];
        }

        if (empty($requestedIds)) {
            return response()->json(['success' => false, 'message' => 'No user_id or user_ids provided.'], 422);
        }

        // 4. Handle Background (file upload OR FE-hosted URL) — supports front/back
        $background_front = null;
        $background_back = null;

        $makeDataUri = function ($raw, $mime = null) {
            if (!$mime) {
                $info = @getimagesizefromstring($raw);
                $mime = $info['mime'] ?? 'image/png';
            }
            return 'data:' . $mime . ';base64,' . base64_encode($raw);
        };

        $normalizeBase64 = function ($value) use ($makeDataUri) {
            if (!$value) return null;
            if (str_starts_with($value, 'data:image/')) return $value;
            // If raw base64, wrap as data URI
            $decoded = base64_decode($value, true);
            if ($decoded !== false) {
                return $makeDataUri($decoded);
            }
            return $value; // fallback: treat as URL
        };

        // helper to fetch either uploaded file contents or remote URL with a short timeout
        $fetchContent = function ($fileOrUrl) {
            try {
                if ($fileOrUrl instanceof \Illuminate\Http\UploadedFile) {
                    return file_get_contents($fileOrUrl->getRealPath());
                }
                // if it looks like a URL, apply a small timeout so we don't hang the request
                if (is_string($fileOrUrl) && preg_match('#^https?://#i', $fileOrUrl)) {
                    $ctx = stream_context_create(['http' => ['timeout' => 5], 'https' => ['timeout' => 5]]);
                    $remote = @file_get_contents($fileOrUrl, false, $ctx);
                    return $remote ?: null;
                }
                $remote = @file_get_contents($fileOrUrl);
                return $remote ?: null;
            } catch (\Throwable $e) {
                return null;
            }
        };

        // Priority: explicit front/back file -> single file -> explicit front/back url -> single url
        if ($request->hasFile('background_front_image') || $request->hasFile('background_image_front')) {
            $file = $request->file('background_front_image') ?? $request->file('background_image_front');
            $raw = $fetchContent($file);
            if ($raw) $background_front = $makeDataUri($raw, $file->getClientMimeType());
        } elseif ($request->filled('background_front')) {
            $background_front = $normalizeBase64($request->input('background_front'));
        } elseif ($request->hasFile('background_image')) {
            $raw = $fetchContent($request->file('background_image'));
            if ($raw) $background_front = $makeDataUri($raw, $request->file('background_image')->getClientMimeType());
        } elseif ($request->filled('background_front_url')) {
            $raw = $fetchContent($request->input('background_front_url'));
            if ($raw) { $background_front = $makeDataUri($raw); } else { $background_front = $request->input('background_front_url'); }
        } elseif ($request->filled('background_url')) {
            $raw = $fetchContent($request->input('background_url'));
            if ($raw) { $background_front = $makeDataUri($raw); } else { $background_front = $request->input('background_url'); }
        }

        if ($request->hasFile('background_back_image') || $request->hasFile('background_image_back')) {
            $file = $request->file('background_back_image') ?? $request->file('background_image_back');
            $raw = $fetchContent($file);
            if ($raw) $background_back = $makeDataUri($raw, $file->getClientMimeType());
        } elseif ($request->filled('background_back')) {
            $background_back = $normalizeBase64($request->input('background_back'));
        } elseif ($request->hasFile('background_image')) {
            $raw = $fetchContent($request->file('background_image'));
            if ($raw) $background_back = $makeDataUri($raw, $request->file('background_image')->getClientMimeType());
        } elseif ($request->filled('background_back_url')) {
            $raw = $fetchContent($request->input('background_back_url'));
            if ($raw) { $background_back = $makeDataUri($raw); } else { $background_back = $request->input('background_back_url'); }
        } elseif ($request->filled('background_url')) {
            $raw = $fetchContent($request->input('background_url'));
            if ($raw) { $background_back = $makeDataUri($raw); } else { $background_back = $request->input('background_url'); }
        }

        // Fallback to database templates if not provided in request
        if (empty($background_front)) {
            $frontTemplate = CertificateTemplate::where('side', 'front')->latest()->first();
            if ($frontTemplate && Storage::disk('public')->exists($frontTemplate->image_path)) {
                $background_front = storage_path('app/public/' . $frontTemplate->image_path);
            }
        }
        
        if (empty($background_back)) {
            $backTemplate = CertificateTemplate::where('side', 'back')->latest()->first();
            if ($backTemplate && Storage::disk('public')->exists($backTemplate->image_path)) {
                $background_back = storage_path('app/public/' . $backTemplate->image_path);
            }
        }

        // inspect sizes to catch gigantic data URIs (DomPDF will choke on +10MB strings)
        $logFront = 'missing';
        if (!empty($background_front)) {
            if (str_starts_with($background_front, 'data:')) {
                $len = strlen($background_front);
                $logFront = "DataURI({$len})";
                if ($len > 5 * 1024 * 1024) {
                    \Log::warning('background_front DataURI too large, dropping to avoid timeouts', ['length' => $len]);
                    $background_front = null;
                    $logFront .= '->dropped';
                }
            } else {
                $logFront = 'URL';
            }
        }

        $logBack = 'missing';
        if (!empty($background_back)) {
            if (str_starts_with($background_back, 'data:')) {
                $len = strlen($background_back);
                $logBack = "DataURI({$len})";
                if ($len > 5 * 1024 * 1024) {
                    \Log::warning('background_back DataURI too large, dropping to avoid timeouts', ['length' => $len]);
                    $background_back = null;
                    $logBack .= '->dropped';
                }
            } else {
                $logBack = 'URL';
            }
        }

        if (empty($background_front) && empty($background_back)) {
            \Log::warning('SertifikatController::generate background empty error');
            return response()->json(['success' => false, 'message' => 'Please provide a background image or URL (front and/or back).'], 422);
        }
        
        \Log::info('SertifikatController::generate backgrounds ready', [
            'front' => $logFront,
            'back' => $logBack
        ]);

        // If multiple interns requested -> generate ZIP of PDFs
        if (count($requestedIds) > 1) {
            // If cert numbers file provided, parse numbers (skip header first row)
            $certNumbers = [];
            $hasCertNumbersFile = $request->hasFile('cert_numbers_file');
            if ($request->hasFile('cert_numbers_file')) {
                // FE may send header flag, but for CSV/TXT we always treat it as simple list (no header)
                $hasHeader = null;
                if ($request->has('first_row_header')) {
                    $hasHeader = $request->boolean('first_row_header');
                } elseif ($request->has('cert_numbers_has_header')) {
                    $hasHeader = $request->boolean('cert_numbers_has_header');
                } elseif ($request->has('first_row_contains_header')) {
                    $hasHeader = $request->boolean('first_row_contains_header');
                } elseif ($request->has('has_header')) {
                    // FE may send 'has_header' as shorthand
                    $hasHeader = $request->boolean('has_header');
                }

                // If file is CSV/TXT, force no header (each line is a cert number) per new FE agreement
                $origName = $request->file('cert_numbers_file')->getClientOriginalName();
                $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
                if (in_array($ext, ['csv', 'txt'])) {
                    $hasHeader = false;
                }

                $d = $this->parseCertNumbersFileDetailed($request->file('cert_numbers_file'), $hasHeader);
                $certNumbers = $d['rows'];
                // attach diagnostic info for potential errors
                $certNumbersMeta = $d['meta'];
            } else {
                $certNumbersMeta = null;
            }

            $zip = new \ZipArchive;
            $zipFileName = 'certificates_' . time() . '.zip';
            $zipFilePath = storage_path('app/public/' . $zipFileName);

            if ($zip->open($zipFilePath, \ZipArchive::CREATE) !== TRUE) {
                return response()->json(['message' => 'Failed to create ZIP'], 500);
            }

            // Fetch interns in the same order as user_ids[] to keep mapping consistent
            $orderedIds = array_values($requestedIds);
            $idsList = implode(',', array_map('intval', $orderedIds));
            $interns = User::with(['roles'])
                ->join('students', 'users.user_id', '=', 'students.user_id')
                ->leftJoin('divisions', 'students.division_id', '=', 'divisions.id_division')
                ->whereIn('users.user_id', $orderedIds)
                ->selectRaw("users.user_id, users.nama, students.universitas, students.jurusan, students.jenjang_pendidikan, COALESCE(divisions.name, students.division) as division, students.mulai_magang, students.akhir_magang")
                ->orderByRaw("COALESCE(students.akhir_magang, '9999-12-31') ASC")
                ->orderByRaw("FIELD(users.user_id, {$idsList})")
                ->get();

            $foundIds = $interns->pluck('user_id')->all();
            $missingIds = array_values(array_diff($orderedIds, $foundIds));
            if (!empty($missingIds)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Some user_ids were not found.',
                    'data' => ['missing_user_ids' => $missingIds]
                ], 422);
            }

            $nonInterns = $interns->filter(function($u) { return !$u->hasRole('intern'); });
            if ($nonInterns->isNotEmpty()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Some users are not interns.',
                    'data' => ['user_ids' => $nonInterns->pluck('user_id')->values()]
                ], 422);
            }

            $internIds = $interns->pluck('user_id')->values()->all();
            $evaluations = Evaluation::whereIn('user_id', $internIds)
                ->where('status', 'final')
                ->with('components')
                ->get()
                ->keyBy('user_id');
            $missingEvalIds = array_values(array_diff($internIds, $evaluations->keys()->all()));
            if (!empty($missingEvalIds)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Final evaluation missing for some interns.',
                    'data' => ['user_ids' => $missingEvalIds]
                ], 422);
            }

            if ($hasCertNumbersFile && count($certNumbers) < count($internIds)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Jumlah nomor sertifikat pada file kurang dari jumlah intern.',
                    'data' => [
                        'cert_numbers_count' => count($certNumbers),
                        'intern_count' => count($internIds),
                        'sample_cert_numbers' => array_slice($certNumbers, 0, 10),
                        'cert_numbers_meta' => $certNumbersMeta
                    ]
                ], 422);
            }

            $manifestLines = [];

            // Build a union of all component keys and their labels across interns
            $allComponentMap = []; // key => label
            foreach ($evaluations as $ev) {
                // components relationship may be empty for legacy evaluations
                if ($ev->components && $ev->components->isNotEmpty()) {
                    foreach ($ev->components as $component) {
                        $key = 'c' . $component->komponen_id;
                        if (!array_key_exists($key, $allComponentMap)) {
                            $allComponentMap[$key] = $component->nama_komponen ?? ('Komponen ' . $component->komponen_id);
                        }
                    }
                } else {
                    // fallback legacy keys and labels
                    $fallbackLabels = [
                        'integrity' => 'Integritas (etika, moral dan kesungguhan)',
                        'punctuality' => 'Ketepatan waktu dalam bekerja',
                        'expertise' => 'Keahlian berdasarkan bidang ilmu',
                        'teamwork' => 'Kerjasama dalam tim',
                        'communication' => 'Komunikasi',
                        'it_proficiency' => 'Penggunaan teknologi informasi',
                        'self_development' => 'Pengembangan diri'
                    ];
                    foreach ($fallbackLabels as $k => $lbl) {
                        if (!array_key_exists($k, $allComponentMap)) {
                            $allComponentMap[$k] = $lbl;
                        }
                    }
                }
            }

            $componentKeys = array_values(array_keys($allComponentMap));

            foreach ($interns as $index => $intern) {
                $rid = $intern->user_id;

                $evaluation = $evaluations->get($intern->user_id);

                // Build scores and labels dynamically from components
                $scores = [];
                $scoreLabels = [];
                foreach ($evaluation->components as $component) {
                    $key = 'c' . $component->komponen_id;
                    $scores[$key] = $component->score ?? 0;
                    $scoreLabels[$key] = $component->nama_komponen ?? ('Komponen ' . $component->komponen_id);
                }

                // Fallback to legacy fixed fields when no components exist
                if (empty($scores)) {
                    $scores = [
                        'integrity' => $evaluation->integrity_score ?? 0,
                        'punctuality' => $evaluation->punctuality_score ?? 0,
                        'expertise' => $evaluation->expertise_score ?? 0,
                        'teamwork' => $evaluation->teamwork_score ?? 0,
                        'communication' => $evaluation->communication_score ?? 0,
                        'it_proficiency' => $evaluation->it_proficiency_score ?? 0,
                        'self_development' => $evaluation->self_development_score ?? 0,
                    ];
                    $scoreLabels = [
                        'integrity' => 'Integritas (etika, moral dan kesungguhan)',
                        'punctuality' => 'Ketepatan waktu dalam bekerja',
                        'expertise' => 'Keahlian berdasarkan bidang ilmu',
                        'teamwork' => 'Kerjasama dalam tim',
                        'communication' => 'Komunikasi',
                        'it_proficiency' => 'Penggunaan teknologi informasi',
                        'self_development' => 'Pengembangan diri'
                    ];
                }

                // Compute final score and totals based on actual number of components
                $totalSumScore = array_sum($scores);
                $finalScore = $evaluation->final_score_numeric ?? null;
                if (empty($finalScore)) {
                    $count = count($scores) ?: 1;
                    $finalScore = round($totalSumScore / $count, 2);
                }

                $predicateLabel = $this->resolvePredicateLabel($finalScore);

                // Assign cert number by order from imported list or fallback to request cert_number or auto
                if ($hasCertNumbersFile) {
                    $assignedCertNumber = $certNumbers[$index];
                } else {
                    $assignedCertNumber = $request->input('cert_number') ?? ('AUTO-' . time() . '-' . ($index + 1));
                }

                $data = [
                    'intern' => [
                        'name' => $intern->nama,
                        'education_level' => $intern->jenjang_pendidikan ?? 'S1',
                        'study_program' => $intern->jurusan ?? '-',
                        'university' => $intern->universitas ?? '-',
                        'division' => $intern->division ?? $intern->divisi ?? '-',
                        'start_date' => $intern->mulai_magang,
                        'end_date' => $intern->akhir_magang,
                        'duration_months' => $this->calculateDuration($intern->mulai_magang, $intern->akhir_magang),
                        'duration_months_text' => ucfirst($this->numberToIndonesianWords($this->calculateDuration($intern->mulai_magang, $intern->akhir_magang))),
                    ],
                    'formData' => ['scores' => $scores, 'scoreLabels' => $scoreLabels],
                    'finalScore' => $finalScore,
                    'finalScoreLetter' => $this->getLetterGrade($finalScore),
                    'predicate' => $predicateLabel,
                    'certNumber' => $assignedCertNumber,
                    'signer' => $request->input('signer') ?? null,
                    'signerTitle' => $request->input('signer_title') ?? null,
                ];

                $periodLabel = $this->formatDateInfo($intern->mulai_magang) . ' - ' . $this->formatDateInfo($intern->akhir_magang);
                $formattedDate = $this->formatDateInfo(now()->toDateString());

                $viewData = [
                    'data' => $data,
                    'background_front' => $background_front,
                    'background_back' => $background_back,
                    'periodLabel' => $periodLabel,
                    'formattedDate' => $formattedDate,
                    'scoreLabels' => $scoreLabels,
                    'totalScore' => $totalSumScore,
                    'finalScoreLetter' => $data['finalScoreLetter']
                ];

                $pdfContent = null;

                if (class_exists('\\Spatie\\Browsershot\\Browsershot')) {
                    try {
                        $html = view('pdf.sertifikat', $viewData)->render();
                        $bsClass = '\\Spatie\\Browsershot\\Browsershot';
                        \Log::info('Starting Browsershot PDF generation for ' . $intern->nama);
                        $pdfContent = $bsClass::html($html)
                            ->noSandbox()
                            ->setOption('args', ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'])
                            ->format('A4')
                            ->landscape()
                            // removed waitUntilNetworkIdle() as it can cause hangups with local DataURIs
                            ->pdf();
                        \Log::info('Finished Browsershot PDF generation for ' . $intern->nama);
                    } catch (\Throwable $e) {
                        $pdfContent = null;
                    }
                }

                if (!$pdfContent) {
                    
                    \Log::info('Generating PDF via DomPDF for ' . $intern->nama, ['mem_before' => round(memory_get_usage()/1024/1024,2) . 'MB']);
                    $viewData['using_dompdf'] = true;
                    $viewData['background_front'] = $this->prepareDompdfBackground($background_front, 'front');
                    $viewData['background_back'] = $this->prepareDompdfBackground($background_back, 'back');
                    $pdf = Pdf::loadView('pdf.sertifikat', $viewData);
                    $pdf->setOption('isRemoteEnabled', false); // Disable remote for speed, we use local paths
                    $pdf->setOption('fontDir', storage_path('fonts'));
                    $pdf->setOption('fontCache', storage_path('fonts'));
                    $pdf->setOption('tempDir', storage_path('app/dompdf'));
                    $pdf->setOption('chroot', base_path());
                    $pdf->setPaper('a4', 'landscape');
                    $pdfContent = $pdf->output();
                    \Log::info('DomPDF finished for ' . $intern->nama, ['mem_after' => round(memory_get_usage()/1024/1024,2) . 'MB']);
                }

                // --- PERUBAHAN START (Penamaan File ZIP) ---
                // Format: nomor sertif_Sertifikat Magang_namauser
                // Sanitasi nomor sertifikat & nama (ganti karakter yang tidak valid pada file name)
                $unsafeChars = ['/', '\\', ':', '"', '*', '?', '<', '>', '|'];
                $safeCertNum = str_replace($unsafeChars, '_', (string) $assignedCertNumber);
                $safeCertNum = trim($safeCertNum) !== '' ? $safeCertNum : ('AUTO-' . time() . '-' . ($index + 1));
                $rawName = $intern->nama ?: ('intern-' . $rid);
                $safeName = str_replace($unsafeChars, '_', $rawName);
                $safeName = preg_replace('/\s+/', ' ', trim($safeName));
                $pdfName = "{$safeCertNum}_Sertifikat Magang_{$safeName}.pdf";

                $zip->addFromString($pdfName, $pdfContent);
                // --- PERUBAHAN END ---

                $qualitativeFeedback = trim((string) ($evaluation->mentor_notes ?? ''));

                // Build manifest row with scores aligned to header component order
                $institution = trim((string) ($intern->universitas ?? '-'));
                $predicateLetter = $this->getLetterGrade($finalScore);

                $row = [$intern->nama, $institution, $assignedCertNumber];
                foreach ($componentKeys as $ck) {
                    $row[] = array_key_exists($ck, $scores) ? $scores[$ck] : '';
                }
                $row[] = $finalScore;
                $row[] = $predicateLetter;
                $row[] = $qualitativeFeedback;
                $manifestLines[] = $row;
            }

            // Add manifest.csv to zip
            // Header: Name, Institution, Cert Number, <dynamic component labels...>, Final Score, Predicate, Qualitative Feedback
            $headers = ['Name', 'Institution', 'Cert Number'];
            foreach ($componentKeys as $ck) {
                $headers[] = ($allComponentMap[$ck] ?? $ck);
            }
            $headers[] = 'Final Score';
            $headers[] = 'Predicate';
            $headers[] = 'Qualitative Feedback';

            $manifestCsv = implode(',', array_map(function($v){ return '"'.str_replace('"','""',$v).'"'; }, $headers)) . "\r\n";
            foreach ($manifestLines as $row) {
                $manifestCsv .= implode(',', array_map(function($v){ return '"'.str_replace('"','""',$v).'"'; }, $row)) . "\r\n";
            }
            $zip->addFromString('manifest.csv', $manifestCsv);

            $zip->close();

            return response()->download($zipFilePath)->deleteFileAfterSend(true);
        }

        // Single intern flow (the first id)
        $rid = $requestedIds[0];
        $intern = User::with(['roles'])
            ->join('students', 'users.user_id', '=', 'students.user_id')
            ->where('users.user_id', $rid)
            ->select([
                'users.user_id', 'users.nama',
                'students.universitas', 'students.jurusan', 'students.jenjang_pendidikan', 'students.division',
                'students.mulai_magang', 'students.akhir_magang'
            ])
            ->first();
        if (!$intern || !$intern->hasRole('intern')) {
            return response()->json(['success' => false, 'message' => 'Intern not found.'], 404);
        }

        \Log::info('SertifikatController::single starting queries');
        $evaluation = Evaluation::forIntern($intern)->where('status', 'final')->first();
        if (!$evaluation) {
            \Log::warning('SertifikatController::single evaluation not found');
            return response()->json(['success' => false, 'message' => 'Final evaluation not found.'], 404);
        }
        
        // Load components with their scores
        \Log::info('SertifikatController::single loading components');
        $evaluation->load('components');

        // Build scores and labels dynamically from components
        $scores = [];
        $scoreLabels = [];
        foreach ($evaluation->components as $component) {
            $key = 'c' . $component->komponen_id;
            $scores[$key] = $component->score ?? 0;
            $scoreLabels[$key] = $component->nama_komponen ?? ('Komponen ' . $component->komponen_id);
        }

        // Fallback to legacy fields when no components exist
        if (empty($scores)) {
            $scores = [
                'integrity' => $evaluation->integrity_score ?? 0,
                'punctuality' => $evaluation->punctuality_score ?? 0,
                'expertise' => $evaluation->expertise_score ?? 0,
                'teamwork' => $evaluation->teamwork_score ?? 0,
                'communication' => $evaluation->communication_score ?? 0,
                'it_proficiency' => $evaluation->it_proficiency_score ?? 0,
                'self_development' => $evaluation->self_development_score ?? 0,
            ];
            $scoreLabels = [
                'integrity' => 'Integritas (etika, moral dan kesungguhan)',
                'punctuality' => 'Ketepatan waktu dalam bekerja',
                'expertise' => 'Keahlian berdasarkan bidang ilmu',
                'teamwork' => 'Kerjasama dalam tim',
                'communication' => 'Komunikasi',
                'it_proficiency' => 'Penggunaan teknologi informasi',
                'self_development' => 'Pengembangan diri'
            ];
        }

        // Compute totals and average
        $totalSumScore = array_sum($scores);
        $finalScore = $evaluation->final_score_numeric ?? null;
        if (empty($finalScore)) {
            $count = count($scores) ?: 1;
            $finalScore = round($totalSumScore / $count, 2);
        }

        $predicateLabel = $this->resolvePredicateLabel($finalScore);

        $data = [
            'intern' => [
                'name' => $intern->nama,
                'education_level' => $intern->jenjang_pendidikan ?? 'S1',
                'study_program' => $intern->jurusan ?? '-',
                'university' => $intern->universitas ?? '-',
                'division' => $intern->division ?? $intern->divisi ?? '-',
                'start_date' => $intern->mulai_magang,
                'end_date' => $intern->akhir_magang,
                'duration_months' => $this->calculateDuration($intern->mulai_magang, $intern->akhir_magang),
                'duration_months_text' => ucfirst($this->numberToIndonesianWords($this->calculateDuration($intern->mulai_magang, $intern->akhir_magang))),
            ],
            'formData' => ['scores' => $scores, 'scoreLabels' => $scoreLabels],
            'finalScore' => $finalScore,
            'finalScoreLetter' => $this->getLetterGrade($finalScore),
            'predicate' => $predicateLabel,
            'certNumber' => $request->cert_number, // User input
            'signer' => $request->input('signer') ?? null,
            'signerTitle' => $request->input('signer_title') ?? null,
        ];

        $periodLabel = $this->formatDateInfo($intern->mulai_magang) . ' - ' . $this->formatDateInfo($intern->akhir_magang);
        $formattedDate = $this->formatDateInfo(now()->toDateString());

        $viewData = [
            'data' => $data,
            'background_front' => $background_front,
            'background_back' => $background_back,
            'periodLabel' => $periodLabel,
            'formattedDate' => $formattedDate,
            'scoreLabels' => $scoreLabels,
            'totalScore' => $totalSumScore,
            'finalScoreLetter' => $data['finalScoreLetter']
        ];

        \Log::info('SertifikatController::single rendering view');
        try {
            $html = view('pdf.sertifikat', $viewData)->render();
            \Log::info('SertifikatController::single view rendered', ['size' => strlen($html)]);
        } catch (\Throwable $e) {
            \Log::error('SertifikatController::single render failed: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Rendering error.'], 500);
        }

        // --- PERUBAHAN START (Penamaan File Single Download) ---
        // Format: nomor sertif_Sertifikat Magang_namauser
        $certNumForFile = $data['certNumber'] ?? $request->input('cert_number');
        $certNumForFile = trim((string) $certNumForFile);
        if ($certNumForFile === '') {
            $certNumForFile = 'AUTO-' . time();
        }
        // Sanitasi nomor sertifikat & nama (ganti karakter yang tidak valid pada file name)
        $unsafeChars = ['/', '\\', ':', '"', '*', '?', '<', '>', '|'];
        $safeCertNum = str_replace($unsafeChars, '_', $certNumForFile);
        $rawName = $intern->nama ?: ('intern-' . $rid);
        $safeName = str_replace($unsafeChars, '_', $rawName);
        $safeName = preg_replace('/\s+/', ' ', trim($safeName));

        $filename = "{$safeCertNum}_Sertifikat Magang_{$safeName}.pdf";
        // --- PERUBAHAN END ---

        // Use Browsershot if installed and available (temporarily disabled for testing if Browsershot is the cause)
        $useBrowsershot = false; // Force DomPDF for testing
        if ($useBrowsershot && class_exists('\\Spatie\\Browsershot\\Browsershot')) {
            try {
                // $html already rendered above

                $bsClass = '\\Spatie\\Browsershot\\Browsershot';
                \Log::info('Starting Browsershot PDF generation (single) for ' . $intern->nama);
                $pdfContent = $bsClass::html($html)
                    ->noSandbox()
                    ->setOption('args', ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'])
                    ->format('A4')
                    ->landscape()
                    // removed waitUntilNetworkIdle() as it can cause hangups with local DataURIs
                    ->pdf();
                \Log::info('Finished Browsershot PDF generation (single) for ' . $intern->nama);

                return response()->streamDownload(function() use ($pdfContent) {
                    echo $pdfContent;
                }, $filename, ['Content-Type' => 'application/pdf']);
            } catch (\Throwable $e) {
                // If Browsershot fails (missing Chrome binary, permission, etc.), fallback to DomPDF
            }
        }

        // Fallback: DomPDF (embed base64 background if available)
        $viewData['using_dompdf'] = true;
        $viewData['background_front'] = $this->prepareDompdfBackground($background_front, 'front');
        $viewData['background_back'] = $this->prepareDompdfBackground($background_back, 'back');
        $pdf = Pdf::loadView('pdf.sertifikat', $viewData);
        $pdf->setOption('isRemoteEnabled', false); // Disable remote for speed
        $pdf->setOption('fontDir', storage_path('fonts'));
        $pdf->setOption('fontCache', storage_path('fonts'));
        $pdf->setOption('tempDir', storage_path('app/dompdf'));
        $pdf->setOption('chroot', base_path());
        $pdf->setPaper('a4', 'landscape');
        
        try {
            \Log::info('SertifikatController::single generating PDF output (DomPDF)', ['mem_before' => round(memory_get_usage()/1024/1024, 2) . 'MB']);
            $pdfContent = $pdf->output();
            \Log::info('SertifikatController::single PDF output generated (DomPDF)', ['size' => strlen($pdfContent), 'mem_after' => round(memory_get_usage()/1024/1024,2) . 'MB']);
        } catch (\Throwable $e) {
            \Log::error('SertifikatController::single PDF generation failed: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'PDF creation error.'], 500);
        }
        return response()->streamDownload(function() use ($pdfContent) {
            echo $pdfContent;
        }, $filename, ['Content-Type' => 'application/pdf']);
    }

    private function formatDateInfo($date)
    {
        if (!$date) return '-';
        return Carbon::parse($date)->locale('id')->isoFormat('D MMMM Y');
    }

    /**
     * Get Certificate Data for Frontend Generator
     * Route: GET /api/sertifikat/data/{id}
     */
    public function getData(Request $request, $id)
    {
        $user = auth('sanctum')->user();


        // 2. Fetch Intern with mahasiswa data
        $intern = User::with(['roles'])
            ->join('students', 'users.user_id', '=', 'students.user_id')
            ->where('users.user_id', $id)
            ->select([
                'users.user_id', 'users.nama',
                'students.universitas', 'students.jurusan', 'students.jenjang_pendidikan',
                'students.division', 'students.mulai_magang', 'students.akhir_magang'
            ])
            ->first();
        
        if (!$intern) {
            return response()->json([
                'success' => false,
                'message' => 'Intern not found.'
            ], 404);
        }
        
        // Verify the user has intern role
        $userCheck = User::with(['roles'])->find($id);
        if (!$userCheck || !$userCheck->hasRole('intern')) {
            return response()->json([
                'success' => false,
                'message' => 'User is not an intern.'
            ], 404);
        }

        // 3. Fetch Final Evaluation
        $evaluation = Evaluation::forIntern($intern)
            ->where('status', 'final')
            ->first();

        // Warning if no evaluation found, but still return partial data? 
        // Better to require evaluation for specific scores.
        if (!$evaluation) {
            return response()->json([
                'success' => false,
                'message' => 'Final evaluation not found for this intern.'
            ], 404);
        }

        // 4. Prepare Data Structure for React Component
        
        // Load components with their scores
        $evaluation->load('components');
        
        // Build scores and labels dynamically from components
        $scores = [];
        $scoreLabels = [];
        foreach ($evaluation->components as $component) {
            $key = 'c' . $component->komponen_id;
            $scores[$key] = $component->score ?? 0;
            $scoreLabels[$key] = $component->nama_komponen ?? ('Komponen ' . $component->komponen_id);
        }

        // Fallback to legacy fields when no components exist
        if (empty($scores)) {
            $scores = [
                'integrity' => $evaluation->integrity_score ?? 0,
                'punctuality' => $evaluation->punctuality_score ?? 0,
                'expertise' => $evaluation->expertise_score ?? 0,
                'teamwork' => $evaluation->teamwork_score ?? 0,
                'communication' => $evaluation->communication_score ?? 0,
                'it_proficiency' => $evaluation->it_proficiency_score ?? 0,
                'self_development' => $evaluation->self_development_score ?? 0,
            ];
            $scoreLabels = [
                'integrity' => 'Integritas (etika, moral dan kesungguhan)',
                'punctuality' => 'Ketepatan waktu dalam bekerja',
                'expertise' => 'Keahlian berdasarkan bidang ilmu',
                'teamwork' => 'Kerjasama dalam tim',
                'communication' => 'Komunikasi',
                'it_proficiency' => 'Penggunaan teknologi informasi',
                'self_development' => 'Pengembangan diri'
            ];
        }

        // Compute totals and average
        $totalSumScore = array_sum($scores);
        $finalScore = $evaluation->final_score_numeric ?? null;
        if (empty($finalScore)) {
             $count = count($scores) ?: 1;
             $finalScore = round($totalSumScore / $count, 2);
        }

        // Calculate Final Score & Predicate (Logic mirrored from Frontend/Eval Model)
        // Note: Evaluation model already has 'final_score_numeric' & 'final_score_letter'
        // We can use those or re-calculate. Let's use stored values if available, else calc.
        
        $predicateLetter = $evaluation->final_score_letter;
        $predicateLabel = $this->resolvePredicateLabel($finalScore); // "Sangat Memuaskan" etc.
        // Ensure letter grade mapping is consistent with thresholds (>=86 A, >=71 B, <=70 C)
        $finalLetter = $this->getLetterGrade($finalScore);

        // Certificate Number is now input by user in Frontend 

        return response()->json([
            'success' => true,
            'data' => [
                'intern' => [
                    'id' => $intern->user_id,
                    'name' => $intern->nama,
                    'education_level' => $intern->jenjang_pendidikan ?? 'S1',
                    'study_program' => $intern->jurusan ?? '-',
                    'university' => $intern->universitas ?? '-',
                    'start_date' => $intern->mulai_magang,
                    'end_date' => $intern->akhir_magang,
                    'duration_months' => $this->calculateDuration($intern->mulai_magang, $intern->akhir_magang),
                    'duration_months_text' => ucfirst($this->numberToIndonesianWords($this->calculateDuration($intern->mulai_magang, $intern->akhir_magang))),
                    'division' => $intern->division ?? '-',
                    'certificate_date' => now()->toDateString(), // Date of printing
                ],
                'formData' => [
                    'scores' => $scores,
                    'scoreLabels' => $scoreLabels
                ],
                'finalScore' => $finalScore,
                'finalScoreLetter' => $this->getLetterGrade($finalScore),
                'predicate' => $predicateLabel,
                'signer' => null, // FE may provide signer when generating; default will be handled by view
                // 'certNumber' removed as per request (input by user)
            ]
        ]);
    }

    private function resolvePredicateLabel($score)
    {
        if ($score >= 86) return 'Sangat Memuaskan';
        if ($score >= 71) return 'Memuaskan';
        return 'Cukup Memuaskan';
    }

    /**
     * Convert numeric final score to letter grade per thresholds:
     * >=86 => A
     * >=71 => B
     * <=70 => C
     */
    private function getLetterGrade($score)
    {
        if ($score >= 86) return 'A';
        if ($score >= 71) return 'B';
        return 'C';
    }

    private function calculateDuration($start, $end)
    {
        if (!$start || !$end) return 1;
        $s = Carbon::parse($start);
        $e = Carbon::parse($end);
        if ($e->lessThan($s)) return 1;
        return $s->diffInMonths($e) + 1; // Inclusive months (e.g., Jul-Dec = 6)
    }

    private function numberToIndonesianWords($number)
    {
        $number = (int) $number;
        $words = [
            0 => 'nol', 1 => 'satu', 2 => 'dua', 3 => 'tiga', 4 => 'empat',
            5 => 'lima', 6 => 'enam', 7 => 'tujuh', 8 => 'delapan', 9 => 'sembilan',
            10 => 'sepuluh', 11 => 'sebelas'
        ];

        if ($number < 12) {
            return $words[$number] ?? (string) $number;
        }
        if ($number < 20) {
            return $this->numberToIndonesianWords($number - 10) . ' belas';
        }
        if ($number < 100) {
            $puluh = intdiv($number, 10);
            $sisa = $number % 10;
            return trim($this->numberToIndonesianWords($puluh) . ' puluh ' . ($sisa ? $this->numberToIndonesianWords($sisa) : ''));
        }
        if ($number < 200) {
            return 'seratus ' . $this->numberToIndonesianWords($number - 100);
        }
        if ($number < 1000) {
            $ratus = intdiv($number, 100);
            $sisa = $number % 100;
            return trim($this->numberToIndonesianWords($ratus) . ' ratus ' . ($sisa ? $this->numberToIndonesianWords($sisa) : ''));
        }
        if ($number < 2000) {
            return 'seribu ' . $this->numberToIndonesianWords($number - 1000);
        }
        if ($number < 1000000) {
            $ribuan = intdiv($number, 1000);
            $sisa = $number % 1000;
            return trim($this->numberToIndonesianWords($ribuan) . ' ribu ' . ($sisa ? $this->numberToIndonesianWords($sisa) : ''));
        }

        return (string) $number;
    }

    /**
     * Parse an uploaded cert numbers spreadsheet (csv/xlsx/xls)
     * Expectation: first row is header/title and rows from 2..N contain certificate numbers in column A
     */
    private function parseCertNumbersFile($file, ?bool $hasHeader = null)
    {
        $d = $this->parseCertNumbersFileDetailed($file, $hasHeader);
        return $d['rows'];
    }

    /**
     * Detailed parser: returns rows and metadata for diagnostics
     */
    private function parseCertNumbersFileDetailed($file, ?bool $hasHeader = null)
    {
        $meta = ['detected_has_header' => null, 'delimiter' => ',', 'line_count' => 0, 'first_nonempty_line' => null];
        try {
            $path = $file->getRealPath();
            $ext = strtolower(pathinfo($file->getClientOriginalName(), PATHINFO_EXTENSION));
            $content = file_get_contents($path);
            if ($content === false) return ['rows' => [], 'meta' => $meta];
            $content = preg_replace('/^\xEF\xBB\xBF/', '', $content);
            $lines = preg_split("/\r\n|\n|\r/", $content);
            $meta['line_count'] = count($lines);
            $firstLine = null;
            foreach ($lines as $line) {
                if (trim($line) !== '') { $firstLine = $line; break; }
            }
            $meta['first_nonempty_line'] = $firstLine;
            $firstValue = trim((string) $firstLine);
            $delimiter = ',';
            if ($firstLine !== false) {
                $delims = [',', ';', "\t", '|'];
                $counts = [];
                foreach ($delims as $d) {
                    $counts[$d] = substr_count($firstLine, $d);
                }
                arsort($counts);
                $delimiter = key($counts);
            }
            $meta['delimiter'] = $delimiter;

            if (in_array($ext, ['csv', 'txt'])) {
                if ($hasHeader === null) {
                    $lower = strtolower($firstValue);
                    $hasHeader = $firstValue === '' || preg_match('/[a-zA-Z]/', $firstValue)
                        || str_contains($lower, 'nomor')
                        || str_contains($lower, 'number')
                        || str_contains($lower, 'cert');
                }
                $meta['detected_has_header'] = (bool) $hasHeader;
                $rows = [];
                $rowIndex = 0;
                foreach ($lines as $line) {
                    if (trim($line) === '') continue;
                    $rowIndex++;
                    $data = str_getcsv($line, $delimiter);
                    if (!is_array($data) || count($data) === 0) continue;
                    $value = trim((string) ($data[0] ?? ''));
                    if ($hasHeader && $rowIndex === 1) {
                        continue; // header row
                    }
                    if ($value !== '') $rows[] = $value;
                }

                return ['rows' => $rows, 'meta' => $meta];
            }

            // xlsx fallback
            if ($hasHeader === null) $hasHeader = false;
            $meta['detected_has_header'] = (bool) $hasHeader;
            $rows = [];
            $rowIndex = 0;
            foreach ($lines as $line) {
                if (trim($line) === '') continue;
                $rowIndex++;
                $value = trim($line);
                if ($hasHeader && $rowIndex === 1) continue;
                if ($value !== '') $rows[] = $value;
            }
            return ['rows' => $rows, 'meta' => $meta];
        } catch (\Throwable $e) {
            return ['rows' => [], 'meta' => $meta];
        }
    }

    private function registerPoppinsFonts($pdfInstance)
    {
        // $pdfInstance is a Barryvdh\DomPDF\PDF instance
        try {
            $variants = [
                300 => storage_path('fonts/Poppins-300.ttf'),
                400 => storage_path('fonts/Poppins-400.ttf'),
                600 => storage_path('fonts/Poppins-600.ttf'),
                700 => storage_path('fonts/Poppins-700.ttf'),
                800 => storage_path('fonts/Poppins-800.ttf'),
            ];

            foreach ($variants as $weight => $path) {
                if (!file_exists($path)) continue;
                $style = [
                    'family' => 'PoppinsLocal',
                    'weight' => $weight,
                    'style' => 'normal'
                ];
                // Build a path relative to project root to satisfy Dompdf chroot checks.
                $root = str_replace('\\', '/', realpath(base_path()));
                $abs = str_replace('\\', '/', $path);
                if (strpos($abs, $root) === 0) {
                    $remote = ltrim(substr($abs, strlen($root)), '/');
                } else {
                    $remote = 'file:///' . $abs;
                }
                // getFontMetrics via PDF magic method
                $pdfInstance->getFontMetrics()->registerFont($style, $remote);
            }
        } catch (\Throwable $e) {
            // swallow errors, font registration is optional
        }
    }

    private function prepareDompdfBackground($value, string $label)
    {
        if (empty($value)) return null;

        // If already a data URI, use it as-is
        if (str_starts_with($value, 'data:image/')) {
            return $value;
        }

        $path = null;
        if (preg_match('#^https?://#i', $value)) {
            // keep as URL
        } elseif (is_string($value) && file_exists($value)) {
            return $value; // DomPDF prefers path
        } elseif (str_starts_with($value, 'file://')) {
            return $value;
        }

        // Only convert to base64 if we have the raw content but no path
        $raw = null;
        if (preg_match('#^https?://#i', $value)) {
            $raw = @file_get_contents($value);
        }

        if (!$raw) {
            return $value;
        }

        $info = @getimagesizefromstring($raw);
        $mime = $info['mime'] ?? 'image/png';

        return 'data:' . $mime . ';base64,' . base64_encode($raw);
    }

    // =====================================================================
    // CERTIFICATE TEMPLATE MANAGEMENT
    // =====================================================================

    /**
     * GET /api/admin/sertifikat/templates
     * Get all certificate templates (front & back)
     */
    public function getTemplates()
    {
        $templates = CertificateTemplate::all();

        return response()->json([
            'success' => true,
            'data' => $templates
        ]);
    }

    /**
     * POST /api/admin/sertifikat/templates
     * Upload new certificate template
     */
    public function uploadTemplate(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'side' => 'required|in:front,back',
            'image' => 'required|file|mimes:png,jpeg,jpg,svg|max:10240', // 10MB max
        ]);

        $user = auth('sanctum')->user();
        $file = $request->file('image');
        $filename = $request->side . '_' . time() . '.png';

        // ensure certificates directory exists on the public disk
        if (! Storage::disk('public')->exists('certificates')) {
            Storage::disk('public')->makeDirectory('certificates');
        }

        $path = $file->storeAs('certificates', $filename, 'public');

        if (! $path || $path === false) {
            // storeAs returns false on failure (permission, disk issue, etc.)
            // log underlying error if available for debugging
            Log::error('certificate upload failed', ['file' => $file, 'disk' => 'public']);
            return response()->json([
                'success' => false,
                'message' => 'Failed to save template file. Check storage configuration.'
            ], 500);
        }

        $template = CertificateTemplate::updateOrCreate(
            ['side' => $request->side],
            [
                'name' => $request->name,
                'image_path' => $path,
                'created_by' => $user->user_id,
                'updated_by' => $user->user_id,
            ]
        );

        return response()->json([
            'success' => true,
            'message' => 'Template uploaded successfully',
            'data' => $template
        ]);
    }

    /**
     * DELETE /api/admin/sertifikat/templates/{id}
     * Delete certificate template
     */
    public function deleteTemplate($id)
    {
        $template = CertificateTemplate::find($id);
        if (!$template) {
            return response()->json([
                'success' => false,
                'message' => 'Template not found'
            ], 404);
        }

        // Delete file from storage
        if ($template->image_path && Storage::disk('public')->exists($template->image_path)) {
            Storage::disk('public')->delete($template->image_path);
        }

        $template->delete();

        return response()->json([
            'success' => true,
            'message' => 'Template deleted successfully'
        ]);
    }

    /**
     * GET /api/sertifikat/templates/view/{side}
     * View template image (public access)
     */
    public function viewTemplate($side)
    {
        $template = CertificateTemplate::where('side', $side)->first();
        if (!$template) {
            return response()->json([
                'success' => false,
                'message' => 'Template not found'
            ], 404);
        }

        if (!Storage::disk('public')->exists($template->image_path)) {
            return response()->json([
                'success' => false,
                'message' => 'Template file not found'
            ], 404);
        }

        return Storage::disk('public')->response($template->image_path);
    }
    // generateCertNumber method removed as it's no longer needed
}
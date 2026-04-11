<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\WorkSchedule;
use Illuminate\Pagination\LengthAwarePaginator;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as PhpSpreadsheetDate;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class WorkScheduleController extends Controller
{
    public function index(Request $request)
    {
        $perPage = $request->input('per_page', 25);
        $query = WorkSchedule::query();

        // Free text search across name, times, and days
        if ($q = $request->input('q')) {
            $query->where(function($qb) use ($q) {
                $qb->where('name', 'like', "%{$q}%")
                   ->orWhere('start_time', 'like', "%{$q}%")
                   ->orWhere('end_time', 'like', "%{$q}%")
                   ->orWhere('days', 'like', "%{$q}%");
            });
        }

        // Filter by single day (e.g., ?day=mon or ?hari=mon) or by multiple days (?days[]=mon&days[]=tue)
        $day = $request->input('day') ?? $request->input('hari');
        $daysParam = $request->input('days');
        if ($day) {
            $day = strtolower($day);
            // match either in 'days' (array) or in keys of 'day_times' (json object)
            $query->where(function($q) use ($day) {
                $q->whereRaw("LOWER(days) LIKE ?", ['%"' . $day . '"%'])
                  ->orWhereRaw("LOWER(day_times) LIKE ?", ['%"' . $day . '"%']);
            });
        } elseif (is_array($daysParam) && count($daysParam) > 0) {
            foreach ($daysParam as $d) {
                $d = strtolower($d);
                $query->where(function($q) use ($d) {
                    $q->whereRaw("LOWER(days) LIKE ?", ['%"' . $d . '"%'])
                      ->orWhereRaw("LOWER(day_times) LIKE ?", ['%"' . $d . '"%']);
                });
            }
        }

        return response()->json($query->paginate($perPage));
    }

    /**
     * Generate and download an Excel template for importing WorkSchedules.
     */
    public function downloadTemplate(Request $request)
    {
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('WorkSchedules Template');

        // Header
        $sheet->fromArray(['name', 'start_time', 'end_time', 'days', 'day_times', 'is_active', 'tolerance'], null, 'A1');

        // Example rows (use HH:MM:SS to avoid Excel auto-format issues)
        // For flexible per-day times, you can use the `day_times` column with format: "mon:08:00-16:00;fri:07:00-15:00"
        // Row with fixed schedule (using start_time, end_time, days)
        $sheet->fromArray(['Shift Pagi', '08:00:00', '16:00:00', 'mon;tue;wed;thu;fri', '', '1', '10'], null, 'A2');
        // Row with flexible per-day schedule (using day_times column)
        $sheet->fromArray(['Shift Fleksibel', '', '', '', 'mon:08:00-16:00;thu:08:00-16:00;fri:07:00-15:00', '1', '10'], null, 'A3');

        $writer = new Xlsx($spreadsheet);
        $filename = 'work_schedule_template.xlsx';

        ob_start();
        $writer->save('php://output');
        $xlsxContent = ob_get_clean();

        return response($xlsxContent, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            'Content-Length' => strlen($xlsxContent),
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0'
        ]);
    }

    public function show($id)
    {
        return response()->json(WorkSchedule::findOrFail($id));
    }

    public function store(Request $request)
    {
        // accept both 'tolerance' and Indonesian alias 'toleransi'
        $request->merge(['tolerance' => $request->input('tolerance', $request->input('toleransi'))]);

        // Normalize human-friendly time formats (e.g., "8:00", "8:00 AM"), and Excel serial times
        if ($request->has('start_time')) {
            $request->merge(['start_time' => $this->normalizeTimeInput($request->input('start_time'))]);
        }
        if ($request->has('end_time')) {
            $request->merge(['end_time' => $this->normalizeTimeInput($request->input('end_time'))]);
        }

        // Normalize day_times input if provided (accept human times)
        if ($request->has('day_times')) {
            $dtRaw = $request->input('day_times');
            if (is_array($dtRaw)) {
                $dtNorm = [];
                foreach ($dtRaw as $dayKey => $range) {
                    if (!is_array($range)) continue;
                    $s = $this->normalizeTimeInput($range['start'] ?? null);
                    $e = $this->normalizeTimeInput($range['end'] ?? null);
                    if ($s && $e) {
                        // ensure end is after start (simple compare of seconds since midnight)
                        if (strtotime($e) <= strtotime($s)) {
                            return response()->json(['success' => false, 'message' => "end must be after start for day {$dayKey}"], 422);
                        }
                        $dtNorm[strtolower($dayKey)] = ['start' => $s, 'end' => $e];
                    }
                }
                $request->merge(['day_times' => $dtNorm]);
                // set days array for compatibility
                $request->merge(['days' => array_keys($dtNorm)]);
                // set global start/end to first day's times for backward compatibility
                if (!empty($dtNorm)) {
                    $first = reset($dtNorm);
                    $request->merge(['start_time' => $first['start'], 'end_time' => $first['end']]);
                }
            }
        }

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'start_time' => 'required_without:day_times|date_format:H:i:s',
            'end_time' => 'required_without:day_times|date_format:H:i:s|after:start_time',
            'day_times' => 'nullable|array',
            'day_times.*.start' => 'required_with:day_times|date_format:H:i:s',
            'day_times.*.end' => 'required_with:day_times|date_format:H:i:s',
            'days' => 'nullable|array',
            'days.*' => 'in:mon,tue,wed,thu,fri,sat,sun',
            'is_active' => 'boolean',
            'tolerance' => 'nullable|integer|min:0'
        ]);

        if (isset($data['days'])) $data['days'] = json_encode($data['days']);
        $data['tolerance'] = $data['tolerance'] ?? 0;

        // Toggle: jika schedule baru diset active, deactivate semua yang lain
        if (!empty($data['is_active'])) {
            WorkSchedule::where('is_active', true)->update(['is_active' => false]);
        }

        $ws = WorkSchedule::create($data);
        return response()->json(['success' => true, 'data' => $ws], 201);
    }

    public function update(Request $request, $id)
    {
        $ws = WorkSchedule::findOrFail($id);

        // accept both 'tolerance' and Indonesian alias 'toleransi'
        $request->merge(['tolerance' => $request->input('tolerance', $request->input('toleransi'))]);

        // Normalize time inputs before validation
        if ($request->has('start_time')) {
            $request->merge(['start_time' => $this->normalizeTimeInput($request->input('start_time'))]);
        }
        if ($request->has('end_time')) {
            $request->merge(['end_time' => $this->normalizeTimeInput($request->input('end_time'))]);
        }

        // Normalize day_times input if provided
        if ($request->has('day_times')) {
            $dtRaw = $request->input('day_times');
            if (is_array($dtRaw)) {
                $dtNorm = [];
                foreach ($dtRaw as $dayKey => $range) {
                    if (!is_array($range)) continue;
                    $s = $this->normalizeTimeInput($range['start'] ?? null);
                    $e = $this->normalizeTimeInput($range['end'] ?? null);
                    if ($s && $e) {
                        if (strtotime($e) <= strtotime($s)) {
                            return response()->json(['success' => false, 'message' => "end must be after start for day {$dayKey}"], 422);
                        }
                        $dtNorm[strtolower($dayKey)] = ['start' => $s, 'end' => $e];
                    }
                }
                $request->merge(['day_times' => $dtNorm]);
                $request->merge(['days' => array_keys($dtNorm)]);
                if (!empty($dtNorm)) {
                    $first = reset($dtNorm);
                    $request->merge(['start_time' => $first['start'], 'end_time' => $first['end']]);
                }
            }
        }

        $data = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'start_time' => 'sometimes|required|date_format:H:i:s',
            'end_time' => 'sometimes|required|date_format:H:i:s|after:start_time',
            'day_times' => 'nullable|array',
            'day_times.*.start' => 'required_with:day_times|date_format:H:i:s',
            'day_times.*.end' => 'required_with:day_times|date_format:H:i:s',
            'days' => 'nullable|array',
            'days.*' => 'in:mon,tue,wed,thu,fri,sat,sun',
            'is_active' => 'boolean',
            'tolerance' => 'nullable|integer|min:0'
        ]);
        if (isset($data['days'])) $data['days'] = json_encode($data['days']);
        if (isset($data['day_times'])) $data['day_times'] = $data['day_times'];

        // Toggle: jika schedule ini diset active, deactivate semua yang lain
        if (!empty($data['is_active'])) {
            WorkSchedule::where('is_active', true)->where('id', '!=', $ws->id)->update(['is_active' => false]);
        }

        $ws->update($data);
        return response()->json(['success' => true, 'data' => $ws]);
    }

    /**
     * Import WorkSchedules from an uploaded Excel file.
     */
    public function import(Request $request)
    {
        $file = $request->file('file');
        if (!$file || !$file->isValid()) {
            return response()->json(['success' => false, 'message' => 'File not provided or invalid'], 422);
        }

        $maxSize = 20 * 1024 * 1024; // 20MB
        if ($file->getSize() > $maxSize) {
            return response()->json(['success' => false, 'message' => 'File too large'], 413);
        }

        try {
            $spreadsheet = IOFactory::load($file->getRealPath());
            $sheet = $spreadsheet->getActiveSheet();
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Failed to read spreadsheet: ' . $e->getMessage()], 400);
        }

        // Use the shared parsing logic!
        $parsedResult = $this->parseSheetToPreview($sheet);

        if (!empty($parsedResult['headerErrors'])) {
             return response()->json(['success' => false, 'message' => 'Header Validation Failed', 'errors' => $parsedResult['headerErrors']], 422);
        }
        
        // Retrieve abort_on_error flag
        $abortOnError = filter_var($request->input('abort_on_error', false), FILTER_VALIDATE_BOOLEAN);

        $successCount = 0;
        $errors = [];

        // Check for parsing errors first if abort_on_error is true
        if ($abortOnError && $parsedResult['errorCount'] > 0) {
             // Collect all errors from parsed rows
             foreach ($parsedResult['rows'] as $row) {
                 if (!empty($row['errors'])) {
                     $errors[] = ['row' => $row['row'], 'errors' => $row['errors'], 'values' => $row['raw']];
                 }
             }
             return response()->json([
                'success' => false,
                'imported' => 0,
                'errors' => $errors,
                'message' => 'Import aborted because parsing errors were found (abort_on_error=true)'
            ], 422);
        }

        if ($abortOnError) DB::beginTransaction();

        foreach ($parsedResult['rows'] as $rowItem) {
            $r = $rowItem['row'];
            $rowErrors = $rowItem['errors'];
            $parsed = $rowItem['parsed']; // Canonical data

            // If row has parsing errors, skip or collect error
            if (!empty($rowErrors)) {
                $errors[] = ['row' => $r, 'errors' => $rowErrors, 'values' => $rowItem['raw']];
                continue;
            }

            // Prepare payload for DB
            // 'parsed' structure from parseRowFields:
            // name, start_time, end_time, days (array), day_times (array/null), is_active, tolerance
            
            $payload = [
                'name' => $parsed['name'],
                'days' => $parsed['days'] ?: null,
                'tolerance' => $parsed['tolerance'],
                'is_active' => $parsed['is_active'],
                'start_time' => $parsed['start_time'] ?: null,
                'end_time' => $parsed['end_time'] ?: null,
                'day_times' => $parsed['day_times'] ?: null,
            ];

            // Backward compatibility logic (if day_times exists, ensure days keys are set, etc - handled by model mostly, but specific request logic needs replication)
            // The model create/update expects 'days' as array and 'day_times' as array.
            // Our helper returns exactly that.
            
            // Logic sync from previous import:
            // if day_times is set, start_time/end_time in payload can be set to first day's time for legacy apps
            if ($payload['day_times']) {
                 $firstDayRanges = reset($payload['day_times']);
                 if (!empty($firstDayRanges) && isset($firstDayRanges[0])) {
                     $payload['start_time'] = $firstDayRanges[0]['start'];
                     $payload['end_time'] = $firstDayRanges[0]['end'];
                 }
            }

            try {
                WorkSchedule::updateOrCreate(['name' => $payload['name']], $payload);
                $successCount++;
            } catch (\Exception $e) {
                // Database error (e.g. duplicate name if not handled by updateOrCreate, or other constraint)
                $errors[] = ['row' => $r, 'errors' => ['database error: ' . $e->getMessage()], 'values' => $rowItem['raw']];
            }
        }

        if ($abortOnError && count($errors) > 0) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'imported' => 0,
                'errors' => $errors,
                'message' => 'Import aborted because errors occurred during save (abort_on_error=true)'
            ], 422);
        }

        if ($abortOnError) DB::commit();

        return response()->json([
            'success' => true,
            'imported' => $successCount,
            'errors' => $errors
        ]);
    }

    public function destroy($id)
    {
        $ws = WorkSchedule::findOrFail($id);
        $ws->delete();
        return response()->json(['success' => true]);
    }

    /**
     * Preview import file (parse only, return parsed rows and row-level errors). Stores preview in cache and
     * returns a preview_token for final import.
     */
    public function preview(Request $request)
    {
        $file = $request->file('file');
        if (!$file || !$file->isValid()) {
            return response()->json(['ok' => false, 'message' => 'File not provided or invalid'], 422);
        }

        $maxSize = 20 * 1024 * 1024; // 20MB
        if ($file->getSize() > $maxSize) {
            return response()->json(['ok' => false, 'message' => 'File too large'], 413);
        }

        try {
            $spreadsheet = IOFactory::load($file->getRealPath());
            $sheet = $spreadsheet->getActiveSheet();
        } catch (\Exception $e) {
            return response()->json(['ok' => false, 'message' => 'Failed to read spreadsheet: ' . $e->getMessage()], 400);
        }

        $result = $this->parseSheetToPreview($sheet);

        // store preview in cache for 30 minutes
        $token = Str::random(40);
        Cache::put('work_schedule_preview:'.$token, $result, now()->addMinutes(30));

        return response()->json([
            'ok' => true,
            'rows' => count($result['rows']),
            'headerErrors' => $result['headerErrors'],
            'preview' => $result['rows'],
            'summary' => ['parsedCount' => $result['parsedCount'], 'errorCount' => $result['errorCount']],
            'preview_token' => $token
        ]);
    }

    /**
     * Parse a cell value (raw or calculated) into H:i:s time string where possible.
     * Returns null on failure.
     */
    private function parseExcelCellTime($cellValue)
    {
        if ($cellValue === null || $cellValue === '') return null;

        // If it's a DateTime object
        if ($cellValue instanceof \DateTimeInterface) {
            return $cellValue->format('H:i:s');
        }

        // If numeric (Excel serial date/time)
        if (is_numeric($cellValue)) {
            try {
                $dt = PhpSpreadsheetDate::excelToDateTimeObject((float)$cellValue);
                return $dt->format('H:i:s');
            } catch (\Exception $e) {
                // fallback to string parsing
            }
        }

        // Try normalize with existing helper
        $normalized = $this->normalizeTimeInput($cellValue);
        if (is_string($normalized) && preg_match('/^\d{2}:\d{2}:\d{2}$/', $normalized)) {
            return $normalized;
        }

        // If the cell contains a date-time string, try to extract time portion
        if (preg_match('/(\d{1,2}:\d{2}(?::\d{2})?)/', (string)$cellValue, $m)) {
            $maybe = $m[1];
            $maybeNorm = $this->normalizeTimeInput($maybe);
            if (preg_match('/^\d{2}:\d{2}:\d{2}$/', $maybeNorm)) return $maybeNorm;
        }

        // If all fails, return null (import will report error)
        return null;
    }

    /**
     * Parse a PhpSpreadsheet sheet into preview rows and errors
     */
    private function parseSheetToPreview($sheet)
    {
        $rows = $sheet->toArray(null, true, true, true);
        if (count($rows) < 2) {
            return [
                'rows' => [],
                'headerErrors' => ['Spreadsheet must contain header and at least one row.'],
                'parsedCount' => 0,
                'errorCount' => 0
            ];
        }

        $rawHeader = array_values($rows[1]);
        $header = array_map(function($h){ return trim((string)$h); }, $rawHeader);
        $normalizeHeader = function($s) {
            $s = strtolower(trim((string)$s));
            if (function_exists('iconv')) $s = @iconv('UTF-8', 'ASCII//TRANSLIT', $s) ?: $s;
            $s = preg_replace('/[^a-z0-9]/', '', $s);
            return $s;
        };
        $normalizedHeaders = array_map($normalizeHeader, $header);
        $findCol = function(array $candidates) use ($normalizedHeaders) {
            foreach ($normalizedHeaders as $idx => $h) {
                foreach ($candidates as $c) {
                    $cNorm = preg_replace('/[^a-z0-9]/','',strtolower($c));
                    if ($h === $cNorm || strpos($h, $cNorm) !== false || strpos($cNorm, $h) !== false) return $idx;
                }
            }
            return null;
        };

        $nameCol = $findCol(['name','nama','namajadwal','nama_jadwal']);
        $startCol = $findCol(['start_time','start','jam_masuk','time_in','waktu_awal','jammasuk']);
        $endCol = $findCol(['end_time','end','jam_pulang','time_out','waktu_akhir','jampulang']);
        $daysCol = $findCol(['days','hari']);
        $dayTimesCol = $findCol(['day_times','daytimes','day-times']);
        $isActiveCol = $findCol(['is_active','active','aktif']);
        $toleranceCol = $findCol(['tolerance','toleransi','toleran']);

        $numCols = count($header);
        $getCell = function($col, $r) use ($sheet, $numCols) {
            if ($col === null) return null;
            $colIndex = $col + 1;
            $colLetter = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($colIndex);
            $coordinate = $colLetter . $r;
            $cell = $sheet->getCell($coordinate);
            try { $val = $cell->getCalculatedValue(); } catch (\Throwable $e) { $val = $cell->getValue(); }
            if ($val === null) $val = $cell->getValue();
            return $val;
        };

        $rowsOut = [];
        $parsedCount = 0;
        $errorCount = 0;

        // Use getHighestDataRow() for accurate row count
        $lastRow = $sheet->getHighestDataRow();
        for ($r = 2; $r <= $lastRow; $r++) {
            // skip blank rows - check if ALL cells in the row are empty
            $isBlank = true;
            $hasNameValue = false;
            
            // Check name column specifically - if name is empty, skip the row
            $nameValue = $getCell($nameCol, $r);
            if ($nameValue !== null && trim((string)$nameValue) !== '') {
                $isBlank = false;
                $hasNameValue = true;
            }
            
            // If no name, check other columns
            if (!$hasNameValue) {
                for ($ci = 0; $ci < $numCols; $ci++) {
                    $cv = $getCell($ci, $r);
                    if ($cv !== null && trim((string)$cv) !== '') { 
                        $isBlank = false; 
                        break; 
                    }
                }
            }
            
            if ($isBlank) continue;

            $raw = [
                'name' => $getCell($nameCol, $r),
                'start_time' => $getCell($startCol, $r),
                'end_time' => $getCell($endCol, $r),
                'days' => $getCell($daysCol, $r),
                'day_times' => $getCell($dayTimesCol, $r),
                'is_active' => $getCell($isActiveCol, $r),
                'tolerance' => $getCell($toleranceCol, $r),
            ];

            $parsed = $this->parseRowFields($raw);
            $rowsOut[] = [
                'row' => $r,
                'raw' => $raw,
                'parsed' => $parsed['parsed'],
                'errors' => $parsed['errors']
            ];

            if (count($parsed['errors']) > 0) $errorCount++; else $parsedCount++;
        }

        return [
            'rows' => $rowsOut,
            'headerErrors' => [],
            'parsedCount' => $parsedCount,
            'errorCount' => $errorCount
        ];
    }

    /**
     * Parse a single raw row fields (array with keys name,start_time,end_time,days,day_times,is_active,tolerance)
     * Returns ['parsed' => canonicalArray, 'errors' => []]
     */
    private function parseRowFields(array $raw)
    {
        $errors = [];
        $parsed = [
            'name' => null,
            'start_time' => null,
            'end_time' => null,
            'days' => [],
            'day_times' => null,
            'is_active' => true,
            'tolerance' => 0
        ];

        $name = trim((string)($raw['name'] ?? ''));
        if ($name === '') $errors[] = 'name is required';
        $parsed['name'] = $name;

        // normalize basic fields
        $parsed['is_active'] = in_array(trim((string)($raw['is_active'] ?? '1')), ['1','true','yes'], true);
        $parsed['tolerance'] = is_numeric($raw['tolerance']) ? intval($raw['tolerance']) : 0;

        // normalize start/end if provided
        if (!empty($raw['start_time'])) $parsed['start_time'] = $this->normalizeTimeInput($raw['start_time']);
        if (!empty($raw['end_time'])) $parsed['end_time'] = $this->normalizeTimeInput($raw['end_time']);

        // If day_times column provided and contains patterns, prefer it
        $dayTimesCell = trim((string)($raw['day_times'] ?? ''));
        $daysCell = trim((string)($raw['days'] ?? ''));

        $dayTimes = null;
        if ($dayTimesCell !== '') {
            [$dt, $err] = $this->parseDayRangeString($dayTimesCell);
            if (!empty($err)) $errors = array_merge($errors, $err);
            $dayTimes = $dt;
            $parsed['day_times'] = $dayTimes;
            if ($dayTimes) $parsed['days'] = array_values(array_unique(array_keys($dayTimes)));
        } elseif ($daysCell !== '') {
            // detect if days cell contains range patterns, delegate to same parser
            if (strpos($daysCell, ':') !== false || strpos($daysCell, '-') !== false) {
                [$dt, $err] = $this->parseDayRangeString($daysCell);
                if (!empty($err)) $errors = array_merge($errors, $err);
                $dayTimes = $dt;
                $parsed['day_times'] = $dayTimes;
                if ($dayTimes) $parsed['days'] = array_values(array_unique(array_keys($dayTimes)));
            } else {
                $parts = preg_split('/[;,|]+/', $daysCell);
                $parts = array_filter(array_map('trim', $parts));
                $parsed['days'] = array_values($parts);
            }
        }

        // if no day_times and no days, fallback to start_time/end_time pair (global)
        if (empty($parsed['days']) && empty($parsed['day_times'])) {
            if ($parsed['start_time'] && $parsed['end_time']) {
                $parsed['days'] = [];
            } else {
                $errors[] = 'either days/day_times or start_time+end_time must be provided';
            }
        }

        // If day_times is present, validate ranges and expand
        if ($parsed['day_times']) {
            // validate ranges per day
            foreach ($parsed['day_times'] as $day => &$ranges) {
                // sort by start
                usort($ranges, function($a,$b){ return strcmp($a['start'],$b['start']); });
                // check overlaps
                $prevEnd = null;
                foreach ($ranges as $r) {
                    if (!isset($r['start']) || !isset($r['end'])) { $errors[] = "invalid range for day {$day}"; continue; }
                    if (strtotime($r['end']) <= strtotime($r['start'])) {
                        $errors[] = "end must be after start for day {$day} ({$r['start']}-{$r['end']})"; continue;
                    }
                    if ($prevEnd && strtotime($r['start']) < strtotime($prevEnd)) {
                        $errors[] = "overlap detected for day {$day} ({$r['start']} < {$prevEnd})"; break;
                    }
                    $prevEnd = $r['end'];
                }
            }
            unset($ranges);
        }

        return ['parsed' => $parsed, 'errors' => $errors];
    }

    /**
     * Parse a string like "mon:08:00-16:00;fri:07:00-15:00" or "mon-thu:08:00-17:00"
     * Returns [dayTimesArray, errorsArray]
     */
    private function parseDayRangeString(string $s)
    {
        $errors = [];
        $order = ['mon','tue','wed','thu','fri','sat','sun'];
        $getNextDay = function($d) use ($order) {
            $idx = array_search(strtolower($d), $order);
            if ($idx === false) return null;
            return $order[($idx + 1) % count($order)];
        };

        $blocks = preg_split('/[;|]+/', $s);
        $dt = [];
        foreach ($blocks as $b) {
            $b = trim($b);
            if ($b === '') continue;
            if (strpos($b, ':') === false) { $errors[] = "invalid block (missing ':'): {$b}"; continue; }
            [$dayPart, $rangesPart] = array_map('trim', explode(':', $b, 2));
            // expand days
            $expandedDays = [];
            if (strpos($dayPart, '-') !== false) {
                [$startDay, $endDay] = array_map('trim', explode('-', $dayPart, 2));
                $startIdx = array_search(strtolower($startDay), $order);
                $endIdx = array_search(strtolower($endDay), $order);
                if ($startIdx === false || $endIdx === false) { $errors[] = "invalid day range: {$dayPart}"; continue; }
                if ($startIdx <= $endIdx) { for ($i=$startIdx;$i<=$endIdx;$i++) $expandedDays[] = $order[$i]; }
                else { for ($i=$startIdx;$i<count($order);$i++) $expandedDays[] = $order[$i]; for ($i=0;$i<=$endIdx;$i++) $expandedDays[] = $order[$i]; }
            } else {
                $parts = preg_split('/[,]+/', $dayPart);
                foreach ($parts as $p) { $p = strtolower(trim($p)); if ($p!=='') $expandedDays[] = $p; }
            }
            if (empty($expandedDays)) { $errors[] = "no valid days parsed from: {$dayPart}"; continue; }

            $ranges = preg_split('/[,]+/', $rangesPart);
            foreach ($ranges as $range) {
                $range = trim($range);
                if ($range === '') continue;
                if (strpos($range, '-') === false) { $errors[] = "invalid time range format: {$range}"; continue; }
                [$sRaw,$eRaw] = array_map('trim', explode('-', $range, 2));
                $sNorm = $this->normalizeTimeInput($sRaw);
                $eNorm = $this->normalizeTimeInput($eRaw);
                if (!$sNorm || !$eNorm) { $errors[] = "could not parse times in range: {$range}"; continue; }
                if (strtotime($eNorm) <= strtotime($sNorm)) {
                    // cross-midnight split
                    $endOfDay = '23:59:59';
                    foreach ($expandedDays as $d) {
                        $dt[$d][] = ['start'=>$sNorm,'end'=>$endOfDay];
                        $next = $getNextDay($d);
                        if ($next) $dt[$next][] = ['start'=>'00:00:00','end'=>$eNorm];
                    }
                } else {
                    foreach ($expandedDays as $d) {
                        $dt[$d][] = ['start'=>$sNorm,'end'=>$eNorm];
                    }
                }
            }
        }
        return [$dt, $errors];
    }

    /**
     * Normalize time inputs from various formats to H:i:s.
     * Accepts: Excel serial time (numeric), HH:MM, HH:MM:SS, human strings parsable by strtotime (e.g., "8:00 AM").
     */
    private function normalizeTimeInput($value)
    {
        if ($value === null || $value === '') return $value;

        // Excel numeric time value
        if (is_numeric($value)) {
            try {
                $dt = PhpSpreadsheetDate::excelToDateTimeObject((float)$value);
                return $dt->format('H:i:s');
            } catch (\Exception $e) {
                // fallthrough to other parsing attempts
            }
        }

        // Accept HH:MM or HH:MM:SS
        $timePattern = '/^\d{1,2}:\d{2}(:\d{2})?$/';
        if (preg_match($timePattern, $value)) {
            if (substr_count($value, ':') == 1) $value .= ':00';
            $ts = strtotime($value);
            if ($ts !== false) return date('H:i:s', $ts);
        }

        // Clean localized separators (08.00 or 08,00)
        $clean = preg_replace(['/\./', '/,/'], ':', (string)$value);
        if (preg_match($timePattern, $clean)) {
            if (substr_count($clean, ':') == 1) $clean .= ':00';
            $ts = strtotime($clean);
            if ($ts !== false) return date('H:i:s', $ts);
        }

        // Fallback: try strtotime for various human formats
        $ts = strtotime($value);
        if ($ts !== false) return date('H:i:s', $ts);

        // If all fails, return original so validation will catch it
        return $value;
    }
}

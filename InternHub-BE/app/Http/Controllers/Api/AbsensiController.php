<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TblAbsensi;
use App\Models\TblMahasiswa;
use App\Models\TblSettingAbsensi;
use App\Models\User;
use App\Models\Izin;
use App\Models\KoreksiAbsensi;
use App\Services\LocationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;
use Carbon\CarbonPeriod; // Jangan lupa import ini di atas

class AbsensiController extends Controller
{
    /**
     * Get server time untuk sinkronisasi waktu
     */
    public function getServerTime(Request $request)
    {
        $now = Carbon::now();
        $user = $request->user();

        $canClockOut = false;
        if ($user) {
            $clockOutLimit = $this->getClockOutTime($user, $now);
            $canClockOut = $now->greaterThanOrEqualTo($clockOutLimit);
        }

        return response()->json([
            'success' => true,
            'server_time' => $now->toDateTimeString(),
            'server_date' => $now->toDateString(),
            'server_hour' => $now->format('H:i:s'),
            'can_clock_out' => $canClockOut,
            'timezone' => config('app.timezone'),
        ]);
    }

    /**
     * Proses absensi masuk dengan foto wajah (live capture)
     * Menggunakan waktu server, bukan waktu HP
     */
    public function absenMasuk(Request $request)
    {
        $request->validate([
            'latitude' => 'required|numeric',
            'longitude' => 'required|numeric',
            'foto' => 'required|image|mimes:jpeg,png,jpg|max:5120', // Max 5MB, wajib foto
        ]);

        $user = $request->user();

        // Cek koordinat valid
        if (!LocationService::isValidCoordinate($request->latitude, $request->longitude)) {
            return response()->json([
                'success' => false,
                'message' => 'Koordinat tidak valid'
            ], 400);
        }

        $roles = $user->getRoleNames();
        $user_role = $roles[0] ?? null;

        if ($user_role != 'intern') {
            return response()->json([
                'success' => false,
                'message' => 'Hanya intern yang dapat melakukan absensi.'
            ], 403);
        }

        // Cek semua site aktif yang tersedia - tanpa harus sesuai site di profile
        $allSites = \App\Models\TblSite::active()->get();
        
        if ($allSites->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'Tidak ada site aktif yang tersedia. Hubungi admin.'
            ], 404);
        }

        $closestSite = null;
        $closestDistance = PHP_FLOAT_MAX;
        $locationCheck = null;
        $isWithinAnySite = false;

        foreach ($allSites as $siteItem) {
            $maxRadiusItem = $siteItem->radius_meter ?? 100;
            $check = LocationService::isWithinRadius(
                $request->latitude,
                $request->longitude,
                $siteItem->latitude,
                $siteItem->longitude,
                $maxRadiusItem
            );

            // Jika masuk radius salah satu site, langsung gunakan site tersebut
            if ($check['is_within_radius']) {
                $isWithinAnySite = true;
                $closestSite = $siteItem;
                $locationCheck = $check;
                break;
            }

            // Simpan jarak terdekat jika belum ada yang masuk radius
            if ($check['distance'] < $closestDistance) {
                $closestDistance = $check['distance'];
                $closestSite = $siteItem;
                $locationCheck = $check;
            }
        }

        $site = $closestSite;
        $maxRadius = $site->radius_meter ?? 100;

        if (!$isWithinAnySite) {
            return response()->json([
                'success' => false,
                'message' => 'Anda berada di luar radius lokasi absensi (max ' . $maxRadius . 'm)',
                'location_info' => [
                    'jarak_anda' => $locationCheck['distance'] . ' meter',
                    'radius_dileave_requestskan' => $locationCheck['radius_allowed'] . ' meter',
                    'kelebihan_jarak' => $locationCheck['difference'] . ' meter'
                ]
            ], 403);
        }

        // Gunakan waktu SERVER, bukan waktu HP
        $serverNow = Carbon::now();
        $today = $serverNow->toDateString();

        // Cek apakah sudah absen masuk hari ini
        $mahasiswaId = $user->mahasiswa?->id_mahasiswa ?? null;
        $existingAbsenQuery = TblAbsensi::query();
        if ($mahasiswaId) { $existingAbsenQuery->where('id_mahasiswa', $mahasiswaId); } else { $existingAbsenQuery->where('user_id', $user->user_id); }
        $existingAbsen = $existingAbsenQuery
            ->where('tanggal', $today)
            ->where('status', 'masuk')
            ->first();

        if ($existingAbsen) {
            return response()->json([
                'success' => false,
                'message' => 'Anda sudah melakukan absen masuk hari ini pada pukul ' . $existingAbsen->waktu
            ], 400);
        }

        // Upload foto wajah dengan encryption
        $fotoPath = null;
        if ($request->hasFile('foto')) {
            try {
                $foto = $request->file('foto');
                $fotoName = 'absen_masuk_' . $user->user_id . '_' . $today . '_' . time() . '.enc';
                $fileContents = file_get_contents($foto->getRealPath());
                $encryptedContents = Crypt::encryptString($fileContents);
                Storage::disk("local")->put("encrypted/absensi/" . $fotoName, $encryptedContents);
                $fotoPath = "encrypted/absensi/" . $fotoName;
                Log::info("Foto absen masuk di-encrypt", ['filename' => $fotoName]);
            } catch (\Exception $e) {
                Log::error("Error encrypt foto absen masuk: " . $e->getMessage());
                return response()->json(['message' => 'Error upload foto: ' . $e->getMessage()], 500);
            }
        }

        // Hitung lama telat berdasarkan jam_masuk dari Work Schedule / Site
        $jamMasukLimit = $this->getClockInTime($user, $serverNow);
        $jamAbsen = Carbon::parse($serverNow->toTimeString());
        $lamaTelat = 0;

        $tolerance = 0;
        $workSchedule = $user->workSchedule;
        if ($workSchedule && $workSchedule->tolerance) {
            $tolerance = $workSchedule->tolerance;
        }

        if ($jamAbsen->gt($jamMasukLimit->copy()->addMinutes($tolerance))) {
            $lamaTelat = $jamMasukLimit->diffInMinutes($jamAbsen);
        }

        // Simpan absensi dengan waktu server
        // Auto-fill id_mahasiswa dari relasi user
        $idMahasiswa = $user->mahasiswa?->id_mahasiswa;

        $absensi = TblAbsensi::create([
            'user_id' => $user->user_id,
            'id_mahasiswa' => $idMahasiswa,
            'status' => 'masuk',
            'waktu' => $serverNow->toTimeString(), // Waktu server!
            'tanggal' => $today,
            'latitude_absen' => $request->latitude,
            'longitude_absen' => $request->longitude,
            'foto_absen' => $fotoPath,
            'lama_telat' => $lamaTelat,
        ]);

        // Prepare response message
        $message = 'Absen masuk berhasil';
        if ($lamaTelat > 0) {
            $message .= ' (Terlambat ' . $lamaTelat . ' menit)';
        }

        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $absensi,
            'keterlambatan' => [
                'jam_masuk_site' => $jamMasukLimit->toTimeString(),
                'jam_absen' => $serverNow->toTimeString(),
                'lama_telat' => $lamaTelat,
                'status' => $lamaTelat > 0 ? 'Terlambat' : 'Tepat Waktu',
            ],
            'server_time' => $serverNow->toDateTimeString(),
            'location_info' => [
                'jarak_dari_site' => $locationCheck['distance'] . ' meter',
                'nama_site' => $site->nama_site
            ]
        ], 201);
    }

    /**
     * Proses absensi pulang dengan foto wajah
     * Tombol clock out terkunci sebelum jam 17:00
     */
    public function absenPulang(Request $request)
    {
        $request->validate([
            'latitude' => 'required|numeric',
            'longitude' => 'required|numeric',
            'foto' => 'required|image|mimes:jpeg,png,jpg|max:5120', // Max 5MB
            'remark' => 'nullable|string|max:255', // Optional remark for early leave
            'reason' => 'nullable|string|max:1000', // Preferred field for early leave reason (FE)
        ]);

        $user = $request->user();
        $serverNow = Carbon::now();

        // Check dynamic clock out time
        $clockOutLimit = $this->getClockOutTime($user, $serverNow);

        // Determine if this is an early leave attempt
        $isEarlyAttempt = $serverNow->lessThan($clockOutLimit);

        // Prefer `reason`, fallback to `remark` (backward compatibility)
        $earlyReason = trim((string) ($request->input('reason') ?? $request->input('remark')));

        $earlyReasonLen = function_exists('mb_strlen') ? mb_strlen($earlyReason) : strlen($earlyReason);

        if ($isEarlyAttempt && ($earlyReason === '' || $earlyReasonLen < 10)) {
            // Require a remark to allow early clock out
            return response()->json([
                'success' => false,
                'message' => 'Clock out belum tersedia. Jika ingin absen pulang lebih awal, sertakan alasan (reason) minimal 10 karakter dan foto. Anda baru bisa absen pulang setelah pukul ' . $clockOutLimit->format('H:i:s'),
                'server_time' => $serverNow->toDateTimeString(),
                'can_clock_out_at' => $clockOutLimit->toDateTimeString(),
            ], 403);
        }

        // Cek koordinat valid
        if (!LocationService::isValidCoordinate($request->latitude, $request->longitude)) {
            return response()->json([
                'success' => false,
                'message' => 'Koordinat tidak valid'
            ], 400);
        }

        $roles = $user->getRoleNames();
        $user_role = $roles[0] ?? null;

        if ($user_role != 'intern') {
            return response()->json([
                'success' => false,
                'message' => 'Hanya intern yang dapat melakukan absensi.'
            ], 403);
        }

        // Cek semua site aktif yang tersedia - tanpa harus sesuai site di profile
        $allSites = \App\Models\TblSite::active()->get();
        
        if ($allSites->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'Tidak ada site aktif yang tersedia. Hubungi admin.'
            ], 404);
        }

        $closestSite = null;
        $closestDistance = PHP_FLOAT_MAX;
        $locationCheck = null;
        $isWithinAnySite = false;

        foreach ($allSites as $siteItem) {
            $maxRadiusItem = $siteItem->radius_meter ?? 100;
            $check = LocationService::isWithinRadius(
                $request->latitude,
                $request->longitude,
                $siteItem->latitude,
                $siteItem->longitude,
                $maxRadiusItem
            );

            // Jika masuk radius salah satu site, langsung gunakan site tersebut
            if ($check['is_within_radius']) {
                $isWithinAnySite = true;
                $closestSite = $siteItem;
                $locationCheck = $check;
                break;
            }

            // Simpan jarak terdekat jika belum ada yang masuk radius
            if ($check['distance'] < $closestDistance) {
                $closestDistance = $check['distance'];
                $closestSite = $siteItem;
                $locationCheck = $check;
            }
        }

        $site = $closestSite;
        $maxRadius = $site->radius_meter ?? 100;

        if (!$isWithinAnySite) {
            return response()->json([
                'success' => false,
                'message' => 'Anda berada di luar radius lokasi absensi (max ' . $maxRadius . 'm)',
                'location_info' => [
                    'jarak_anda' => $locationCheck['distance'] . ' meter',
                    'radius_dileave_requestskan' => $locationCheck['radius_allowed'] . ' meter',
                    'kelebihan_jarak' => $locationCheck['difference'] . ' meter'
                ]
            ], 403);
        }

        $today = $serverNow->toDateString();

        // Cek apakah sudah absen masuk hari ini
        $mahasiswaId = $user->mahasiswa?->id_mahasiswa ?? null;
        $absenMasukQuery = TblAbsensi::query();
        if ($mahasiswaId) { $absenMasukQuery->where('id_mahasiswa', $mahasiswaId); } else { $absenMasukQuery->where('user_id', $user->user_id); }
        $absenMasuk = $absenMasukQuery
            ->where('tanggal', $today)
            ->where('status', 'masuk')
            ->first();

        if (!$absenMasuk) {
            return response()->json([
                'success' => false,
                'message' => 'Anda belum melakukan absen masuk hari ini'
            ], 400);
        }

        // Cek apakah sudah absen pulang
        $existingPulangQuery = TblAbsensi::query();
        if ($mahasiswaId) { $existingPulangQuery->where('id_mahasiswa', $mahasiswaId); } else { $existingPulangQuery->where('user_id', $user->user_id); }
        $existingPulang = $existingPulangQuery
            ->where('tanggal', $today)
            ->where('status', 'pulang')
            ->first();

        if ($existingPulang) {
            return response()->json([
                'success' => false,
                'message' => 'Anda sudah melakukan absen pulang hari ini pada pukul ' . $existingPulang->waktu
            ], 400);
        }

        // Upload foto wajah dengan encryption
        $fotoPath = null;
        if ($request->hasFile('foto')) {
            try {
                $foto = $request->file('foto');
                $fotoName = 'absen_pulang_' . $user->user_id . '_' . $today . '_' . time() . '.enc';
                $fileContents = file_get_contents($foto->getRealPath());
                $encryptedContents = Crypt::encryptString($fileContents);
                Storage::disk("local")->put("encrypted/absensi/" . $fotoName, $encryptedContents);
                $fotoPath = "encrypted/absensi/" . $fotoName;
                Log::info("Foto absen pulang di-encrypt", ['filename' => $fotoName]);
            } catch (\Exception $e) {
                Log::error("Error encrypt foto absen pulang: " . $e->getMessage());
                return response()->json(['message' => 'Error upload foto: ' . $e->getMessage()], 500);
            }
        }

        // Simpan absensi pulang dengan waktu server
        // Auto-fill id_mahasiswa dari relasi user
        $idMahasiswa = $user->mahasiswa?->id_mahasiswa;

        // Cek apakah ini early leave (sebelum jam pulang minimal berdasarkan work schedule/site)
        $isEarly = $serverNow->lessThan($clockOutLimit);
        $remark = $request->input('remark'); // Optional legacy remark
        $reason = $request->input('reason') ?? ($isEarly ? ($earlyReason !== '' ? $earlyReason : null) : null);

        $absensi = TblAbsensi::create([
            'user_id' => $user->user_id,
            'id_mahasiswa' => $idMahasiswa,
            'status' => 'pulang',
            'waktu' => $serverNow->toTimeString(),
            'tanggal' => $today,
            'latitude_absen' => $request->latitude,
            'longitude_absen' => $request->longitude,
            'foto_absen' => $fotoPath,
            'early' => $isEarly,
            'remark' => $remark,
            'reason' => $isEarly ? ($reason ?: null) : null,
        ]);

        $message = 'Absen pulang berhasil';
        if ($isEarly) {
            $message .= ' (Early leave)';
        }

        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $absensi,
            'server_time' => $serverNow->toDateTimeString(),
            'location_info' => [
                'jarak_dari_site' => $locationCheck['distance'] . ' meter',
                'nama_site' => $site->nama_site
            ]
        ], 201);
    }

    /**
     * Cek lokasi user (untuk preview sebelum absen)
     */
    public function checkLocation(Request $request)
    {
        $request->validate([
            'latitude' => 'required|numeric',
            'longitude' => 'required|numeric',
        ]);

        $user = $request->user();

        if (!$user->site) {
            return response()->json([
                'success' => false,
                'message' => 'Site user tidak ditemukan. Hubungi admin.'
            ], 404);
        }

        $userSite = $user->site;

        // Cek semua site aktif yang tersedia
        $allSites = \App\Models\TblSite::active()->get();
        $closestSite = $userSite;
        $closestDistance = PHP_FLOAT_MAX;
        $locationCheck = null;
        $isWithinAnySite = false;

        foreach ($allSites as $siteItem) {
            $maxRadiusItem = $siteItem->radius_meter ?? 100;
            $check = LocationService::isWithinRadius(
                $request->latitude,
                $request->longitude,
                $siteItem->latitude,
                $siteItem->longitude,
                $maxRadiusItem
            );

            // Jika masuk radius salah satu site, langsung gunakan site tersebut
            if ($check['is_within_radius']) {
                $isWithinAnySite = true;
                $closestSite = $siteItem;
                $locationCheck = $check;
                break;
            }

            // Simpan jarak terdekat jika belum ada yang masuk radius
            if ($check['distance'] < $closestDistance) {
                $closestDistance = $check['distance'];
                $closestSite = $siteItem;
                $locationCheck = $check;
            }
        }

        $site = $closestSite;
        $maxRadius = $site->radius_meter ?? 100;

        $serverNow = Carbon::now();
        $clockOutLimit = $this->getClockOutTime($user, $serverNow);

        return response()->json([
            'success' => true,
            'can_absen' => $isWithinAnySite,
            'can_clock_out' => $serverNow->greaterThanOrEqualTo($clockOutLimit),
            'site' => [
                'nama' => $site->nama_site,
                'latitude' => $site->latitude,
                'longitude' => $site->longitude,
                'radius' => $maxRadius
            ],
            'user_location' => [
                'latitude' => $request->latitude,
                'longitude' => $request->longitude
            ],
            'distance' => ($locationCheck['distance'] ?? 0) . ' meter',
            'server_time' => $serverNow->toDateTimeString(),
            'message' => $isWithinAnySite
                ? 'Anda berada dalam radius lokasi absensi ' . $site->nama_site
                : 'Anda berada ' . ($locationCheck['difference'] ?? 0) . ' meter di luar radius'
        ]);
    }

    /**
     * Get status absensi hari ini untuk user
     */
    public function statusHariIni(Request $request)
    {
        $user = $request->user();
        $today = Carbon::now()->toDateString();

        $mahasiswaId = $user->mahasiswa?->id_mahasiswa ?? null;
        $absenQuery = TblAbsensi::query();
        if ($mahasiswaId) { $absenQuery->where('id_mahasiswa', $mahasiswaId); } else { $absenQuery->where('user_id', $user->user_id); }

        $absenMasuk = (clone $absenQuery)
            ->where('tanggal', $today)
            ->where('status', 'masuk')
            ->first();

        $absenPulang = (clone $absenQuery)
            ->where('tanggal', $today)
            ->where('status', 'pulang')
            ->first();

        $serverNow = Carbon::now();
        $clockOutLimit = $this->getClockOutTime($user, $serverNow);

        return response()->json([
            'success' => true,
            'tanggal' => $today,
            'server_time' => $serverNow->toDateTimeString(),
            'sudah_absen_masuk' => $absenMasuk !== null,
            'sudah_absen_pulang' => $absenPulang !== null,
            'can_clock_out' => $serverNow->greaterThanOrEqualTo($clockOutLimit),
            'absen_masuk' => $absenMasuk,
            'absen_pulang' => $absenPulang,
            'absen_pulang_early' => $absenPulang ? (bool) $absenPulang->early : false,
            'absen_pulang_remark' => $absenPulang ? $absenPulang->remark : null,
            'absen_pulang_reason' => $absenPulang ? $absenPulang->reason : null,
        ]);
    }

    public function riwayat(Request $request)
    {
        $user = $request->user();
        $perPage = (int) ($request->limit ?? 10);
        $page = (int) ($request->page ?? 1);

        // 1. Tentukan Range Tanggal
        if ($request->has('start_date') && $request->has('end_date')) {
            $start = $request->start_date;
            $end = $request->end_date;
        } else {
            // Default: Hari ini ($end) mundur ke belakang
            $end = now()->toDateString();

            $mahasiswa = \App\Models\TblMahasiswa::where('user_id', $request->user()->user_id)->first();

            // Logic start date (mulai magang atau 30 hari terakhir)
            if ($mahasiswa && $mahasiswa->mulai_magang) {
                $start = \Carbon\Carbon::parse($mahasiswa->mulai_magang)->toDateString();
            } else {
                $start = now()->subDays(30)->toDateString();
            }

            // Cap end date: Jangan melebihi akhir magang jika sudah lewat
            if ($mahasiswa && $mahasiswa->akhir_magang) {
                $am = \Carbon\Carbon::parse($mahasiswa->akhir_magang)->toDateString();
                if ($am < $end) $end = $am;
            }
        }

        // 2. Setup Driver Database (SQLite vs MySQL/PgSQL)
        try {
            $driver = \DB::getPdo()->getAttribute(\PDO::ATTR_DRIVER_NAME);
        } catch (\Throwable $e) {
            $driver = config('database.default');
        }

        $today = now()->toDateString(); // Use PHP timezone (Asia/Jakarta), not MySQL timezone
        $curDate = "'{$today}'";
        if ($driver === 'sqlite') {
            $dateAdd = "DATE(dt, '+1 day')";
            $notWeekend = "AND strftime('%w', d.dt) NOT IN ('0','6')";
        } else {
            $dateAdd = "DATE_ADD(dt, INTERVAL 1 DAY)";
            $notWeekend = "AND DAYOFWEEK(d.dt) NOT IN (1,7)";
        }

        $hasLibur = \Illuminate\Support\Facades\Schema::hasTable('holidays');
        $holidayCondition = $hasLibur ? "AND NOT EXISTS (SELECT 1 FROM holidays l WHERE l.tanggal = d.dt)" : "";

        // 3. Query Utama
        // PERBAIKAN: Menghapus filter EXISTS di relevant_dates agar hari kerja kosong (Absent) tetap terambil

        $sqlDates = "WITH RECURSIVE dates AS (
            SELECT DATE('{$start}') AS dt
            UNION ALL
            SELECT {$dateAdd} FROM dates WHERE dt < DATE('{$end}')
        )";

        // Kita ambil semua hari kerja (Senin-Jumat & Bukan Libur) dalam range
        // Tanpa peduli apakah user sudah absen atau belum
        $sqlRelevantDates = "relevant_dates AS (
            SELECT d.dt as tanggal
            FROM dates d
            WHERE d.dt BETWEEN ? AND ? 
            {$notWeekend} 
            {$holidayCondition}
        )";

        // Hitung Total Data (Untuk Pagination)
        $countSql = "{$sqlDates}, {$sqlRelevantDates}
            SELECT COUNT(*) as total FROM relevant_dates";

        // Query Data Detail
        $dataSql = "{$sqlDates}, {$sqlRelevantDates}
            SELECT rd.tanggal as tanggal,
                MAX(CASE WHEN a.status = 'masuk' THEN a.waktu END) as jam_masuk,
                MAX(CASE WHEN a.status = 'pulang' THEN a.waktu END) as jam_pulang,
                MAX(CASE WHEN a.status = 'masuk' THEN a.foto_absen END) as foto_masuk,
                MAX(CASE WHEN a.status = 'pulang' THEN a.foto_absen END) as foto_pulang,
                MAX(CASE WHEN a.status = 'masuk' THEN a.lama_telat END) as minutes_late,
                MAX(CASE WHEN a.status = 'masuk' THEN a.latitude_absen END) as latitude_absen_masuk,
                MAX(CASE WHEN a.status = 'masuk' THEN a.longitude_absen END) as longitude_absen_masuk,
                MAX(CASE WHEN a.status = 'pulang' THEN a.latitude_absen END) as latitude_absen_pulang,
                MAX(CASE WHEN a.status = 'pulang' THEN a.longitude_absen END) as longitude_absen_pulang,
                MAX(CASE WHEN (iz.status = 'approved' OR iz.status_admin = 'approved') THEN iz.id_izin END) as leave_requests_id,
                MAX(CASE WHEN (iz.status = 'approved' OR iz.status_admin = 'approved') THEN iz.jenis_izin END) as leave_requests_jenis,
                MAX(CASE WHEN (iz.status = 'approved' OR iz.status_admin = 'approved') THEN iz.keterangan END) as leave_requests_keterangan,
                MAX(CASE WHEN ka.status = 'approved' THEN ka.id_koreksi END) as koreksi_id,
                MAX(CASE WHEN ka.status = 'approved' THEN ka.alasan END) as koreksi_alasan,
                MAX(CASE WHEN a.status = 'pulang' THEN a.early END) as pulang_early,
                MAX(CASE WHEN a.status = 'pulang' THEN a.remark END) as pulang_remark
            FROM relevant_dates rd
            LEFT JOIN attendances a ON a.user_id = ? AND a.tanggal = rd.tanggal
            LEFT JOIN izin iz ON iz.user_id = ? AND (iz.status = 'approved' OR iz.status_admin = 'approved') AND rd.tanggal BETWEEN iz.tanggal_mulai AND IFNULL(iz.tanggal_selesai, iz.tanggal_mulai)
            LEFT JOIN attendance_corrections ka ON ka.user_id = ? AND ka.status = 'approved' AND ka.tanggal = rd.tanggal
            WHERE rd.tanggal <= {$curDate}  -- Memastikan masa depan tidak muncul, tapi HARI INI muncul
            GROUP BY rd.tanggal
            ORDER BY rd.tanggal DESC
            LIMIT ? OFFSET ?";

        // Eksekusi Query
        // Parameter untuk count: start, end
        $count = \DB::select($countSql, [$start, $end]);
        $total = $count[0]->total ?? 0;

        $offset = ($page - 1) * $perPage;

        // Parameter untuk data: start, end, user_id (3x join), limit, offset
        $rows = \DB::select($dataSql, [
            $start,
            $end,
            $user->user_id,
            $user->user_id,
            $user->user_id,
            $perPage,
            $offset
        ]);

        // 4. Mapping Status
        $data = collect($rows)->map(function ($item) {
            $status = null;
            $reason = null;
            $today = now()->toDateString();

            if ($item->leave_requests_id) {
                $status = strtolower($item->leave_requests_jenis) === 'sakit' ? 'sick' : 'on_leave';
                $reason = $item->leave_requests_keterangan ?: null;
            } elseif ($item->koreksi_id) {
                $status = 'koreksi';
                $reason = $item->koreksi_alasan ?: null;
            } elseif (!empty($item->pulang_early)) {
                $status = 'early';
                $reason = $item->pulang_remark ?: null;
            } elseif ($item->jam_masuk) {
                // PERBAIKAN: Handle jika sudah absen masuk tapi belum pulang
                if ($item->jam_pulang) {
                    $status = $item->minutes_late > 0 ? 'late' : 'ontime';
                } else {
                    // Jika hari ini dan baru absen masuk -> 'working' (atau biarkan null/ontime sesuai selera)
                    // Jika hari lampau tapi lupa absen pulang -> 'no_checkout' (atau dianggap absent/working)
                    $status = ($item->tanggal === $today) ? 'working' : 'no_checkout';
                }
            } else {
                // Jika tidak ada data sama sekali -> ABSENT
                $status = 'absent';
            }

            return [
                'status' => $status,
                'tanggal' => $item->tanggal,
                'jam_masuk' => $item->jam_masuk,
                'jam_pulang' => $item->jam_pulang,
                'minutes_late' => $item->minutes_late,
                'reason' => $reason,
                'early' => !empty($item->pulang_early),
                'photo_masuk' => $item->foto_masuk ?: null,
                'photo_pulang' => $item->foto_pulang ?: null,
                'latitude_masuk' => $item->latitude_absen_masuk,
                'longitude_masuk' => $item->longitude_absen_masuk,
                'latitude_pulang' => $item->latitude_absen_pulang,
                'longitude_pulang' => $item->longitude_absen_pulang,
                'leave_requests' => $item->leave_requests_id ? [
                    'id_izin' => $item->leave_requests_id,
                    'jenis_izin' => $item->leave_requests_jenis,
                    'keterangan' => $item->leave_requests_keterangan,
                ] : null,
                'koreksi' => $item->koreksi_id ? [
                    'id_koreksi' => $item->koreksi_id,
                    'alasan' => $item->koreksi_alasan,
                ] : null,
                'is_absent' => ($status === 'absent'),
            ];
        })->all();

        $lastPage = $total > 0 ? (int) ceil($total / $perPage) : 1;
        $from = $total > 0 ? $offset + 1 : null;
        $to = $total > 0 ? min($offset + $perPage, $total) : null;

        return response()->json([
            'success' => true,
            'data' => $data,
            'meta' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'last_page' => $lastPage,
                'from' => $from,
                'to' => $to,
            ]
        ]);
    }

    /**
     * Rekap absensi (untuk Admin/Mentor)
     * Mentor hanya bisa melihat intern bimbingannya
     *
     * Ringkasan parameter (light untuk FE):
     * - start_date, end_date : date range (YYYY-MM-DD)
     * - month & year         : integer month/year (alternatif ke range)
     * - page, per_page       : pagination
     * - user_id              : filter spesifik user
     * - q                    : search `nama` atau `identifier` (LIKE)
     * - universitas          : filter universitas (LIKE)
     * - division / divisi    : filter division (LIKE)
     * - id_site / site       : filter site id atau nama site
     * - status               : string atau CSV/array dari [leave_requests,koreksi,late,ontime,absent]
     *
     * Catatan: filter `status` menggunakan HAVING pada hasil agregat sehingga
     * backend akan menghitung seluruh hasil yang cocok untuk memastikan akurasi
     * sebelum menerapkan pagination ketika `status` diberikan.
     */
    public function rekap(Request $request)
    {
        $user = $request->user();
        $perPage = (int) ($request->per_page ?? 20);
        $page = (int) ($request->page ?? 1);

        // Determine date range
        if ($request->has('start_date') && $request->has('end_date')) {
            $start = $request->start_date;
            $end = $request->end_date;
        } elseif ($request->filled('month') || $request->filled('year')) {
            // When filtering by month, require BOTH `bulan` and `tahun` to avoid ambiguity
            if (!$request->filled('month') || !$request->filled('year')) {
                return response()->json(['success' => false, 'message' => 'Parameter bulan dan tahun harus disertakan bersama'], 400);
            }
            $bulan = intval($request->input('month'));
            $tahun = intval($request->input('year'));
            // sanitize month
            if ($bulan < 1 || $bulan > 12) {
                return response()->json(['success' => false, 'message' => 'Parameter bulan tidak valid'], 400);
            }
            $start = Carbon::create($tahun, $bulan, 1)->toDateString();
            $end = Carbon::create($tahun, $bulan, 1)->endOfMonth()->toDateString();
        } else {
            // default last 30 days
            $end = now()->toDateString();
            $start = now()->subDays(30)->toDateString();
        }

        // Prevent future dates
        $end = min($end, now()->toDateString());

        // Build mentor filter
        // The mentor route (`/api/mentor/...`) should restrict to the mentor's own interns
        // even if the current user also has the admin role.  Admins calling the
        // admin-prefixed endpoint should not be filtered.
        $mentorFilter = '';
        if ($request->segment(2) === 'mentor' && $user->isMentor()) {
            // collect user IDs for interns the mentor is responsible for
            // primary source: belongsToMany via `intern_user_id` pivot column
            $direct = $user->interns()->pluck('users.user_id')->toArray();

            // legacy rows may only populate intern_mentors.intern_id (mahasiswa PK)
            // join against students to resolve to user_id if available
            $viaStudents = \DB::table('intern_mentors as im')
                ->join('students as s', 's.id_mahasiswa', '=', 'im.intern_id')
                ->where('im.is_active', 1)
                ->where(function($q) use ($user) {
                    $q->where('im.mentor_user_id', $user->user_id);
                    if ($user->karyawan?->id_karyawan) {
                        $q->orWhere('im.mentor_id', $user->karyawan->id_karyawan);
                    }
                })
                ->pluck('s.user_id')
                ->filter()
                ->toArray();

            $internIds = array_unique(array_filter(array_merge($direct, $viaStudents)));
            if (empty($internIds)) {
                return response()->json(['success' => true, 'data' => [], 'meta' => []]);
            }
            $ids = implode(',', array_map('intval', $internIds));
            $mentorFilter = "AND u.user_id IN ($ids)";
        }
        // Filter by a specific user if provided
        $userFilter = '';
        if ($request->has('user_id')) {
            $userFilter = "AND u.user_id = " . intval($request->user_id);
        }

        // Additional user filters from request (q, universitas, division, site/id_site)
        $userFiltersSql = '';
        if ($request->filled('q')) {
            $q = addslashes($request->q);
            // Search across users.name and mahasiswa nim/nama (identifier moved to students)
            $userFiltersSql .= " AND (u.nama LIKE '%{$q}%' OR EXISTS (SELECT 1 FROM students m WHERE m.user_id = u.user_id AND (m.nim LIKE '%{$q}%' OR m.nama LIKE '%{$q}%')))";
        }
        if ($request->filled('universitas')) {
            $univ = addslashes($request->universitas);
            $userFiltersSql .= " AND EXISTS (SELECT 1 FROM students m WHERE m.user_id = u.user_id AND m.universitas LIKE '%{$univ}%')";
        }
        if ($request->filled('division') || $request->filled('divisi')) {
            $div = addslashes($request->filled('division') ? $request->division : $request->divisi);
            $userFiltersSql .= " AND EXISTS (SELECT 1 FROM students m WHERE m.user_id = u.user_id AND m.job_position LIKE '%{$div}%')";
        }
        if ($request->filled('id_site') || $request->filled('site')) {
            if ($request->filled('id_site')) {
                $siteId = intval($request->id_site);
                // Check students and karyawan profiles for matching site (users table no longer authoritative)
                $userFiltersSql .= " AND (EXISTS (SELECT 1 FROM students m WHERE m.user_id = u.user_id AND m.id_site = {$siteId}) OR EXISTS (SELECT 1 FROM karyawans k WHERE k.user_id = u.user_id AND k.id_site = {$siteId}))";
            } else {
                $site = addslashes($request->site);
                $userFiltersSql .= " AND (EXISTS (SELECT 1 FROM students m JOIN sites s ON s.id_site = m.id_site WHERE m.user_id = u.user_id AND s.nama_site LIKE '%{$site}%') OR EXISTS (SELECT 1 FROM karyawans k JOIN sites s ON s.id_site = k.id_site WHERE k.user_id = u.user_id AND s.nama_site LIKE '%{$site}%'))";
            }
        }

        // Prepare status-based HAVING clause (supports: sick, on_leave (leave_requests), koreksi, late, ontime, absent)
        $having = '';
        if ($request->filled('status')) {
            $statuses = is_array($request->status) ? $request->status : explode(',', $request->status);
            $statusConditions = [];

            // Define common SQL fragments to ensure consistency and avoid repetition
            $sqlHasIzin = "MAX(CASE WHEN (iz.status = 'approved' OR iz.status_admin = 'approved' OR (iz.status_mentor = 'approved' AND iz.status_admin = 'pending') OR (iz.jenis_izin = 'sakit' AND iz.status_mentor = 'approved')) THEN iz.id_izin END)";
            $sqlHasKoreksi = "MAX(CASE WHEN (ka.status = 'approved' OR ka.status_admin = 'approved' OR (ka.status_mentor = 'approved' AND ka.status_admin = 'pending')) THEN ka.id_koreksi END)";
            $sqlIsEarly = "MAX(CASE WHEN a.status = 'pulang' AND a.early = 1 THEN 1 WHEN (ka.status = 'approved' OR ka.status_admin = 'approved' OR (ka.status_mentor = 'approved' AND ka.status_admin = 'pending')) AND ka.jenis_koreksi = 'pulang_cepat' THEN 1 ELSE 0 END)";
            $sqlHasMasuk = "MAX(CASE WHEN a.status = 'masuk' THEN a.waktu END)";
            $sqlHasPulang = "MAX(CASE WHEN a.status = 'pulang' OR ((ka.status = 'approved' OR ka.status_admin = 'approved' OR (ka.status_mentor = 'approved' AND ka.status_admin = 'pending')) AND ka.jenis_koreksi IN ('lupa_absen_pulang', 'pulang_cepat')) THEN a.waktu END)";
            $sqlLamaTelat = "MAX(CASE WHEN a.status = 'masuk' THEN a.lama_telat END)";

            foreach ($statuses as $st) {
                $st = trim(strtolower($st));
                // normalize common aliases
                if (in_array($st, ['on leave', 'on_leave', 'onleave', 'izin', 'leave'])) {
                    $st = 'on_leave';
                } elseif (in_array($st, ['sakit', 'sick'])) {
                    $st = 'sick';
                } elseif (in_array($st, ['early', 'early out', 'early_out', 'pulang cepat', 'pulang_cepat'])) {
                    $st = 'early';
                }

                if ($st === 'on_leave') {
                    $statusConditions[] = "({$sqlHasIzin} IS NOT NULL AND MAX(CASE WHEN (iz.status = 'approved' OR iz.status_admin = 'approved' OR (iz.status_mentor = 'approved' AND iz.status_admin = 'pending') OR (iz.jenis_izin = 'sakit' AND iz.status_mentor = 'approved')) THEN iz.jenis_izin END) = 'izin')";
                } elseif ($st === 'sick') {
                    $statusConditions[] = "({$sqlHasIzin} IS NOT NULL AND MAX(CASE WHEN (iz.status = 'approved' OR iz.status_admin = 'approved' OR (iz.status_mentor = 'approved' AND iz.status_admin = 'pending') OR (iz.jenis_izin = 'sakit' AND iz.status_mentor = 'approved')) THEN iz.jenis_izin END) = 'sakit')";
                } elseif ($st === 'early') {
                    $statusConditions[] = "({$sqlHasIzin} IS NULL AND {$sqlIsEarly} = 1)";
                } elseif ($st === 'late') {
                    $statusConditions[] = "({$sqlHasIzin} IS NULL AND ({$sqlIsEarly} IS NULL OR {$sqlIsEarly} = 0) AND {$sqlHasMasuk} IS NOT NULL AND {$sqlHasPulang} IS NOT NULL AND {$sqlLamaTelat} > 0)";
                } elseif ($st === 'ontime') {
                    $statusConditions[] = "({$sqlHasIzin} IS NULL AND ({$sqlIsEarly} IS NULL OR {$sqlIsEarly} = 0) AND {$sqlHasMasuk} IS NOT NULL AND {$sqlHasPulang} IS NOT NULL AND {$sqlLamaTelat} = 0)";
                } elseif ($st === 'koreksi') {
                    $statusConditions[] = "({$sqlHasIzin} IS NULL AND {$sqlHasKoreksi} IS NOT NULL)";
                } elseif ($st === 'absent') {
                    $statusConditions[] = "({$sqlHasIzin} IS NULL AND {$sqlHasKoreksi} IS NULL AND ({$sqlHasMasuk} IS NULL OR {$sqlHasPulang} IS NULL))";
                }
            }
            if (!empty($statusConditions)) {
                $having = '(' . implode(' OR ', $statusConditions) . ')';
            }
        }

        // DB driver-aware date functions and weekend exclusion
        try {
            $driver = \DB::getPdo()->getAttribute(\PDO::ATTR_DRIVER_NAME);
        } catch (\Throwable $e) {
            $driver = config('database.default');
        }
        $today = now()->toDateString(); // Use PHP timezone (Asia/Jakarta), not MySQL timezone
        $curDate = "'{$today}'";
        if ($driver === 'sqlite') {
            $dateAdd = "DATE(dt, '+1 day')";
            $notWeekend = "AND strftime('%w', d.dt) NOT IN ('0','6')"; // exclude Sun(0) and Sat(6)
        } else {
            $dateAdd = "DATE_ADD(dt, INTERVAL 1 DAY)";
            $notWeekend = "AND DAYOFWEEK(d.dt) NOT IN (1,7)"; // exclude Sun(1) and Sat(7)
        }

        // Check if libur table exists (avoid errors on DBs without it). Table name is `holidays`.
        $hasLibur = \Illuminate\Support\Facades\Schema::hasTable('holidays');
        $holidayCondition = $hasLibur ? "AND NOT EXISTS (SELECT 1 FROM holidays l WHERE l.tanggal = d.dt)" : "";

        // CTE to generate dates
        $sqlDates = "WITH RECURSIVE dates AS (
            SELECT DATE('$start') AS dt
            UNION ALL
            SELECT {$dateAdd} FROM dates WHERE dt < DATE('$end')
        )";

        // Build relevant_users CTE (scope based on provided filters) and relevant_dates as cross-join of dates × users
        $sqlRelevantUsers = "relevant_users AS (
            SELECT u.user_id
            FROM users u
            WHERE 1 = 1 {$userFilter} {$mentorFilter} {$userFiltersSql}
            -- Only include users that have role 'intern'
            AND EXISTS (
                SELECT 1 FROM role_user ru JOIN roles r ON ru.role_id = r.role_id WHERE ru.user_id = u.user_id AND r.name = 'intern'
            )
        )";

        $sqlRelevantDates = "relevant_dates AS (
            SELECT ru.user_id, d.dt as tanggal
            FROM dates d
            JOIN relevant_users ru ON 1=1
            WHERE d.dt BETWEEN ? AND ? {$notWeekend} {$holidayCondition}
            -- Keep today's row if there is either a 'masuk', an approved koreksi, or an approved leave_requests; otherwise exclude incomplete current day
            AND NOT (
                d.dt = {$curDate} AND NOT (
                    EXISTS (SELECT 1 FROM attendances a2 WHERE a2.user_id = ru.user_id AND a2.tanggal = d.dt AND a2.status = 'masuk')
                    OR EXISTS (SELECT 1 FROM attendance_corrections ka2 WHERE ka2.user_id = ru.user_id AND ka2.tanggal = d.dt AND (ka2.status = 'approved' OR ka2.status_admin = 'approved' OR (ka2.status_mentor = 'approved' AND ka2.status_admin = 'pending')))
                    OR EXISTS (SELECT 1 FROM izin iz2 WHERE iz2.user_id = ru.user_id AND (iz2.status = 'approved' OR iz2.status_admin = 'approved' OR (iz2.status_mentor = 'approved' AND iz2.status_admin = 'pending') OR (iz2.jenis_izin = 'sakit' AND iz2.status_mentor = 'approved')) AND d.dt BETWEEN iz2.tanggal_mulai AND IFNULL(iz2.tanggal_selesai, iz2.tanggal_mulai))
                )
            )
        )";

        // Main count query - count distinct user_id,tanggal from relevant_dates (dates × users grid ensures pure absents are included)
        $countSql = "$sqlDates, $sqlRelevantUsers, $sqlRelevantDates
            SELECT COUNT(*) as total FROM (
                SELECT rd.user_id, rd.tanggal
                FROM relevant_dates rd
                JOIN users u ON u.user_id = rd.user_id
                WHERE rd.tanggal <= {$curDate}
                GROUP BY rd.user_id, rd.tanggal
            ) t";

        // Pagination calculation
        $offset = ($page - 1) * $perPage;

        // Main data query - aggregate per user per date (includes pure absents via relevant_users × dates)
        $dataSql = "$sqlDates, $sqlRelevantUsers, $sqlRelevantDates
            SELECT
                u.user_id,
                u.nama,
                m.id_mahasiswa as id_mahasiswa,
                COALESCE(m.nim, '') as identifier,
                COALESCE(m.job_position, '') as job_position,
                COALESCE(m.division, '') as division,
                COALESCE(m.universitas, '') as universitas,
                COALESCE(m.jurusan, '') as jurusan,
                rd.tanggal as tanggal,
                MAX(CASE WHEN a.status = 'masuk' THEN a.waktu END) as jam_masuk,
                MAX(CASE WHEN a.status = 'pulang' THEN a.waktu END) as jam_pulang,
                MAX(CASE WHEN a.status = 'masuk' THEN a.foto_absen END) as foto_masuk,
                MAX(CASE WHEN a.status = 'pulang' THEN a.foto_absen END) as foto_pulang,
                MAX(CASE WHEN a.status = 'pulang' THEN a.early END) as early_pulang,
                MAX(CASE WHEN (ka.status = 'approved' OR ka.status_admin = 'approved' OR (ka.status_mentor = 'approved' AND ka.status_admin = 'pending')) AND ka.jenis_koreksi = 'pulang_cepat' THEN 1 ELSE 0 END) as koreksi_is_early,
                MAX(CASE WHEN a.status = 'pulang' THEN a.remark END) as pulang_remark,
                MAX(CASE WHEN a.status = 'masuk' THEN a.latitude_absen END) as latitude_masuk,
                MAX(CASE WHEN a.status = 'masuk' THEN a.longitude_absen END) as longitude_masuk,
                MAX(CASE WHEN a.status = 'pulang' THEN a.latitude_absen END) as latitude_pulang,
                MAX(CASE WHEN a.status = 'pulang' THEN a.longitude_absen END) as longitude_pulang,
                MAX(CASE WHEN a.status = 'masuk' THEN a.lama_telat END) as lama_telat,
                MAX(CASE WHEN (iz.status = 'approved' OR iz.status_admin = 'approved' OR (iz.status_mentor = 'approved' AND iz.status_admin = 'pending') OR (iz.jenis_izin = 'sakit' AND iz.status_mentor = 'approved')) THEN iz.id_izin END) as leave_requests_id,
                MAX(CASE WHEN (iz.status = 'approved' OR iz.status_admin = 'approved' OR (iz.status_mentor = 'approved' AND iz.status_admin = 'pending') OR (iz.jenis_izin = 'sakit' AND iz.status_mentor = 'approved')) THEN iz.jenis_izin END) as leave_requests_jenis,
                MAX(CASE WHEN (iz.status = 'approved' OR iz.status_admin = 'approved' OR (iz.status_mentor = 'approved' AND iz.status_admin = 'pending') OR (iz.jenis_izin = 'sakit' AND iz.status_mentor = 'approved')) THEN iz.keterangan END) as leave_requests_keterangan,
                MAX(CASE WHEN (ka.status = 'approved' OR ka.status_admin = 'approved' OR (ka.status_mentor = 'approved' AND ka.status_admin = 'pending')) THEN ka.id_koreksi END) as koreksi_id,
                MAX(CASE WHEN (ka.status = 'approved' OR ka.status_admin = 'approved' OR (ka.status_mentor = 'approved' AND ka.status_admin = 'pending')) THEN ka.alasan END) as koreksi_alasan
            FROM relevant_dates rd
            JOIN users u ON u.user_id = rd.user_id
            LEFT JOIN students m ON m.user_id = rd.user_id
            LEFT JOIN attendances a ON a.user_id = rd.user_id AND a.tanggal = rd.tanggal
            LEFT JOIN izin iz ON iz.user_id = rd.user_id AND (iz.status = 'approved' OR iz.status_admin = 'approved' OR (iz.status_mentor = 'approved' AND iz.status_admin = 'pending') OR (iz.jenis_izin = 'sakit' AND iz.status_mentor = 'approved')) AND rd.tanggal BETWEEN iz.tanggal_mulai AND IFNULL(iz.tanggal_selesai, iz.tanggal_mulai)
            LEFT JOIN attendance_corrections ka ON ka.user_id = rd.user_id AND (ka.status = 'approved' OR ka.status_admin = 'approved' OR (ka.status_mentor = 'approved' AND ka.status_admin = 'pending')) AND ka.tanggal = rd.tanggal
            WHERE rd.tanggal <= {$curDate}
            GROUP BY u.user_id, u.nama, m.id_mahasiswa, m.nim, m.job_position, m.division, m.universitas, m.jurusan, rd.tanggal
            ORDER BY rd.tanggal DESC
            LIMIT ? OFFSET ?";

        // If a status-based HAVING is present, run full query (no LIMIT) to compute total and then slice for pagination
        if (!empty($having)) {
            $dataSqlWithHaving = str_replace('ORDER BY rd.tanggal DESC', "HAVING {$having} ORDER BY rd.tanggal DESC", $dataSql);
            $dataSqlWithHavingNoLimit = preg_replace('/\s+LIMIT\s+\?\s+OFFSET\s+\?\s*$/i', '', $dataSqlWithHaving);
            $allRows = \DB::select($dataSqlWithHavingNoLimit, [$start, $end]);
            $total = count($allRows);
            $rows = array_slice($allRows, $offset, $perPage);
        } else {
            $count = \DB::select($countSql, [$start, $end]);
            $total = $count[0]->total ?? 0;
            $rows = \DB::select($dataSql, [$start, $end, $perPage, $offset]);
        }

        // Attach mentors data for listed interns (only interns are included due to CTE change)
        $mentorsByIntern = [];
        $userIdsInRows = collect($rows)->pluck('user_id')->unique()->filter()->all();
        if (!empty($userIdsInRows)) {
            $idsList = implode(',', array_map('intval', $userIdsInRows));
            // Select the primary mentor per intern: the active mapping with the latest assigned_date
            // Profile-aware join: intern_mentors.intern_id -> students.id_mahasiswa,
            // intern_mentors.mentor_id -> employees.id_karyawan
            $mentorRows = \DB::select("SELECT s.user_id as intern_user_id, im.mentor_id, COALESCE(u.nama, e.nama) as mentor_name, e.user_id as mentor_user_id
                FROM intern_mentors im
                JOIN students s ON s.id_mahasiswa = im.intern_id
                JOIN employees e ON e.id_karyawan = im.mentor_id
                LEFT JOIN users u ON u.user_id = e.user_id
                WHERE s.user_id IN ({$idsList}) AND im.is_active = 1
                AND im.assigned_date = (
                    SELECT MAX(assigned_date) FROM intern_mentors im2 WHERE im2.intern_id = im.intern_id AND im2.is_active = 1
                )");
            foreach ($mentorRows as $mr) {
                // store single primary mentor per intern (use mentor_user_id)
                $mentorsByIntern[$mr->intern_user_id] = ['user_id' => $mr->mentor_user_id, 'id_karyawan' => $mr->mentor_id, 'nama' => $mr->mentor_name];
            }

        }

        // Map result and format photo paths
        $data = collect($rows)->map(function ($item) use ($mentorsByIntern) {
            $foto_masuk = $item->foto_masuk ? str_replace('absensi/foto/', 'absensi/foto-masuk/', $item->foto_masuk) : null;
            $foto_pulang = $item->foto_pulang ? str_replace('absensi/foto/', 'absensi/foto-pulang/', $item->foto_pulang) : null;
            $status = null;
            $reason = null;
            if ($item->leave_requests_id) {
                $status = strtolower($item->leave_requests_jenis) === 'sakit' ? 'sick' : 'on_leave';
                $reason = $item->leave_requests_keterangan ?: null;
            } elseif ($item->jam_masuk && $item->jam_pulang) {
                if ($item->early_pulang || $item->koreksi_is_early) {
                    $status = 'early';
                    $reason = $item->pulang_remark ?: ($item->koreksi_alasan ?: null);
                } else {
                    $status = $item->lama_telat > 0 ? 'late' : 'ontime';
                    $reason = $item->koreksi_alasan ?: null;
                }
            } elseif ($item->koreksi_id) {
                $status = 'koreksi';
                $reason = $item->koreksi_alasan ?: null;
            } else {
                $status = 'absent';
            }
            return [
                'user_id' => $item->user_id,
                'id_mahasiswa' => $item->id_mahasiswa ?? null,
                'nama' => $item->nama,
                'identifier' => $item->identifier,
                'job_position' => $item->job_position,
                'division' => $item->division,
                'universitas' => $item->universitas,
                'jurusan' => $item->jurusan,
                'tanggal' => $item->tanggal,
                'status' => $status,
                'reason' => $reason,
                'jam_masuk' => $item->jam_masuk,
                'jam_pulang' => $item->jam_pulang,
                'foto_masuk' => $foto_masuk,
                'foto_pulang' => $foto_pulang,
                'latitude_masuk' => $item->latitude_masuk,
                'longitude_masuk' => $item->longitude_masuk,
                'latitude_pulang' => $item->latitude_pulang,
                'longitude_pulang' => $item->longitude_pulang,
                'lama_telat' => $item->lama_telat,
                // Primary mentor (single object) — null jika tidak ada
                'mentor' => $mentorsByIntern[$item->user_id] ?? null,
            ];
        })->all();

        // Build meta
        $lastPage = $total > 0 ? (int) ceil($total / $perPage) : 1;
        $from = $total > 0 ? $offset + 1 : null;
        $to = $total > 0 ? min($offset + $perPage, $total) : null;

        return response()->json([
            'success' => true,
            'data' => $data,
            'meta' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'last_page' => $lastPage,
                'from' => $from,
                'to' => $to,
            ]
        ]);
    }

    /**
     * Get detail absensi (masuk & pulang) untuk user dan tanggal tertentu
     */
    // Accept either id_mahasiswa (preferred) or legacy user_id (fallback)
    public function detailByUserTanggal(Request $request, $user_id, $tanggal)
    {
        // Try to resolve mahasiswa by profile id first, else by legacy user_id
        $mahasiswa = TblMahasiswa::find($user_id) ?? TblMahasiswa::where('user_id', $user_id)->first();
        if (!$mahasiswa) {
            return response()->json([
                'success' => false,
                'message' => 'Mahasiswa tidak ditemukan.'
            ], 404);
        }

        $mahasiswaId = $mahasiswa->id_mahasiswa;
        $user = $mahasiswa->user; // may be null if user not provisioned

        $masuk = TblAbsensi::where('id_mahasiswa', $mahasiswaId)
            ->where('tanggal', $tanggal)
            ->where('status', 'masuk')
            ->first();
        $pulang = TblAbsensi::where('id_mahasiswa', $mahasiswaId)
            ->where('tanggal', $tanggal)
            ->where('status', 'pulang')
            ->first();

        if (!$masuk && !$pulang) {
            return response()->json([
                'success' => false,
                'message' => 'Data absensi tidak ditemukan.'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'user_id' => $user?->user_id ?? null,
                'id_mahasiswa' => $mahasiswaId,
                'nama' => $user?->nama ?? $mahasiswa->nama,
                'identifier' => $user?->identifier ?? $mahasiswa->nim,
                'division' => $mahasiswa->division,
                'universitas' => $mahasiswa->universitas,
                'tanggal' => $tanggal,
                'jam_masuk' => $masuk ? $masuk->waktu : null,
                'jam_pulang' => $pulang ? $pulang->waktu : null,
                'foto_masuk' => $masuk ? $masuk->foto_absen : null,
                'foto_pulang' => $pulang ? $pulang->foto_absen : null,
                'latitude_masuk' => $masuk ? $masuk->latitude_absen : null,
                'longitude_masuk' => $masuk ? $masuk->longitude_absen : null,
                'latitude_pulang' => $pulang ? $pulang->latitude_absen : null,
                'longitude_pulang' => $pulang ? $pulang->longitude_absen : null,
                'lama_telat' => $masuk ? $masuk->lama_telat : null,
                'early_pulang' => $pulang ? (bool) $pulang->early : false,
                'pulang_remark' => $pulang ? $pulang->remark : null,
            ]
        ]);
    }

    public function getUserSite(Request $request)
    {
        $user = $request->user();

        $site = $user->site ?? $user->mahasiswa?->site ?? $user->karyawan?->site ?? null;
        if (!$site) {
            return response()->json([
                'success' => false,
                'message' => 'Site user tidak ditemukan. Hubungi admin.'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $site
        ]);
    }

    public function checkStatus(Request $request)
    {
        $user = $request->user();
        $today = Carbon::now()->toDateString();

        $mahasiswaId = $user->mahasiswa?->id_mahasiswa ?? null;
        $absenQuery = TblAbsensi::query();
        if ($mahasiswaId) { $absenQuery->where('id_mahasiswa', $mahasiswaId); } else { $absenQuery->where('user_id', $user->user_id); }
        $absenMasuk = (clone $absenQuery)->where('tanggal', $today)->where('status', 'masuk')->first();
        $absenPulang = (clone $absenQuery)->where('tanggal', $today)->where('status', 'pulang')->first();

        return response()->json([
            'success' => true,
            'tanggal' => $today,
            'sudah_absen_masuk' => $absenMasuk !== null,
            'sudah_absen_pulang' => $absenPulang !== null,
            'absen_masuk' => $absenMasuk,
            'absen_pulang' => $absenPulang,
            'absen_pulang_early' => $absenPulang ? (bool) $absenPulang->early : false,
            'absen_pulang_remark' => $absenPulang ? $absenPulang->remark : null,
            'absen_pulang_reason' => $absenPulang ? $absenPulang->reason : null,
        ]);
    }

    public function getImage($param)
    {
        $fotoPath = null;

        if (is_numeric($param)) {
            // Logic EXISTING: Cari absensi terakhir by user_id
            $absensi = TblAbsensi::where('user_id', $param)
                ->orderBy('tanggal', 'desc')
                ->orderBy('waktu', 'desc')
                ->first();

            if (!$absensi || !$absensi->foto_absen) {
                return response()->json(['message' => 'Foto tidak ditemukan'], 404);
            }
            $fotoPath = $absensi->foto_absen;
        } else {
            // Logic BARU: By Filename
            // Sanitize filename
            $filename = basename($param);
            $fotoPath = 'absensi/foto/' . $filename;

            // Fallback check (root)
            if (!Storage::disk('public')->exists($fotoPath) && Storage::disk('public')->exists($filename)) {
                $fotoPath = $filename;
            }

            // Final fallback if the path was stored exactly as passed (e.g. 'storage/.../x.jpg' stored in public disk without 'storage/' prefix)
            $rawPath = str_replace('storage/', '', $param);
            if (!Storage::disk('public')->exists($fotoPath) && Storage::disk('public')->exists($rawPath)) {
                $fotoPath = $rawPath;
            }
        }

        if (!$fotoPath) {
            return response()->json(['message' => 'Foto tidak ditemukan'], 404);
        }

        if (str_starts_with($fotoPath, "encrypted/")) {
            if (!Storage::disk("local")->exists($fotoPath)) return response()->json(["message" => "Foto tidak ditemukan di storage"], 404);
            $encryptedContents = Storage::disk("local")->get($fotoPath);
            $decryptedContents = Crypt::decryptString($encryptedContents);
            $finfo = new \finfo(FILEINFO_MIME_TYPE);
            $mime = $finfo->buffer($decryptedContents) ?: "application/octet-stream";
            return response($decryptedContents, 200)->header("Content-Type", $mime);
        }

        if (!Storage::disk('public')->exists($fotoPath)) {
            return response()->json(['message' => 'Foto tidak ditemukan di storage'], 404);
        }

        return Storage::disk('public')->response($fotoPath);
    }

    public function getImagePulang($param)
    {
        $fotoPath = null;

        if (is_numeric($param)) {
            // Logic EXISTING: Cari absensi pulang terakhir by user_id
            $absensi = TblAbsensi::where('user_id', $param)
                ->where('status', 'pulang')
                ->orderBy('tanggal', 'desc')
                ->orderBy('waktu', 'desc')
                ->first();

            if (!$absensi || !$absensi->foto_absen) {
                return response()->json(['message' => 'Foto tidak ditemukan'], 404);
            }
            $fotoPath = $absensi->foto_absen;
        } else {
            // Logic BARU: By Filename
            // Sanitize filename
            $filename = basename($param);
            $fotoPath = 'absensi/foto/' . $filename;

            // Fallback check (root)
            if (!Storage::disk('public')->exists($fotoPath) && Storage::disk('public')->exists($filename)) {
                $fotoPath = $filename;
            }

            // Final fallback if the path was stored exactly as passed (e.g. 'storage/.../x.jpg' stored in public disk without 'storage/' prefix)
            $rawPath = str_replace('storage/', '', $param);
            if (!Storage::disk('public')->exists($fotoPath) && Storage::disk('public')->exists($rawPath)) {
                $fotoPath = $rawPath;
            }
        }

        if (!$fotoPath) {
            return response()->json(['message' => 'Foto tidak ditemukan'], 404);
        }

        if (str_starts_with($fotoPath, "encrypted/")) {
            if (!Storage::disk("local")->exists($fotoPath)) return response()->json(["message" => "Foto tidak ditemukan di storage"], 404);
            $encryptedContents = Storage::disk("local")->get($fotoPath);
            $decryptedContents = Crypt::decryptString($encryptedContents);
            $finfo = new \finfo(FILEINFO_MIME_TYPE);
            $mime = $finfo->buffer($decryptedContents) ?: "application/octet-stream";
            return response($decryptedContents, 200)->header("Content-Type", $mime);
        }

        if (!Storage::disk('public')->exists($fotoPath)) {
            return response()->json(['message' => 'Foto tidak ditemukan di storage'], 404);
        }

        return Storage::disk('public')->response($fotoPath);
    }

    /**
     * Get foto absensi as raw image (Legacy/Alias)
     */
    public function getFotoAbsensiRaw($filename)
    {
        return $this->getImage($filename);
    }
    private function getClockInTime($user, $serverNow)
    {
        // Determine Clock In Time based on Priority:
        // 1. User's Work Schedule (Specific Day -> Global)
        // 2. Site's Schedule
        // 3. Default (08:00:00)

        $minimumClockInTime = '08:00:00'; // Default fallback
        $workSchedule = $user->workSchedule;

        if ($workSchedule) {
            $dayKey = strtolower($serverNow->format('D')); // mon, tue, wed...
            $dayTimes = $workSchedule->day_times;

            if ($dayTimes && isset($dayTimes[$dayKey]) && !empty($dayTimes[$dayKey]['start'])) {
                $minimumClockInTime = $dayTimes[$dayKey]['start'];
            } elseif ($workSchedule->start_time) {
                // Fallback to global setting in schedule
                $minimumClockInTime = $workSchedule->start_time;
            }
        } elseif ($user->site && !empty($user->site->jam_masuk)) {
            $minimumClockInTime = $user->site->jam_masuk;
        }

        return Carbon::parse($serverNow->toDateString() . ' ' . $minimumClockInTime);
    }

    private function getClockOutTime($user, $serverNow)
    {
        // Determine Clock Out Time based on Priority:
        // 1. User's Work Schedule (Specific Day -> Global)
        // 2. Site's Schedule
        // 3. Default (17:00:00)

        $minimumClockOutTime = '17:00:00'; // Default fallback
        // Eager load if not already loaded (though usually it is if accessed via request->user() depending on implementation, but safer to just access relation)
        $workSchedule = $user->workSchedule;

        if ($workSchedule) {
            $dayKey = strtolower($serverNow->format('D')); // mon, tue, wed...
            $dayTimes = $workSchedule->day_times;

            if ($dayTimes && isset($dayTimes[$dayKey]) && !empty($dayTimes[$dayKey]['end'])) {
                $minimumClockOutTime = $dayTimes[$dayKey]['end'];
            } elseif ($workSchedule->end_time) {
                // Fallback to global setting in schedule
                $minimumClockOutTime = $workSchedule->end_time;
            }
        } elseif ($user->site && !empty($user->site->jam_pulang)) {
            $minimumClockOutTime = $user->site->jam_pulang;
        }

        return Carbon::parse($serverNow->toDateString() . ' ' . $minimumClockOutTime);
    }

  public function getAttendanceDates(Request $request)
{
    $user = $request->user();
    // Pastikan today formatnya string Y-m-d
    $today = Carbon::now()->format('Y-m-d'); 

    $mahasiswaId = $user->mahasiswa?->id_mahasiswa ?? null;

    // 1. Tentukan Start Date dengan Tepat
    $firstAttendanceQuery = TblAbsensi::query();
    if ($mahasiswaId) { $firstAttendanceQuery->where('id_mahasiswa', $mahasiswaId); } else { $firstAttendanceQuery->where('user_id', $user->user_id); }
    $firstAttendance = $firstAttendanceQuery->orderBy('tanggal', 'asc')->first();

    // Consider internship start date (mahasiswa.mulai_magang) so calendar covers the whole internship period
    $candidates = [];
    if ($firstAttendance) {
        $candidates[] = Carbon::parse($firstAttendance->tanggal);
    }
    if ($user->mahasiswa && $user->mahasiswa->mulai_magang) {
        $candidates[] = Carbon::parse($user->mahasiswa->mulai_magang)->startOfDay();
    }

    if (!empty($candidates)) {
        // pick the earliest candidate but do not pick a future date
        $min = collect($candidates)->min();
        $startDate = $min->gt(Carbon::now()) ? $user->created_at->format('Y-m-d') : $min->format('Y-m-d');
    } else {
        // Fallback: Jika belum pernah absen dan tidak ada mulai_magang, pakai tanggal user dibuat (register)
        $startDate = $user->created_at->format('Y-m-d');
    }

    // 2. Ambil Data DB & Paksa Key menjadi format 'Y-m-d'
    // Menggunakan closure function di groupBy untuk memastikan key-nya bersih
    $attQuery = TblAbsensi::query();
    if ($mahasiswaId) { $attQuery->where('id_mahasiswa', $mahasiswaId); } else { $attQuery->where('user_id', $user->user_id); }
    $attendances = $attQuery
        ->whereBetween('tanggal', [$startDate, $today])
        ->orderBy('tanggal')
        ->get()
        ->groupBy(function($item) {
            // Paksa jadi string Y-m-d agar cocok dengan loop nanti
            return Carbon::parse($item->tanggal)->format('Y-m-d');
        });

    // 2a. Preload approved izin (sakit/izin) yang bersinggungan dengan rentang
    $izinQuery = Izin::query();
    if ($mahasiswaId) { $izinQuery->where('id_mahasiswa', $mahasiswaId); } else { $izinQuery->where('user_id', $user->user_id); }
    $izins = $izinQuery->where(function($q) use ($startDate, $today) {
            $q->where('tanggal_mulai', '<=', $today)
                ->where(function($q2) use ($startDate) {
                    $q2->whereNull('tanggal_selesai')->orWhere('tanggal_selesai', '>=', $startDate);
                });
        })
        ->where(function($q) {
            $q->where('status', 'approved')
              ->orWhere('status_admin', 'approved')
              ->orWhere(function($q2) {
                  $q2->where('status_mentor', 'approved')->where('status_admin','pending');
              });
        })
        ->get();

    // Buat map tanggal => izin (ambil yang pertama jika tumpang tindih)
    $izinMap = [];
    foreach ($izins as $iz) {
        $start = Carbon::parse($iz->tanggal_mulai);
        $end = $iz->tanggal_selesai ? Carbon::parse($iz->tanggal_selesai) : $start;
        $periodIzin = CarbonPeriod::create($start, $end);
        foreach ($periodIzin as $d) {
            $dStr = $d->format('Y-m-d');
            if (!isset($izinMap[$dStr])) $izinMap[$dStr] = $iz;
        }
    }

    // 2b. Preload approved koreksi untuk rentang
    $koreks = KoreksiAbsensi::forUser($user)
        ->where(function($q){
            $q->where('status', 'approved')
              ->orWhere('status_admin', 'approved')
              ->orWhere(function($q2){ $q2->where('status_mentor','approved')->where('status_admin','pending'); });
        })
        ->whereBetween('tanggal', [$startDate, $today])
        ->get()
        ->keyBy(function($item){ return Carbon::parse($item->tanggal)->format('Y-m-d'); });

    // 3. Generate Loop Tanggal
    $period = CarbonPeriod::create($startDate, $today);
    $attendanceDates = [];

    foreach ($period as $date) {
        // Format object Carbon menjadi String '2023-10-25'
        $dateStr = $date->format('Y-m-d');

        // Logic cek hari libur (Sabtu/Minggu) - Opsional
        // Jika hari libur DAN tidak ada data absen/izin/koreksi, jangan dianggap Absent (biar ga merah di kalender)
        $isWeekend = $date->isWeekend();

        // Cek apakah tanggal ini ada di hasil query database?
        if (isset($attendances[$dateStr])) {
            // --- KASUS: ADA DATA (Hadir / Telat / Early / Lupa Checkout) ---
            $records = $attendances[$dateStr];
            $masuk = $records->where('status', 'masuk')->first();
            $pulang = $records->where('status', 'pulang')->first();

            // Tentukan status spesifik
            $status = 'present';
            if (!$masuk || !$pulang) {
                $status = 'incomplete'; // Kuning (Lupa salah satu)
            }

            $attendanceDates[] = [ // Pakai [] agar jadi array of objects
                'date' => $dateStr,
                'has_attendance' => true,
                'status' => $status, 
                'masuk' => $masuk ? $masuk->waktu : null,
                'pulang' => $pulang ? $pulang->waktu : null,
                'early' => $pulang ? ($pulang->early ?? false) : false,
                'can_correct' => true, 
                'title' => ($status === 'incomplete') ? 'Hadir (Tidak Lengkap)' : 'Hadir',
                'color' => ($status === 'incomplete') ? '#f59e0b' : '#10b981', // Kuning / Hijau
            ];

            continue;
        }

        // Jika ada izin/sakit pada tanggal ini
        if (isset($izinMap[$dateStr])) {
            $iz = $izinMap[$dateStr];
            $jenis = strtolower($iz->jenis_izin ?? 'izin');
            $status = ($jenis === 'sakit') ? 'sick' : 'on_leave';

            $attendanceDates[] = [
                'date' => $dateStr,
                'has_attendance' => false,
                'status' => $status,
                'masuk' => null,
                'pulang' => null,
                'early' => false,
                'can_correct' => false, // Sudah ada izin, tidak perlu koreksi
                'title' => ($status === 'sick') ? 'Sakit' : 'Izin',
                'color' => ($status === 'sick') ? '#3b82f6' : '#6366f1',
                'reason' => $iz->keterangan ?? null,
            ];

            continue;
        }

        // Jika ada koreksi approved pada tanggal ini
        if (isset($koreks[$dateStr])) {
            $ka = $koreks[$dateStr];
            $attendanceDates[] = [
                'date' => $dateStr,
                'has_attendance' => false,
                'status' => 'koreksi',
                'masuk' => null,
                'pulang' => null,
                'early' => false,
                'can_correct' => false,
                'title' => 'Koreksi',
                'color' => '#f97316',
                'reason' => $ka->alasan ?? null,
            ];

            continue;
        }

        // --- KASUS: ABSENT (Tidak ada di DB) ---
        // Skip jika weekend (biasanya weekend tidak dianggap absent/bolos)
        if ($isWeekend) {
            continue; 
        }

        $attendanceDates[] = [
            'date' => $dateStr,
            'has_attendance' => false,
            'status' => 'absent', // Merah (Alpha)
            'masuk' => null,
            'pulang' => null,
            'early' => false,
            'can_correct' => true, // User BISA klik tanggal ini untuk koreksi
            'title' => 'Alpha / Absent',
            'color' => '#ef4444', // Merah Tailwind
        ];
    }

    // Sort descending (terbaru paling atas) untuk list, atau biarkan asc untuk kalender
    // $attendanceDates = array_reverse($attendanceDates); 

    return response()->json([
        'success' => true,
        'data' => $attendanceDates, // Pastikan FE loop variable ini
    ]);
}
}

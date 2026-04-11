<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use App\Models\User;
use App\Models\TblKaryawan;
use App\Models\Role;

class SyncSierEmployees extends Command
{
    /**
     * The name and signature of the console command.
     *
     * Note: per request "jangan baca env" the SIER URL is hard-coded here.
     */
    protected $signature = 'sync:employees';

    /**
     * The console command description.
     */
    protected $description = 'Tarik semua data karyawan dari API PT SIER ke tabel users lokal';

    public function handle()
    {
        $this->info('Memulai sinkronisasi data karyawan...');

        // SIER base URL (ambil dari env — you will provide the correct value)
        $apisso = env('SSO_API_URL');
        $sierUrl = $apisso . '/api/user/v1/employee';

        try {
            $this->info('Mendapatkan token admin...');

            // 1) Login admin ke API SIER (credentials disediakan via .env oleh Anda)
            $loginResponse = Http::asForm()->timeout(15)->post($apisso . '/api/auth/login', [
                'usercode' => env('SIER_ADMIN_USER'),
                'password' => env('SIER_ADMIN_PASS'),
            ]);

            if (! $loginResponse->successful()) {
                $this->error('Gagal login admin API SIER (periksa SIER_ADMIN_USER/ PASS) — status: ' . $loginResponse->status());
                $this->line('Login response body: ' . $loginResponse->body());
                return 1;
            }

            // Ambil token (tangguh terhadap beberapa struktur respons)
            $body = $loginResponse->json() ?? [];
            $adminToken = data_get($body, 'data.token')
                ?? data_get($body, 'data.data.token')
                ?? data_get($body, 'token')
                ?? data_get($body, 'access_token')
                ?? null;

            if (! $adminToken) {
                $this->error('Login sukses tetapi token tidak ditemukan pada response SIER');
                $this->line('Login response (truncated): ' . substr(json_encode($body), 0, 1000));
                return 1;
            }
            // $adminToken = env('TOKEN_ADMIN');
            $this->info('Token didapatkan. Mengambil data karyawan...');

            // 2) Ambil data karyawan pakai token admin
            $response = Http::withToken($adminToken)->timeout(30)->get('https://api-sso.sier.id/api/user/v1/employee', [
                'per_page' => 999999,
            ]);

        } catch (\Exception $e) {
            $this->error('Gagal terhubung ke API SIER: ' . $e->getMessage());
            return 1;
        }

        if (! $response->successful()) {
            $this->error('API SIER merespons dengan status: ' . $response->status());
            return 1;
        }

        $employees = $response->json('data') ?? $response->json() ?? [];

        if (! is_array($employees) || empty($employees)) {
            $this->info('Tidak ada data karyawan yang diterima dari API SIER.');
            return 0;
        }

        // Normalizer used across the sync (convert arrays/objects to string)
        $normalize = function ($v) {
            if (is_null($v)) return null;
            if (is_string($v) || is_numeric($v)) return (string) $v;
            if (is_array($v)) {
                if (isset($v['name'])) return (string) $v['name'];
                if (isset($v['sectioname'])) return (string) $v['sectioname'];
                if (isset($v['PosName'])) return (string) $v['PosName'];
                if (isset($v[0]) && (is_string($v[0]) || is_numeric($v[0]))) return (string) $v[0];
                return json_encode($v);
            }
            if (is_object($v)) {
                if (isset($v->name)) return (string) $v->name;
                return json_encode($v);
            }
            return (string) $v;
        };

        // Pre-create distinct divisions from incoming payload to avoid duplicates and redundant DB calls
        $divisionNames = collect($employees)
            ->map(fn($emp) => $normalize($emp['divisionname'] ?? $emp['division'] ?? null))
            ->filter()
            ->map(fn($d) => trim($d))
            ->unique()
            ->values();

        $divisionMap = [];
        foreach ($divisionNames as $dn) {
            $dnKey = \Illuminate\Support\Str::slug($dn);
            $siteIdGuess = $this->guessSiteIdFromDivision($dn);
            $div = \App\Models\Division::findOrCreateByName($dn, $siteIdGuess);
            $divisionMap[$dnKey] = $div;
        }

        $bar = $this->output->createProgressBar(count($employees));
        $bar->start();

        // Ensure mentor role exists locally
        $mentorRole = Role::firstOrCreate(['name' => 'mentor'], ['label' => 'Mentor']);

        // ── Sync Sites dari SSO ──────────────────────────────────────────
        // Extract semua SiteName unik dari data employee, lalu auto-create
        // di tabel sites lokal jika belum ada (alamat/lat/long = null, diisi manual).
        $siteNames = collect($employees)
            ->map(fn($emp) => $normalize($emp['SiteName'] ?? null))
            ->filter()
            ->map(fn($s) => trim($s))
            ->unique()
            ->values();

        $siteMap = []; // SiteName => id_site
        foreach ($siteNames as $sn) {
            $site = \App\Models\TblSite::where('nama_site', $sn)->first();
            if (! $site) {
                $site = \App\Models\TblSite::create([
                    'nama_site'    => $sn,
                    'alamat'       => '-',
                    'latitude'     => 1,
                    'longitude'    => 1,
                    'radius_meter' => 1,
                ]);
                $this->info("  ✚ Site baru dibuat: {$sn} (id_site={$site->id_site}) — alamat/lat/long/radius perlu diisi manual");
            } else {
                $this->line("  ✓ Site sudah ada: {$sn} (id_site={$site->id_site})");
            }
            $siteMap[$sn] = $site->id_site;
        }
        $this->info('Site sync selesai: ' . count($siteMap) . ' site(s) ditemukan/dibuat.');
        // ────────────────────────────────────────────────────────────────────

        $unmapped = [];
        $mappedLog = [];

        foreach ($employees as $emp) {
            // Map fields from the sample SIER response to local karyawan schema
            $nip = $emp['usercode'] ?? $emp['empcode'] ?? null;

            $nama = $normalize($emp['empname'] ?? $emp['name'] ?? null);
            $email = $normalize($emp['email'] ?? null);
            $phone = $normalize($emp['no_telp'] ?? $emp['phone'] ?? null);
            // normalize gender if present (some API use 'gender' or 'sex')
            $rawGender = $normalize($emp['gender'] ?? $emp['sex'] ?? null);
            $gender = $rawGender;
            if (strtoupper($rawGender) === 'M') {
                $gender = 'L';
            } elseif (strtoupper($rawGender) === 'F') {
                $gender = 'P';
            }
            $divisionName = $normalize($emp['divisionname'] ?? $emp['division'] ?? null);
            // job_position: ONLY take `sectioname` (or nested `section.sectioname`) or `PosName` — no other fallbacks / no JSON dumps
            $jobPosition = null;
            if (! empty($emp['sectioname']) && is_scalar($emp['sectioname'])) {
                $jobPosition = trim((string) $emp['sectioname']);
            } elseif (! empty($emp['sectioname']) && is_scalar($emp['sectioname'])) {
                // handle occasional misspelled key seen in API
                $jobPosition = trim((string) $emp['sectioname']);
            } elseif (! empty($emp['section']) && is_array($emp['section'])) {
                $jobPosition = trim((string) (data_get($emp['section'], 'sectioname') ?? data_get($emp['section'], 'sectioname') ?? data_get($emp['section'], 'name') ?? ''));
            }
            if (empty($jobPosition) && ! empty($emp['PosName']) && is_scalar($emp['PosName'])) {
                $jobPosition = trim((string) $emp['PosName']);
            }
            if ($jobPosition === '') {
                $jobPosition = null;
            }

            // Site mapping logic based on SiteName (dynamic dari siteMap)
            $siteName = $normalize($emp['SiteName'] ?? null);
            $mappedSiteId = null;

            if ($siteName && isset($siteMap[$siteName])) {
                $mappedSiteId = $siteMap[$siteName];
            }

            $resignDate = $emp['resigndate'] ?? null;

            // Determine status: if resigndate is '-' or empty => active, otherwise inactive
            $status = (empty($resignDate) || $resignDate === '-' || $resignDate === null) ? 'active' : 'inactive';

            // Use pre-created division map to avoid redundant DB ops
            $divisionId = null;
            $divisionModel = null;
            if (! empty($divisionName)) {
                $slug = \Illuminate\Support\Str::slug($divisionName);
                $divisionModel = $divisionMap[$slug] ?? null;
                $divisionId = $divisionModel?->id_division ?? null;
            }

            if (! $nip) {
                $this->warn("Skip record tanpa usercode/nip: " . json_encode($emp));
                $bar->advance();
                continue;
            }

            DB::beginTransaction();
            try {
                // Find existing karyawan by NIP
                $k = TblKaryawan::where('nip', $nip)->first();

                if ($k) {
                    // Update only fields that belong to employees table
                    $k->division = $divisionName ?? $k->division;
                    // set normalized relation if available
                    $k->division_id = $divisionId ?? $k->division_id;
                    $k->job_position = $jobPosition ?? $k->job_position;
                    // store profile fields on employees (nama, email, gender); keep no_telp untouched
                    $k->nama = $nama ?? $k->nama;
                    $k->email = $email ?? $k->email;
                    $k->gender = $gender ?? $k->gender;

                    // Update id_site based on SiteName mapping
                    $k->id_site = $mappedSiteId;

                    if ($mappedSiteId) {
                        $mappedLog[] = [ 'nip' => $nip, 'division' => $divisionName, 'site' => $siteName, 'mapped_id_site' => $mappedSiteId ];
                    } else {
                        $unmapped[$nip] = "{$divisionName} (Site: " . ($siteName ?? 'NULL') . ")";
                    }

                    $k->status = $status ?? $k->status;
                    $k->save();

                    // Optionally update related user minimal info (nama/email) if present
                    if ($k->user) {
                        $u = $k->user;
                        if ($nama) $u->nama = $nama;
                        if ($email) $u->email = $email;
                        $u->save();
                    }
                } else {
                    // NEW BEHAVIOR: create ONLY employees record (do NOT create a `users` row here).
                    // `user_id` will be NULL — provisioning of `users` happens on first successful SSO login.

                    TblKaryawan::create([
                        'user_id' => null,
                        'nip' => $nip,
                        'nama' => $nama,
                        'email' => $email,
                        'gender' => $gender,
                        'division' => $divisionName,
                        'division_id' => $divisionId,
                        'job_position' => $jobPosition,
                        'status' => $status,
                        'id_site' => $mappedSiteId,
                    ]);

                    if ($mappedSiteId) {
                        $mappedLog[] = [ 'nip' => $nip, 'division' => $divisionName, 'site' => $siteName, 'mapped_id_site' => $mappedSiteId ];
                    } else {
                        $unmapped[$nip] = "{$divisionName} (Site: " . ($siteName ?? 'NULL') . ")";
                    }
                }

                DB::commit();
            } catch (\Exception $e) {
                DB::rollBack();
                $this->error('Gagal menyimpan data untuk NIP ' . $nip . ': ' . $e->getMessage());
                $this->line('Record causing error (truncated): ' . substr(json_encode($emp), 0, 1000));
            }

            $bar->advance();
        }

        $bar->finish();

        // report mapped/unmapped divisions
        $this->newLine(1);
        if (! empty($mappedLog)) {
            $this->info('Mapped sites -> id_site:');
            foreach ($mappedLog as $m) {
                $this->line(" - {$m['nip']} : {$m['division']} (Site: {$m['site']}) => id_site={$m['mapped_id_site']}");
            }
        }

        if (! empty($unmapped)) {
            $this->warn('Unmapped divisions (no site guessed):');
            foreach ($unmapped as $nip => $div) {
                $this->line(" - {$nip} : {$div}");
            }
            $this->line('Tip: add mapping keys in config/site_mappings.php or create sites with matching names.');
        }

        $this->newLine(1);
        $this->info('Sinkronisasi selesai! Semua karyawan berhasil diproses.');

        return 0;
    }

    /**
     * Try to guess id_site from division/department/section text using
     * configurable keywords in config/site_mappings.php
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
                    // try to find the site record by partial match on nama_site
                    $site = \App\Models\TblSite::where('nama_site', 'like', "%{$siteName}%")->first();
                    if ($site) return $site->id_site;

                    // fallback: try to locate by keyword present in nama_site
                    $site2 = \App\Models\TblSite::where('nama_site', 'like', "%{$kw}%")->first();
                    if ($site2) return $site2->id_site;
                }
            }
        }

        // optional default site configured by name
        $defaultName = config('site_mappings.default_site_name');
        if (! empty($defaultName)) {
            $s = \App\Models\TblSite::where('nama_site', 'like', "%{$defaultName}%")->first();
            if ($s) return $s->id_site;
        }

        return null;
    }
}

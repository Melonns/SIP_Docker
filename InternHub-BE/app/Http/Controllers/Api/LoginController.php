<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\TblKaryawan;
use App\Models\Role;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class LoginController extends Controller
{
    /**
     * Login user dengan support multi-role (overlap model)
     * Menerima input `email` yang bisa berupa email biasa (mengandung '@')
     * atau usercode/NIP (tanpa '@') untuk karyawan. Lookup akan mencoba
     * `users.email` lalu `karyawans.nip` ketika format tanpa '@'.
     */
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'sometimes|required_without:usercode|string',
            'usercode' => 'sometimes|required_without:email|string',
            'password' => 'required|string',
        ]);

        // Ambil identifier dari body (`email` atau `usercode`) — prefer `usercode` when provided
        $isUsercode = $request->filled('usercode');
        $login = trim($request->post($isUsercode ? 'usercode' : 'email'));
        $password = $request->post('password');

        // Tolak jika credentials dikirim via query parameter (security)
        if ($request->query('email') || $request->query('password') || $request->query('usercode')) {
            return response()->json([
                'success' => false,
                'message' => 'Credentials tidak boleh dikirim via query parameter'
            ], 400);
        }

        // Jika payload mengandung `usercode` -> autentikasi lewat SSO eksternal
        if ($isUsercode) {
            $ssoUrl = config('services.sso.login_url', env('SSO_LOGIN_URL'));

            try {
                $ssoResp = Http::asForm()->post($ssoUrl, [
                    'usercode' => $login,
                    'password' => $password,
                ]);
            } catch (\Exception $e) {
                return response()->json([
                    'success' => false,
                    'message' => 'Gagal terhubung ke layanan SSO'
                ], 502);
            }

            if ($ssoResp->failed()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Usercode atau password salah'
                ], 401);
            }

            // SSO OK — cari user lokal berdasarkan NIP di tabel karyawan
            $user = User::with(['roles', 'permissions'])
                ->whereHas('karyawan', function ($q) use ($login) {
                    $q->where('nip', $login);
                })
                ->first();

            // Jika tidak ada `users` tetapi ada `employees` dengan matching NIP,
            // buat `users` baru (role = mentor) dan link ke record employees.
            if (! $user) {
                $karyawan = TblKaryawan::where('nip', $login)->first();

                if ($karyawan) {
                    // Provision new user for the existing employee (SSO-first provisioning)
                    $user = User::create([
                        'nama' => $karyawan->nama ?? $login,
                        'email' => $karyawan->email ?? null,
                        'password' => Str::random(24),
                        'status' => $karyawan->status ?? 'active',
                        'must_change_password' => false,
                        'level' => 'mentor',
                    ]);

                    // Attach mentor role
                    $mentorRole = Role::firstOrCreate(['name' => 'mentor'], ['label' => 'Mentor']);
                    if ($mentorRole && ! $user->roles()->wherePivot('role_id', $mentorRole->role_id)->exists()) {
                        $user->roles()->syncWithoutDetaching([$mentorRole->role_id]);
                    }

                    // Link karyawan -> user
                    $karyawan->user_id = $user->user_id;
                    $karyawan->save();

                    $user = $user->load(['roles', 'permissions']);
                } else {
                    // Tidak ditemukan di employees — user memilih agar ditolak dan notify admin
                    return response()->json([
                        'success' => false,
                        'message' => 'Akun SSO terverifikasi tetapi belum terdaftar di sistem. Hubungi admin.'
                    ], 403);
                }
            }

            // Issue token (SSO sudah memverifikasi kredensial)
            $token = $user->createToken('API Token')->plainTextToken;
            $roles = $user->getRoleNames();
            $permissions = $user->getGrantedPermissions();
            $identifierLabel = $user->getIdentifierLabel();

            return response()->json([
                'success' => true,
                'token' => $token,
                'user' => [
                    'user_id' => $user->user_id,
                    'id_mahasiswa' => $user->mahasiswa?->id_mahasiswa ?? null,
                    'id_karyawan' => $user->karyawan?->id_karyawan ?? null,
                    'nama' => $user->nama,
                    'identifier' => $user->identifier,
                    'identifier_label' => $identifierLabel,
                    'email' => $user->email,
                    'no_telp' => $user->mahasiswa?->no_telp ?? $user->karyawan?->no_telp ?? null,
                    'foto' => $user->mahasiswa?->foto ?? $user->karyawan?->foto ?? null,
                    'status' => $user->status,
                    'site' => $user->mahasiswa?->site ?? $user->karyawan?->site ?? $user->site ?? null,
                    'universitas' => $user->mahasiswa?->universitas,
                    'jurusan' => $user->mahasiswa?->jurusan,
                    'mulai_magang' => $user->mahasiswa?->mulai_magang,
                    'akhir_magang' => $user->mahasiswa?->akhir_magang,
                    'alamat' => $user->mahasiswa?->alamat,
                    'must_change_password' => (bool)$user->must_change_password,
                ],
                'roles' => $roles,
                'permissions' => $permissions,
                'server_time' => now()->toDateTimeString(),
            ]);
        }

        // Deteksi apakah input adalah email atau usercode/NIP (email mengandung '@')
        $isEmailFormat = str_contains($login, '@');

        // Cari user: jika format email -> cari di users.email
        // jika bukan email -> coba users.email OR relation karyawan.nip
        $query = User::with(['roles', 'permissions']);

        if ($isEmailFormat) {
            $query->where('email', $login);
        } else {
            $query->where(function ($q) use ($login) {
                $q->where('email', $login)
                  ->orWhereHas('karyawan', function ($q2) use ($login) {
                      $q2->where('nip', $login);
                  });
            });
        }

        $user = $query->first();

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Email/NIP atau password salah'
            ], 401);
        }

        // Jika akun SSO-only (tidak punya password) dan user mencoba login dengan NIP,
        // berikan pesan agar menggunakan SSO. (Integrasi SSO akan ditambahkan terpisah.)
        if (empty($user->password) && ! $isEmailFormat && $user->karyawan) {
            return response()->json([
                'success' => false,
                'message' => 'Akun ini menggunakan Single Sign-On. Silakan login lewat SSO atau hubungi admin.'
            ], 403);
        }

        // Normal password check
        if (! Hash::check($password, $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Email/NIP atau password salah'
            ], 401);
        }

        // Cek apakah user aktif
        if ($user->status === 'inactive') {
            return response()->json([
                'success' => false,
                'message' => 'Akun Anda tidak aktif. Hubungi admin.'
            ], 403);
        }

        $token = $user->createToken('API Token')->plainTextToken;

        // Ambil semua role names untuk sidebar rendering
        $roles = $user->getRoleNames();

        // Ambil granted permissions untuk dynamic access control
        $permissions = $user->getGrantedPermissions();

        // Tentukan label identifier berdasarkan role
        $identifierLabel = $user->getIdentifierLabel();

        return response()->json([
            'success' => true,
            'token' => $token,
            'user' => [
                'user_id' => $user->user_id,
                'id_mahasiswa' => $user->mahasiswa?->id_mahasiswa ?? null,
                'id_karyawan' => $user->karyawan?->id_karyawan ?? null,
                'nama' => $user->nama,
                'identifier' => $user->identifier,
                'identifier_label' => $identifierLabel, // NIP atau NIM
                'email' => $user->email,
                'no_telp' => $user->mahasiswa?->no_telp ?? $user->karyawan?->no_telp ?? null,
                'foto' => $user->mahasiswa?->foto ?? $user->karyawan?->foto ?? null,
                'status' => $user->status,
                'site' => $user->mahasiswa?->site ?? $user->karyawan?->site ?? $user->site ?? null,
                // Data khusus intern
                'universitas' => $user->mahasiswa?->universitas,
                'jurusan' => $user->mahasiswa?->jurusan,
                'mulai_magang' => $user->mahasiswa?->mulai_magang,
                'akhir_magang' => $user->mahasiswa?->akhir_magang,
                'alamat' => $user->mahasiswa?->alamat,
                'must_change_password' => (bool)$user->must_change_password,
            ],
            'roles' => $roles, // Semua role untuk sidebar rendering
            'permissions' => $permissions, // Permissions untuk dynamic access control
            'server_time' => now()->toDateTimeString(), // Server timestamp
        ]);
    }

    /**
     * Logout user dan hapus token
     */
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Logout berhasil'
        ]);
    }

    public function ssoBypass(Request $request)
    {
        $frontendUrl = env('FRONTEND_URL', 'http://localhost:5173');
        $token = $request->query('token');

        if (! $token) {
            return response()->json([
                'success' => false,
                'message' => 'Token tidak ditemukan pada parameter',
            ], 400);
        }

        // Panggil SSO credential URL untuk verifikasi token
        $credentialUrl = env('SSO_CREDENTIAL_URL');
        $clientId      = env('CLIENT_ID');
        $clientSecret  = env('CLIENT_SECRET');

        if (! $credentialUrl) {
            return response()->json([
                'success' => false,
                'message' => 'SSO_CREDENTIAL_URL belum dikonfigurasi',
            ], 500);
        }

        try {
            $ssoResp = Http::withToken($token)->get($credentialUrl, [
                'client_id'     => $clientId,
                'client_secret' => $clientSecret,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal terhubung ke layanan SSO: ' . $e->getMessage(),
            ], 502);
        }

        if ($ssoResp->failed()) {
            return response()->json([
                'success' => false,
                'message' => 'Token SSO tidak valid atau sudah kadaluarsa',
            ], 401);
        }

        $ssoData = $ssoResp->json('data') ?? $ssoResp->json();

        // Ambil usercode/NIP dari response SSO
        $usercode = data_get($ssoData, 'user.usercode')
            ?? data_get($ssoData, 'empcode')
            ?? data_get($ssoData, 'nip')
            ?? null;

        if (! $usercode) {
            return response()->json([
                'success' => false,
                'message' => 'Response SSO tidak mengandung usercode',
            ], 422);
        }

        // Cari user lokal berdasarkan NIP di tabel karyawan
        $user = User::with(['roles', 'permissions'])
            ->whereHas('karyawan', function ($q) use ($usercode) {
                $q->where('nip', $usercode);
            })
            ->first();

        // Jika belum ada user tapi ada karyawan, provision user baru
        if (! $user) {
            $karyawan = TblKaryawan::where('nip', $usercode)->first();

            if ($karyawan) {
                $user = User::create([
                    'nama'                 => $karyawan->nama ?? $usercode,
                    'email'                => $karyawan->email ?? null,
                    'password'             => Str::random(24),
                    'status'               => $karyawan->status ?? 'active',
                    'must_change_password' => false,
                    'level'                => 'mentor',
                ]);

                $mentorRole = Role::firstOrCreate(['name' => 'mentor'], ['label' => 'Mentor']);
                if ($mentorRole && ! $user->roles()->wherePivot('role_id', $mentorRole->role_id)->exists()) {
                    $user->roles()->syncWithoutDetaching([$mentorRole->role_id]);
                }

                $karyawan->user_id = $user->user_id;
                $karyawan->save();

                $user = $user->load(['roles', 'permissions']);
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Akun SSO terverifikasi tetapi belum terdaftar di sistem. Hubungi admin.',
                ], 403);
            }
        }

        // Cek status aktif
        if ($user->status === 'inactive') {
            return response()->json([
                'success' => false,
                'message' => 'Akun Anda tidak aktif. Hubungi admin.',
            ], 403);
        }

        // Issue Sanctum token & redirect ke frontend
        $sanctumToken = $user->createToken('API Token')->plainTextToken;

        return redirect($frontendUrl . '/login?sanctum_token=' . urlencode($sanctumToken));
    }

    /**
     * Get current user info dengan roles dan permissions
     */
    public function me(Request $request)
    {
        $user = $request->user()->load(['roles', 'permissions']);

        // Support active_role filtering for multi-role users
        $activeRole = $request->query('active_role');
        $roles = $user->getRoleNames();

        // Validate active_role: must be one of the user's actual roles
        if ($activeRole && !in_array($activeRole, $roles)) {
            $activeRole = null; // fallback: return all permissions
        }

        // Get permissions filtered by active role (or all if no active_role)
        $permissions = $activeRole
            ? $user->getPermissionsForRole($activeRole)
            : $user->getGrantedPermissions();

        return response()->json([
            'success' => true,
            'user' => [
                'user_id' => $user->user_id,
                'id_mahasiswa' => $user->mahasiswa?->id_mahasiswa ?? null,
                'id_karyawan' => $user->karyawan?->id_karyawan ?? null,
                'nama' => $user->nama,
                'identifier' => $user->identifier,
                'identifier_label' => $user->getIdentifierLabel(),
                'email' => $user->email,
                'no_telp' => $user->mahasiswa?->no_telp ?? $user->karyawan?->no_telp ?? null,
                'foto' => $user->mahasiswa?->foto ?? $user->karyawan?->foto ?? null,
                'status' => $user->status,
                'site' => $user->mahasiswa?->site ?? $user->karyawan?->site ?? $user->site ?? null,
                'universitas' => $user->mahasiswa?->universitas,
                'jurusan' => $user->mahasiswa?->jurusan,
                'mulai_magang' => $user->mahasiswa?->mulai_magang,
                'akhir_magang' => $user->mahasiswa?->akhir_magang,
                'alamat' => $user->mahasiswa?->alamat,
                'must_change_password' => (bool)$user->must_change_password,
            ],
            'roles' => $roles,
            'active_role' => $activeRole,
            'permissions' => $permissions,
            'server_time' => now()->toDateTimeString(),
        ]);
    }

    /**
     * Get server time (untuk sinkronisasi waktu absensi)
     */
    public function serverTime()
    {
        return response()->json([
            'success' => true,
            'server_time' => now()->toDateTimeString(),
            'server_date' => now()->toDateString(),
            'server_hour' => now()->format('H:i:s'),
            'timezone' => config('app.timezone'),
        ]);
    }
}
<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Carbon\Carbon;

class ProfileController extends Controller
{
    /**
     * Get authenticated user profile (mentor/admin/intern)
     */
    public function getProfile(Request $request)
    {
        $user = $request->user();
        $roles = $user->getRoleNames();
        $mainRole = is_array($roles) ? ($roles[0] ?? null) : $roles->first();

        $profile = [
            'user_id' => $user->user_id,
            'id_mahasiswa' => $user->mahasiswa?->id_mahasiswa ?? null,
            'id_karyawan' => $user->karyawan?->id_karyawan ?? null,
            'nama' => $user->nama ?? null,
            'email' => $user->email,
            // Prefer profile table phone (students/employees)
            'no_telp' => $user->mahasiswa?->no_telp ?? $user->karyawan?->no_telp ?? null,
            'gender' => $user->mahasiswa?->gender ?? $user->karyawan?->gender ?? null,
            'nip' => $user->karyawan?->nip ?? null, // Staff/Mentor ID
            'nim' => $user->mahasiswa?->nim ?? null, // Intern ID
            'nik' => $user->mahasiswa?->nik ?? null,
            'foto' => $user->mahasiswa?->foto ?? $user->karyawan?->foto ?? null,
            'foto_url' => ($user->mahasiswa?->foto ?? $user->karyawan?->foto) ? url($user->mahasiswa?->foto ?? $user->karyawan?->foto) : null,
            'foto_filename' => ($user->mahasiswa?->foto ?? $user->karyawan?->foto) ? basename($user->mahasiswa?->foto ?? $user->karyawan?->foto) : null,
            'job_position' => $user->mahasiswa?->job_position ?? $user->karyawan?->job_position ?? null,
            'division' => $user->mahasiswa?->division ?? $user->karyawan?->division ?? null,
            'role' => $mainRole,
            'roles' => $roles,
            'status' => $user->status ?? null,
            'created_at' => $user->created_at ? Carbon::parse($user->created_at)->toDateTimeString() : null,
            'updated_at' => $user->updated_at ? Carbon::parse($user->updated_at)->toDateTimeString() : null,
        ];

        // Info khusus Intern
        if ($user->hasRole('intern')) {
            // Load mahasiswa profile data
            $mahasiswa = $user->mahasiswa;
            
            $profile['nim'] = $user->mahasiswa?->nim ?? null; // NIM now stored on mahasiswa table
            $profile['universitas'] = $mahasiswa?->universitas ?? null;
            $profile['jurusan'] = $mahasiswa?->jurusan ?? null;
            $profile['semester'] = $mahasiswa?->semester ?? null;
            $profile['jenjang_pendidikan'] = $mahasiswa?->jenjang_pendidikan ?? null;
            $profile['mulai_magang'] = $mahasiswa?->mulai_magang ? Carbon::parse($mahasiswa->mulai_magang)->toDateString() : null;
            $profile['akhir_magang'] = $mahasiswa?->akhir_magang ? Carbon::parse($mahasiswa->akhir_magang)->toDateString() : null;
            $profile['alamat'] = $mahasiswa?->alamat ?? null;
            $profile['nomor_darurat'] = $mahasiswa?->nomor_darurat ?? null;
            $profile['nama_kontak_darurat'] = $mahasiswa?->nama_kontak_darurat ?? null;
            $profile['foto_ktm'] = $mahasiswa?->foto_ktm ?? null;
            $profile['foto_ktm_url'] = $mahasiswa?->foto_ktm ? url($mahasiswa->foto_ktm) : null;
            $profile['foto_ktm_filename'] = $mahasiswa?->foto_ktm ? basename($mahasiswa->foto_ktm) : null;

            // Bank details from mahasiswa
            $profile['bank_name'] = $mahasiswa?->bank_name ?? null;
            $profile['bank_account_name'] = $mahasiswa?->bank_account_name ?? null;
            $profile['bank_account_number'] = $mahasiswa?->bank_account_number ?? null;
            $profile['bank_proof'] = $mahasiswa?->bank_proof ?? null;
            $profile['bank_proof_url'] = $mahasiswa?->bank_proof ? url($mahasiswa->bank_proof) : null;
            $profile['bank_proof_filename'] = $mahasiswa?->bank_proof ? basename($mahasiswa->bank_proof) : null;
            $profile['bank_proof'] = $mahasiswa?->bank_proof ?? null;
            $profile['bank_proof_url'] = $mahasiswa?->bank_proof ? url($mahasiswa->bank_proof) : null;
            $profile['bank_proof_filename'] = $mahasiswa?->bank_proof ? basename($mahasiswa->bank_proof) : null;

            // Legacy keys for backward compatibility (also from mahasiswa now)
            $profile['nama_bank'] = $mahasiswa?->bank_name ?? null;
            $profile['nama_pemegang_rekening'] = $mahasiswa?->bank_account_name ?? null;
            $profile['no_rekening'] = $mahasiswa?->bank_account_number ?? null;

            // Personal ID fields from mahasiswa
            $profile['gender'] = $mahasiswa?->gender ?? null;
            $profile['nik'] = $mahasiswa?->nik ?? null;
            $profile['tempat_lahir'] = $mahasiswa?->tempat_lahir ?? null;
            $profile['tanggal_lahir'] = $mahasiswa?->tanggal_lahir ? Carbon::parse($mahasiswa->tanggal_lahir)->toDateString() : null;

            // Job position and division from mahasiswa
            $profile['job_position'] = $mahasiswa?->job_position ?? null;
            $profile['division'] = $mahasiswa?->division ?? null;

            $profile['mentor'] = $user->mentors()->first() ? [
                'nama' => $user->mentors()->first()->nama,
                'email' => $user->mentors()->first()->email,
            ] : null;

            // Site/Location information
            $site = $user->site;
            $profile['site'] = $site ? [
                'id_site' => $site->id_site,
                'nama_site' => $site->nama_site,
                'alamat' => $site->alamat ?? null,
                'kota' => $site->kota ?? null,
                'propinsi' => $site->propinsi ?? null,
                'kode_pos' => $site->kode_pos ?? null,
            ] : null;
        }

        // Info khusus Mentor
        if ($user->hasRole('mentor')) {
            $profile['total_interns'] = $user->interns()->count();
            $profile['id_karyawan'] = $user->karyawan?->id_karyawan ?? null;
            $profile['karyawan_profile'] = $user->karyawan;
        }

        // Add Work Schedule info
        $schedule = $user->workSchedule;
        $profile['work_schedule'] = $schedule ? [
            'id' => $schedule->id,
            'name' => $schedule->name,
            'start_time' => $schedule->start_time,
            'end_time' => $schedule->end_time,
            'days' => $schedule->days, // Ini sudah di-cast array di model
            'day_times' => $schedule->day_times, // Ini juga
            'tolerance' => $schedule->tolerance,
        ] : null;

        return response()->json([
            'success' => true,
            'data' => $profile
        ]);
    }

    /**
     * Get authenticated user's profile photo
     * Route: GET /api/profile/photo
     * Query: ?download=1 (force download)
     */
    public function getPhoto(Request $request)
    {
        $user = $request->user();

        $foto = $user->mahasiswa?->foto ?? $user->karyawan?->foto ?? null;

        if (!$foto) {
            return response()->json(['message' => 'Foto profil tidak ditemukan'], 404);
        }

        // Remove 'storage/' prefix for Storage facade
        $relativePath = str_replace('storage/', '', $foto);

        if (!Storage::disk('public')->exists($relativePath)) {
            return response()->json(['message' => 'File foto tidak ditemukan'], 404);
        }

        if ($request->query('download')) {
            return Storage::disk('public')->download($relativePath);
        }

        $file = Storage::disk('public')->get($relativePath);
        $mimeType = Storage::disk('public')->mimeType($relativePath);
        return response($file)->header('Content-Type', $mimeType);
    }

    /**
     * Get authenticated user's KTM photo (intern only)
     * Route: GET /api/profile/ktm
     * Query: ?download=1 (force download)
     */
    public function getKtm(Request $request)
    {
        $user = $request->user();
        $mahasiswa = $user->mahasiswa;

        if (!$mahasiswa || !$mahasiswa->foto_ktm) {
            return response()->json(['message' => 'Foto KTM tidak ditemukan'], 404);
        }

        // Remove 'storage/' prefix for Storage facade
        $relativePath = str_replace('storage/', '', $mahasiswa->foto_ktm);

        if (!Storage::disk('public')->exists($relativePath)) {
            return response()->json(['message' => 'File KTM tidak ditemukan'], 404);
        }

        if ($request->query('download')) {
            return Storage::disk('public')->download($relativePath);
        }

        $file = Storage::disk('public')->get($relativePath);
        $mimeType = Storage::disk('public')->mimeType($relativePath);
        return response($file)->header('Content-Type', $mimeType);
    }

    /**
     * Get authenticated user's Bank Proof (intern only)
     * Route: GET /api/profile/bank-proof
     * Query: ?download=1 (force download)
     */
    public function getBankProof(Request $request)
    {
        $user = $request->user();
        $mahasiswa = $user->mahasiswa;

        if (!$mahasiswa || !$mahasiswa->bank_proof) {
            return response()->json(['message' => 'Bukti bank tidak ditemukan'], 404);
        }

        // Remove 'storage/' prefix for Storage facade
        $relativePath = str_replace('storage/', '', $mahasiswa->bank_proof);

        if (!Storage::disk('public')->exists($relativePath)) {
            return response()->json(['message' => 'File bukti bank tidak ditemukan'], 404);
        }

        if ($request->query('download')) {
            return Storage::disk('public')->download($relativePath);
        }

        $file = Storage::disk('public')->get($relativePath);
        $mimeType = Storage::disk('public')->mimeType($relativePath);
        return response($file)->header('Content-Type', $mimeType);
    }
    public function update(Request $request)
    {


        $user = $request->user();
    
        // Check which profile components exist
        $hasInternRole = $user->hasRole('intern');
        $hasMentorOrAdminRole = $user->hasRole('mentor') || $user->hasRole('admin');

        $rules = [
            'nama' => 'nullable|string|max:255',
            'no_telp' => 'nullable|string|max:20',
            'gender' => 'nullable|in:L,P,Laki-laki,Perempuan',
            'foto' => 'nullable|image|max:5120', // Max 2MB
            'nik' => 'nullable|string|max:20',
            'tempat_lahir' => 'nullable|string|max:255',
            'tanggal_lahir' => 'nullable|date',
        ];

        if ($hasInternRole) {
            $rules['alamat'] = 'nullable|string';
            $rules['nomor_darurat'] = 'nullable|string|max:20';
            $rules['nama_kontak_darurat'] = 'nullable|string|max:255';
            $rules['foto_ktm'] = 'nullable|image|max:5120'; // Max 5MB
            // Add education fields
            $rules['universitas'] = 'nullable|string|max:255';
            $rules['jurusan'] = 'nullable|string|max:255';
            $rules['semester'] = 'nullable|integer|min:1|max:14';
            $rules['jenjang_pendidikan'] = 'nullable|string|max:50';
            // Job position and division
            $rules['job_position'] = 'nullable|string|max:255';
            $rules['division'] = 'nullable|string|max:255';
            // Bank details (canonical)
            $rules['bank_name'] = 'nullable|string|max:255';
            $rules['bank_account_name'] = 'nullable|string|max:255';
            $rules['bank_account_number'] = 'nullable|string|max:50';
            $rules['bank_proof'] = 'nullable|image|max:5120'; // Max 5MB
            // Legacy/Indonesian fields for compatibility
            $rules['nama_bank'] = 'nullable|string|max:255';
            $rules['nama_pemegang_rekening'] = 'nullable|string|max:255';
            $rules['no_rekening'] = 'nullable|string|max:50';
        }

        $request->validate($rules);

        // Map payload fields to User model (only fields that exist in users table)
        if ($request->has('nama')) $user->nama = $request->input('nama');
        if ($request->has('identifier')) {
            $idValue = $request->input('identifier');
            if ($hasInternRole) {
                $mahasiswa = $user->mahasiswa ?? new \App\Models\TblMahasiswa();
                $mahasiswa->user_id = $user->user_id;
                $mahasiswa->nim = $idValue;
                $mahasiswa->save();
            } else {
                // For mentors/staff, persist NIP to karyawan table
                $karyawan = $user->karyawan ?? new \App\Models\TblKaryawan();
                $karyawan->user_id = $user->user_id;
                $karyawan->nip = $idValue;
                $karyawan->save();
            }
        }
        if ($request->has('email')) $user->email = $request->input('email');
        if ($request->has('no_telp')) {
            $val = $request->input('no_telp');
            // Persist to profile table depending on role
            if ($hasInternRole) {
                $mahasiswa = $user->mahasiswa ?? new \App\Models\TblMahasiswa();
                $mahasiswa->user_id = $user->user_id;
                $mahasiswa->no_telp = $val;
                $mahasiswa->save();
            } else {
                $karyawan = $user->karyawan ?? new \App\Models\TblKaryawan();
                $karyawan->user_id = $user->user_id;
                $karyawan->no_telp = $val;
                $karyawan->save();
            }
        }

        // Handle Foto Profil — save to profile table (mahasiswa for interns, karyawan for mentors/admins)
        if ($request->hasFile('foto')) {
            // Determine where old foto is stored
            $oldFoto = $user->mahasiswa?->foto ?? $user->karyawan?->foto ?? null;

            // Delete old photo if exists
            if ($oldFoto) {
                $oldPath = str_replace('storage/', '', $oldFoto);
                if (Storage::disk('public')->exists($oldPath)) {
                    Storage::disk('public')->delete($oldPath);
                }
            }
            
            // Generate filename with timestamp for uniqueness
            $filename = time() . '_foto_' . uniqid() . '.' . $request->file('foto')->getClientOriginalExtension();
            $path = $request->file('foto')->storeAs('users', $filename, 'public');
            $storagePath = 'storage/' . $path;

            // Save to the correct profile table
            if ($hasInternRole) {
                $mahasiswa = $user->mahasiswa ?? new \App\Models\TblMahasiswa();
                $mahasiswa->user_id = $user->user_id;
                $mahasiswa->foto = $storagePath;
                $mahasiswa->save();
            } else {
                $karyawan = $user->karyawan ?? new \App\Models\TblKaryawan();
                $karyawan->user_id = $user->user_id;
                $karyawan->foto = $storagePath;
                $karyawan->save();
            }
        }

        // Handle fields for Intern - save to mahasiswa table
        if ($hasInternRole) {
            // Load or create mahasiswa profile
            $mahasiswa = $user->mahasiswa;
            if (!$mahasiswa) {
                $mahasiswa = new \App\Models\TblMahasiswa();
                $mahasiswa->user_id = $user->user_id;
                // Prefer incoming id_site or existing profile/karyawan site if provided
                $mahasiswa->id_site = $request->input('id_site', $user->mahasiswa?->id_site ?? $user->karyawan?->id_site ?? null);
            }
            
            if ($request->has('alamat')) $mahasiswa->alamat = $request->input('alamat');
            if ($request->has('nomor_darurat')) $mahasiswa->nomor_darurat = $request->input('nomor_darurat');
            if ($request->has('nama_kontak_darurat')) $mahasiswa->nama_kontak_darurat = $request->input('nama_kontak_darurat');
            
            // Personal ID fields - save to mahasiswa for interns
            if ($request->has('nik')) $mahasiswa->nik = $request->input('nik');
            if ($request->has('tempat_lahir')) $mahasiswa->tempat_lahir = $request->input('tempat_lahir');
            if ($request->has('tanggal_lahir')) $mahasiswa->tanggal_lahir = $request->input('tanggal_lahir');
            
            // Handle Gender Conversion (Full string -> Char) and save to mahasiswa
            if ($request->has('gender')) {
                $val = $request->input('gender');
                if (strtolower($val) === 'laki-laki') $mahasiswa->gender = 'L';
                elseif (strtolower($val) === 'perempuan') $mahasiswa->gender = 'P';
                else $mahasiswa->gender = $val; // Fallback "L", "P" or null
            }
            
            // Handle Education Fields
            if ($request->has('universitas')) $mahasiswa->universitas = $request->input('universitas');
            if ($request->has('jurusan')) $mahasiswa->jurusan = $request->input('jurusan');
            if ($request->has('semester')) $mahasiswa->semester = $request->input('semester');
            
            // Job position and division
            if ($request->has('job_position')) $mahasiswa->job_position = $request->input('job_position');
            if ($request->has('division')) $mahasiswa->division = $request->input('division');
            
            // Map jenjang (priority: jenjang_pendidikan > jenjang)
            if ($request->has('jenjang_pendidikan')) {
                $mahasiswa->jenjang_pendidikan = $request->input('jenjang_pendidikan');
            } elseif ($request->has('jenjang')) {
                $mahasiswa->jenjang_pendidikan = $request->input('jenjang');
            }

            // Handle Foto KTM
            if ($request->hasFile('foto_ktm')) {
                // Delete old KTM if exists
                if ($mahasiswa->foto_ktm) {
                    $oldPath = str_replace('storage/', '', $mahasiswa->foto_ktm);
                    if (Storage::disk('public')->exists($oldPath)) {
                        Storage::disk('public')->delete($oldPath);
                    }
                }

                $filename = time() . '_ktm_' . uniqid() . '.' . $request->file('foto_ktm')->getClientOriginalExtension();
                $path = $request->file('foto_ktm')->storeAs('users', $filename, 'public');
                $mahasiswa->foto_ktm = 'storage/' . $path;
            }

            // Handle Bank Proof Upload
            if ($request->hasFile('bank_proof')) {
                // Delete old bank proof if exists
                if ($mahasiswa->bank_proof) {
                    $oldPath = str_replace('storage/', '', $mahasiswa->bank_proof);
                    if (Storage::disk('public')->exists($oldPath)) {
                        Storage::disk('public')->delete($oldPath);
                    }
                }

                $filename = time() . '_bank_proof_' . uniqid() . '.' . $request->file('bank_proof')->getClientOriginalExtension();
                $path = $request->file('bank_proof')->storeAs('users', $filename, 'public');
                $mahasiswa->bank_proof = 'storage/' . $path;
            }

            // Handle Bank Proof Upload
            if ($request->hasFile('bank_proof')) {
                // Delete old bank proof if exists
                if ($mahasiswa->bank_proof) {
                    $oldPath = str_replace('storage/', '', $mahasiswa->bank_proof);
                    if (Storage::disk('public')->exists($oldPath)) {
                        Storage::disk('public')->delete($oldPath);
                    }
                }

                $filename = time() . '_bank_proof_' . uniqid() . '.' . $request->file('bank_proof')->getClientOriginalExtension();
                $path = $request->file('bank_proof')->storeAs('users', $filename, 'public');
                $mahasiswa->bank_proof = 'storage/' . $path;
            }

            // Map bank fields to mahasiswa (canonical)
            if ($request->has('bank_name')) $mahasiswa->bank_name = $request->input('bank_name');
            if ($request->has('bank_account_name')) $mahasiswa->bank_account_name = $request->input('bank_account_name');
            if ($request->has('bank_account_number')) $mahasiswa->bank_account_number = $request->input('bank_account_number');
            
            $mahasiswa->save();
        }

        $user->save();

        return $this->getProfile($request);
    }
}

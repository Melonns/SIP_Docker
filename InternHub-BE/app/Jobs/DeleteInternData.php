<?php

namespace App\Jobs;

use App\Models\Evaluation;
use App\Models\InternMentor;
use App\Models\Izin;
use App\Models\KoreksiAbsensi;
use App\Models\Logbook;
use App\Models\TblAbsensi;
use App\Models\TblMahasiswa;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class DeleteInternData implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $userId;
    public ?int $mahasiswaId;

    public function __construct(int $userId, ?int $mahasiswaId)
    {
        $this->userId = $userId;
        $this->mahasiswaId = $mahasiswaId;
    }

    public function handle(): void
    {
        try {
            DB::beginTransaction();

            // 1. Hapus absensi
            TblAbsensi::where('user_id', $this->userId)->delete();
            if ($this->mahasiswaId) {
                TblAbsensi::where('id_mahasiswa', $this->mahasiswaId)->delete();
            }

            // 2. Hapus koreksi absensi
            KoreksiAbsensi::where('user_id', $this->userId)->delete();
            if ($this->mahasiswaId) {
                KoreksiAbsensi::where('id_mahasiswa', $this->mahasiswaId)->delete();
            }

            // 3. Hapus izin / leave requests
            Izin::where('user_id', $this->userId)->delete();
            if ($this->mahasiswaId) {
                Izin::where('id_mahasiswa', $this->mahasiswaId)->delete();
            }

            // 4. Hapus logbook
            Logbook::where('user_id', $this->userId)->delete();
            if ($this->mahasiswaId) {
                Logbook::where('id_mahasiswa', $this->mahasiswaId)->delete();
            }

            // 5. Hapus evaluasi
            Evaluation::where('user_id', $this->userId)->delete();
            if ($this->mahasiswaId) {
                Evaluation::where('intern_mahasiswa_id', $this->mahasiswaId)->delete();
            }

            // 6. Hapus mapping intern-mentor
            InternMentor::where('intern_user_id', $this->userId)->delete();
            if ($this->mahasiswaId) {
                InternMentor::where('intern_id', $this->mahasiswaId)->delete();
            }

            // 7. Hapus tokens Sanctum
            DB::table('personal_access_tokens')
                ->where('tokenable_type', User::class)
                ->where('tokenable_id', $this->userId)
                ->delete();

            // 8. Hapus notifikasi
            DB::table('notifications')
                ->where('notifiable_type', User::class)
                ->where('notifiable_id', $this->userId)
                ->delete();

            // 9. Hapus roles & permissions
            DB::table('role_user')->where('user_id', $this->userId)->delete();
            DB::table('permission_user')->where('user_id', $this->userId)->delete();

            // 10. Hapus file foto dari storage & profile mahasiswa
            if ($this->mahasiswaId) {
                $mahasiswa = TblMahasiswa::withTrashed()->find($this->mahasiswaId);
                if ($mahasiswa) {
                    if ($mahasiswa->foto) {
                        Storage::delete(str_replace('storage/', 'public/', $mahasiswa->foto));
                    }
                    if ($mahasiswa->foto_ktm) {
                        Storage::delete(str_replace('storage/', 'public/', $mahasiswa->foto_ktm));
                    }
                    $mahasiswa->forceDelete();
                }
            }

            // 11. Hapus user (force delete karena SoftDeletes)
            User::withTrashed()->where('user_id', $this->userId)->forceDelete();

            DB::commit();

            Log::info("DeleteInternData: user {$this->userId} (mahasiswa {$this->mahasiswaId}) berhasil dihapus.");
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error("DeleteInternData: gagal hapus user {$this->userId} - " . $e->getMessage(), [
                'exception' => $e,
            ]);
            throw $e;
        }
    }
}

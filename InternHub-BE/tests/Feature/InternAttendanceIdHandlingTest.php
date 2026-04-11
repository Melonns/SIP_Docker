<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\TblMahasiswa;
use App\Models\TblAbsensi;
use Laravel\Sanctum\Sanctum;

class InternAttendanceIdHandlingTest extends TestCase
{
    /** @test */
    public function mentor_can_fetch_attendance_using_id_mahasiswa()
    {
        // Create mentor user and mahasiswa profile + user
        $mentorUser = User::create([
            'nama' => 'Mentor Test',
            'identifier' => 'mentor_' . uniqid(),
            'email' => 'mentor' . uniqid() . '@test.com',
            'password' => bcrypt('password'),
            'status' => 'active',
        ]);
        $mentorRole = \App\Models\Role::firstWhere('name', 'mentor') ?? \App\Models\Role::create(['name' => 'mentor']);
        $mentorUser->roles()->attach($mentorRole->role_id ?? $mentorRole->id ?? 2);

        $internUser = User::create([
            'nama' => 'Intern Test',
            'identifier' => 'intern_' . uniqid(),
            'email' => 'intern' . uniqid() . '@test.com',
            'password' => bcrypt('password'),
            'status' => 'active',
        ]);

        $mahasiswa = TblMahasiswa::create([
            'user_id' => $internUser->user_id,
            'universitas' => 'Universitas Test',
            'jurusan' => 'Teknik',
        ]);

        // Create an attendance row using id_mahasiswa
        $att = TblAbsensi::create([
            'user_id' => $internUser->user_id,
            'id_mahasiswa' => $mahasiswa->id_mahasiswa,
            'tanggal' => now()->toDateString(),
            'status' => 'masuk',
            'waktu' => now()->toTimeString(),
            'latitude_absen' => 0.0,
            'longitude_absen' => 0.0,
        ]);

        Sanctum::actingAs($mentorUser, ['*']);

        $res = $this->getJson("/api/mentor/interns/{$mahasiswa->id_mahasiswa}/attendance");
        $res->assertStatus(200);
        $res->assertJson(['success' => true]);
    }

    /** @test */
    public function mentor_can_fetch_attendance_using_legacy_user_id_as_fallback()
    {
        $mentorUser = User::create([
            'nama' => 'Mentor Test',
            'identifier' => 'mentor_' . uniqid(),
            'email' => 'mentor' . uniqid() . '@test.com',
            'password' => bcrypt('password'),
            'status' => 'active',
        ]);
        $mentorRole = \App\Models\Role::firstWhere('name', 'mentor') ?? \App\Models\Role::create(['name' => 'mentor']);
        $mentorUser->roles()->attach($mentorRole->role_id ?? $mentorRole->id ?? 2);

        $internUser = User::create([
            'nama' => 'Intern Test',
            'identifier' => 'intern_' . uniqid(),
            'email' => 'intern' . uniqid() . '@test.com',
            'password' => bcrypt('password'),
            'status' => 'active',
        ]);

        $mahasiswa = TblMahasiswa::create([
            'user_id' => $internUser->user_id,
            'universitas' => 'Universitas Test',
            'jurusan' => 'Teknik',
        ]);

        $att = TblAbsensi::create([
            'user_id' => $internUser->user_id,
            'id_mahasiswa' => $mahasiswa->id_mahasiswa,
            'tanggal' => now()->toDateString(),
            'status' => 'masuk',
            'waktu' => now()->toTimeString(),
            'latitude_absen' => 0.0,
            'longitude_absen' => 0.0,
        ]);

        Sanctum::actingAs($mentorUser, ['*']);

        // Call using legacy user_id (should still resolve via fallback)
        $res = $this->getJson("/api/mentor/interns/{$internUser->user_id}/attendance");
        $res->assertStatus(200);
        $res->assertJson(['success' => true]);
    }

    /** @test */
    public function rekap_returns_id_mahasiswa_when_profile_exists()
    {
        $adminUser = User::create([
            'nama' => 'Admin Test',
            'identifier' => 'admin_' . uniqid(),
            'email' => 'admin' . uniqid() . '@test.com',
            'password' => bcrypt('password'),
            'status' => 'active',
        ]);
        $adminRole = \App\Models\Role::firstWhere('name', 'admin') ?? \App\Models\Role::create(['name' => 'admin']);
        $adminUser->roles()->attach($adminRole->role_id ?? $adminRole->id ?? 1);

        $internUser = User::create([
            'nama' => 'Intern Rekap',
            'identifier' => 'intern_rekap_' . uniqid(),
            'email' => 'intern_rekap' . uniqid() . '@test.com',
            'password' => bcrypt('password'),
            'status' => 'active',
        ]);

        $mahasiswa = TblMahasiswa::create([
            'user_id' => $internUser->user_id,
            'universitas' => 'Universitas Test',
            'jurusan' => 'Teknik',
        ]);

        // attendance row with id_mahasiswa set
        TblAbsensi::create([
            'user_id' => $internUser->user_id,
            'id_mahasiswa' => $mahasiswa->id_mahasiswa,
            'tanggal' => now()->toDateString(),
            'status' => 'masuk',
            'waktu' => now()->toTimeString(),
            'latitude_absen' => 0.0,
            'longitude_absen' => 0.0,
        ]);

        Sanctum::actingAs($adminUser, ['*']);

        $month = now()->format('n');
        $year = now()->format('Y');
        $res = $this->getJson("/api/admin/absensi/rekap?page=1&per_page=10&month={$month}&year={$year}");
        $res->assertStatus(200);
        $res->assertJson(['success' => true]);

        $json = $res->json();
        $found = collect($json['data'])->firstWhere('user_id', $internUser->user_id);
        $this->assertNotNull($found, 'rekap did not include the intern user row');
        $this->assertEquals($mahasiswa->id_mahasiswa, $found['id_mahasiswa']);
    }
}

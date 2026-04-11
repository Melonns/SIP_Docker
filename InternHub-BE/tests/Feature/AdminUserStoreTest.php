<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Role;
use App\Models\TblMahasiswa;
use Illuminate\Foundation\Testing\RefreshDatabase;

class AdminUserStoreTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test create mahasiswa profile (tanpa user)
     * Endpoint: POST /api/intern-profiles
     */
    public function test_create_mahasiswa_profile_without_user()
    {
        // create a site for required id_site
        $site = \App\Models\TblSite::create([
            'nama_site' => 'Test Site',
            'lokasi' => 'Jakarta',
            'alamat' => 'Jl. Test',
        ]);

        $response = $this->postJson('/api/intern-profiles', [
            'nama' => 'Ahmad Wijaya',
            'universitas' => 'Universitas Indonesia',
            'jurusan' => 'Teknik Informatika',
            'mulai_magang' => '2024-01-01',
            'akhir_magang' => '2024-06-30',
            'tempat_lahir' => 'Jakarta',
            'tanggal_lahir' => '2003-05-15',
            'nik' => '3173101203050001',
            'job_position' => 'Frontend Developer',
            'division' => 'Product',
            'alamat' => 'Jl. Merdeka No. 123, Jakarta',
            'jenjang_pendidikan' => 'S1',
            'gender' => 'L',
            'semester' => 4,
            'nomor_darurat' => '081987654321',
            'nama_kontak_darurat' => 'Ibnu Wijaya',
            'bank_name' => 'Bank Mandiri',
            'bank_account_name' => 'Ahmad Wijaya',
            'bank_account_number' => '1234567890',
            'id_site' => $site->id_site,
        ]);

        $response->assertStatus(201)
                 ->assertJson([
                     'success' => true,
                     'message' => 'Profil mahasiswa berhasil dibuat. Selanjutnya atur di halaman User & Role.',
                 ]);

        // Verify mahasiswa created without user_id
        $this->assertDatabaseHas('students', [
            'universitas' => 'Universitas Indonesia',
            'user_id' => null, // Important: user_id should be null
        ]);
    }

    /**
     * Test create user dari mahasiswa existing (Mode A)
     * Endpoint: POST /api/admin/users (dengan id_mahasiswa)
     */
    public function test_create_user_from_existing_mahasiswa()
    {
        // Setup
        Role::create(['name' => 'intern']);
        Role::create(['name' => 'mentor']);
        Role::create(['name' => 'admin']);

        // Create mahasiswa first
        $mahasiswa = TblMahasiswa::create([
            'universitas' => 'Universitas Indonesia',
            'jurusan' => 'Teknik Informatika',
            'mulai_magang' => '2024-01-01',
            'akhir_magang' => '2024-06-30',
            'job_position' => 'Frontend Developer',
            'division' => 'Product',
        ]);

        // Authenticate as admin
        $adminUser = User::create([
            'nama' => 'Admin',
            'identifier' => 'admin' . uniqid(),
            'email' => 'admin' . uniqid() . '@test.com',
            'password' => bcrypt('password'),
            'status' => 'active',
        ]);
        $adminRole = Role::where('name', 'admin')->first();
        if ($adminRole) $adminUser->roles()->attach($adminRole->role_id);

        // Now create user from mahasiswa
        $response = $this->actingAs($adminUser, 'sanctum')->postJson('/api/admin/users', [
            'id_mahasiswa' => $mahasiswa->id_mahasiswa,
            'identifier' => '20240001',
            'email' => 'ahmad@student.univ.ac.id',
            'nama' => 'Ahmad Wijaya',
            'roles' => ['intern'],
            'no_telp' => '081234567890',
            'status' => 'active',
        ]);

        $response->assertStatus(201)
                 ->assertJson([
                     'success' => true,
                     'message' => 'User berhasil dibuat dari profil mahasiswa. Email dengan password telah dikirim.',
                 ]);

        // Verify user created
        $user = User::where('identifier', '20240001')->first();
        $this->assertNotNull($user);
        $this->assertEquals('ahmad@student.univ.ac.id', $user->email);

        // Verify mahasiswa now has user_id
        $updatedMahasiswa = TblMahasiswa::find($mahasiswa->id_mahasiswa);
        $this->assertEquals($user->user_id, $updatedMahasiswa->user_id);

        // Verify role assigned
        $this->assertTrue($user->roles()->where('name', 'intern')->exists());
    }

    /**
     * Test create user dengan multiple roles (Mode A)
     */
    public function test_create_user_with_multiple_roles()
    {
        Role::create(['name' => 'intern']);
        Role::create(['name' => 'mentor']);
        Role::create(['name' => 'admin']);

        $mahasiswa = TblMahasiswa::create([
            'universitas' => 'Universitas Indonesia',
            'jurusan' => 'Teknik Informatika',
        ]);

        $adminUser = User::create([
            'nama' => 'Admin',
            'identifier' => 'admin' . uniqid(),
            'email' => 'admin' . uniqid() . '@test.com',
            'password' => bcrypt('password'),
            'status' => 'active',
        ]);
        $adminRole = Role::where('name', 'admin')->first();
        if ($adminRole) $adminUser->roles()->attach($adminRole->role_id);

        $response = $this->actingAs($adminUser, 'sanctum')->postJson('/api/admin/users', [
            'id_mahasiswa' => $mahasiswa->id_mahasiswa,
            'identifier' => '20240001',
            'email' => 'ahmad@student.univ.ac.id',
            'nama' => 'Ahmad Wijaya',
            'roles' => ['intern', 'mentor'],
        ]);

        $response->assertStatus(201);

        $user = User::where('identifier', '20240001')->first();
        $this->assertTrue($user->roles()->where('name', 'intern')->exists());
        $this->assertTrue($user->roles()->where('name', 'mentor')->exists());
    }

    /**
     * Test create user + mahasiswa sekaligus (Mode B - Legacy)
     * Endpoint: POST /api/admin/users (tanpa id_mahasiswa, dengan role singular)
     */
    public function test_create_user_with_new_mahasiswa()
    {
        Role::create(['name' => 'intern']);
        Role::create(['name' => 'mentor']);
        Role::create(['name' => 'admin']);

        $adminUser = User::create([
            'nama' => 'Admin',
            'identifier' => 'admin' . uniqid(),
            'email' => 'admin' . uniqid() . '@test.com',
            'password' => bcrypt('password'),
            'status' => 'active',
        ]);
        $adminRole = Role::where('name', 'admin')->first();
        if ($adminRole) $adminUser->roles()->attach($adminRole->role_id);

        $response = $this->actingAs($adminUser, 'sanctum')->postJson('/api/admin/users', [
            'nama' => 'Ahmad Wijaya',
            'identifier' => '20240001',
            'email' => 'ahmad@student.univ.ac.id',
            'role' => 'intern',
            'no_telp' => '081234567890',
            'status' => 'active',
            'universitas' => 'Universitas Indonesia',
            'jurusan' => 'Teknik Informatika',
            'mulai_magang' => '2024-01-01',
            'akhir_magang' => '2024-06-30',
        ]);

        $response->assertStatus(201)
                 ->assertJson([
                     'success' => true,
                     'message' => 'User berhasil dibuat. Email dengan password telah dikirim.',
                 ]);

        $user = User::where('identifier', '20240001')->first();
        $this->assertNotNull($user->mahasiswa);
        $this->assertEquals('Universitas Indonesia', $user->mahasiswa->universitas);
    }

    /**
     * Test create mentor without mahasiswa (Mode B - Legacy)
     */
    public function test_create_mentor_without_mahasiswa()
    {
        Role::create(['name' => 'mentor']);
        Role::create(['name' => 'intern']);
        Role::create(['name' => 'admin']);

        $response = $this->postJson('/api/admin/users', [
            'nama' => 'Dr. Budi Santoso',
            'identifier' => '198705151',
            'email' => 'budi.santoso@company.com',
            'role' => 'mentor',
            'no_telp' => '081234567890',
            'status' => 'active',
        ]);

        $response->assertStatus(201);

        $user = User::where('identifier', '198705151')->first();
        $this->assertNull($user->mahasiswa);
        $this->assertTrue($user->roles()->where('name', 'mentor')->exists());
    }

    /**
     * Test error: Mahasiswa sudah punya user
     */
    public function test_cannot_assign_user_to_mahasiswa_with_existing_user()
    {
        Role::create(['name' => 'intern']);

        // Create user + mahasiswa
        $user = User::create([
            'nama' => 'Existing User',
            'identifier' => '20240000',
            'email' => 'existing@email.com',
            'password' => bcrypt('password'),
            'username' => '20240000',
        ]);

        $mahasiswa = TblMahasiswa::create([
            'universitas' => 'UI',
            'user_id' => $user->user_id, // Already has user
        ]);

        $adminUser = User::create([
            'nama' => 'Admin',
            'identifier' => 'admin' . uniqid(),
            'email' => 'admin' . uniqid() . '@test.com',
            'password' => bcrypt('password'),
            'status' => 'active',
        ]);
        $adminRole = Role::where('name', 'admin')->first();
        if ($adminRole) $adminUser->roles()->attach($adminRole->role_id);

        $response = $this->actingAs($adminUser, 'sanctum')->postJson('/api/admin/users', [
            'id_mahasiswa' => $mahasiswa->id_mahasiswa,
            'identifier' => '20240001',
            'email' => 'newuser@email.com',
            'nama' => 'New User',
            'roles' => ['intern'],
        ]);

        $response->assertStatus(400)
                 ->assertJson([
                     'success' => false,
                     'message' => 'Mahasiswa ini sudah memiliki akun user'
                 ]);
    }

    /**
     * Test validation - email harus unik
     */
    public function test_cannot_create_user_with_duplicate_email()
    {
        Role::create(['name' => 'intern']);
        
        User::create([
            'nama' => 'Existing User',
            'identifier' => '20240000',
            'email' => 'existing@email.com',
            'password' => bcrypt('password'),
            'username' => '20240000',
        ]);

        $mahasiswa = TblMahasiswa::create(['universitas' => 'UI']);

        $adminUser = User::create([
            'nama' => 'Admin',
            'identifier' => 'admin' . uniqid(),
            'email' => 'admin' . uniqid() . '@test.com',
            'password' => bcrypt('password'),
            'status' => 'active',
        ]);
        $adminRole = Role::where('name', 'admin')->first();
        if ($adminRole) $adminUser->roles()->attach($adminRole->role_id);

        $response = $this->actingAs($adminUser, 'sanctum')->postJson('/api/admin/users', [
            'id_mahasiswa' => $mahasiswa->id_mahasiswa,
            'identifier' => '20240002',
            'email' => 'existing@email.com', // Duplicate
            'nama' => 'New User',
            'roles' => ['intern'],
        ]);

        $response->assertStatus(422)
                 ->assertJsonValidationErrors('email');
    }

    /**
     * Test validation - identifier harus unik
     */
    public function test_cannot_create_user_with_duplicate_identifier()
    {
        Role::create(['name' => 'intern']);
        
        User::create([
            'nama' => 'Existing User',
            'identifier' => '20240000',
            'email' => 'existing@email.com',
            'password' => bcrypt('password'),
            'username' => '20240000',
        ]);

        $mahasiswa = TblMahasiswa::create(['universitas' => 'UI']);

        $adminUser = User::create([
            'nama' => 'Admin',
            'identifier' => 'admin' . uniqid(),
            'email' => 'admin' . uniqid() . '@test.com',
            'password' => bcrypt('password'),
            'status' => 'active',
        ]);
        $adminRole = Role::where('name', 'admin')->first();
        if ($adminRole) $adminUser->roles()->attach($adminRole->role_id);

        $response = $this->actingAs($adminUser, 'sanctum')->postJson('/api/admin/users', [
            'id_mahasiswa' => $mahasiswa->id_mahasiswa,
            'identifier' => '20240000', // Duplicate
            'email' => 'newuser@email.com',
            'nama' => 'New User',
            'roles' => ['intern'],
        ]);

        $response->assertStatus(422)
                 ->assertJsonValidationErrors('identifier');
    }

    /**
     * Test validation - roles array wajib diisi (Mode A)
     */
    public function test_roles_required_for_mode_a()
    {
        Role::create(['name' => 'intern']);

        $mahasiswa = TblMahasiswa::create(['universitas' => 'UI']);

        $adminUser = User::create([
            'nama' => 'Admin',
            'identifier' => 'admin' . uniqid(),
            'email' => 'admin' . uniqid() . '@test.com',
            'password' => bcrypt('password'),
            'status' => 'active',
        ]);
        $adminRole = Role::where('name', 'admin')->first();
        if ($adminRole) $adminUser->roles()->attach($adminRole->role_id);

        $response = $this->actingAs($adminUser, 'sanctum')->postJson('/api/admin/users', [
            'id_mahasiswa' => $mahasiswa->id_mahasiswa,
            'identifier' => '20240001',
            'email' => 'user@email.com',
            'nama' => 'User Name',
            'roles' => [], // Empty roles array
        ]);

        $response->assertStatus(422);
    }
}

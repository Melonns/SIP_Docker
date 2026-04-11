<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Role;
use App\Models\TblMahasiswa;
use App\Models\TblSite;
use Illuminate\Foundation\Testing\RefreshDatabase;

class AdminUserAssignRoleTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Helper method to create an authenticated admin user
     */
    protected function createAuthenticatedAdmin()
    {
        return User::create([
            'nama' => 'Admin User',
            'identifier' => 'admin' . uniqid(),
            'email' => 'admin' . uniqid() . '@test.com',
            'username' => 'admin' . uniqid(),
            'password' => bcrypt('password'),
            'status' => 'active',
        ]);
    }

    /**
     * Helper method to create mahasiswa with all required fields
     */
    protected function createMahasiswa(array $overrides = [])
    {
        // Create a site first if id_site is not provided
        if (!isset($overrides['id_site'])) {
            $site = TblSite::create([
                'nama_site' => 'Test Site ' . uniqid(),
                'lokasi' => 'Jakarta',
                'alamat' => 'Jl. Test',
            ]);
            $overrides['id_site'] = $site->id_site;
        }

        $defaults = [
            'nama' => 'Ahmad Wijaya',
            'universitas' => 'Universitas Indonesia',
            'jurusan' => 'Teknik Informatika',
            'nim' => '20240001',
            'id_site' => $overrides['id_site'],
            'mulai_magang' => '2024-01-01',
            'akhir_magang' => '2024-06-30',
            'job_position' => 'Frontend Developer',
            'division' => 'Product',
            'alamat' => 'Jl. Merdeka No. 123',
            'no_telp' => '081987654321',
        ];

        return TblMahasiswa::create(array_merge($defaults, $overrides));
    }

    /**
     * Test create mahasiswa profile (tanpa user)
     * Endpoint: POST /api/intern-profiles
     */
    public function test_create_mahasiswa_profile_without_user()
    {
        $admin = $this->createAuthenticatedAdmin();

        // Create site for intern-profiles endpoint
        $site = TblSite::create([
            'nama_site' => 'Test Site',
            'lokasi' => 'Jakarta',
            'alamat' => 'Jl. Test',
        ]);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/intern-profiles', [
            'nama' => 'Ahmad Wijaya',
            'universitas' => 'Universitas Indonesia',
            'jurusan' => 'Teknik Informatika',
            'nim' => '20240001',
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
            'user_id' => null,
        ]);
    }

    /**
     * Test assign role to mahasiswa (creates user automatically)
     * Endpoint: POST /api/admin/users
     * Input: id_mahasiswa + roles + identifier + email
     */
    public function test_assign_role_to_mahasiswa_creates_user()
    {
        $admin = $this->createAuthenticatedAdmin();

        Role::create(['name' => 'intern']);
        Role::create(['name' => 'mentor']);
        Role::create(['name' => 'admin']);

        // Create mahasiswa first (without user)
        $mahasiswa = $this->createMahasiswa();

        // Assign role to mahasiswa (this creates user + sends email)
        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/users', [
            'id_mahasiswa' => $mahasiswa->id_mahasiswa,
            'identifier' => '20240001',
            'email' => 'ahmad@student.univ.ac.id',
            'roles' => ['intern'],
        ]);

        $response->assertStatus(201)
                 ->assertJson([
                     'success' => true,
                     'message' => 'User berhasil dibuat dan role di-assign. Password telah dikirim ke email.',
                 ]);

        // Verify user created
        $user = User::where('identifier', '20240001')->first();
        $this->assertNotNull($user);
        $this->assertEquals('ahmad@student.univ.ac.id', $user->email);
        $this->assertEquals('Ahmad Wijaya', $user->nama);

        // Verify mahasiswa now has user_id
        $updatedMahasiswa = TblMahasiswa::find($mahasiswa->id_mahasiswa);
        $this->assertEquals($user->user_id, $updatedMahasiswa->user_id);

        // Verify role assigned
        $this->assertTrue($user->roles()->where('name', 'intern')->exists());
    }

    /**
     * Test assign multiple roles to mahasiswa
     */
    public function test_assign_multiple_roles_to_mahasiswa()
    {
        $admin = $this->createAuthenticatedAdmin();

        Role::create(['name' => 'intern']);
        Role::create(['name' => 'mentor']);
        Role::create(['name' => 'admin']);

        $mahasiswa = $this->createMahasiswa(['nim' => '20240002']);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/users', [
            'id_mahasiswa' => $mahasiswa->id_mahasiswa,
            'identifier' => '20240002',
            'email' => 'ahmad2@student.univ.ac.id',
            'roles' => ['intern', 'mentor'],
        ]);

        $response->assertStatus(201);

        $user = User::where('identifier', '20240002')->first();
        $this->assertTrue($user->roles()->where('name', 'intern')->exists());
        $this->assertTrue($user->roles()->where('name', 'mentor')->exists());
    }

    /**
     * Test error: Mahasiswa sudah punya user
     */
    public function test_cannot_assign_role_to_mahasiswa_with_existing_user()
    {
        $admin = $this->createAuthenticatedAdmin();

        Role::create(['name' => 'intern']);

        // Create user
        $user = User::create([
            'nama' => 'Existing User',
            'identifier' => '20240000',
            'email' => 'existing@email.com',
            'password' => bcrypt('password'),
            'username' => '20240000',
        ]);

        // Create mahasiswa with user_id
        $mahasiswa = $this->createMahasiswa(['user_id' => $user->user_id, 'nim' => '20240000']);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/users', [
            'id_mahasiswa' => $mahasiswa->id_mahasiswa,
            'identifier' => '20240003',
            'email' => 'newuser@email.com',
            'roles' => ['intern'],
        ]);

        $response->assertStatus(400)
                 ->assertJson([
                     'success' => false,
                     'message' => 'Mahasiswa ini sudah memiliki akun user'
                 ]);
    }

    /**
     * Test error: Identifier required
     */
    public function test_identifier_required_to_assign_role()
    {
        $admin = $this->createAuthenticatedAdmin();

        Role::create(['name' => 'intern']);

        $mahasiswa = $this->createMahasiswa(['nim' => '20240004']);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/users', [
            'id_mahasiswa' => $mahasiswa->id_mahasiswa,
            'email' => 'ahmad@email.com',
            'roles' => ['intern'],
        ]);

        $response->assertStatus(422);
    }

    /**
     * Test error: Email required
     */
    public function test_email_required_to_assign_role()
    {
        $admin = $this->createAuthenticatedAdmin();

        Role::create(['name' => 'intern']);

        $mahasiswa = $this->createMahasiswa(['nim' => '20240005']);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/users', [
            'id_mahasiswa' => $mahasiswa->id_mahasiswa,
            'identifier' => '20240005',
            'roles' => ['intern'],
        ]);

        $response->assertStatus(422);
    }

    /**
     * Test validation: Identifier must be unique
     */
    public function test_identifier_must_be_unique()
    {
        $admin = $this->createAuthenticatedAdmin();

        Role::create(['name' => 'intern']);
        
        User::create([
            'nama' => 'Existing User',
            'identifier' => '20240000',
            'email' => 'existing@email.com',
            'password' => bcrypt('password'),
            'username' => '20240000',
        ]);

        $mahasiswa = $this->createMahasiswa(['nim' => '20240006']);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/users', [
            'id_mahasiswa' => $mahasiswa->id_mahasiswa,
            'identifier' => '20240000',
            'email' => 'newuser@email.com',
            'roles' => ['intern'],
        ]);

        $response->assertStatus(422)
                 ->assertJsonValidationErrors('identifier');
    }

    /**
     * Test validation: Email must be unique
     */
    public function test_email_must_be_unique()
    {
        $admin = $this->createAuthenticatedAdmin();

        Role::create(['name' => 'intern']);
        
        User::create([
            'nama' => 'Existing User',
            'identifier' => '20240000',
            'email' => 'existing@email.com',
            'password' => bcrypt('password'),
            'username' => '20240000',
        ]);

        $mahasiswa = $this->createMahasiswa(['nim' => '20240007']);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/users', [
            'id_mahasiswa' => $mahasiswa->id_mahasiswa,
            'identifier' => '20240007',
            'email' => 'existing@email.com',
            'roles' => ['intern'],
        ]);

        $response->assertStatus(422)
                 ->assertJsonValidationErrors('email');
    }

    /**
     * Test validation: Roles array required and not empty
     */
    public function test_roles_required_and_not_empty()
    {
        $admin = $this->createAuthenticatedAdmin();

        Role::create(['name' => 'intern']);

        $mahasiswa = $this->createMahasiswa(['nim' => '20240008']);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/users', [
            'id_mahasiswa' => $mahasiswa->id_mahasiswa,
            'identifier' => '20240008',
            'email' => 'ahmad@email.com',
            'roles' => [],
        ]);

        $response->assertStatus(422)
                 ->assertJsonValidationErrors('roles');
    }
}

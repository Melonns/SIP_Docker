<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\User;
use App\Models\Role;
use App\Models\TblMahasiswa;
use App\Models\InternMentor;

class MultiRoleContextTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Setup Roles
        Role::create(['name' => 'admin', 'label' => 'Admin']);
        Role::create(['name' => 'mentor', 'label' => 'Mentor']);
        Role::create(['name' => 'intern', 'label' => 'Intern']);
    }

    public function test_multi_role_user_mentor_context_filters_universities()
    {
        // 1. Create a multi-role user (Admin + Mentor)
        $multiRoleUser = User::factory()->create([
            'nama' => 'Multi Role User',
            'username' => 'multirole',
        ]);
        $multiRoleUser->roles()->attach(Role::whereIn('name', ['admin', 'mentor'])->pluck('role_id'));

        // 2. Create another mentor
        $otherMentor = User::factory()->create(['nama' => 'Other Mentor']);
        $otherMentor->roles()->attach(Role::where('name', 'mentor')->first()->role_id);

        // 3. Create interns with different universities
        $intern1 = User::factory()->create(['nama' => 'Intern 1']);
        $intern1->roles()->attach(Role::where('name', 'intern')->first()->role_id);
        TblMahasiswa::create([
            'user_id' => $intern1->user_id,
            'nama' => 'Intern 1',
            'universitas' => 'University A',
            'nim' => '101'
        ]);

        $intern2 = User::factory()->create(['nama' => 'Intern 2']);
        $intern2->roles()->attach(Role::where('name', 'intern')->first()->role_id);
        TblMahasiswa::create([
            'user_id' => $intern2->user_id,
            'nama' => 'Intern 2',
            'universitas' => 'University B',
            'nim' => '102'
        ]);

        // 4. Assign intern1 to multiRoleUser, intern2 to otherMentor
        InternMentor::create([
            'mentor_user_id' => $multiRoleUser->user_id,
            'intern_id' => $intern1->mahasiswa->id_mahasiswa,
            'is_active' => true,
            'assigned_date' => now(),
        ]);

        InternMentor::create([
            'mentor_user_id' => $otherMentor->user_id,
            'intern_id' => $intern2->mahasiswa->id_mahasiswa,
            'is_active' => true,
            'assigned_date' => now(),
        ]);

        // --- VERIFICATION ---

        $this->actingAs($multiRoleUser, 'sanctum');

        // A. Call as Admin (defaults to ALL if not api/mentor/*)
        // Note: UserController::getAvailableUniv is usually called via api/mentor/universitas or api/admin/universitas
        $response = $this->getJson('/api/admin/universitas');
        $response->assertStatus(200);
        $this->assertCount(2, $response->json('data'), 'Admin context should see all universities');

        // B. Call via Mentor Route (prefix api/mentor/*)
        // Should be filtered to only University A
        $response = $this->getJson('/api/mentor/universitas');
        $response->assertStatus(200);
        $this->assertCount(1, $response->json('data'), 'Mentor route prefix should filter universities');
        $this->assertEquals('University A', $response->json('data.0'));

        // C. Call as Admin but with active_role=mentor
        // Should be filtered to only University A
        $response = $this->getJson('/api/admin/universitas?active_role=mentor');
        $response->assertStatus(200);
        $this->assertCount(1, $response->json('data'), 'active_role=mentor should filter universities even on admin route');
        $this->assertEquals('University A', $response->json('data.0'));
        
        // D. Call as Admin with active_role=admin
        $response = $this->getJson('/api/mentor/universitas?active_role=admin');
        $response->assertStatus(200);
        $this->assertCount(2, $response->json('data'), 'active_role=admin should show all even on mentor route');
    }
}

<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Role;
use App\Models\Logbook;
use App\Models\TblMahasiswa;
use App\Models\Tag;
use App\Notifications\GeneralNotification;
use Carbon\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Notification;
use Illuminate\Foundation\Testing\RefreshDatabase;

class LogbookControllerStoreTest extends TestCase
{
    use RefreshDatabase;

    protected User $intern;
    protected User $mentor;
    protected TblMahasiswa $mahasiswa;
    protected Tag $tag;

    /**
     * Setup: Create test data for each test
     */
    public function setUp(): void
    {
        parent::setUp();

        // Create roles
        Role::create(['name' => 'intern']);
        Role::create(['name' => 'mentor']);
        Role::create(['name' => 'admin']);

        // Create mahasiswa profile
        $this->mahasiswa = TblMahasiswa::create([
            'universitas' => 'Test University',
            'jurusan' => 'Teknik Informatika',
            'mulai_magang' => Carbon::now()->subMonths(1)->toDateString(),
            'akhir_magang' => Carbon::now()->addMonths(5)->toDateString(),
        ]);

        // Create intern user
        $this->intern = User::create([
            'nama' => 'Intern Test',
            'email' => 'intern@test.com',
            'password' => bcrypt('password'),
        ]);
        $this->intern->roles()->attach(Role::where('name', 'intern')->first());
        
        // Link mahasiswa to intern user
        $this->mahasiswa->user_id = $this->intern->user_id;
        $this->mahasiswa->save();

        // Create mentor user
        $this->mentor = User::create([
            'nama' => 'Mentor Test',
            'email' => 'mentor@test.com',
            'password' => bcrypt('password'),
        ]);
        $this->mentor->roles()->attach(Role::where('name', 'mentor')->first());

        // Link intern to mentor
        $this->intern->mentors()->attach($this->mentor, ['is_active' => true, 'assigned_date' => Carbon::now()]);

        // Create tag
        $this->tag = Tag::create(['nama' => 'Test Tag']);
    }

    /**
     * Test 1: Empty payload → expect 422 validation error
     * Scenario: POST /api/logbook dengan data kosong
     */
    public function test_store_empty_payload_returns_422_validation_error()
    {
        $response = $this->actingAs($this->intern)
            ->postJson('/api/logbook', []);

        $response->assertStatus(422)
                 ->assertJsonStructure(['errors']);

        // Verify logbook not created
        $this->assertCount(0, Logbook::all());
    }

    /**
     * Test 2: Submit when logbook exists with status 'pending' → expect 400 locked
     * Scenario: Logbook untuk tanggal yang sama sudah ada dengan status pending
     */
    public function test_store_duplicate_with_pending_status_returns_400_locked()
    {
        // Create existing logbook with 'pending' status
        $date = Carbon::now()->toDateString();
        Logbook::create([
            'user_id' => $this->intern->user_id,
            'id_mahasiswa' => $this->mahasiswa->id_mahasiswa,
            'tanggal' => $date,
            'deskripsi_kegiatan' => 'Existing logbook',
            'status_verifikasi' => 'pending',
            'submitted_at' => Carbon::now(),
        ]);

        // Try to submit another logbook for the same date
        $response = $this->actingAs($this->intern)
            ->postJson('/api/logbook', [
                'tanggal' => $date,
                'deskripsi_kegiatan' => 'New logbook attempt',
                'is_draft' => false,
            ]);

        $response->assertStatus(400)
                 ->assertJson(['success' => false])
                 ->assertJsonStructure(['existing_logbooks']);

        // Verify only 1 logbook exists
        $this->assertCount(1, Logbook::all());
    }

    /**
     * Test 3: Update logbook (status 'revision_needed') with is_draft=true 
     * → expect 200, NO notification
     * Scenario: Logbook dengan status revision_needed diubah menjadi draft
     */
    public function test_store_update_revision_needed_as_draft_returns_200_no_notification()
    {
        Notification::fake();
        Storage::fake('public');

        // Create existing logbook with 'revision_needed' status
        $date = Carbon::now()->toDateString();
        $existingLogbook = Logbook::create([
            'user_id' => $this->intern->user_id,
            'id_mahasiswa' => $this->mahasiswa->id_mahasiswa,
            'tanggal' => $date,
            'deskripsi_kegiatan' => 'Original logbook',
            'status_verifikasi' => 'revision_needed',
            'feedback' => 'Please revise',
            'revision_at' => Carbon::now(),
        ]);

        // Submit same date with is_draft=true (update as draft)
        $response = $this->actingAs($this->intern)
            ->postJson('/api/logbook', [
                'tanggal' => $date,
                'deskripsi_kegiatan' => 'Updated content as draft',
                'is_draft' => true,
                'tag_id' => $this->tag->id,
            ]);

        $response->assertStatus(200)
                 ->assertJson(['success' => true])
                 ->assertJsonPath('message', 'Logbook berhasil disimpan sebagai draft');

        // Verify logbook updated (still only 1 record)
        $this->assertCount(1, Logbook::all());

        // Verify status changed to 'draft'
        $this->assertDatabaseHas('logbooks', [
            'id_logbooks' => $existingLogbook->id_logbooks,
            'status_verifikasi' => 'draft',
            'deskripsi_kegiatan' => 'Updated content as draft',
            'submitted_at' => null, // Draft should not have submitted_at
        ]);

        // Verify NO notification sent
        Notification::assertNothingSent();
    }

    /**
     * Test 4: Update logbook (status 'revision_needed') with is_draft=false
     * → expect 200, notification SENT
     * Scenario: Logbook dengan status revision_needed di-update dan di-submit kembali
     */
    public function test_store_update_revision_needed_and_submit_returns_200_with_notification()
    {
        Notification::fake();
        Storage::fake('public');

        // Create existing logbook with 'revision_needed' status
        $date = Carbon::now()->toDateString();
        $existingLogbook = Logbook::create([
            'user_id' => $this->intern->user_id,
            'id_mahasiswa' => $this->mahasiswa->id_mahasiswa,
            'tanggal' => $date,
            'deskripsi_kegiatan' => 'Original logbook',
            'status_verifikasi' => 'revision_needed',
            'feedback' => 'Please revise',
            'revision_at' => Carbon::now(),
        ]);

        // Submit same date with is_draft=false (update and resubmit)
        $response = $this->actingAs($this->intern)
            ->postJson('/api/logbook', [
                'tanggal' => $date,
                'deskripsi_kegiatan' => 'Revised content - resubmitting',
                'is_draft' => false,
                'tag_id' => $this->tag->id,
            ]);

        $response->assertStatus(200)
                 ->assertJson(['success' => true])
                 ->assertJsonPath('message', 'Logbook berhasil diajukan ulang');

        // Verify logbook updated
        $this->assertDatabaseHas('logbooks', [
            'id_logbooks' => $existingLogbook->id_logbooks,
            'status_verifikasi' => 'pending',
            'deskripsi_kegiatan' => 'Revised content - resubmitting',
            'feedback' => null, // Feedback cleared when resubmitting
        ]);

        // Verify status is 'pending' (not draft)
        $updatedLogbook = Logbook::find($existingLogbook->id_logbooks);
        $this->assertEquals('pending', $updatedLogbook->status_verifikasi);

        // Verify notification WAS sent to mentors
        Notification::assertSentTo(
            [$this->mentor],
            GeneralNotification::class
        );
    }

    /**
     * Test 5: Create new logbook with is_draft=true
     * → expect 201, NO notification
     * Scenario: Logbook baru di tanggal kosong, disimpan sebagai draft
     */
    public function test_store_create_new_logbook_as_draft_returns_201_no_notification()
    {
        Notification::fake();
        Storage::fake('public');

        $newDate = Carbon::now()->subDays(1)->toDateString();

        $response = $this->actingAs($this->intern)
            ->postJson('/api/logbook', [
                'tanggal' => $newDate,
                'deskripsi_kegiatan' => 'New draft logbook entry',
                'is_draft' => true,
                'tag_id' => $this->tag->id,
            ]);

        $response->assertStatus(201)
                 ->assertJson(['success' => true])
                 ->assertJsonPath('message', 'Logbook berhasil disimpan sebagai draft');

        // Verify logbook created
        $this->assertCount(1, Logbook::all());
        $this->assertDatabaseHas('logbooks', [
            'user_id' => $this->intern->user_id,
            'id_mahasiswa' => $this->mahasiswa->id_mahasiswa,
            'tanggal' => $newDate,
            'deskripsi_kegiatan' => 'New draft logbook entry',
            'status_verifikasi' => 'draft',
            'submitted_at' => null, // Draft should not have submitted_at
        ]);

        // Verify NO notification sent
        Notification::assertNothingSent();
    }

    /**
     * Test 6: Create new logbook with is_draft=false
     * → expect 201, notification SENT
     * Scenario: Logbook baru di tanggal kosong, langsung di-submit (tidak draft)
     */
    public function test_store_create_new_logbook_and_submit_returns_201_with_notification()
    {
        Notification::fake();
        Storage::fake('public');

        $newDate = Carbon::now()->subDays(2)->toDateString();

        $response = $this->actingAs($this->intern)
            ->postJson('/api/logbook', [
                'tanggal' => $newDate,
                'deskripsi_kegiatan' => 'New logbook submitted for review',
                'is_draft' => false,
                'tag_id' => $this->tag->id,
            ]);

        $response->assertStatus(201)
                 ->assertJson(['success' => true])
                 ->assertJsonPath('message', 'Logbook berhasil diajukan');

        // Verify logbook created
        $this->assertCount(1, Logbook::all());
        $this->assertDatabaseHas('logbooks', [
            'user_id' => $this->intern->user_id,
            'id_mahasiswa' => $this->mahasiswa->id_mahasiswa,
            'tanggal' => $newDate,
            'deskripsi_kegiatan' => 'New logbook submitted for review',
            'status_verifikasi' => 'pending',
        ]);

        // Verify submitted_at timestamp was set
        $logbook = Logbook::where('tanggal', $newDate)->first();
        $this->assertNotNull($logbook->submitted_at);

        // Verify notification WAS sent to mentors
        Notification::assertSentTo(
            [$this->mentor],
            GeneralNotification::class
        );
    }
}

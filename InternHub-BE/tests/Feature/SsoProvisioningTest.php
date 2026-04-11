<?php

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\TblKaryawan;
use App\Models\User;
use App\Models\Role;

uses(RefreshDatabase::class);

it('creates a user and links to employee on first-time SSO login', function () {
    // arrange: have an employee record without a linked user
    $nip = '900001';

    $k = TblKaryawan::create([
        'user_id' => null,
        'nip' => $nip,
        'nama' => 'Test Karyawan',
        'email' => 'test.karyawan@example.test',
        'status' => 'active',
    ]);

    // fake SSO response (controller only checks status)
    $ssoUrl = config('services.sso.login_url', env('SSO_LOGIN_URL'));
    Http::fake([
        $ssoUrl => Http::response(['ok' => true], 200),
    ]);

    // act: call login endpoint using usercode (NIP)
    $response = $this->postJson('/api/login', [
        'usercode' => $nip,
        'password' => 'irrelevant',
    ]);

    // assert: success + token
    $response->assertStatus(200)->assertJsonStructure(['success','token','user']);

    // user record created and linked
    $user = User::where('nama', 'Test Karyawan')->first();
    expect($user)->not->toBeNull();

    $kFresh = $k->fresh();
    expect($kFresh->user_id)->toBe($user->user_id);

    // role mentor attached
    $mentorRole = Role::where('name', 'mentor')->first();
    expect($mentorRole)->not->toBeNull();
    expect($user->roles()->where('role_id', $mentorRole->role_id)->exists())->toBeTrue();
});

it('sync:employees creates employees only and does not create users', function () {
    // fake SIER payload
    $payload = [
        [
            'usercode' => '88888',
            'empname' => 'Synced Employee',
            'email' => 'sync.emp@example.test',
            'divisionname' => 'Engineering',
        ],
    ];

    $ssoApi = env('SSO_API_URL') . '/api/user/v1/employee';

    Http::fake([
        $ssoApi => Http::response(['data' => $payload], 200),
    ]);

    // run command
    $this->artisan('sync:employees')->assertExitCode(0);

    // employee created
    $k = TblKaryawan::where('nip', '88888')->first();
    expect($k)->not->toBeNull();

    // user_id must be NULL because sync should not create users
    expect($k->user_id)->toBeNull();

    // no user exists linked to that employee
    $userExist = User::whereHas('karyawan', function ($q) {
        $q->where('nip', '88888');
    })->exists();
    expect($userExist)->toBeFalse();
});

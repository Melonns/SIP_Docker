<?php

use Illuminate\Support\Facades\Broadcast;

/*
|--------------------------------------------------------------------------
| Broadcast Channels
|--------------------------------------------------------------------------
|
| Here you may register all of the event broadcasting channels that your
| application supports. The given channel authorization callbacks are
| used to check if an authenticated user can listen to the channel.
|
*/

Broadcast::channel('App.Models.Mahasiswa.{id}', function ($user, $id) {
    return $user->isIntern() && (int) $user->mahasiswa?->id_mahasiswa === (int) $id;
});

Broadcast::channel('App.Models.Karyawan.{id}', function ($user, $id) {
    return ($user->isMentor() || $user->isAdmin()) && (int) $user->karyawan?->id_karyawan === (int) $id;
});

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->user_id === (int) $id;
});

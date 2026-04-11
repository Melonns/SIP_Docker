<?php

// @formatter:off
// phpcs:ignoreFile
/**
 * A helper file for your Eloquent Models
 * Copy the phpDocs from this file to the correct Model,
 * And remove them from this file, to prevent double declarations.
 *
 * @author Barry vd. Heuvel <barryvdh@gmail.com>
 */


namespace App\Models{
/**
 * @property int $id_absensi
 * @property int $id_mahasiswa
 * @property int $status
 * @property string $waktu
 * @property string $tanggal
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\TblMahasiswa $mahasiswa
 * @method static \Illuminate\Database\Eloquent\Builder|TblAbsensi newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|TblAbsensi newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|TblAbsensi query()
 * @method static \Illuminate\Database\Eloquent\Builder|TblAbsensi whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblAbsensi whereIdAbsensi($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblAbsensi whereIdMahasiswa($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblAbsensi whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblAbsensi whereTanggal($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblAbsensi whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblAbsensi whereWaktu($value)
 */
	class TblAbsensi extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id_admin
 * @property string $nama
 * @property string $nip
 * @property string $email
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @method static \Illuminate\Database\Eloquent\Builder|TblAdmin newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|TblAdmin newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|TblAdmin query()
 * @method static \Illuminate\Database\Eloquent\Builder|TblAdmin whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblAdmin whereEmail($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblAdmin whereIdAdmin($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblAdmin whereNama($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblAdmin whereNip($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblAdmin whereUpdatedAt($value)
 */
	class TblAdmin extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id_alasan
 * @property int $id_mahasiswa
 * @property string $alasan
 * @property string $tanggal
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\TblMahasiswa $mahasiswa
 * @method static \Illuminate\Database\Eloquent\Builder|TblAlasan newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|TblAlasan newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|TblAlasan query()
 * @method static \Illuminate\Database\Eloquent\Builder|TblAlasan whereAlasan($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblAlasan whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblAlasan whereIdAlasan($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblAlasan whereIdMahasiswa($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblAlasan whereTanggal($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblAlasan whereUpdatedAt($value)
 */
	class TblAlasan extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id_kegiatan
 * @property int $id_mahasiswa
 * @property string $kegiatan
 * @property string $waktu_awal
 * @property string $waktu_akhir
 * @property string $tanggal
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\TblMahasiswa $mahasiswa
 * @method static \Illuminate\Database\Eloquent\Builder|TblKegiatan newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|TblKegiatan newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|TblKegiatan query()
 * @method static \Illuminate\Database\Eloquent\Builder|TblKegiatan whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblKegiatan whereIdKegiatan($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblKegiatan whereIdMahasiswa($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblKegiatan whereKegiatan($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblKegiatan whereTanggal($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblKegiatan whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblKegiatan whereWaktuAkhir($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblKegiatan whereWaktuAwal($value)
 */
	class TblKegiatan extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id_mahasiswa
 * @property string $nama
 * @property string $universitas
 * @property string $jurusan
 * @property string $nim
 * @property string $mulai_magang
 * @property string $akhir_magang
 * @property string $alamat
 * @property string $no_telp
 * @property string $foto
 * @property int $id_site
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\TblAbsensi> $absensi
 * @property-read int|null $absensi_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\TblAlasan> $alasan
 * @property-read int|null $alasan_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\TblKegiatan> $kegiatan
 * @property-read int|null $kegiatan_count
 * @property-read \App\Models\TblSite $site
 * @method static \Illuminate\Database\Eloquent\Builder|TblMahasiswa newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|TblMahasiswa newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|TblMahasiswa query()
 * @method static \Illuminate\Database\Eloquent\Builder|TblMahasiswa whereAkhirMagang($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblMahasiswa whereAlamat($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblMahasiswa whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblMahasiswa whereFoto($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblMahasiswa whereIdMahasiswa($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblMahasiswa whereIdSite($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblMahasiswa whereJurusan($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblMahasiswa whereMulaiMagang($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblMahasiswa whereNama($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblMahasiswa whereNim($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblMahasiswa whereNoTelp($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblMahasiswa whereUniversitas($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblMahasiswa whereUpdatedAt($value)
 */
	class TblMahasiswa extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id_waktu
 * @property string $mulai_absen
 * @property string $akhir_absen
 * @property int $id_site
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\TblSite $site
 * @method static \Illuminate\Database\Eloquent\Builder|TblSettingAbsensi newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|TblSettingAbsensi newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|TblSettingAbsensi query()
 * @method static \Illuminate\Database\Eloquent\Builder|TblSettingAbsensi whereAkhirAbsen($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblSettingAbsensi whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblSettingAbsensi whereIdSite($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblSettingAbsensi whereIdWaktu($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblSettingAbsensi whereMulaiAbsen($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblSettingAbsensi whereUpdatedAt($value)
 */
	class TblSettingAbsensi extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $id_site
 * @property string $nama_site
 * @property string $pimpinan
 * @property string $pembimbing
 * @property string $no_telp
 * @property string $alamat
 * @property string $website
 * @property string $logo
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\TblMahasiswa> $mahasiswa
 * @property-read int|null $mahasiswa_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\TblSettingAbsensi> $settingAbsensi
 * @property-read int|null $setting_absensi_count
 * @method static \Illuminate\Database\Eloquent\Builder|TblSite newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|TblSite newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|TblSite query()
 * @method static \Illuminate\Database\Eloquent\Builder|TblSite whereAlamat($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblSite whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblSite whereIdSite($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblSite whereLogo($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblSite whereNamaSite($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblSite whereNoTelp($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblSite wherePembimbing($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblSite wherePimpinan($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblSite whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TblSite whereWebsite($value)
 */
	class TblSite extends \Eloquent {}
}

namespace App\Models{
/**
 * @property int $user_id
 * @property string $username
 * @property mixed $password
 * @property string $level
 * @property string|null $remember_token
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Notifications\DatabaseNotificationCollection<int, \Illuminate\Notifications\DatabaseNotification> $notifications
 * @property-read int|null $notifications_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \Laravel\Sanctum\PersonalAccessToken> $tokens
 * @property-read int|null $tokens_count
 * @method static \Database\Factories\UserFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder|User newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|User newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|User query()
 * @method static \Illuminate\Database\Eloquent\Builder|User whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder|User whereLevel($value)
 * @method static \Illuminate\Database\Eloquent\Builder|User wherePassword($value)
 * @method static \Illuminate\Database\Eloquent\Builder|User whereRememberToken($value)
 * @method static \Illuminate\Database\Eloquent\Builder|User whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder|User whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder|User whereUsername($value)
 */
	class User extends \Eloquent {}
}


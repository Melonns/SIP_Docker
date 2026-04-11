<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Division extends Model
{
    use HasFactory;

    protected $table = 'divisions';
    protected $primaryKey = 'id_division';

    protected $fillable = [
        'name', 'slug', 'site_id', 'keywords'
    ];

    protected $casts = [
        'keywords' => 'array'
    ];

    public static function findOrCreateByName(?string $name, $siteId = null)
    {
        if (empty($name)) return null;
        $slug = Str::slug($name);
        $div = static::firstOrCreate(
            ['slug' => $slug],
            ['name' => trim($name), 'site_id' => $siteId]
        );
        return $div;
    }

    public function site()
    {
        return $this->belongsTo(TblSite::class, 'site_id', 'id_site');
    }
}

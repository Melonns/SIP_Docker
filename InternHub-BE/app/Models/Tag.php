<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Tag extends Model
{
    use HasFactory;

    protected $table = 'tags';

    protected $fillable = [
        'nama',
        'warna',
    ];

    /**
     * Relasi ke logbooks yang menggunakan tag ini
     */
    public function logbooks()
    {
        return $this->hasMany(Logbook::class, 'tag_id');
    }
}

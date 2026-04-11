<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TblAdmin extends Model
{
    use HasFactory;

    protected $table = 'tbl_admin';
    protected $primaryKey = 'id_admin';

    protected $fillable = [
        'nama',
        'nip',
        'email',
    ];
}

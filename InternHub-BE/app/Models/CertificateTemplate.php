<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CertificateTemplate extends Model
{
    protected $table = 'certificate_templates';
    protected $primaryKey = 'id';

    protected $fillable = [
        'name',
        'side',
        'image_path',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Relasi ke user yang membuat template
     */
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by', 'user_id');
    }

    /**
     * Relasi ke user yang mengupdate template
     */
    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by', 'user_id');
    }

    /**
     * Scope untuk filter by side (depan/belakang)
     */
    public function scopeFront($query)
    {
        return $query->where('side', 'front');
    }

    public function scopeBack($query)
    {
        return $query->where('side', 'back');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EvaluationComponent extends Model
{
    use HasFactory;

    protected $table = 'evaluation_details';
    protected $primaryKey = 'id';

    protected $fillable = [
        'id_evaluation',
        'komponen_id',
        'nama_komponen',
        'score',
    ];

    protected $casts = [
        'score' => 'decimal:2',
    ];

    // Relationship to Evaluation
    public function evaluation()
    {
        return $this->belongsTo(Evaluation::class, 'id_evaluation', 'id_evaluation');
    }

    // Relationship to Komponen Penilaian (Master)
    public function komponen()
    {
        return $this->belongsTo(EvaluationComponentMaster::class, 'komponen_id', 'id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\TblMahasiswa;
use App\Models\TblKaryawan;

class Evaluation extends Model
{
    use HasFactory;

    protected $table = 'evaluations';
    protected $primaryKey = 'id_evaluation';

    protected $fillable = [
        'user_id',
        'intern_mahasiswa_id',
        'mentor_id',
        'mentor_karyawan_id',
        // Old static fields (deprecated, kept for backward compatibility)
        'integrity_score',
        'punctuality_score',
        'expertise_score',
        'teamwork_score',
        'communication_score',
        'it_proficiency_score',
        'self_development_score',
        // Final scores
        'final_score_letter',
        'final_score_numeric',
        // Other fields
        'periode',
        'status',
        'mentor_notes',
        'evaluation_date',
        // Admin review fields
        'admin_reviewed',
        'admin_id',
        'admin_reviewed_at',
    ];

    protected $casts = [
        'evaluation_date' => 'date',
        'integrity_score' => 'decimal:2',
        'punctuality_score' => 'decimal:2',
        'expertise_score' => 'decimal:2',
        'teamwork_score' => 'decimal:2',
        'communication_score' => 'decimal:2',
        'it_proficiency_score' => 'decimal:2',
        'self_development_score' => 'decimal:2',
        'final_score_numeric' => 'decimal:2',
    ];

    // Hide deprecated score fields from JSON response (now in evaluation_details)
    protected $hidden = [
        'integrity_score',
        'punctuality_score',
        'expertise_score',
        'teamwork_score',
        'communication_score',
        'it_proficiency_score',
        'self_development_score',
    ];

    protected $appends = ['total_average_score', 'final_score_text', 'id'];

    /**
     * Relationship to User (Intern being evaluated)
     */
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }

    /**
     * Relationship to profile mahasiswa (preferred intern FK)
     */
    public function internMahasiswa()
    {
        return $this->belongsTo(TblMahasiswa::class, 'intern_mahasiswa_id', 'id_mahasiswa');
    }

    /**
     * Relationship to User (Mentor who evaluated)
     */
    public function mentor()
    {
        return $this->belongsTo(User::class, 'mentor_id', 'user_id');
    }

    /**
     * Relationship to profile karyawan (preferred mentor FK)
     */
    public function mentorKaryawan()
    {
        return $this->belongsTo(TblKaryawan::class, 'mentor_karyawan_id', 'id_karyawan');
    }

    /**
     * Relationship to User (Admin who reviewed)
     */
    public function admin()
    {
        return $this->belongsTo(User::class, 'admin_id', 'user_id');
    }

    /**
     * Scope to query evaluations for an intern (prefers intern_mahasiswa_id)
     */
    public function scopeForIntern($query, $user)
    {
        $mahasiswaId = $user->mahasiswa?->id_mahasiswa ?? null;
        if ($mahasiswaId) {
            return $query->where('intern_mahasiswa_id', $mahasiswaId);
        }
        return $query->where('user_id', $user->user_id);
    }

    /**
     * Scope to query evaluations for a mentor (prefers mentor_karyawan_id)
     */
    public function scopeForMentor($query, $user)
    {
        $karyawanId = $user->karyawan?->id_karyawan ?? null;
        if ($karyawanId) {
            return $query->where('mentor_karyawan_id', $karyawanId);
        }
        return $query->where('mentor_id', $user->user_id);
    }

    /**
     * Relationship to EvaluationComponent (Pivot - Dynamic Components)
     */
    public function details()
    {
        return $this->hasMany(EvaluationComponent::class, 'id_evaluation', 'id_evaluation');
    }

    /**
     * Legacy alias for backward compatibility
     */
    public function components()
    {
        return $this->details();
    }

    /**
     * Accessor: Calculate total average score from components (dynamic) or legacy fields
     */
    public function getTotalAverageScoreAttribute()
    {
        // Try from dynamic components first
        if ($this->relationLoaded('details') || $this->details()->count() > 0) {
            $scores = $this->details->pluck('score')->filter(fn($s) => $s !== null)->toArray();
            if (count($scores) > 0) {
                return round(array_sum($scores) / count($scores), 2);
            }
        }

        // Fallback to legacy fields
        $legacyScores = [
            $this->integrity_score,
            $this->punctuality_score,
            $this->expertise_score,
            $this->teamwork_score,
            $this->communication_score,
            $this->it_proficiency_score,
            $this->self_development_score,
        ];

        $validScores = array_filter($legacyScores, fn($s) => $s !== null);
        
        if (count($validScores) === 0) return null;

        $total = array_sum($validScores);
        return round($total / count($validScores), 2);
    }

    /**
     * Accessor: Get final score numeric (calculate if null)
     */
    public function getFinalScoreNumericAttribute($value)
    {
        if ($value !== null) return $value;
        return $this->total_average_score;
    }

    /**
     * Accessor: Get final score letter (calculate if null)
     */
    public function getFinalScoreLetterAttribute($value)
    {
        if ($value !== null) return $value;
        return self::scoreToLetter($this->final_score_numeric);
    }

    /**
     * Accessor: Helper for FE mapping
     */
    public function getFinalScoreTextAttribute()
    {
        $numeric = $this->final_score_numeric;
        $letter = $this->final_score_letter;
        if ($numeric === null) return null;
        return "{$numeric} ({$letter})";
    }

    /**
     * Accessor: Get admin review status
     * Returns: not_yet, need_review, done
     */
    public function getAdminReviewStatusAttribute()
    {
        // Not yet = Mentor belum submit evaluation (status masih draft)
        if ($this->status === 'draft') {
            return 'not_yet';
        }
        
        // Done = Admin sudah review
        if ($this->admin_reviewed) {
            return 'done';
        }
        
        // Need review = Mentor sudah final, admin belum review
        return 'need_review';
    }

    /**
     * Helper: Convert numeric score to letter grade
     */
    public static function scoreToLetter($score)
    {
        if ($score === null) return null;
        if ($score >= 85) return 'A';
        if ($score >= 75) return 'B';
        if ($score >= 65) return 'C';
        if ($score >= 55) return 'D';
        return 'E';
    }

    /**
     * Accessor: Return id_evaluation as id for FE compatibility
     */
    public function getIdAttribute()
    {
        return $this->id_evaluation;
    }
}

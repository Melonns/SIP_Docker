<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('evaluations', function (Blueprint $table) {
            // Remove old score columns
            $table->dropColumn([
                'discipline_score',
                'work_quality_score',
                'initiative_score',
                'teamwork_score',
                'technical_score',
            ]);
        });

        Schema::table('evaluations', function (Blueprint $table) {
            // Add new 7 score components (0-100)
            $table->decimal('integrity_score', 5, 2)->after('mentor_id'); // Integritas
            $table->decimal('punctuality_score', 5, 2)->after('integrity_score'); // Ketepatan waktu
            $table->decimal('expertise_score', 5, 2)->after('punctuality_score'); // Keahlian bidang ilmu
            $table->decimal('teamwork_score', 5, 2)->after('expertise_score'); // Kerjasama tim
            $table->decimal('communication_score', 5, 2)->after('teamwork_score'); // Komunikasi
            $table->decimal('it_proficiency_score', 5, 2)->after('communication_score'); // Penggunaan TI
            $table->decimal('self_development_score', 5, 2)->after('it_proficiency_score'); // Pengembangan diri
            
            // Final score as letter grade (A, B, C, D, E)
            $table->string('final_score_letter', 2)->nullable()->after('self_development_score');
            
            // Computed average (stored for convenience, though FE also calculates)
            $table->decimal('final_score_numeric', 5, 2)->nullable()->after('final_score_letter');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('evaluations', function (Blueprint $table) {
            // Remove new columns
            $table->dropColumn([
                'integrity_score',
                'punctuality_score',
                'expertise_score',
                'teamwork_score',
                'communication_score',
                'it_proficiency_score',
                'self_development_score',
                'final_score_letter',
                'final_score_numeric',
            ]);
        });

        Schema::table('evaluations', function (Blueprint $table) {
            // Restore old columns
            $table->decimal('discipline_score', 5, 2)->after('mentor_id');
            $table->decimal('work_quality_score', 5, 2)->after('discipline_score');
            $table->decimal('initiative_score', 5, 2)->after('work_quality_score');
            $table->decimal('teamwork_score', 5, 2)->after('initiative_score');
            $table->decimal('technical_score', 5, 2)->after('teamwork_score');
        });
    }
};

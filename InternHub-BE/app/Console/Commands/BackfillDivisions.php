<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use App\Models\Division;

class BackfillDivisions extends Command
{
    protected $signature = 'backfill:divisions {--dry-run}';
    protected $description = 'Create `divisions` from existing profile division strings and populate division_id on profiles';

    public function handle()
    {
        $this->info('Starting backfill of divisions...');
        $dry = $this->option('dry-run');

        // Collect distinct division names from employees and students
        $employeeDivs = DB::table('employees')->whereNotNull('division')->pluck('division')->unique()->filter()->values()->toArray();
        $studentDivs = DB::table('students')->whereNotNull('division')->pluck('division')->unique()->filter()->values()->toArray();

        $all = collect($employeeDivs)->merge($studentDivs)->unique()->filter()->values();

        if ($all->isEmpty()) {
            $this->info('No division strings found to backfill.');
            return 0;
        }

        $this->info('Found ' . $all->count() . ' distinct division strings.');

        foreach ($all as $name) {
            $this->line("- Creating division: {$name}");
            if (! $dry) {
                Division::findOrCreateByName($name);
            }
        }

        if ($dry) {
            $this->info('Dry-run: no profile updates were applied.');
            return 0;
        }

        $this->info('Updating employees (chunked)...');
        DB::table('employees')->whereNotNull('division')->chunkById(200, function ($rows) {
            foreach ($rows as $r) {
                if (empty($r->division)) continue;
                $div = Division::findOrCreateByName($r->division);
                if ($div && empty($r->division_id)) {
                    DB::table('employees')->where('id_karyawan', $r->id_karyawan)->update(['division_id' => $div->id_division]);
                }
            }
        }, 'id_karyawan');

        $this->info('Updating students (chunked)...');
        DB::table('students')->whereNotNull('division')->chunkById(200, function ($rows) {
            foreach ($rows as $r) {
                if (empty($r->division)) continue;
                $div = Division::findOrCreateByName($r->division);
                if ($div && empty($r->division_id)) {
                    DB::table('students')->where('id_mahasiswa', $r->id_mahasiswa)->update(['division_id' => $div->id_division]);
                }
            }
        }, 'id_mahasiswa');

        $this->info('Backfill complete.');
        return 0;
    }
}

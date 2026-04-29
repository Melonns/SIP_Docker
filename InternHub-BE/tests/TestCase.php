<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\DB;

abstract class TestCase extends BaseTestCase
{
    use CreatesApplication;

    /**
     * Override the default refresh database behavior for SQLite
     */
    public function setUp(): void
    {
        parent::setUp();

        // Disable foreign key constraints for SQLite
        if (config('database.default') === 'sqlite') {
            DB::statement('PRAGMA foreign_keys=OFF');
        }
    }

    public function tearDown(): void
    {
        // Re-enable foreign key constraints for SQLite
        if (config('database.default') === 'sqlite') {
            DB::statement('PRAGMA foreign_keys=ON');
        }

        parent::tearDown();
    }
}

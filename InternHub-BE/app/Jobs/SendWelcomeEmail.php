<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;

class SendWelcomeEmail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $user;
    public $password;

    /**
     * Create a new job instance.
     */
    public function __construct($user, $password)
    {
        $this->user = $user;
        $this->password = $password;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        try {
            Mail::send('emails.welcome-new-user', [
                'user' => $this->user,
                'password' => $this->password,
                'login_url' => config('app.frontend_url', 'http://localhost:3000') . '/login',
            ], function ($message) {
                $message->to($this->user->email);
                $message->subject('Akun SIP - Kredensial Login');
            });
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('SendWelcomeEmail job failed for ' . ($this->user->email ?? 'unknown'), ['error' => $e->getMessage()]);
        }
    }
}

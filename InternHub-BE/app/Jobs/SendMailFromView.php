<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;

class SendMailFromView implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public string $view;
    public array $data;
    public ?string $to;
    public string $subject;

    public function __construct(string $view, array $data, ?string $to, string $subject = '')
    {
        $this->view = $view;
        $this->data = $data;
        $this->to = $to;
        $this->subject = $subject;
    }

    public function handle(): void
    {
        try {
            if (empty($this->to)) {
                Log::warning('SendMailFromView: recipient is empty for view ' . $this->view, ['data' => $this->data]);
                return;
            }

            Mail::send($this->view, $this->data, function ($message) {
                $message->to($this->to);
                if (!empty($this->subject)) {
                    $message->subject($this->subject);
                }
            });
        } catch (\Exception $e) {
            Log::error('SendMailFromView job failed for ' . ($this->to ?? 'unknown'), ['error' => $e->getMessage(), 'view' => $this->view]);
        }
    }
}

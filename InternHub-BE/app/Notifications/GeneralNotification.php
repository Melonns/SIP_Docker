<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\BroadcastMessage;

class GeneralNotification extends Notification
{
    use Queueable;

    protected $title;
    protected $message;
    protected $link;
    protected $type;
    protected $target_role;

    /**
     * Create a new notification instance.
     *
     * @param string $title Judul Notifikasi
     * @param string $message Isi Notifikasi
     * @param string|null $link Link URL tujuan
     * @param string|null $type Tipe (info, success, warning, etc)
     * @param string|null $target_role Target role pembaca (intern, mentor, admin)
     */
    public function __construct(string $title, string $message, ?string $link = null, ?string $type = 'info', ?string $target_role = null)
    {
        $this->title = $title;
        $this->message = $message;
        $this->link = $link;
        $this->type = $type;
        $this->target_role = $target_role;
    }

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return [\App\Notifications\Channels\DatabaseChannel::class, 'broadcast']; // Simpan di DB (custom) + broadcast
    }

    /**
     * Get the array representation of the notification (for database).
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'title' => $this->title,
            'message' => $this->message,
            'link' => $this->link,
            'type' => $this->type,
            'target_role' => $this->target_role,
        ];
    }

    /**
     * Get the broadcastable representation of the notification (for Pusher).
     */
    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage([
            'title' => $this->title,
            'message' => $this->message,
            'link' => $this->link,
            'type' => $this->type,
            'target_role' => $this->target_role,
        ]);
    }
}

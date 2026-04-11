<?php

namespace App\Notifications\Channels;

use Illuminate\Notifications\Channels\DatabaseChannel as BaseDatabaseChannel;
use Illuminate\Notifications\Notification;

class DatabaseChannel extends BaseDatabaseChannel
{
    /**
     * Build an array payload for the DatabaseNotification Model.
     *
     * @param  mixed  $notifiable
     * @param  \Illuminate\Notifications\Notification  $notification
     * @return array
     */
    protected function buildPayload($notifiable, Notification $notification)
    {
        $payload = parent::buildPayload($notifiable, $notification);
        
        // Extract target_role from the notification's data
        $data = method_exists($notification, 'toDatabase') 
            ? $notification->toDatabase($notifiable) 
            : $notification->toArray($notifiable);

        if (isset($data['target_role'])) {
            $payload['target_role'] = $data['target_role'];
        }

        return $payload;
    }
}

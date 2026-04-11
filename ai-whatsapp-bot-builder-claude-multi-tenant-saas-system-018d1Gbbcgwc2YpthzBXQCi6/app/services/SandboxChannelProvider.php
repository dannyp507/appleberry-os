<?php
// FILE: /app/services/SandboxChannelProvider.php

class SandboxChannelProvider implements ChannelProviderInterface {
    public function sendMessage($channel, $recipient, $message) {
        return [
            'success' => true,
            'status' => 'sent',
            'status_code' => 200,
            'provider_message_id' => 'sandbox_' . uniqid(),
            'response_body' => json_encode([
                'channel' => $channel['id'],
                'to' => $recipient['phone_number'],
                'message' => $message['content']
            ]),
            'error' => null
        ];
    }
}

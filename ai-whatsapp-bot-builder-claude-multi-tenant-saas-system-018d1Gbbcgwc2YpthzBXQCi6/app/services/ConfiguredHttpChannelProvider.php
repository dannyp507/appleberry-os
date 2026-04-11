<?php
// FILE: /app/services/ConfiguredHttpChannelProvider.php

class ConfiguredHttpChannelProvider extends AbstractHttpChannelProvider {
    public function sendMessage($channel, $recipient, $message) {
        $config = isset($channel['provider_config_decoded']) ? $channel['provider_config_decoded'] : [];
        $outboundUrl = isset($config['outbound_url']) && $config['outbound_url']
            ? $config['outbound_url']
            : $channel['webhook_url'];

        if (!$outboundUrl) {
            return [
                'success' => false,
                'status' => 'failed',
                'status_code' => 0,
                'error' => 'Channel is missing an outbound_url or webhook_url.'
            ];
        }

        $headers = [];

        if (!empty($config['api_key_header']) && !empty($config['api_key'])) {
            $headers[$config['api_key_header']] = $config['api_key'];
        } elseif (!empty($config['api_key'])) {
            $headers['X-API-Key'] = $config['api_key'];
        }

        if (!empty($config['bearer_token'])) {
            $headers['Authorization'] = 'Bearer ' . $config['bearer_token'];
        }

        if (!empty($config['headers']) && is_array($config['headers'])) {
            foreach ($config['headers'] as $name => $value) {
                $headers[$name] = $value;
            }
        }

        $payload = [
            'channel' => [
                'id' => $channel['id'],
                'name' => $channel['name'],
                'phone_number' => $channel['phone_number'],
                'provider_type' => $channel['provider_type']
            ],
            'recipient' => [
                'name' => isset($recipient['name']) ? $recipient['name'] : null,
                'phone_number' => $recipient['phone_number']
            ],
            'message' => $message
        ];

        return $this->postJson($outboundUrl, $headers, $payload);
    }
}

<?php
// FILE: /app/services/FirebaseBridgeService.php

/**
 * FirebaseBridgeService
 *
 * Sends application events to an optional Firebase HTTP bridge.
 * This keeps MySQL/PHP as the source of truth while allowing
 * Firestore to power realtime inboxes, dashboards, and sidecars.
 */
class FirebaseBridgeService {

    /**
     * Publish an event to the configured Firebase bridge.
     *
     * @param string $eventType
     * @param array $payload
     * @return bool
     */
    public function publish($eventType, $payload) {
        if (getenv('FIREBASE_ENABLED') !== 'true') {
            return false;
        }

        $endpoint = getenv('FIREBASE_EVENT_ENDPOINT');
        if (!$endpoint) {
            return false;
        }

        $body = [
            'event_type' => $eventType,
            'project_id' => getenv('FIREBASE_PROJECT_ID') ?: null,
            'occurred_at' => date('c'),
            'payload' => $payload
        ];

        $headers = [
            'Content-Type: application/json'
        ];

        $secret = getenv('FIREBASE_EVENT_SECRET');
        if ($secret) {
            $headers[] = 'X-Firebase-Bridge-Secret: ' . $secret;
        }

        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => implode("\r\n", $headers),
                'content' => json_encode($body),
                'ignore_errors' => true,
                'timeout' => 10
            ]
        ]);

        $result = @file_get_contents($endpoint, false, $context);
        return $result !== false;
    }
}

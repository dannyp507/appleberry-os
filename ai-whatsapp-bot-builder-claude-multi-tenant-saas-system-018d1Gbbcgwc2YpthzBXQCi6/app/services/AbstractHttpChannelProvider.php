<?php
// FILE: /app/services/AbstractHttpChannelProvider.php

abstract class AbstractHttpChannelProvider implements ChannelProviderInterface {

    /**
     * Send JSON to an outbound connector endpoint.
     *
     * @param string $url
     * @param array $headers
     * @param array $payload
     * @return array
     */
    protected function postJson($url, $headers, $payload) {
        $headerLines = ['Content-Type: application/json'];

        foreach ($headers as $name => $value) {
            if ($value === null || $value === '') {
                continue;
            }
            $headerLines[] = $name . ': ' . $value;
        }

        $options = [
            'http' => [
                'method' => 'POST',
                'header' => implode("\r\n", $headerLines),
                'content' => json_encode($payload),
                'ignore_errors' => true,
                'timeout' => 15
            ]
        ];

        $context = stream_context_create($options);
        $responseBody = @file_get_contents($url, false, $context);
        $responseHeaders = isset($http_response_header) ? $http_response_header : [];
        $statusCode = $this->extractStatusCode($responseHeaders);

        if ($responseBody === false && $statusCode === 0) {
            return [
                'success' => false,
                'status' => 'failed',
                'status_code' => 0,
                'error' => 'Unable to reach outbound provider endpoint.'
            ];
        }

        $decoded = json_decode($responseBody, true);
        $providerMessageId = is_array($decoded) && isset($decoded['message_id'])
            ? $decoded['message_id']
            : null;

        return [
            'success' => $statusCode >= 200 && $statusCode < 300,
            'status' => $statusCode >= 200 && $statusCode < 300 ? 'sent' : 'failed',
            'status_code' => $statusCode,
            'provider_message_id' => $providerMessageId,
            'response_body' => $responseBody,
            'error' => $statusCode >= 200 && $statusCode < 300
                ? null
                : 'Provider responded with HTTP ' . $statusCode
        ];
    }

    /**
     * @param array $headers
     * @return int
     */
    private function extractStatusCode($headers) {
        if (empty($headers)) {
            return 0;
        }

        if (preg_match('/\s(\d{3})\s/', $headers[0], $matches)) {
            return (int) $matches[1];
        }

        return 0;
    }
}

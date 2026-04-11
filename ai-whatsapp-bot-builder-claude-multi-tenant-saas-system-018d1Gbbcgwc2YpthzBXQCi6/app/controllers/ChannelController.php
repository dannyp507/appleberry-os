<?php
// FILE: /app/controllers/ChannelController.php

class ChannelController extends Controller {
    public function index() {
        $this->requireAuth();
        $tenantId = $this->getTenantId();
        require_once __DIR__ . '/../models/Channel.php';
        $model = new Channel();
        $channels = $model->getByTenantWithBots($tenantId);
        $selectedChannel = null;
        $selectedId = (int) $this->request->get('account', 0);

        foreach ($channels as &$channel) {
            $channel = $model->hydrateProviderConfig($channel);
            if ($selectedId > 0 && (int) $channel['id'] === $selectedId) {
                $selectedChannel = $channel;
            }
        }
        unset($channel);

        if (!$selectedChannel && !empty($channels)) {
            $selectedChannel = $channels[0];
        }

        $this->view('channels/index', [
            'title' => 'WhatsApp Workspace',
            'channels' => $channels,
            'selectedChannel' => $selectedChannel
        ]);
    }

    public function create() {
        $this->requireAuth();
        $this->view('channels/create', ['title' => 'Add WhatsApp Account']);
    }

    public function store() {
        $this->requireAuth();
        $this->requireCsrf();
        require_once __DIR__ . '/../models/Channel.php';
        $model = new Channel();
        $channelId = $model->create([
            'tenant_id' => $this->getTenantId(),
            'name' => $this->request->post('name'),
            'phone_number' => $this->request->post('phone_number'),
            'provider_type' => $this->request->post('provider_type'),
            'provider_config' => $this->buildProviderConfig(),
            'webhook_url' => $this->request->post('webhook_url'),
            'webhook_verify_token' => bin2hex(random_bytes(16)),
            'status' => 'active'
        ]);
        $this->session->flash('success', 'WhatsApp account created successfully');
        $this->redirect('/channels/' . $channelId);
    }

    public function show($id) {
        $this->requireAuth();
        require_once __DIR__ . '/../models/Channel.php';
        $model = new Channel();
        $channel = $model->find($id, $this->getTenantId());
        if (!$channel) {
            $this->session->flash('error', 'Channel not found');
            $this->redirect('/channels');
        }

        $channel = $model->hydrateProviderConfig($channel);

        $this->view('channels/show', [
            'title' => 'WhatsApp Account Profile',
            'channel' => $channel,
            'maskedAccessToken' => $this->maskSecret(
                $channel['provider_config_decoded'],
                ['access_token', 'api_key', 'bearer_token']
            ),
            'maskedInstanceId' => $this->maskValue(
                isset($channel['provider_config_decoded']['instance_id'])
                    ? $channel['provider_config_decoded']['instance_id']
                    : ''
            )
        ]);
    }

    public function edit($id) {
        $this->requireAuth();
        require_once __DIR__ . '/../models/Channel.php';
        $model = new Channel();
        $channel = $model->find($id, $this->getTenantId());
        if (!$channel) {
            $this->session->flash('error', 'Channel not found');
            $this->redirect('/channels');
        }
        $channel = $model->hydrateProviderConfig($channel);
        $this->view('channels/edit', ['title' => 'Edit Channel', 'channel' => $channel]);
    }

    public function update($id) {
        $this->requireAuth();
        $this->requireCsrf();
        require_once __DIR__ . '/../models/Channel.php';
        $model = new Channel();
        $model->update($id, [
            'name' => $this->request->post('name'),
            'phone_number' => $this->request->post('phone_number'),
            'provider_type' => $this->request->post('provider_type'),
            'provider_config' => $this->buildProviderConfig(),
            'webhook_url' => $this->request->post('webhook_url'),
            'status' => $this->request->post('status')
        ], $this->getTenantId());
        $this->session->flash('success', 'Channel updated successfully');
        $this->redirect('/channels/' . $id);
    }

    public function test($id) {
        $this->requireAuth();
        $this->requireCsrf();
        require_once __DIR__ . '/../models/Channel.php';
        $model = new Channel();
        $channel = $model->find($id, $this->getTenantId());
        if (!$channel) {
            $this->session->flash('error', 'Channel not found');
            $this->redirect('/channels');
        }

        $channel = $model->hydrateProviderConfig($channel);
        $config = $channel['provider_config_decoded'];
        $targetUrl = !empty($config['outbound_url']) ? $config['outbound_url'] : $channel['webhook_url'];

        if (!$targetUrl) {
            $this->session->flash('error', 'Add an outbound or webhook URL before running a connection test.');
            $this->redirect('/channels/' . $id);
        }

        $headers = ['Content-Type: application/json'];
        if (!empty($config['api_key_header']) && !empty($config['api_key'])) {
            $headers[] = $config['api_key_header'] . ': ' . $config['api_key'];
        } elseif (!empty($config['api_key'])) {
            $headers[] = 'X-API-Key: ' . $config['api_key'];
        }

        if (!empty($config['access_token'])) {
            $headers[] = 'Authorization: Bearer ' . $config['access_token'];
        } elseif (!empty($config['bearer_token'])) {
            $headers[] = 'Authorization: Bearer ' . $config['bearer_token'];
        }

        $payload = [
            'event' => 'connection.test',
            'channel' => [
                'id' => (int) $channel['id'],
                'name' => $channel['name'],
                'phone_number' => $channel['phone_number'],
                'instance_id' => isset($config['instance_id']) ? $config['instance_id'] : null
            ],
            'sent_at' => gmdate('c')
        ];

        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => implode("\r\n", $headers),
                'content' => json_encode($payload),
                'ignore_errors' => true,
                'timeout' => 15
            ]
        ]);

        $responseBody = @file_get_contents($targetUrl, false, $context);
        $responseHeaders = function_exists('http_get_last_response_headers')
            ? (http_get_last_response_headers() ?: [])
            : [];
        $statusCode = $this->extractStatusCode($responseHeaders);

        if ($responseBody === false && $statusCode === 0) {
            $this->session->flash('error', 'Test failed. The configured endpoint could not be reached.');
            $this->redirect('/channels/' . $id);
        }

        if ($statusCode >= 200 && $statusCode < 300) {
            $this->session->flash('success', 'Connection test passed with HTTP ' . $statusCode . '.');
        } else {
            $this->session->flash('error', 'Connection test failed with HTTP ' . $statusCode . '.');
        }

        $this->redirect('/channels/' . $id);
    }

    public function delete($id) {
        $this->requireAuth();
        $this->requireCsrf();
        require_once __DIR__ . '/../models/Channel.php';
        $model = new Channel();
        $model->delete($id, $this->getTenantId());
        $this->session->flash('success', 'Channel deleted successfully');
        $this->redirect('/channels');
    }

    private function buildProviderConfig() {
        $raw = $this->request->post('provider_config');
        $config = [];

        if ($raw) {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                $config = $decoded;
            } else {
                $config = ['raw' => $raw];
            }
        }

        foreach (['instance_id', 'access_token', 'outbound_url', 'api_key', 'api_key_header', 'bearer_token'] as $field) {
            $value = $this->request->post($field);
            if ($value !== null && $value !== '') {
                $config[$field] = $value;
            }
        }

        return empty($config) ? null : json_encode($config);
    }

    private function maskSecret($config, $keys) {
        foreach ($keys as $key) {
            if (!empty($config[$key])) {
                return $this->maskValue($config[$key]);
            }
        }

        return 'Not configured';
    }

    private function maskValue($value) {
        if (!$value) {
            return 'Not configured';
        }

        $length = strlen($value);
        if ($length <= 8) {
            return str_repeat('*', $length);
        }

        return substr($value, 0, 4) . str_repeat('*', max(4, $length - 8)) . substr($value, -4);
    }

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

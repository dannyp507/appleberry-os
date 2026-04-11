<?php
// FILE: /config/app.php

/**
 * Application Configuration
 */

return [
    'name' => 'AI WhatsApp Bot Builder',
    'version' => '1.0.0',
    'timezone' => 'UTC',
    'url' => getenv('APP_URL') ?: 'http://localhost',

    'debug' => getenv('APP_DEBUG') === 'true',

    'pagination' => [
        'per_page' => 20
    ],

    'upload' => [
        'max_size' => 10 * 1024 * 1024, // 10MB
        'allowed_types' => ['jpg', 'jpeg', 'png', 'pdf', 'txt', 'doc', 'docx']
    ],

    'session' => [
        'lifetime' => 120, // minutes
        'cookie_name' => 'ai_whatsapp_session'
    ],

    'firebase' => [
        'enabled' => getenv('FIREBASE_ENABLED') === 'true',
        'project_id' => getenv('FIREBASE_PROJECT_ID') ?: null,
        'web_api_key' => getenv('FIREBASE_WEB_API_KEY') ?: null,
        'auth_domain' => getenv('FIREBASE_AUTH_DOMAIN') ?: null,
        'storage_bucket' => getenv('FIREBASE_STORAGE_BUCKET') ?: null,
        'messaging_sender_id' => getenv('FIREBASE_MESSAGING_SENDER_ID') ?: null,
        'app_id' => getenv('FIREBASE_APP_ID') ?: null,
        'event_endpoint' => getenv('FIREBASE_EVENT_ENDPOINT') ?: null,
        'enable_anon_auth' => getenv('FIREBASE_ENABLE_ANON_AUTH') === 'true'
    ]
];

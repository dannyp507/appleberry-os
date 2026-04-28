<?php
// FILE: /app/views/channels/show.php
$config = isset($channel['provider_config_decoded']) ? $channel['provider_config_decoded'] : [];
?>
<div class="wa-shell">
    <aside class="wa-rail">
        <div class="wa-rail-logo">WA</div>
        <div class="wa-rail-icon is-active"></div>
        <div class="wa-rail-icon"></div>
        <div class="wa-rail-icon"></div>
        <div class="wa-rail-icon"></div>
        <div class="wa-rail-spacer"></div>
        <div class="wa-rail-icon"></div>
    </aside>

    <section class="wa-sidebar">
        <div class="wa-sidebar-header">
            <div>
                <p class="wa-eyebrow">Workspace</p>
                <h1>Whatsapp</h1>
            </div>
            <div class="wa-search">Search</div>
        </div>

        <a class="wa-add-account" href="/channels/create">Add account</a>

        <p class="wa-section-label">Features</p>
        <div class="wa-feature-list">
            <a class="wa-feature-card is-active" href="/channels/<?php echo (int) $channel['id']; ?>">
                <span class="wa-feature-icon mint"></span>
                <span>
                    <strong>Profile</strong>
                    <small>Information WhatsApp account</small>
                </span>
            </a>
            <a class="wa-feature-card" href="/broadcasts">
                <span class="wa-feature-icon violet"></span>
                <span>
                    <strong>Bulk messaging</strong>
                    <small>Send to multiple recipients</small>
                </span>
            </a>
            <a class="wa-feature-card" href="/bots">
                <span class="wa-feature-icon green"></span>
                <span>
                    <strong>Autoresponder</strong>
                    <small>Build flow-based replies</small>
                </span>
            </a>
            <a class="wa-feature-card" href="/settings/api-keys">
                <span class="wa-feature-icon teal"></span>
                <span>
                    <strong>API</strong>
                    <small>WhatsApp REST access</small>
                </span>
            </a>
        </div>
    </section>

    <main class="wa-main">
        <div class="wa-toolbar">
            <div class="wa-toolbar-chip">Social Media Manager</div>
            <div class="wa-toolbar-user">JA</div>
        </div>

        <div class="wa-content-card">
            <div class="wa-content-header">
                <div>
                    <p class="wa-eyebrow">Profile</p>
                    <h2>Information WhatsApp account</h2>
                </div>
                <div class="wa-stack-actions">
                    <form method="post" action="/channels/<?php echo (int) $channel['id']; ?>/test" class="inline-form">
                        <?php echo CSRF::field(); ?>
                        <button class="btn btn-secondary" type="submit">Test connection</button>
                    </form>
                    <a class="btn btn-primary" href="/channels/<?php echo (int) $channel['id']; ?>/edit">Edit account</a>
                </div>
            </div>

            <div class="wa-select-row">
                <div class="wa-select-pill">
                    <span><?php echo View::e($channel['name']); ?></span>
                    <small><?php echo View::e($channel['phone_number']); ?></small>
                </div>
            </div>

            <div class="wa-account-hero">
                <div class="wa-account-badge"><?php echo strtoupper(substr($channel['name'], 0, 1)); ?></div>
                <div>
                    <h3><?php echo View::e($channel['name']); ?></h3>
                    <p><?php echo View::e($channel['phone_number']); ?></p>
                </div>
            </div>

            <div class="wa-profile-grid">
                <div class="wa-profile-card">
                    <span class="wa-metric-label">Provider</span>
                    <strong><?php echo View::e($channel['provider_type']); ?></strong>
                    <small>Delivery adapter for this account</small>
                </div>
                <div class="wa-profile-card">
                    <span class="wa-metric-label">Instance ID</span>
                    <strong><?php echo View::e($maskedInstanceId); ?></strong>
                    <small><?php echo !empty($config['instance_id']) ? 'Saved to provider config' : 'Not configured yet'; ?></small>
                </div>
                <div class="wa-profile-card">
                    <span class="wa-metric-label">Access Token</span>
                    <strong><?php echo View::e($maskedAccessToken); ?></strong>
                    <small>Masked in UI for safety</small>
                </div>
                <div class="wa-profile-card">
                    <span class="wa-metric-label">Status</span>
                    <strong><?php echo View::e($channel['status']); ?></strong>
                    <small>Keep active to allow sends and syncs</small>
                </div>
            </div>

            <div class="wa-details-panel wa-details-panel--stack">
                <div>
                    <span class="wa-metric-label">Webhook URL</span>
                    <p><?php echo View::e($channel['webhook_url'] ?: 'Not configured yet'); ?></p>
                </div>
                <div>
                    <span class="wa-metric-label">Outbound URL</span>
                    <p><?php echo View::e($config['outbound_url'] ?? 'Not configured yet'); ?></p>
                </div>
                <div>
                    <span class="wa-metric-label">API Key Header</span>
                    <p><?php echo View::e($config['api_key_header'] ?? 'Not configured'); ?></p>
                </div>
                <div>
                    <span class="wa-metric-label">Verify Token</span>
                    <p><?php echo View::e($channel['webhook_verify_token']); ?></p>
                </div>
            </div>
        </div>
    </main>
</div>

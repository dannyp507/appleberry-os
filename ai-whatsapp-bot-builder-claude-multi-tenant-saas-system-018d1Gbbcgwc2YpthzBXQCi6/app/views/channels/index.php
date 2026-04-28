<?php
// FILE: /app/views/channels/index.php
$selectedChannel = isset($selectedChannel) ? $selectedChannel : null;
$featureItems = [
    ['label' => 'Profile', 'description' => 'Information WhatsApp account', 'href' => '/channels', 'active' => true, 'accent' => 'mint'],
    ['label' => 'Bulk messaging', 'description' => 'Send to multiple recipients', 'href' => '/broadcasts', 'active' => false, 'accent' => 'violet'],
    ['label' => 'Autoresponder', 'description' => 'Build flow-based replies', 'href' => '/bots', 'active' => false, 'accent' => 'green'],
    ['label' => 'Chatbot', 'description' => 'Automate conversations', 'href' => '/bots', 'active' => false, 'accent' => 'orange'],
    ['label' => 'API', 'description' => 'WhatsApp REST access', 'href' => '/settings/api-keys', 'active' => false, 'accent' => 'teal'],
];
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
            <?php foreach ($featureItems as $item): ?>
                <a class="wa-feature-card <?php echo $item['active'] ? 'is-active' : ''; ?>" href="<?php echo View::e($item['href']); ?>">
                    <span class="wa-feature-icon <?php echo View::e($item['accent']); ?>"></span>
                    <span>
                        <strong><?php echo View::e($item['label']); ?></strong>
                        <small><?php echo View::e($item['description']); ?></small>
                    </span>
                </a>
            <?php endforeach; ?>
        </div>

        <p class="wa-section-label">Accounts</p>
        <div class="wa-account-list">
            <?php if (empty($channels)): ?>
                <div class="wa-empty-note">No connected accounts yet.</div>
            <?php else: ?>
                <?php foreach ($channels as $channel): ?>
                    <a class="wa-account-item <?php echo $selectedChannel && (int) $selectedChannel['id'] === (int) $channel['id'] ? 'is-selected' : ''; ?>" href="/channels/<?php echo (int) $channel['id']; ?>">
                        <span class="wa-account-avatar"><?php echo strtoupper(substr($channel['name'], 0, 1)); ?></span>
                        <span>
                            <strong><?php echo View::e($channel['name']); ?></strong>
                            <small><?php echo View::e($channel['phone_number']); ?></small>
                        </span>
                    </a>
                <?php endforeach; ?>
            <?php endif; ?>
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
                <?php if ($selectedChannel): ?>
                    <div class="wa-stack-actions">
                        <a class="btn btn-secondary" href="/channels/<?php echo (int) $selectedChannel['id']; ?>">Open profile</a>
                        <a class="btn btn-secondary" href="/channels/<?php echo (int) $selectedChannel['id']; ?>/edit">Edit account</a>
                    </div>
                <?php endif; ?>
            </div>

            <?php if (!$selectedChannel): ?>
                <div class="wa-empty-stage">
                    <div class="wa-empty-illustration"></div>
                    <h3>No WhatsApp account selected</h3>
                    <p>Create your first account to configure providers, bot routing, and broadcast delivery.</p>
                </div>
            <?php else: ?>
                <div class="wa-select-row">
                    <div class="wa-select-pill">
                        <span><?php echo View::e($selectedChannel['name']); ?></span>
                        <small><?php echo View::e($selectedChannel['phone_number']); ?></small>
                    </div>
                </div>

                <div class="wa-profile-grid">
                    <div class="wa-profile-card">
                        <span class="wa-metric-label">Provider</span>
                        <strong><?php echo View::e($selectedChannel['provider_type']); ?></strong>
                        <small>Outbound delivery route for this account</small>
                    </div>
                    <div class="wa-profile-card">
                        <span class="wa-metric-label">Status</span>
                        <strong><?php echo View::e($selectedChannel['status']); ?></strong>
                        <small>Keep active to accept sends and webhooks</small>
                    </div>
                    <div class="wa-profile-card">
                        <span class="wa-metric-label">Bots</span>
                        <strong><?php echo (int) $selectedChannel['bot_count']; ?></strong>
                        <small>Automations currently attached</small>
                    </div>
                </div>

                <div class="wa-details-panel">
                    <div>
                        <span class="wa-metric-label">Webhook / Connector URL</span>
                        <p><?php echo View::e($selectedChannel['webhook_url'] ?: 'Not configured yet'); ?></p>
                    </div>
                    <div class="wa-detail-actions">
                        <form method="post" action="/channels/<?php echo (int) $selectedChannel['id']; ?>/delete" class="inline-form">
                            <?php echo CSRF::field(); ?>
                            <button class="btn btn-danger" type="submit">Delete account</button>
                        </form>
                    </div>
                </div>
            <?php endif; ?>
        </div>
    </main>
</div>

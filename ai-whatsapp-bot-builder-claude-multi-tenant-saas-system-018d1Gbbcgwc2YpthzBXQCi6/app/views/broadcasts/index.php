<?php
// FILE: /app/views/broadcasts/index.php
$featureItems = [
    ['label' => 'Profile', 'description' => 'Information WhatsApp account', 'href' => '/channels', 'active' => false, 'accent' => 'mint'],
    ['label' => 'Bulk messaging', 'description' => 'Send to multiple recipients', 'href' => '/broadcasts', 'active' => true, 'accent' => 'violet'],
    ['label' => 'Autoresponder', 'description' => 'Build flow-based replies', 'href' => '/bots', 'active' => false, 'accent' => 'green'],
    ['label' => 'Chatbot', 'description' => 'Automate conversations', 'href' => '/bots', 'active' => false, 'accent' => 'orange'],
    ['label' => 'API', 'description' => 'WhatsApp REST access', 'href' => '/settings/api-keys', 'active' => false, 'accent' => 'teal'],
];
?>
<div class="wa-shell">
    <aside class="wa-rail">
        <div class="wa-rail-logo">WA</div>
        <div class="wa-rail-icon"></div>
        <div class="wa-rail-icon is-active"></div>
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

        <a class="wa-add-account" href="/broadcasts/create">Create broadcast</a>

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

        <p class="wa-section-label">Campaigns</p>
        <div class="wa-account-list">
            <?php if (empty($broadcasts)): ?>
                <div class="wa-empty-note">No campaigns yet.</div>
            <?php else: ?>
                <?php foreach ($broadcasts as $broadcast): ?>
                    <a class="wa-account-item" href="/broadcasts/<?php echo (int) $broadcast['id']; ?>">
                        <span class="wa-account-avatar"><?php echo strtoupper(substr($broadcast['name'], 0, 1)); ?></span>
                        <span>
                            <strong><?php echo View::e($broadcast['name']); ?></strong>
                            <small><?php echo View::e($broadcast['status']); ?> • <?php echo (int) $broadcast['sent_count']; ?>/<?php echo (int) $broadcast['total_recipients']; ?> sent</small>
                        </span>
                    </a>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>
    </section>

    <main class="wa-main">
        <div class="wa-toolbar">
            <div class="wa-toolbar-chip">Bulk messaging</div>
            <div class="wa-toolbar-user">JA</div>
        </div>

        <div class="wa-content-card">
            <div class="wa-content-header">
                <div>
                    <p class="wa-eyebrow">Bulk messaging</p>
                    <h2>Campaign control room</h2>
                </div>
                <a class="btn btn-primary" href="/broadcasts/create">New campaign</a>
            </div>

            <?php if (empty($broadcasts)): ?>
                <div class="wa-empty-stage">
                    <div class="wa-empty-illustration violet"></div>
                    <h3>No broadcasts yet</h3>
                    <p>Create a campaign, queue recipients, and process batches as your provider capacity allows.</p>
                </div>
            <?php else: ?>
                <div class="wa-profile-grid">
                    <div class="wa-profile-card">
                        <span class="wa-metric-label">Campaigns</span>
                        <strong><?php echo count($broadcasts); ?></strong>
                        <small>Total saved broadcast drafts and runs</small>
                    </div>
                    <div class="wa-profile-card">
                        <span class="wa-metric-label">Sent</span>
                        <strong><?php echo array_sum(array_map(function ($item) { return (int) $item['sent_count']; }, $broadcasts)); ?></strong>
                        <small>Total recipient deliveries recorded</small>
                    </div>
                    <div class="wa-profile-card">
                        <span class="wa-metric-label">Failed</span>
                        <strong><?php echo array_sum(array_map(function ($item) { return (int) $item['failed_count']; }, $broadcasts)); ?></strong>
                        <small>Recipients needing retry or cleanup</small>
                    </div>
                </div>

                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Channel</th>
                            <th>Status</th>
                            <th>Recipients</th>
                            <th>Sent</th>
                            <th>Failed</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($broadcasts as $broadcast): ?>
                            <tr>
                                <td><?php echo View::e($broadcast['name']); ?></td>
                                <td><?php echo View::e($broadcast['channel_name']); ?></td>
                                <td><span class="badge badge-<?php echo View::e($broadcast['status']); ?>"><?php echo View::e($broadcast['status']); ?></span></td>
                                <td><?php echo (int) $broadcast['total_recipients']; ?></td>
                                <td><?php echo (int) $broadcast['sent_count']; ?></td>
                                <td><?php echo (int) $broadcast['failed_count']; ?></td>
                                <td class="actions">
                                    <a class="btn btn-small btn-secondary" href="/broadcasts/<?php echo (int) $broadcast['id']; ?>">Open</a>
                                    <form method="post" action="/broadcasts/<?php echo (int) $broadcast['id']; ?>/delete" class="inline-form">
                                        <?php echo CSRF::field(); ?>
                                        <button class="btn btn-small btn-danger" type="submit">Delete</button>
                                    </form>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php endif; ?>
        </div>
    </main>
</div>

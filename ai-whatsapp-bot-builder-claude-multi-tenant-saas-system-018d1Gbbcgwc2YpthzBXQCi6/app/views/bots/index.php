<?php
// FILE: /app/views/bots/index.php
$featureItems = [
    ['label' => 'Profile', 'description' => 'Information WhatsApp account', 'href' => '/channels', 'active' => false, 'accent' => 'mint'],
    ['label' => 'Bulk messaging', 'description' => 'Send to multiple recipients', 'href' => '/broadcasts', 'active' => false, 'accent' => 'violet'],
    ['label' => 'Autoresponder', 'description' => 'Build flow-based replies', 'href' => '/bots', 'active' => true, 'accent' => 'green'],
    ['label' => 'Chatbot', 'description' => 'Automate conversations', 'href' => '/bots', 'active' => true, 'accent' => 'orange'],
    ['label' => 'API', 'description' => 'WhatsApp REST access', 'href' => '/settings/api-keys', 'active' => false, 'accent' => 'teal'],
];
?>
<div class="wa-shell">
    <aside class="wa-rail">
        <div class="wa-rail-logo">WA</div>
        <div class="wa-rail-icon"></div>
        <div class="wa-rail-icon"></div>
        <div class="wa-rail-icon is-active"></div>
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

        <a class="wa-add-account" href="/bots/create">Create bot</a>

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

        <p class="wa-section-label">Bots</p>
        <div class="wa-account-list">
            <?php if (empty($bots)): ?>
                <div class="wa-empty-note">No automation bots yet.</div>
            <?php else: ?>
                <?php foreach ($bots as $bot): ?>
                    <a class="wa-account-item" href="/bots/<?php echo (int) $bot['id']; ?>">
                        <span class="wa-account-avatar"><?php echo strtoupper(substr($bot['name'], 0, 1)); ?></span>
                        <span>
                            <strong><?php echo View::e($bot['name']); ?></strong>
                            <small><?php echo View::e($bot['status']); ?> • <?php echo View::e($bot['channel_name']); ?></small>
                        </span>
                    </a>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>
    </section>

    <main class="wa-main">
        <div class="wa-toolbar">
            <div class="wa-toolbar-chip">Bot studio</div>
            <div class="wa-toolbar-user">JA</div>
        </div>

        <div class="wa-content-card">
            <div class="wa-content-header">
                <div>
                    <p class="wa-eyebrow">Chatbot</p>
                    <h2>Automation workspace</h2>
                </div>
                <a href="/bots/create" class="btn btn-primary">Create Bot</a>
            </div>

            <?php if (empty($bots)): ?>
                <div class="wa-empty-stage">
                    <div class="wa-empty-illustration"></div>
                    <h3>No bots yet</h3>
                    <p>Create your first autoresponder and connect it to a WhatsApp account.</p>
                </div>
            <?php else: ?>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Channel</th>
                            <th>Status</th>
                            <th>AI</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($bots as $bot): ?>
                        <tr>
                            <td>
                                <strong><?php echo View::e($bot['name']); ?></strong><br>
                                <small><?php echo View::e($bot['description']); ?></small>
                            </td>
                            <td><?php echo View::e($bot['channel_name']); ?> (<?php echo View::e($bot['phone_number']); ?>)</td>
                            <td><span class="badge badge-<?php echo View::e($bot['status']); ?>"><?php echo View::e($bot['status']); ?></span></td>
                            <td><?php echo $bot['ai_enabled'] ? 'Yes' : 'No'; ?></td>
                            <td><?php echo View::e(date('M d, Y', strtotime($bot['created_at']))); ?></td>
                            <td>
                                <div class="actions">
                                    <a href="/bots/<?php echo (int) $bot['id']; ?>" class="btn btn-small">View</a>
                                    <a href="/bots/<?php echo (int) $bot['id']; ?>/edit" class="btn btn-small btn-secondary">Edit</a>
                                    <a href="/bots/<?php echo (int) $bot['id']; ?>/flows" class="btn btn-small btn-info">Flows</a>
                                </div>
                            </td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>

                <?php if ($pagination['total_pages'] > 1): ?>
                <div class="pagination">
                    <?php if ($pagination['has_prev']): ?>
                        <a href="?page=<?php echo $pagination['page'] - 1; ?>" class="btn btn-small">Previous</a>
                    <?php endif; ?>
                    <span>Page <?php echo $pagination['page']; ?> of <?php echo $pagination['total_pages']; ?></span>
                    <?php if ($pagination['has_next']): ?>
                        <a href="?page=<?php echo $pagination['page'] + 1; ?>" class="btn btn-small">Next</a>
                    <?php endif; ?>
                </div>
                <?php endif; ?>
            <?php endif; ?>
        </div>
    </main>
</div>

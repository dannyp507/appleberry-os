<?php
// FILE: /app/views/inbox/index.php
$tenantId = (new Auth())->tenantId();
?>
<div class="wa-shell">
    <aside class="wa-rail">
        <div class="wa-rail-logo">WA</div>
        <div class="wa-rail-icon"></div>
        <div class="wa-rail-icon"></div>
        <div class="wa-rail-icon"></div>
        <div class="wa-rail-icon is-active"></div>
        <div class="wa-rail-spacer"></div>
        <div class="wa-rail-icon"></div>
    </aside>

    <section class="wa-sidebar">
        <div class="wa-sidebar-header">
            <div>
                <p class="wa-eyebrow">Inbox</p>
                <h1>Conversations</h1>
            </div>
            <div class="wa-search">Live queue</div>
        </div>

        <div class="wa-filter-strip">
            <a class="wa-filter-pill <?php echo empty($filters['status']) ? 'is-selected' : ''; ?>" href="/inbox">All</a>
            <a class="wa-filter-pill <?php echo ($filters['status'] ?? '') === 'open' ? 'is-selected' : ''; ?>" href="/inbox?status=open">Open</a>
            <a class="wa-filter-pill <?php echo ($filters['status'] ?? '') === 'pending' ? 'is-selected' : ''; ?>" href="/inbox?status=pending">Pending</a>
            <a class="wa-filter-pill <?php echo ($filters['status'] ?? '') === 'closed' ? 'is-selected' : ''; ?>" href="/inbox?status=closed">Closed</a>
        </div>

        <div class="wa-account-list">
            <?php if (empty($conversations)): ?>
                <div class="wa-empty-note">No conversations yet.</div>
            <?php else: ?>
                <?php foreach ($conversations as $conversation): ?>
                    <a class="wa-account-item" href="/conversations/<?php echo (int) $conversation['id']; ?>">
                        <span class="wa-account-avatar"><?php echo strtoupper(substr($conversation['contact_name'] ?: 'U', 0, 1)); ?></span>
                        <span>
                            <strong><?php echo View::e($conversation['contact_name'] ?: 'Unknown contact'); ?></strong>
                            <small><?php echo View::e($conversation['channel_name']); ?> • <?php echo (int) $conversation['unread_count']; ?> unread</small>
                        </span>
                    </a>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>
    </section>

    <main class="wa-main">
        <div class="wa-toolbar">
            <div class="wa-toolbar-chip">Agent inbox</div>
            <div class="wa-toolbar-user">JA</div>
        </div>

        <div class="wa-content-card">
            <div class="wa-content-header">
                <div>
                    <p class="wa-eyebrow">Queue overview</p>
                    <h2>Customer conversations</h2>
                </div>
            </div>

            <div class="card">
                <div class="wa-content-header compact">
                    <div>
                        <p class="wa-eyebrow">Realtime mirror</p>
                        <h2>Firestore live feed</h2>
                    </div>
                </div>
                <div class="wa-account-list" data-firebase-inbox data-tenant-id="<?php echo (int) $tenantId; ?>">
                    <div class="wa-empty-note">Enable Firebase and anon auth to stream mirrored conversations here.</div>
                </div>
            </div>

            <?php if (empty($conversations)): ?>
                <div class="wa-empty-stage">
                    <div class="wa-empty-illustration"></div>
                    <h3>No active conversations</h3>
                    <p>Inbound messages and API-triggered replies will appear here for agents.</p>
                </div>
            <?php else: ?>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Contact</th>
                            <th>Channel</th>
                            <th>Status</th>
                            <th>Unread</th>
                            <th>Last message</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($conversations as $conversation): ?>
                            <tr>
                                <td>
                                    <strong><?php echo View::e($conversation['contact_name'] ?: 'Unknown contact'); ?></strong><br>
                                    <small><?php echo View::e($conversation['phone_number']); ?></small>
                                </td>
                                <td><?php echo View::e($conversation['channel_name']); ?></td>
                                <td><span class="badge badge-<?php echo View::e($conversation['status']); ?>"><?php echo View::e($conversation['status']); ?></span></td>
                                <td><?php echo (int) $conversation['unread_count']; ?></td>
                                <td><?php echo View::e($conversation['last_message_at'] ?: '-'); ?></td>
                                <td><a class="btn btn-small btn-primary" href="/conversations/<?php echo (int) $conversation['id']; ?>">Open</a></td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php endif; ?>
        </div>
    </main>
</div>

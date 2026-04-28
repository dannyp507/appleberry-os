<?php
// FILE: /app/views/flows/index.php
?>
<div class="wa-single-panel">
    <div class="page-header">
        <div>
            <p class="wa-eyebrow">Flow builder</p>
            <h1><?php echo View::e($bot['name']); ?> flows</h1>
            <p class="muted">Create trigger-based WhatsApp automations using keywords, menu taps, button replies, or fallback rules.</p>
        </div>
        <div class="actions">
            <a class="btn btn-secondary" href="/bots/<?php echo (int) $bot['id']; ?>">Back to bot</a>
            <a class="btn btn-primary" href="/bots/<?php echo (int) $bot['id']; ?>/flows/create">Create flow</a>
        </div>
    </div>

    <div class="flow-builder-intro card">
        <div class="flow-trigger-pill">1. Choose trigger</div>
        <div class="flow-trigger-pill">2. Add keywords or button IDs</div>
        <div class="flow-trigger-pill">3. Build response steps</div>
    </div>

    <?php if (empty($flows)): ?>
        <div class="wa-empty-stage compact">
            <div class="wa-empty-illustration violet"></div>
            <h3>No flows yet</h3>
            <p>Start with a keyword flow like <code>pricing</code>, <code>location</code>, or <code>book</code>, then attach text, media, or AI steps.</p>
        </div>
    <?php else: ?>
        <div class="flow-card-grid">
            <?php foreach ($flows as $flow): ?>
                <?php $keywords = array_filter(array_map('trim', explode(',', (string) $flow['trigger_value']))); ?>
                <article class="flow-card">
                    <div class="flow-card-top">
                        <div>
                            <p class="wa-eyebrow">Trigger</p>
                            <h3><?php echo View::e($flow['name']); ?></h3>
                        </div>
                        <span class="badge badge-<?php echo View::e($flow['status']); ?>"><?php echo View::e($flow['status']); ?></span>
                    </div>

                    <p class="muted"><?php echo View::e($flow['description'] ?: 'No description yet.'); ?></p>

                    <div class="flow-meta-row">
                        <span class="flow-type-badge"><?php echo View::e($flow['trigger_type']); ?></span>
                        <span class="muted">Priority <?php echo (int) $flow['priority']; ?></span>
                    </div>

                    <?php if (!empty($keywords)): ?>
                        <div class="flow-keyword-list">
                            <?php foreach ($keywords as $keyword): ?>
                                <span class="flow-keyword-chip"><?php echo View::e($keyword); ?></span>
                            <?php endforeach; ?>
                        </div>
                    <?php else: ?>
                        <p class="muted">No trigger values configured yet.</p>
                    <?php endif; ?>

                    <div class="actions">
                        <a class="btn btn-small btn-info" href="/flows/<?php echo (int) $flow['id']; ?>/steps">Response blocks</a>
                        <a class="btn btn-small btn-secondary" href="/flows/<?php echo (int) $flow['id']; ?>/edit">Edit trigger</a>
                        <form method="post" action="/flows/<?php echo (int) $flow['id']; ?>/delete" class="inline-form">
                            <?php echo CSRF::field(); ?>
                            <button class="btn btn-small btn-danger" type="submit">Delete</button>
                        </form>
                    </div>
                </article>
            <?php endforeach; ?>
        </div>
    <?php endif; ?>
</div>

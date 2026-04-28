<?php
// FILE: /app/views/bots/show.php
?>
<div class="wa-single-panel">
    <div class="page-header">
        <div>
            <p class="wa-eyebrow">Chatbot</p>
            <h1><?php echo View::e($bot['name']); ?></h1>
            <p class="muted"><?php echo View::e($bot['description'] ?: 'No bot description yet.'); ?></p>
        </div>
        <div class="actions">
            <a class="btn btn-secondary" href="/bots/<?php echo (int) $bot['id']; ?>/edit">Edit bot</a>
            <a class="btn btn-primary" href="/bots/<?php echo (int) $bot['id']; ?>/flows">Manage flows</a>
        </div>
    </div>
    <div class="stats-grid">
        <div class="stat-card"><h3>Status</h3><p><?php echo View::e($bot['status']); ?></p></div>
        <div class="stat-card"><h3>Flows</h3><p><?php echo (int) $bot['flow_count']; ?></p></div>
        <div class="stat-card"><h3>Knowledge Base</h3><p><?php echo (int) $bot['knowledge_base_count']; ?></p></div>
        <div class="stat-card"><h3>AI Tone</h3><p><?php echo View::e($bot['ai_tone']); ?></p></div>
    </div>
    <div class="wa-profile-grid">
        <div class="wa-profile-card">
            <span class="wa-metric-label">Connected account</span>
            <strong><?php echo View::e($bot['channel_name']); ?></strong>
            <small><?php echo View::e($bot['phone_number']); ?></small>
        </div>
        <div class="wa-profile-card">
            <span class="wa-metric-label">Language</span>
            <strong><?php echo View::e($bot['default_language']); ?></strong>
            <small>Default conversation locale</small>
        </div>
        <div class="wa-profile-card">
            <span class="wa-metric-label">AI fallback</span>
            <strong><?php echo (int) $bot['ai_enabled'] ? 'enabled' : 'disabled'; ?></strong>
            <small>Used when no flow rule matches</small>
        </div>
        <div class="wa-profile-card">
            <span class="wa-metric-label">Max length</span>
            <strong><?php echo (int) $bot['ai_max_length']; ?></strong>
            <small>Reply limit target for AI messages</small>
        </div>
    </div>
    <div class="wa-details-panel">
        <div>
            <span class="wa-metric-label">Next steps</span>
            <p>Build flows, connect knowledge base answers, and enable the bot on a live or sandbox WhatsApp account.</p>
        </div>
        <div class="actions">
            <form method="post" action="/bots/<?php echo (int) $bot['id']; ?>/toggle-status" class="inline-form">
                <?php echo CSRF::field(); ?>
                <button class="btn btn-success" type="submit"><?php echo $bot['status'] === 'active' ? 'Pause bot' : 'Activate bot'; ?></button>
            </form>
            <form method="post" action="/bots/<?php echo (int) $bot['id']; ?>/delete" class="inline-form">
                <?php echo CSRF::field(); ?>
                <button class="btn btn-danger" type="submit">Delete bot</button>
            </form>
        </div>
    </div>
</div>

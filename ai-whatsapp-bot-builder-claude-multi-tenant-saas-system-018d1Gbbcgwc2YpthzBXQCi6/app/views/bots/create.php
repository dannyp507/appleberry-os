<?php
// FILE: /app/views/bots/create.php
?>
<div class="wa-single-panel">
    <div class="page-header">
        <div>
            <p class="wa-eyebrow">Autoresponder</p>
            <h1>Create bot</h1>
        </div>
        <a class="btn btn-secondary" href="/bots">Back</a>
    </div>
    <div class="card">
        <form method="post" action="/bots/store">
            <?php echo CSRF::field(); ?>
            <div class="form-group">
                <label for="name">Bot Name</label>
                <input id="name" name="name" required>
            </div>
            <div class="form-group">
                <label for="description">Description</label>
                <textarea id="description" name="description" placeholder="Describe what this bot is responsible for."></textarea>
            </div>
            <div class="form-group">
                <label for="channel_id">WhatsApp Account</label>
                <select id="channel_id" name="channel_id" required>
                    <?php foreach ($channels as $channel): ?>
                        <option value="<?php echo (int) $channel['id']; ?>"><?php echo View::e($channel['name']); ?> (<?php echo View::e($channel['phone_number']); ?>)</option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div class="form-grid-two">
                <div class="form-group">
                    <label for="default_language">Default Language</label>
                    <input id="default_language" name="default_language" value="en">
                </div>
                <div class="form-group">
                    <label for="ai_tone">AI Tone</label>
                    <select id="ai_tone" name="ai_tone">
                        <option value="friendly">friendly</option>
                        <option value="formal">formal</option>
                        <option value="concise">concise</option>
                        <option value="professional">professional</option>
                    </select>
                </div>
            </div>
            <div class="form-grid-two">
                <div class="form-group">
                    <label for="ai_max_length">AI Max Length</label>
                    <input id="ai_max_length" name="ai_max_length" type="number" value="500" min="50">
                </div>
                <div class="form-group">
                    <label for="status">Status</label>
                    <select id="status" name="status">
                        <option value="draft">draft</option>
                        <option value="active">active</option>
                        <option value="paused">paused</option>
                    </select>
                </div>
            </div>
            <div class="form-group checkbox-row">
                <label class="checkbox-label">
                    <input type="checkbox" name="ai_enabled" value="1" checked>
                    <span>Enable AI fallback when no flow matches</span>
                </label>
            </div>
            <button class="btn btn-primary" type="submit">Create Bot</button>
        </form>
    </div>
</div>

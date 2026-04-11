<?php
// FILE: /app/views/bots/edit.php
?>
<div class="wa-single-panel">
    <div class="page-header">
        <div>
            <p class="wa-eyebrow">Chatbot</p>
            <h1>Edit bot</h1>
        </div>
        <a class="btn btn-secondary" href="/bots/<?php echo (int) $bot['id']; ?>">Back</a>
    </div>
    <div class="card">
        <form method="post" action="/bots/<?php echo (int) $bot['id']; ?>/update">
            <?php echo CSRF::field(); ?>
            <div class="form-group">
                <label for="name">Bot Name</label>
                <input id="name" name="name" value="<?php echo View::e($bot['name']); ?>" required>
            </div>
            <div class="form-group">
                <label for="description">Description</label>
                <textarea id="description" name="description"><?php echo View::e($bot['description']); ?></textarea>
            </div>
            <div class="form-group">
                <label for="channel_id">WhatsApp Account</label>
                <select id="channel_id" name="channel_id" required>
                    <?php foreach ($channels as $channel): ?>
                        <option value="<?php echo (int) $channel['id']; ?>" <?php echo (int) $bot['channel_id'] === (int) $channel['id'] ? 'selected' : ''; ?>>
                            <?php echo View::e($channel['name']); ?> (<?php echo View::e($channel['phone_number']); ?>)
                        </option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div class="form-grid-two">
                <div class="form-group">
                    <label for="default_language">Default Language</label>
                    <input id="default_language" name="default_language" value="<?php echo View::e($bot['default_language']); ?>">
                </div>
                <div class="form-group">
                    <label for="ai_tone">AI Tone</label>
                    <select id="ai_tone" name="ai_tone">
                        <?php foreach (['friendly', 'formal', 'concise', 'professional'] as $tone): ?>
                            <option value="<?php echo View::e($tone); ?>" <?php echo $bot['ai_tone'] === $tone ? 'selected' : ''; ?>><?php echo View::e($tone); ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
            </div>
            <div class="form-grid-two">
                <div class="form-group">
                    <label for="ai_max_length">AI Max Length</label>
                    <input id="ai_max_length" name="ai_max_length" type="number" value="<?php echo (int) $bot['ai_max_length']; ?>" min="50">
                </div>
                <div class="form-group">
                    <label for="status">Status</label>
                    <select id="status" name="status">
                        <?php foreach (['draft', 'active', 'paused'] as $status): ?>
                            <option value="<?php echo View::e($status); ?>" <?php echo $bot['status'] === $status ? 'selected' : ''; ?>><?php echo View::e($status); ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
            </div>
            <div class="form-group checkbox-row">
                <label class="checkbox-label">
                    <input type="checkbox" name="ai_enabled" value="1" <?php echo (int) $bot['ai_enabled'] ? 'checked' : ''; ?>>
                    <span>Enable AI fallback when no flow matches</span>
                </label>
            </div>
            <button class="btn btn-primary" type="submit">Save Changes</button>
        </form>
    </div>
</div>

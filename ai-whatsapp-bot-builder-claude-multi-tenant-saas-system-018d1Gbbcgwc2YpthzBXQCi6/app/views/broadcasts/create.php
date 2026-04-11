<?php
// FILE: /app/views/broadcasts/create.php
?>
<div class="wa-single-panel">
    <div class="page-header">
        <div>
            <p class="wa-eyebrow">Bulk messaging</p>
            <h1>Create campaign</h1>
        </div>
        <a class="btn btn-secondary" href="/broadcasts">Back</a>
    </div>

    <div class="card">
        <form method="post" action="/broadcasts/store">
        <?php echo CSRF::field(); ?>

        <div class="form-group">
            <label for="name">Broadcast Name</label>
            <input id="name" name="name" required>
        </div>

        <div class="form-group">
            <label for="channel_id">Channel</label>
            <select id="channel_id" name="channel_id" required>
                <?php foreach ($channels as $channel): ?>
                    <option value="<?php echo (int) $channel['id']; ?>"><?php echo View::e($channel['name']); ?> (<?php echo View::e($channel['provider_type']); ?>)</option>
                <?php endforeach; ?>
            </select>
        </div>

        <div class="form-group">
            <label for="template_id">Template</label>
            <select id="template_id" name="template_id">
                <option value="">None</option>
                <?php foreach ($templates as $template): ?>
                    <option value="<?php echo (int) $template['id']; ?>"><?php echo View::e($template['name']); ?></option>
                <?php endforeach; ?>
            </select>
        </div>

        <div class="form-group">
            <label for="message_content">Message Content</label>
            <textarea id="message_content" name="message_content" required placeholder="Hello {{name}}, thanks for being part of our WhatsApp community."></textarea>
            <small class="help-text">Supported variables: `{{name}}`, `{{phone_number}}`</small>
        </div>

        <div class="form-group">
            <label for="search">Recipient Search Filter</label>
            <input id="search" name="search" placeholder="Optional name, phone, or email filter">
        </div>

        <div class="form-group">
            <label for="tag">Tag Filter</label>
            <input id="tag" name="tag" placeholder="Optional exact tag name">
        </div>

            <button class="btn btn-primary" type="submit">Save Draft</button>
        </form>
    </div>
</div>

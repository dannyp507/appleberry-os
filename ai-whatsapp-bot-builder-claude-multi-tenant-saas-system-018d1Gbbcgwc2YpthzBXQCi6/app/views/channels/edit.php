<?php
// FILE: /app/views/channels/edit.php
$providerConfig = isset($channel['provider_config_decoded']) ? $channel['provider_config_decoded'] : [];
$providerConfigJson = !empty($channel['provider_config'])
    ? json_encode(json_decode($channel['provider_config'], true), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
    : '';
?>
<div class="wa-single-panel">
    <div class="page-header">
        <div>
            <p class="wa-eyebrow">Whatsapp</p>
            <h1>Edit account</h1>
            <p>Update connector details, tokens, and channel status.</p>
        </div>
        <a class="btn btn-secondary" href="/channels/<?php echo (int) $channel['id']; ?>">Back</a>
    </div>

    <div class="card">
        <form method="post" action="/channels/<?php echo (int) $channel['id']; ?>/update" class="wa-account-form">
            <?php echo CSRF::field(); ?>

            <div class="form-group">
                <label for="name">Account Name</label>
                <input id="name" name="name" value="<?php echo View::e($channel['name']); ?>" required>
            </div>

            <div class="form-group">
                <label for="phone_number">WhatsApp Number</label>
                <input id="phone_number" name="phone_number" value="<?php echo View::e($channel['phone_number']); ?>" required>
            </div>

            <div class="form-group">
                <label for="provider_type">Provider Type</label>
                <select id="provider_type" name="provider_type" required>
                    <?php foreach (['sandbox', 'cloud_api', 'twilio', 'other'] as $type): ?>
                    <option value="<?php echo View::e($type); ?>" <?php echo $channel['provider_type'] === $type ? 'selected' : ''; ?>>
                        <?php echo View::e($type); ?>
                    </option>
                    <?php endforeach; ?>
                </select>
            </div>

            <div class="form-group">
                <label for="instance_id">Instance ID</label>
                <input id="instance_id" name="instance_id" value="<?php echo View::e($providerConfig['instance_id'] ?? ''); ?>">
            </div>

            <div class="form-group">
                <label for="access_token">Access Token</label>
                <input id="access_token" name="access_token" value="<?php echo View::e($providerConfig['access_token'] ?? ''); ?>">
            </div>

            <div class="form-group">
                <label for="webhook_url">Webhook / Connector URL</label>
                <input id="webhook_url" name="webhook_url" value="<?php echo View::e($channel['webhook_url']); ?>">
            </div>

            <div class="form-group">
                <label for="outbound_url">Outbound URL</label>
                <input id="outbound_url" name="outbound_url" value="<?php echo View::e($providerConfig['outbound_url'] ?? ''); ?>">
            </div>

            <div class="form-group">
                <label for="api_key_header">API Key Header</label>
                <input id="api_key_header" name="api_key_header" value="<?php echo View::e($providerConfig['api_key_header'] ?? ''); ?>">
            </div>

            <div class="form-group">
                <label for="api_key">API Key</label>
                <input id="api_key" name="api_key" value="<?php echo View::e($providerConfig['api_key'] ?? ''); ?>">
            </div>

            <div class="form-group">
                <label for="bearer_token">Bearer Token</label>
                <input id="bearer_token" name="bearer_token" value="<?php echo View::e($providerConfig['bearer_token'] ?? ''); ?>">
            </div>

            <div class="form-group">
                <label for="provider_config">Provider Config JSON</label>
                <textarea id="provider_config" name="provider_config"><?php echo View::e($providerConfigJson); ?></textarea>
            </div>

            <div class="form-group">
                <label for="status">Status</label>
                <select id="status" name="status">
                    <option value="active" <?php echo $channel['status'] === 'active' ? 'selected' : ''; ?>>active</option>
                    <option value="inactive" <?php echo $channel['status'] === 'inactive' ? 'selected' : ''; ?>>inactive</option>
                </select>
            </div>

            <div class="form-actions">
                <button class="btn btn-primary" type="submit">Save Changes</button>
                <a class="btn btn-secondary" href="/channels/<?php echo (int) $channel['id']; ?>">Cancel</a>
            </div>
        </form>
    </div>
</div>

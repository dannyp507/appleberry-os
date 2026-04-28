<?php
// FILE: /app/views/settings/api_keys.php
$session = new Session();
$rawKey = $session->getFlash('api_key');
?>
<div class="wa-single-panel">
    <div class="page-header">
        <div>
            <p class="wa-eyebrow">API</p>
            <h1>REST access keys</h1>
            <p class="muted">Use these keys for `/api/v1/send-message` and your provider bridge.</p>
        </div>
    </div>
    <?php if (!empty($rawKey)): ?>
        <div class="card">
            <span class="wa-metric-label">New raw API key</span>
            <p class="mono-block"><?php echo View::e($rawKey); ?></p>
            <small class="help-text">This is the only time the full key is shown.</small>
        </div>
    <?php endif; ?>
    <div class="card">
        <form method="post" action="/settings/generate-api-key" class="api-key-form">
            <?php echo CSRF::field(); ?>
            <div class="form-group">
                <label for="name">Key Name</label>
                <input id="name" name="name" placeholder="Outbound connector key" required>
            </div>
            <button class="btn btn-primary" type="submit">Generate API Key</button>
        </form>
    </div>
    <div class="card">
        <h2>Issued Keys</h2>
        <?php if (empty($apiKeys)): ?>
            <div class="wa-empty-stage compact">
                <div class="wa-empty-illustration"></div>
                <p>No API keys have been issued yet.</p>
            </div>
        <?php else: ?>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Prefix</th>
                        <th>Status</th>
                        <th>Last used</th>
                        <th>Created</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($apiKeys as $apiKey): ?>
                        <tr>
                            <td><?php echo View::e($apiKey['name']); ?></td>
                            <td><code><?php echo View::e($apiKey['key_prefix']); ?></code></td>
                            <td><span class="badge badge-<?php echo View::e($apiKey['status']); ?>"><?php echo View::e($apiKey['status']); ?></span></td>
                            <td><?php echo View::e($apiKey['last_used_at'] ?: 'Never'); ?></td>
                            <td><?php echo View::e($apiKey['created_at']); ?></td>
                            <td>
                                <?php if ($apiKey['status'] === 'active'): ?>
                                    <form method="post" action="/settings/revoke-api-key" class="inline-form">
                                        <?php echo CSRF::field(); ?>
                                        <input type="hidden" name="key_id" value="<?php echo (int) $apiKey['id']; ?>">
                                        <button class="btn btn-small btn-danger" type="submit">Revoke</button>
                                    </form>
                                <?php else: ?>
                                    <span class="muted">Revoked</span>
                                <?php endif; ?>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        <?php endif; ?>
    </div>
</div>

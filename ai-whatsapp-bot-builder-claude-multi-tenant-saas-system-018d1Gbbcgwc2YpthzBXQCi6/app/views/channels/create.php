<?php
// FILE: /app/views/channels/create.php
?>
<div class="wa-single-panel">
    <div class="page-header">
        <div>
            <p class="wa-eyebrow">Whatsapp</p>
            <h1>Add account</h1>
            <p>Save the WhatsApp number, connector endpoint, and provider credentials for testing.</p>
        </div>
        <a class="btn btn-secondary" href="/channels">Back</a>
    </div>

    <div class="card">
        <form method="post" action="/channels/store" class="wa-account-form">
            <?php echo CSRF::field(); ?>

            <div class="form-group">
                <label for="name">Account Name</label>
                <input id="name" name="name" placeholder="Appleberry Care Centre" required>
            </div>

            <div class="form-group">
                <label for="phone_number">WhatsApp Number</label>
                <input id="phone_number" name="phone_number" placeholder="27828861110@s.whatsapp.net" required>
            </div>

            <div class="form-group">
                <label for="provider_type">Provider Type</label>
                <select id="provider_type" name="provider_type" required>
                    <option value="sandbox">Sandbox</option>
                    <option value="cloud_api">Cloud API</option>
                    <option value="twilio">Twilio</option>
                    <option value="other">Other HTTP Connector</option>
                </select>
            </div>

            <div class="form-group">
                <label for="instance_id">Instance ID</label>
                <input id="instance_id" name="instance_id" placeholder="68AF28A69A5E2">
            </div>

            <div class="form-group">
                <label for="access_token">Access Token</label>
                <input id="access_token" name="access_token" placeholder="68a43c31abd56">
            </div>

            <div class="form-group">
                <label for="webhook_url">Webhook / Connector URL</label>
                <input id="webhook_url" name="webhook_url" placeholder="https://your-connector.example.com/messages">
            </div>

            <div class="form-group">
                <label for="outbound_url">Outbound URL</label>
                <input id="outbound_url" name="outbound_url" placeholder="https://your-connector.example.com/send">
            </div>

            <div class="form-group">
                <label for="api_key_header">API Key Header</label>
                <input id="api_key_header" name="api_key_header" placeholder="X-API-Key">
            </div>

            <div class="form-group">
                <label for="api_key">API Key</label>
                <input id="api_key" name="api_key" placeholder="connector-secret">
            </div>

            <div class="form-group">
                <label for="bearer_token">Bearer Token</label>
                <input id="bearer_token" name="bearer_token" placeholder="Optional alternative bearer token">
            </div>

            <div class="form-group">
                <label for="provider_config">Provider Config JSON</label>
                <textarea id="provider_config" name="provider_config" placeholder='{"headers":{"X-Workspace":"appleberry"}}'></textarea>
                <small class="help-text">Optional extra JSON for custom headers or provider-specific settings.</small>
            </div>

            <div class="form-actions">
                <button class="btn btn-primary" type="submit">Save Account</button>
                <a class="btn btn-secondary" href="/channels">Cancel</a>
            </div>
        </form>
    </div>
</div>

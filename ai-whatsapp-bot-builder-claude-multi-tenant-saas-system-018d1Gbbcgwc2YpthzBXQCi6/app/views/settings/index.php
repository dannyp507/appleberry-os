<?php
// FILE: /app/views/settings/index.php
?>
<div class="wa-single-panel">
    <div class="page-header">
        <div>
            <p class="wa-eyebrow">Workspace</p>
            <h1>Tenant settings</h1>
        </div>
        <a class="btn btn-secondary" href="/settings/api-keys">Manage API keys</a>
    </div>
    <div class="card">
        <form method="post" action="/settings/update">
            <?php echo CSRF::field(); ?>
            <div class="form-grid-two">
                <div class="form-group">
                    <label for="name">Business Name</label>
                    <input id="name" name="name" value="<?php echo View::e($tenant['name']); ?>" required>
                </div>
                <div class="form-group">
                    <label for="industry">Industry</label>
                    <input id="industry" name="industry" value="<?php echo View::e($tenant['industry']); ?>">
                </div>
            </div>
            <div class="form-grid-two">
                <div class="form-group">
                    <label for="email">Email</label>
                    <input id="email" name="email" value="<?php echo View::e($tenant['email']); ?>" required>
                </div>
                <div class="form-group">
                    <label for="phone">Phone</label>
                    <input id="phone" name="phone" value="<?php echo View::e($tenant['phone']); ?>">
                </div>
            </div>
            <div class="form-group">
                <label for="timezone">Timezone</label>
                <input id="timezone" name="timezone" value="<?php echo View::e($tenant['timezone']); ?>">
            </div>
            <button class="btn btn-primary" type="submit">Save Settings</button>
        </form>
    </div>
</div>

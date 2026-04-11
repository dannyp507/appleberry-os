<!-- FILE: /app/views/users/create.php -->
<div class="dashboard">
    <div class="section-header">
        <div>
            <h1>Create User</h1>
            <p>Add a tenant admin, developer, or agent to the platform.</p>
        </div>
        <a href="/users" class="btn btn-secondary">Back to Users</a>
    </div>

    <div class="section">
        <form method="POST" action="/users/store" class="form-card">
            <?php echo CSRF::field(); ?>

            <?php if (!empty($tenants)): ?>
            <div class="form-group">
                <label for="tenant_id">Tenant</label>
                <select id="tenant_id" name="tenant_id" class="form-control" required>
                    <option value="">Select tenant</option>
                    <?php foreach ($tenants as $tenant): ?>
                    <option value="<?php echo (int) $tenant['id']; ?>"><?php echo View::e($tenant['name']); ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <?php endif; ?>

            <div class="form-group">
                <label for="name">Name</label>
                <input type="text" id="name" name="name" class="form-control" required>
            </div>

            <div class="form-group">
                <label for="email">Email</label>
                <input type="email" id="email" name="email" class="form-control" required>
            </div>

            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" class="form-control" required>
            </div>

            <div class="form-group">
                <label for="role">Role</label>
                <select id="role" name="role" class="form-control" required>
                    <option value="tenant_admin">Tenant Admin</option>
                    <option value="developer">Developer</option>
                    <option value="agent">Agent</option>
                </select>
            </div>

            <div class="form-actions">
                <button type="submit" class="btn btn-primary">Create User</button>
                <a href="/users" class="btn btn-secondary">Cancel</a>
            </div>
        </form>
    </div>
</div>

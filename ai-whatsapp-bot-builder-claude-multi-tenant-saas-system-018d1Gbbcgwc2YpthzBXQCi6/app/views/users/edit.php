<!-- FILE: /app/views/users/edit.php -->
<div class="dashboard">
    <div class="section-header">
        <div>
            <h1>Edit User</h1>
            <p>Update role, status, and login details.</p>
        </div>
        <a href="/users" class="btn btn-secondary">Back to Users</a>
    </div>

    <div class="section">
        <form method="POST" action="/users/<?php echo (int) $user['id']; ?>/update" class="form-card">
            <?php echo CSRF::field(); ?>

            <?php if (!empty($tenants)): ?>
            <div class="form-group">
                <label for="tenant_id">Tenant</label>
                <select id="tenant_id" name="tenant_id" class="form-control" required>
                    <?php foreach ($tenants as $tenant): ?>
                    <option value="<?php echo (int) $tenant['id']; ?>" <?php echo (int) $user['tenant_id'] === (int) $tenant['id'] ? 'selected' : ''; ?>>
                        <?php echo View::e($tenant['name']); ?>
                    </option>
                    <?php endforeach; ?>
                </select>
            </div>
            <?php endif; ?>

            <div class="form-group">
                <label for="name">Name</label>
                <input type="text" id="name" name="name" class="form-control" value="<?php echo View::e($user['name']); ?>" required>
            </div>

            <div class="form-group">
                <label for="email">Email</label>
                <input type="email" id="email" name="email" class="form-control" value="<?php echo View::e($user['email']); ?>" required>
            </div>

            <div class="form-group">
                <label for="password">New Password</label>
                <input type="password" id="password" name="password" class="form-control">
            </div>

            <div class="form-group">
                <label for="role">Role</label>
                <select id="role" name="role" class="form-control" required>
                    <?php foreach (['tenant_admin', 'developer', 'agent'] as $role): ?>
                    <option value="<?php echo $role; ?>" <?php echo $user['role'] === $role ? 'selected' : ''; ?>>
                        <?php echo ucwords(str_replace('_', ' ', $role)); ?>
                    </option>
                    <?php endforeach; ?>
                </select>
            </div>

            <div class="form-group">
                <label for="status">Status</label>
                <select id="status" name="status" class="form-control" required>
                    <?php foreach (['active', 'inactive'] as $status): ?>
                    <option value="<?php echo $status; ?>" <?php echo $user['status'] === $status ? 'selected' : ''; ?>>
                        <?php echo ucfirst($status); ?>
                    </option>
                    <?php endforeach; ?>
                </select>
            </div>

            <div class="form-actions">
                <button type="submit" class="btn btn-primary">Save Changes</button>
                <a href="/users" class="btn btn-secondary">Cancel</a>
            </div>
        </form>

        <form method="POST" action="/users/<?php echo (int) $user['id']; ?>/delete" onsubmit="return confirm('Delete this user?');" style="margin-top: 1rem;">
            <?php echo CSRF::field(); ?>
            <button type="submit" class="btn btn-danger">Delete User</button>
        </form>
    </div>
</div>

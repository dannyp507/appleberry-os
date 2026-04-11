<!-- FILE: /app/views/users/index.php -->
<div class="dashboard">
    <div class="section-header">
        <div>
            <h1>Users</h1>
            <p>Manage workspace operators, agents, and tenant admins.</p>
        </div>
        <a href="/users/create" class="btn btn-primary">Create User</a>
    </div>

    <div class="section">
        <?php if (!empty($users)): ?>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <?php if (!empty($tenantLookup)): ?>
                    <th>Tenant</th>
                    <?php endif; ?>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($users as $user): ?>
                <tr>
                    <td><?php echo View::e($user['name']); ?></td>
                    <td><?php echo View::e($user['email']); ?></td>
                    <?php if (!empty($tenantLookup)): ?>
                    <td><?php echo View::e($tenantLookup[$user['tenant_id']] ?? 'Platform'); ?></td>
                    <?php endif; ?>
                    <td><?php echo View::e($user['role']); ?></td>
                    <td>
                        <span class="badge badge-<?php echo View::e($user['status']); ?>">
                            <?php echo View::e($user['status']); ?>
                        </span>
                    </td>
                    <td><?php echo View::e($user['last_login_at'] ?: 'Never'); ?></td>
                    <td>
                        <a href="/users/<?php echo (int) $user['id']; ?>/edit" class="btn btn-small">Edit</a>
                    </td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
        <?php else: ?>
        <p>No users found yet.</p>
        <?php endif; ?>
    </div>
</div>

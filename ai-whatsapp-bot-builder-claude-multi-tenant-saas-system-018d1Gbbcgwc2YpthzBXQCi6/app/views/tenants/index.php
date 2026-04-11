<!-- FILE: /app/views/tenants/index.php -->
<div class="dashboard">
    <div class="section-header">
        <div>
            <h1>Tenants</h1>
            <p>Manage client workspaces, status, and access from one place.</p>
        </div>
        <a href="/tenants/create" class="btn btn-primary">Create Tenant</a>
    </div>

    <div class="section">
        <?php if (!empty($tenants)): ?>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Slug</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($tenants as $tenant): ?>
                <tr>
                    <td><?php echo View::e($tenant['name']); ?></td>
                    <td><?php echo View::e($tenant['slug']); ?></td>
                    <td><?php echo View::e($tenant['email']); ?></td>
                    <td><?php echo View::e($tenant['phone'] ?: '-'); ?></td>
                    <td>
                        <span class="badge badge-<?php echo View::e($tenant['status']); ?>">
                            <?php echo View::e($tenant['status']); ?>
                        </span>
                    </td>
                    <td><?php echo View::e(date('M d, Y', strtotime($tenant['created_at']))); ?></td>
                    <td>
                        <a href="/tenants/<?php echo (int) $tenant['id']; ?>" class="btn btn-small">View</a>
                        <a href="/tenants/<?php echo (int) $tenant['id']; ?>/edit" class="btn btn-small">Edit</a>
                    </td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
        <?php else: ?>
        <p>No tenants found yet.</p>
        <?php endif; ?>
    </div>
</div>

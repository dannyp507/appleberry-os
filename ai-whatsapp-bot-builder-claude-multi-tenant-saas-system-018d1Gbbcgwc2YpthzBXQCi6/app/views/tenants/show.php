<!-- FILE: /app/views/tenants/show.php -->
<div class="dashboard">
    <div class="section-header">
        <div>
            <h1><?php echo View::e($tenant['name']); ?></h1>
            <p>Workspace profile, subscription snapshot, and account controls.</p>
        </div>
        <div>
            <a href="/tenants/<?php echo (int) $tenant['id']; ?>/edit" class="btn btn-primary">Edit Tenant</a>
            <a href="/tenants" class="btn btn-secondary">Back to Tenants</a>
        </div>
    </div>

    <div class="stats-grid">
        <div class="stat-card">
            <h3>Status</h3>
            <p class="stat-number"><?php echo View::e(ucfirst($tenant['status'])); ?></p>
        </div>
        <div class="stat-card">
            <h3>Plan</h3>
            <p class="stat-number"><?php echo View::e($tenant['plan_name'] ?: 'No active plan'); ?></p>
        </div>
        <div class="stat-card">
            <h3>Subscription</h3>
            <p class="stat-number"><?php echo View::e($tenant['subscription_status'] ?: 'inactive'); ?></p>
        </div>
    </div>

    <div class="section">
        <h2>Tenant Details</h2>
        <table class="data-table">
            <tbody>
                <tr>
                    <th>Name</th>
                    <td><?php echo View::e($tenant['name']); ?></td>
                </tr>
                <tr>
                    <th>Slug</th>
                    <td><?php echo View::e($tenant['slug']); ?></td>
                </tr>
                <tr>
                    <th>Email</th>
                    <td><?php echo View::e($tenant['email']); ?></td>
                </tr>
                <tr>
                    <th>Phone</th>
                    <td><?php echo View::e($tenant['phone'] ?: '-'); ?></td>
                </tr>
                <tr>
                    <th>Industry</th>
                    <td><?php echo View::e($tenant['industry'] ?: '-'); ?></td>
                </tr>
                <tr>
                    <th>Timezone</th>
                    <td><?php echo View::e($tenant['timezone']); ?></td>
                </tr>
                <tr>
                    <th>Created</th>
                    <td><?php echo View::e(date('M d, Y H:i', strtotime($tenant['created_at']))); ?></td>
                </tr>
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>Danger Zone</h2>
        <form method="POST" action="/tenants/<?php echo (int) $tenant['id']; ?>/delete" onsubmit="return confirm('Delete this tenant? This cannot be undone.');">
            <?php echo CSRF::field(); ?>
            <button type="submit" class="btn btn-danger">Delete Tenant</button>
        </form>
    </div>
</div>

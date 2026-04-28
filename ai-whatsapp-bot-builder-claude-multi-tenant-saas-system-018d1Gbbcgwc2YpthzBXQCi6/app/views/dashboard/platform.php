<!-- FILE: /app/views/dashboard/platform.php -->
<div class="dashboard">
    <h1>Platform Dashboard</h1>
    <p>Monitor tenants, users, and overall workspace growth from one place.</p>

    <div class="stats-grid">
        <div class="stat-card">
            <h3>Total Tenants</h3>
            <p class="stat-number"><?php echo (int) $stats['total_tenants']; ?></p>
        </div>
        <div class="stat-card">
            <h3>Active Tenants</h3>
            <p class="stat-number"><?php echo (int) $stats['active_tenants']; ?></p>
        </div>
        <div class="stat-card">
            <h3>Total Users</h3>
            <p class="stat-number"><?php echo (int) $stats['total_users']; ?></p>
        </div>
    </div>

    <div class="section">
        <h2>Recent Tenants</h2>
        <?php if (!empty($recentTenants)): ?>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Slug</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Created</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($recentTenants as $tenant): ?>
                <tr>
                    <td><?php echo View::e($tenant['name']); ?></td>
                    <td><?php echo View::e($tenant['slug']); ?></td>
                    <td><?php echo View::e($tenant['email']); ?></td>
                    <td>
                        <span class="badge badge-<?php echo View::e($tenant['status']); ?>">
                            <?php echo View::e($tenant['status']); ?>
                        </span>
                    </td>
                    <td><?php echo View::e(date('M d, Y', strtotime($tenant['created_at']))); ?></td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
        <?php else: ?>
        <p>No tenants found yet.</p>
        <?php endif; ?>
    </div>
</div>

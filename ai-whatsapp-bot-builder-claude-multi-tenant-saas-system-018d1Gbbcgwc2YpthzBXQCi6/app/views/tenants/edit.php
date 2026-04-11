<!-- FILE: /app/views/tenants/edit.php -->
<div class="dashboard">
    <div class="section-header">
        <div>
            <h1>Edit Tenant</h1>
            <p>Update workspace information and account status.</p>
        </div>
        <a href="/tenants/<?php echo (int) $tenant['id']; ?>" class="btn btn-secondary">View Tenant</a>
    </div>

    <div class="section">
        <form method="POST" action="/tenants/<?php echo (int) $tenant['id']; ?>/update" class="form-card">
            <?php echo CSRF::field(); ?>

            <div class="form-group">
                <label for="name">Tenant Name</label>
                <input type="text" id="name" name="name" class="form-control" value="<?php echo View::e($tenant['name']); ?>" required>
            </div>

            <div class="form-group">
                <label for="email">Email</label>
                <input type="email" id="email" name="email" class="form-control" value="<?php echo View::e($tenant['email']); ?>" required>
            </div>

            <div class="form-group">
                <label for="phone">Phone</label>
                <input type="text" id="phone" name="phone" class="form-control" value="<?php echo View::e($tenant['phone']); ?>">
            </div>

            <div class="form-group">
                <label for="industry">Industry</label>
                <input type="text" id="industry" name="industry" class="form-control" value="<?php echo View::e($tenant['industry']); ?>">
            </div>

            <div class="form-group">
                <label for="status">Status</label>
                <select id="status" name="status" class="form-control">
                    <?php foreach (['active', 'suspended', 'cancelled'] as $status): ?>
                    <option value="<?php echo $status; ?>" <?php echo $tenant['status'] === $status ? 'selected' : ''; ?>>
                        <?php echo ucfirst($status); ?>
                    </option>
                    <?php endforeach; ?>
                </select>
            </div>

            <div class="form-actions">
                <button type="submit" class="btn btn-primary">Save Changes</button>
                <a href="/tenants/<?php echo (int) $tenant['id']; ?>" class="btn btn-secondary">Cancel</a>
            </div>
        </form>
    </div>
</div>

<!-- FILE: /app/views/tenants/create.php -->
<div class="dashboard">
    <div class="section-header">
        <div>
            <h1>Create Tenant</h1>
            <p>Set up a new workspace for a client or internal business unit.</p>
        </div>
        <a href="/tenants" class="btn btn-secondary">Back to Tenants</a>
    </div>

    <div class="section">
        <form method="POST" action="/tenants/store" class="form-card">
            <?php echo CSRF::field(); ?>

            <div class="form-group">
                <label for="name">Tenant Name</label>
                <input type="text" id="name" name="name" class="form-control" required>
            </div>

            <div class="form-group">
                <label for="email">Email</label>
                <input type="email" id="email" name="email" class="form-control" required>
            </div>

            <div class="form-group">
                <label for="phone">Phone</label>
                <input type="text" id="phone" name="phone" class="form-control">
            </div>

            <div class="form-group">
                <label for="industry">Industry</label>
                <input type="text" id="industry" name="industry" class="form-control">
            </div>

            <div class="form-actions">
                <button type="submit" class="btn btn-primary">Create Tenant</button>
                <a href="/tenants" class="btn btn-secondary">Cancel</a>
            </div>
        </form>
    </div>
</div>

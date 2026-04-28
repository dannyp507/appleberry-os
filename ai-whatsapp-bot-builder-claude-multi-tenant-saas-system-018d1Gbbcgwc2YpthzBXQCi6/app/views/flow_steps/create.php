<?php
// FILE: /app/views/flow_steps/create.php
?>
<div class="wa-single-panel">
    <div class="page-header">
        <div>
            <p class="wa-eyebrow">Flow steps</p>
            <h1>Create step</h1>
        </div>
        <a class="btn btn-secondary" href="/flows/<?php echo (int) $flowId; ?>/steps">Back</a>
    </div>
    <div class="card">
        <form method="post" action="/flows/<?php echo (int) $flowId; ?>/steps/store">
            <?php echo CSRF::field(); ?>
            <?php include __DIR__ . '/form.php'; ?>
            <button class="btn btn-primary" type="submit">Create Step</button>
        </form>
    </div>
</div>

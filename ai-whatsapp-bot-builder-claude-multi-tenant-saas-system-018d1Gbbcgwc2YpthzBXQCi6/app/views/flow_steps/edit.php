<?php
// FILE: /app/views/flow_steps/edit.php
$config = json_decode($step['action_config'], true);
if (!is_array($config)) {
    $config = [];
}
?>
<div class="wa-single-panel">
    <div class="page-header">
        <div>
            <p class="wa-eyebrow">Flow steps</p>
            <h1>Edit step</h1>
        </div>
        <a class="btn btn-secondary" href="/flows/<?php echo (int) $step['flow_id']; ?>/steps">Back</a>
    </div>
    <div class="card">
        <form method="post" action="/steps/<?php echo (int) $step['id']; ?>/update">
            <?php echo CSRF::field(); ?>
            <?php include __DIR__ . '/form.php'; ?>
            <button class="btn btn-primary" type="submit">Save Step</button>
        </form>
    </div>
</div>

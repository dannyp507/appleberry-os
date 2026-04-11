<?php
// FILE: /app/views/flow_steps/index.php
?>
<div class="wa-single-panel">
    <div class="page-header">
        <div>
            <p class="wa-eyebrow">Response builder</p>
            <h1><?php echo View::e($flow['name'] ?? 'Flow'); ?> blocks</h1>
            <p class="muted">Stack response blocks in order. Each block runs top to bottom after the trigger matches.</p>
        </div>
        <div class="actions">
            <a class="btn btn-secondary" href="/bots/<?php echo (int) ($flow['bot_id'] ?? 0); ?>/flows">Back to flows</a>
            <a class="btn btn-primary" href="/flows/<?php echo (int) $flowId; ?>/steps/create">Add response block</a>
        </div>
    </div>

    <?php if (empty($steps)): ?>
        <div class="wa-empty-stage compact">
            <div class="wa-empty-illustration"></div>
            <h3>No response blocks yet</h3>
            <p>Add a text reply, media message, question, AI call, or variable step to complete this automation.</p>
        </div>
    <?php else: ?>
        <div class="step-card-list">
            <?php foreach ($steps as $step): ?>
                <?php $config = json_decode($step['action_config'], true); ?>
                <?php $config = is_array($config) ? $config : []; ?>
                <article class="step-card">
                    <div class="step-card-top">
                        <div class="step-order-pill">Step <?php echo (int) $step['step_order']; ?></div>
                        <span class="flow-type-badge"><?php echo View::e($step['action_type']); ?></span>
                    </div>

                    <div class="step-card-body">
                        <?php if (!empty($config['message'])): ?>
                            <p><?php echo nl2br(View::e($config['message'])); ?></p>
                        <?php elseif (!empty($config['question'])): ?>
                            <p><strong>Question:</strong> <?php echo View::e($config['question']); ?></p>
                        <?php elseif (!empty($config['prompt'])): ?>
                            <p><strong>AI Prompt:</strong> <?php echo View::e($config['prompt']); ?></p>
                        <?php elseif (!empty($config['key']) || !empty($config['value'])): ?>
                            <p><strong>Variable:</strong> <?php echo View::e(($config['key'] ?? '') . ' = ' . ($config['value'] ?? '')); ?></p>
                        <?php else: ?>
                            <p class="muted">This block uses advanced JSON or an empty config.</p>
                        <?php endif; ?>

                        <?php if (!empty($config['media_url'])): ?>
                            <p class="muted">Media: <?php echo View::e($config['media_url']); ?></p>
                        <?php endif; ?>
                        <?php if (!empty($config['variable'])): ?>
                            <p class="muted">Capture variable: <?php echo View::e($config['variable']); ?></p>
                        <?php endif; ?>
                    </div>

                    <div class="actions">
                        <a class="btn btn-small btn-secondary" href="/steps/<?php echo (int) $step['id']; ?>/edit">Edit block</a>
                        <form method="post" action="/steps/<?php echo (int) $step['id']; ?>/delete" class="inline-form">
                            <?php echo CSRF::field(); ?>
                            <button class="btn btn-small btn-danger" type="submit">Delete</button>
                        </form>
                    </div>
                </article>
            <?php endforeach; ?>
        </div>
    <?php endif; ?>
</div>

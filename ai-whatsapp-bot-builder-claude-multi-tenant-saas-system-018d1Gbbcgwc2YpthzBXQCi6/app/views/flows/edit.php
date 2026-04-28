<?php
// FILE: /app/views/flows/edit.php
$triggerOptions = [
    'keyword' => ['label' => 'Keyword match', 'hint' => 'Run when the message exactly matches one of your keywords.'],
    'message_contains' => ['label' => 'Message contains', 'hint' => 'Run when the message includes any keyword or phrase.'],
    'default' => ['label' => 'Fallback flow', 'hint' => 'Use this when no other keyword flow matches.'],
    'menu' => ['label' => 'Menu selection', 'hint' => 'Run after a structured menu option is selected.'],
    'button' => ['label' => 'Button reply', 'hint' => 'Run after a quick reply or template button is pressed.'],
];
?>
<div class="wa-single-panel">
    <div class="page-header">
        <div>
            <p class="wa-eyebrow">Flow builder</p>
            <h1>Edit flow</h1>
            <p class="muted">Refine the trigger and keywords that launch this automation.</p>
        </div>
        <div class="actions">
            <a class="btn btn-secondary" href="/bots/<?php echo (int) $flow['bot_id']; ?>/flows">Back</a>
            <a class="btn btn-primary" href="/flows/<?php echo (int) $flow['id']; ?>/steps">Response blocks</a>
        </div>
    </div>

    <div class="card">
        <form method="post" action="/flows/<?php echo (int) $flow['id']; ?>/update" class="flow-builder-form">
            <?php echo CSRF::field(); ?>

            <div class="form-group">
                <label for="name">Flow Name</label>
                <input id="name" name="name" value="<?php echo View::e($flow['name']); ?>" required>
            </div>

            <div class="form-group">
                <label for="description">Description</label>
                <textarea id="description" name="description"><?php echo View::e($flow['description']); ?></textarea>
            </div>

            <div class="form-group">
                <label for="trigger_type">Trigger Type</label>
                <select id="trigger_type" name="trigger_type">
                    <?php foreach ($triggerOptions as $type => $option): ?>
                        <option value="<?php echo View::e($type); ?>" <?php echo $flow['trigger_type'] === $type ? 'selected' : ''; ?>>
                            <?php echo View::e($option['label']); ?>
                        </option>
                    <?php endforeach; ?>
                </select>
            </div>

            <div class="flow-trigger-grid">
                <?php foreach ($triggerOptions as $type => $option): ?>
                    <div class="flow-trigger-card <?php echo $flow['trigger_type'] === $type ? 'is-selected' : ''; ?>">
                        <strong><?php echo View::e($option['label']); ?></strong>
                        <small><?php echo View::e($option['hint']); ?></small>
                    </div>
                <?php endforeach; ?>
            </div>

            <div class="form-grid-two">
                <div class="form-group">
                    <label for="trigger_value">Keywords / Trigger Values</label>
                    <input id="trigger_value" name="trigger_value" value="<?php echo View::e($flow['trigger_value']); ?>">
                </div>
                <div class="form-group">
                    <label for="priority">Priority</label>
                    <input id="priority" name="priority" type="number" value="<?php echo (int) $flow['priority']; ?>">
                </div>
            </div>

            <div class="form-group">
                <label for="status">Status</label>
                <select id="status" name="status">
                    <option value="active" <?php echo $flow['status'] === 'active' ? 'selected' : ''; ?>>active</option>
                    <option value="inactive" <?php echo $flow['status'] === 'inactive' ? 'selected' : ''; ?>>inactive</option>
                </select>
            </div>

            <div class="form-actions">
                <button class="btn btn-primary" type="submit">Save flow</button>
                <a class="btn btn-secondary" href="/flows/<?php echo (int) $flow['id']; ?>/steps">Manage steps</a>
            </div>
        </form>
    </div>
</div>

<?php
// FILE: /app/views/flows/create.php
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
            <h1>Create flow</h1>
            <p class="muted">Build a WhatsApp automation around a trigger and the keywords or IDs that activate it.</p>
        </div>
        <a class="btn btn-secondary" href="/bots/<?php echo (int) $bot['id']; ?>/flows">Back</a>
    </div>

    <div class="card">
        <form method="post" action="/bots/<?php echo (int) $bot['id']; ?>/flows/store" class="flow-builder-form">
            <?php echo CSRF::field(); ?>

            <div class="form-group">
                <label for="name">Flow Name</label>
                <input id="name" name="name" placeholder="Pricing enquiry flow" required>
            </div>

            <div class="form-group">
                <label for="description">Description</label>
                <textarea id="description" name="description" placeholder="Responds when customers ask about pricing or packages."></textarea>
            </div>

            <div class="form-group">
                <label for="trigger_type">Trigger Type</label>
                <select id="trigger_type" name="trigger_type">
                    <?php foreach ($triggerOptions as $type => $option): ?>
                        <option value="<?php echo View::e($type); ?>"><?php echo View::e($option['label']); ?></option>
                    <?php endforeach; ?>
                </select>
                <small class="help-text">Pick the event that should start this flow.</small>
            </div>

            <div class="flow-trigger-grid">
                <?php foreach ($triggerOptions as $type => $option): ?>
                    <div class="flow-trigger-card">
                        <strong><?php echo View::e($option['label']); ?></strong>
                        <small><?php echo View::e($option['hint']); ?></small>
                    </div>
                <?php endforeach; ?>
            </div>

            <div class="form-grid-two">
                <div class="form-group">
                    <label for="trigger_value">Keywords / Trigger Values</label>
                    <input id="trigger_value" name="trigger_value" placeholder="pricing, prices, packages">
                    <small class="help-text">Separate multiple keywords or IDs with commas.</small>
                </div>
                <div class="form-group">
                    <label for="priority">Priority</label>
                    <input id="priority" name="priority" type="number" value="0">
                    <small class="help-text">Higher priority flows should be checked first.</small>
                </div>
            </div>

            <div class="flow-builder-tip">
                <strong>Suggested first flows</strong>
                <p>Start with `pricing`, `location`, `hours`, `speak to agent`, or a `default` fallback flow for unknown messages.</p>
            </div>

            <div class="form-actions">
                <button class="btn btn-primary" type="submit">Create flow</button>
                <a class="btn btn-secondary" href="/bots/<?php echo (int) $bot['id']; ?>/flows">Cancel</a>
            </div>
        </form>
    </div>
</div>

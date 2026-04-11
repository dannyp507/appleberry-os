<?php
// FILE: /app/views/flow_steps/form.php
$step = isset($step) ? $step : null;
$config = isset($config) && is_array($config) ? $config : [];
$actionTypes = [
    'send_text' => 'Send a text reply',
    'send_media' => 'Send an image or file',
    'ask_question' => 'Ask a question and wait',
    'call_ai' => 'Generate an AI reply',
    'set_variable' => 'Save a variable',
];
?>
<div class="flow-trigger-grid">
    <?php foreach ($actionTypes as $type => $label): ?>
        <div class="flow-trigger-card <?php echo (($step['action_type'] ?? 'send_text') === $type) ? 'is-selected' : ''; ?>">
            <strong><?php echo View::e($label); ?></strong>
            <small><?php echo View::e($type); ?></small>
        </div>
    <?php endforeach; ?>
</div>

<div class="form-grid-two">
    <div class="form-group">
        <label for="step_order">Block Order</label>
        <input id="step_order" name="step_order" type="number" value="<?php echo View::e($step['step_order'] ?? 1); ?>" required>
    </div>
    <div class="form-group">
        <label for="action_type">Block Type</label>
        <select id="action_type" name="action_type">
            <?php foreach ($actionTypes as $type => $label): ?>
                <option value="<?php echo View::e($type); ?>" <?php echo (($step['action_type'] ?? 'send_text') === $type) ? 'selected' : ''; ?>>
                    <?php echo View::e($label); ?>
                </option>
            <?php endforeach; ?>
        </select>
    </div>
</div>

<div class="form-group">
    <label for="config_message">Primary Message</label>
    <textarea id="config_message" name="config_message" placeholder="Thanks for messaging us. Here is our latest price list."><?php echo View::e($config['message'] ?? ''); ?></textarea>
</div>

<div class="form-grid-two">
    <div class="form-group">
        <label for="config_media_url">Media URL</label>
        <input id="config_media_url" name="config_media_url" value="<?php echo View::e($config['media_url'] ?? ''); ?>" placeholder="https://example.com/brochure.jpg">
    </div>
    <div class="form-group">
        <label for="config_caption">Media Caption</label>
        <input id="config_caption" name="config_caption" value="<?php echo View::e($config['caption'] ?? ''); ?>" placeholder="View our latest brochure">
    </div>
</div>

<div class="form-grid-two">
    <div class="form-group">
        <label for="config_question">Question Prompt</label>
        <input id="config_question" name="config_question" value="<?php echo View::e($config['question'] ?? ''); ?>" placeholder="What service do you need help with?">
    </div>
    <div class="form-group">
        <label for="config_variable">Capture Into Variable</label>
        <input id="config_variable" name="config_variable" value="<?php echo View::e($config['variable'] ?? ''); ?>" placeholder="service_interest">
    </div>
</div>

<div class="form-grid-two">
    <div class="form-group">
        <label for="config_prompt">AI Prompt</label>
        <input id="config_prompt" name="config_prompt" value="<?php echo View::e($config['prompt'] ?? ''); ?>" placeholder="Answer politely using the salon pricing knowledge base.">
    </div>
    <div class="form-group">
        <label for="config_key">Variable Key</label>
        <input id="config_key" name="config_key" value="<?php echo View::e($config['key'] ?? ''); ?>" placeholder="last_intent">
    </div>
</div>

<div class="form-group">
    <label for="config_value">Variable Value</label>
    <input id="config_value" name="config_value" value="<?php echo View::e($config['value'] ?? ''); ?>" placeholder="pricing">
</div>

<div class="form-group">
    <label for="action_config_json">Advanced JSON Override</label>
    <textarea id="action_config_json" name="action_config_json" placeholder='{"message":"Hello there"}'><?php echo View::e(json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)); ?></textarea>
    <small class="help-text">Use this only when you need something more advanced than the guided fields above.</small>
</div>

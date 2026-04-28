<?php
// FILE: /app/views/conversations/show.php
?>
<div class="wa-single-panel">
    <div class="page-header">
        <div>
            <p class="wa-eyebrow">Conversation</p>
            <h1><?php echo View::e($conversation['contact_name'] ?: 'Unknown contact'); ?></h1>
            <p class="muted"><?php echo View::e($conversation['phone_number']); ?> • <?php echo View::e($conversation['channel_name']); ?></p>
        </div>
        <a class="btn btn-secondary" href="/inbox">Back</a>
    </div>

    <div class="wa-conversation-shell">
        <div class="wa-message-list">
            <?php if (empty($messages)): ?>
                <div class="wa-empty-note">No messages in this conversation yet.</div>
            <?php else: ?>
                <?php foreach ($messages as $message): ?>
                    <div class="wa-message-bubble <?php echo $message['direction'] === 'outbound' ? 'is-outbound' : 'is-inbound'; ?>">
                        <div class="wa-message-meta">
                            <strong><?php echo View::e($message['direction']); ?></strong>
                            <small><?php echo View::e($message['created_at']); ?></small>
                        </div>
                        <p><?php echo nl2br(View::e($message['content'])); ?></p>
                    </div>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>

        <div class="wa-details-panel">
            <form method="post" action="/conversations/<?php echo (int) $conversation['id']; ?>/send-message" class="wa-compose-form">
                <?php echo CSRF::field(); ?>
                <div class="form-group">
                    <label for="message">Reply</label>
                    <textarea id="message" name="message" placeholder="Type a reply for this contact..." required></textarea>
                </div>
                <button class="btn btn-primary" type="submit">Send reply</button>
            </form>

            <div class="actions">
                <?php if ($conversation['status'] !== 'closed'): ?>
                    <form method="post" action="/conversations/<?php echo (int) $conversation['id']; ?>/close" class="inline-form">
                        <?php echo CSRF::field(); ?>
                        <button class="btn btn-danger" type="submit">Close conversation</button>
                    </form>
                <?php else: ?>
                    <form method="post" action="/conversations/<?php echo (int) $conversation['id']; ?>/reopen" class="inline-form">
                        <?php echo CSRF::field(); ?>
                        <button class="btn btn-success" type="submit">Reopen conversation</button>
                    </form>
                <?php endif; ?>
            </div>
        </div>
    </div>
</div>

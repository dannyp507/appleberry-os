<?php
// FILE: /app/views/broadcasts/show.php
$stats = isset($broadcast['stats']) ? $broadcast['stats'] : ['total' => 0, 'sent' => 0, 'failed' => 0, 'pending' => 0];
?>
<div class="wa-single-panel">
    <div class="page-header">
        <div>
            <p class="wa-eyebrow">Bulk messaging</p>
            <h1><?php echo View::e($broadcast['name']); ?></h1>
            <p class="muted"><?php echo View::e($broadcast['message_content']); ?></p>
        </div>
        <a class="btn btn-secondary" href="/broadcasts">Back</a>
    </div>

    <div class="stats-grid">
        <div class="stat-card">
            <h3>Total</h3>
            <p><?php echo (int) $stats['total']; ?></p>
        </div>
        <div class="stat-card">
            <h3>Sent</h3>
            <p><?php echo (int) $stats['sent']; ?></p>
        </div>
        <div class="stat-card">
            <h3>Failed</h3>
            <p><?php echo (int) $stats['failed']; ?></p>
        </div>
        <div class="stat-card">
            <h3>Pending</h3>
            <p><?php echo (int) $stats['pending']; ?></p>
        </div>
    </div>

    <div class="card card-actions">
        <form method="post" action="/broadcasts/<?php echo (int) $broadcast['id']; ?>/launch" class="inline-form">
            <?php echo CSRF::field(); ?>
            <button class="btn btn-success" type="submit">Launch Broadcast</button>
        </form>

        <form method="post" action="/broadcasts/<?php echo (int) $broadcast['id']; ?>/process" class="inline-form">
            <?php echo CSRF::field(); ?>
            <input type="number" name="batch_size" value="50" min="1" max="500" class="batch-size-input">
            <button class="btn btn-primary" type="submit">Process Batch</button>
        </form>
        <span class="badge badge-<?php echo View::e($broadcast['status']); ?>"><?php echo View::e($broadcast['status']); ?></span>
    </div>

    <div class="card">
        <h2>Recent Recipient Attempts</h2>
        <?php if (empty($broadcast['messages'])): ?>
            <div class="wa-empty-stage compact">
                <div class="wa-empty-illustration violet"></div>
                <p>No recipient rows yet. Launch the broadcast to generate them.</p>
            </div>
        <?php else: ?>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Contact</th>
                        <th>Phone</th>
                        <th>Status</th>
                        <th>Error</th>
                        <th>Sent At</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($broadcast['messages'] as $message): ?>
                        <tr>
                            <td><?php echo View::e($message['contact_name'] ?: 'Unknown'); ?></td>
                            <td><?php echo View::e($message['phone_number']); ?></td>
                            <td><span class="badge badge-<?php echo View::e($message['status']); ?>"><?php echo View::e($message['status']); ?></span></td>
                            <td><?php echo View::e($message['error_message'] ?: '-'); ?></td>
                            <td><?php echo View::e($message['sent_at'] ?: '-'); ?></td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        <?php endif; ?>
    </div>
</div>

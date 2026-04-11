<?php
// FILE: /app/services/BroadcastService.php

require_once __DIR__ . '/MessageDeliveryService.php';

class BroadcastService {
    private $messageDeliveryService;

    public function __construct() {
        $this->messageDeliveryService = new MessageDeliveryService();
    }

    /**
     * Queue a broadcast for active contacts.
     *
     * @param int $broadcastId
     * @param int $tenantId
     * @return array
     */
    public function launch($broadcastId, $tenantId) {
        require_once __DIR__ . '/../models/Broadcast.php';
        require_once __DIR__ . '/../models/BroadcastMessage.php';
        require_once __DIR__ . '/../models/Contact.php';

        $broadcastModel = new Broadcast();
        $broadcastMessageModel = new BroadcastMessage();
        $contactModel = new Contact();

        $broadcast = $broadcastModel->find($broadcastId, $tenantId);
        if (!$broadcast) {
            throw new Exception('Broadcast not found.');
        }

        $contacts = $contactModel->getBroadcastRecipients($tenantId, $broadcast['target_filter']);
        $createdCount = $broadcastMessageModel->seedPendingRecipients($broadcastId, $contacts);
        $totalRecipients = $broadcastMessageModel->countByBroadcast($broadcastId);

        $broadcastModel->update($broadcastId, [
            'status' => 'scheduled',
            'scheduled_at' => date('Y-m-d H:i:s'),
            'total_recipients' => $totalRecipients,
            'sent_count' => 0,
            'failed_count' => 0,
            'started_at' => null,
            'completed_at' => null
        ], $tenantId);

        return [
            'seeded' => $createdCount,
            'total_recipients' => $totalRecipients
        ];
    }

    /**
     * Process a batch of pending broadcast messages.
     *
     * @param int $broadcastId
     * @param int $tenantId
     * @param int $limit
     * @return array
     */
    public function process($broadcastId, $tenantId, $limit = 50) {
        require_once __DIR__ . '/../models/Broadcast.php';
        require_once __DIR__ . '/../models/BroadcastMessage.php';
        require_once __DIR__ . '/../models/Contact.php';
        require_once __DIR__ . '/../models/Conversation.php';

        $broadcastModel = new Broadcast();
        $broadcastMessageModel = new BroadcastMessage();
        $contactModel = new Contact();
        $conversationModel = new Conversation();

        $broadcast = $broadcastModel->find($broadcastId, $tenantId);
        if (!$broadcast) {
            throw new Exception('Broadcast not found.');
        }

        if ($broadcast['status'] === 'draft') {
            throw new Exception('Launch the broadcast before processing it.');
        }

        $broadcastModel->update($broadcastId, [
            'status' => 'running',
            'started_at' => $broadcast['started_at'] ?: date('Y-m-d H:i:s')
        ], $tenantId);

        $botId = !empty($broadcast['bot_id']) ? (int) $broadcast['bot_id'] : null;
        $batch = $broadcastMessageModel->getPendingBatch($broadcastId, $limit);
        $sent = 0;
        $failed = 0;

        foreach ($batch as $row) {
            $contact = $contactModel->find($row['contact_id'], $tenantId);
            if (!$contact || $contact['status'] !== 'active') {
                $broadcastMessageModel->markAsFailed($row['id'], 'Recipient is unavailable for broadcast.');
                $failed++;
                continue;
            }

            $conversation = $conversationModel->findOrCreate(
                $contact['id'],
                $broadcast['channel_id'],
                $tenantId,
                $botId
            );

            $messageContent = $this->renderMessage($broadcast, $contact);

            try {
                $result = $this->messageDeliveryService->sendConversationMessage($conversation, $contact, [
                    'type' => 'text',
                    'content' => $messageContent,
                    'triggered_by' => 'api',
                    'metadata' => json_encode([
                        'broadcast_id' => $broadcastId,
                        'broadcast_message_id' => $row['id']
                    ])
                ]);

                if ($result['status'] === 'sent') {
                    $broadcastMessageModel->markAsSent($row['id']);
                    $sent++;
                } else {
                    $error = isset($result['provider_result']['error']) ? $result['provider_result']['error'] : 'Provider rejected message.';
                    $broadcastMessageModel->markAsFailed($row['id'], $error);
                    $failed++;
                }
            } catch (Exception $e) {
                $broadcastMessageModel->markAsFailed($row['id'], $e->getMessage());
                $failed++;
            }
        }

        $stats = $broadcastMessageModel->getStatusCounts($broadcastId);
        $pending = isset($stats['pending']) ? (int) $stats['pending'] : 0;

        $broadcastModel->update($broadcastId, [
            'sent_count' => isset($stats['sent']) ? (int) $stats['sent'] : 0,
            'failed_count' => isset($stats['failed']) ? (int) $stats['failed'] : 0,
            'status' => $pending === 0 ? 'completed' : 'running',
            'completed_at' => $pending === 0 ? date('Y-m-d H:i:s') : null
        ], $tenantId);

        return [
            'processed' => count($batch),
            'sent' => $sent,
            'failed' => $failed,
            'pending' => $pending
        ];
    }

    /**
     * @param array $broadcast
     * @param array $contact
     * @return string
     */
    private function renderMessage($broadcast, $contact) {
        $message = (string) $broadcast['message_content'];
        $name = !empty($contact['name']) ? $contact['name'] : 'there';

        $message = str_replace('{{name}}', $name, $message);
        $message = str_replace('{{phone_number}}', $contact['phone_number'], $message);

        return $message;
    }
}

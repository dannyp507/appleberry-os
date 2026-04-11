<?php
// FILE: /app/models/Message.php

/**
 * Message Model
 *
 * Handles message data.
 */
class Message extends Model {

    protected $table = 'messages';

    /**
     * Get messages by conversation
     *
     * @param int $conversationId
     * @param int $tenantId
     * @param int $limit
     * @param int $offset
     * @return array
     */
    public function getByConversation($conversationId, $tenantId, $limit = 100, $offset = 0) {
        $sql = "SELECT m.*, u.name as sent_by_name
                FROM {$this->table} m
                LEFT JOIN users u ON m.sent_by_user_id = u.id
                WHERE m.conversation_id = ? AND m.tenant_id = ?
                ORDER BY m.id ASC
                LIMIT ? OFFSET ?";
        $stmt = $this->query($sql, [$conversationId, $tenantId, $limit, $offset]);
        return $stmt->fetchAll();
    }

    /**
     * Create message
     *
     * @param array $data
     * @return int Message ID
     */
    public function createMessage($data) {
        $data['created_at'] = date('Y-m-d H:i:s');

        $columns = array_keys($data);
        $placeholders = array_fill(0, count($columns), '?');
        $sql = sprintf(
            "INSERT INTO {$this->table} (%s) VALUES (%s)",
            implode(', ', $columns),
            implode(', ', $placeholders)
        );

        $stmt = $this->db->prepare($sql);
        $stmt->execute(array_values($data));
        $messageId = (int) $this->db->lastInsertId();

        // Update conversation's last message timestamp
        if (isset($data['conversation_id'])) {
            require_once __DIR__ . '/Conversation.php';
            $conversationModel = new Conversation();
            $conversationModel->update(
                $data['conversation_id'],
                ['last_message_at' => date('Y-m-d H:i:s')],
                $data['tenant_id']
            );
        }

        require_once __DIR__ . '/../services/FirebaseBridgeService.php';
        $bridge = new FirebaseBridgeService();
        $bridge->publish('message.created', [
            'tenant_id' => $data['tenant_id'],
            'message_id' => $messageId,
            'conversation_id' => $data['conversation_id'],
            'direction' => isset($data['direction']) ? $data['direction'] : null,
            'type' => isset($data['type']) ? $data['type'] : 'text',
            'content' => isset($data['content']) ? $data['content'] : null,
            'status' => isset($data['status']) ? $data['status'] : null,
            'triggered_by' => isset($data['triggered_by']) ? $data['triggered_by'] : null,
            'created_at' => $data['created_at']
        ]);

        return $messageId;
    }

    /**
     * Get message statistics
     *
     * @param int $tenantId
     * @param string $startDate
     * @param string $endDate
     * @return array
     */
    public function getStatistics($tenantId, $startDate, $endDate) {
        $sql = "SELECT
                    COUNT(*) as total_messages,
                    SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as inbound_count,
                    SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) as outbound_count,
                    SUM(CASE WHEN triggered_by = 'ai' THEN 1 ELSE 0 END) as ai_count,
                    SUM(CASE WHEN triggered_by = 'flow' THEN 1 ELSE 0 END) as flow_count,
                    SUM(CASE WHEN triggered_by = 'agent' THEN 1 ELSE 0 END) as agent_count
                FROM {$this->table}
                WHERE tenant_id = ? AND created_at BETWEEN ? AND ?";
        $stmt = $this->query($sql, [$tenantId, $startDate, $endDate]);
        return $stmt->fetch();
    }
}

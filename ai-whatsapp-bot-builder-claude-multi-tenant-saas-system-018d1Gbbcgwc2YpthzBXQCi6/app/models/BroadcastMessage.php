<?php
// FILE: /app/models/BroadcastMessage.php

/**
 * BroadcastMessage Model
 *
 * Handles individual broadcast message records.
 */
class BroadcastMessage extends Model {

    protected $table = 'broadcast_messages';

    /**
     * Get messages by broadcast
     *
     * @param int $broadcastId
     * @param string|null $status
     * @param int $limit
     * @param int $offset
     * @return array
     */
    public function getByBroadcast($broadcastId, $status = null, $limit = 100, $offset = 0) {
        $sql = "SELECT bm.*, c.name as contact_name, c.phone_number
                FROM {$this->table} bm
                JOIN contacts c ON bm.contact_id = c.id
                WHERE bm.broadcast_id = ?";
        $params = [$broadcastId];

        if ($status !== null) {
            $sql .= " AND bm.status = ?";
            $params[] = $status;
        }

        $sql .= " ORDER BY bm.id DESC LIMIT ? OFFSET ?";
        $params[] = $limit;
        $params[] = $offset;

        $stmt = $this->query($sql, $params);
        return $stmt->fetchAll();
    }

    /**
     * Mark as sent
     *
     * @param int $id
     * @return bool
     */
    public function markAsSent($id) {
        $sql = "UPDATE {$this->table} SET status = 'sent', sent_at = NOW() WHERE id = ?";
        $stmt = $this->query($sql, [$id]);
        return $stmt->rowCount() > 0;
    }

    /**
     * Mark as failed
     *
     * @param int $id
     * @param string $errorMessage
     * @return bool
     */
    public function markAsFailed($id, $errorMessage) {
        $sql = "UPDATE {$this->table} SET status = 'failed', error_message = ? WHERE id = ?";
        $stmt = $this->query($sql, [$errorMessage, $id]);
        return $stmt->rowCount() > 0;
    }

    /**
     * Seed pending recipient rows for contacts not already attached to the broadcast.
     *
     * @param int $broadcastId
     * @param array $contacts
     * @return int
     */
    public function seedPendingRecipients($broadcastId, $contacts) {
        $created = 0;

        foreach ($contacts as $contact) {
            $exists = $this->query(
                "SELECT id FROM {$this->table} WHERE broadcast_id = ? AND contact_id = ? LIMIT 1",
                [$broadcastId, $contact['id']]
            )->fetch();

            if ($exists) {
                continue;
            }

            $stmt = $this->db->prepare(
                "INSERT INTO {$this->table} (broadcast_id, contact_id, status, created_at)
                 VALUES (?, ?, 'pending', ?)"
            );
            $stmt->execute([$broadcastId, $contact['id'], date('Y-m-d H:i:s')]);
            $created++;
        }

        return $created;
    }

    /**
     * @param int $broadcastId
     * @param int $limit
     * @return array
     */
    public function getPendingBatch($broadcastId, $limit = 50) {
        $sql = "SELECT * FROM {$this->table}
                WHERE broadcast_id = ? AND status = 'pending'
                ORDER BY id ASC
                LIMIT ?";
        $stmt = $this->query($sql, [$broadcastId, $limit]);
        return $stmt->fetchAll();
    }

    /**
     * @param int $broadcastId
     * @return int
     */
    public function countByBroadcast($broadcastId) {
        $stmt = $this->query(
            "SELECT COUNT(*) AS total FROM {$this->table} WHERE broadcast_id = ?",
            [$broadcastId]
        );
        $result = $stmt->fetch();
        return (int) $result['total'];
    }

    /**
     * @param int $broadcastId
     * @return array
     */
    public function getStatusCounts($broadcastId) {
        $rows = $this->query(
            "SELECT status, COUNT(*) AS total
             FROM {$this->table}
             WHERE broadcast_id = ?
             GROUP BY status",
            [$broadcastId]
        )->fetchAll();

        $counts = ['pending' => 0, 'sent' => 0, 'failed' => 0];

        foreach ($rows as $row) {
            $counts[$row['status']] = (int) $row['total'];
        }

        return $counts;
    }

    /**
     * Check if table has tenant_id column
     *
     * @return bool
     */
    protected function hasTenantId() {
        return false; // BroadcastMessage doesn't have tenant_id directly
    }
}

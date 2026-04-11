<?php
// FILE: /app/services/MessageDeliveryService.php

require_once __DIR__ . '/ChannelProviderInterface.php';
require_once __DIR__ . '/AbstractHttpChannelProvider.php';
require_once __DIR__ . '/ChannelProviderFactory.php';

class MessageDeliveryService {
    /**
     * Send and persist an outbound message for a conversation.
     *
     * @param array $conversation
     * @param array $recipient
     * @param array $messageData
     * @return array
     */
    public function sendConversationMessage($conversation, $recipient, $messageData) {
        require_once __DIR__ . '/../models/Channel.php';
        require_once __DIR__ . '/../models/Message.php';

        $channelModel = new Channel();
        $messageModel = new Message();

        $channel = $channelModel->find($conversation['channel_id'], $conversation['tenant_id']);
        if (!$channel) {
            throw new Exception('Conversation channel not found.');
        }

        $channel = $channelModel->hydrateProviderConfig($channel);
        $provider = ChannelProviderFactory::make($channel);

        $deliveryPayload = [
            'type' => isset($messageData['type']) ? $messageData['type'] : 'text',
            'content' => isset($messageData['content']) ? $messageData['content'] : '',
            'media_url' => isset($messageData['media_url']) ? $messageData['media_url'] : null,
            'metadata' => isset($messageData['metadata']) ? $messageData['metadata'] : null
        ];

        $providerResult = $provider->sendMessage($channel, $recipient, $deliveryPayload);

        $metadata = [
            'channel_provider' => $channel['provider_type'],
            'provider_message_id' => isset($providerResult['provider_message_id']) ? $providerResult['provider_message_id'] : null,
            'provider_status_code' => isset($providerResult['status_code']) ? $providerResult['status_code'] : null,
            'provider_response' => isset($providerResult['response_body']) ? $providerResult['response_body'] : null,
            'provider_error' => isset($providerResult['error']) ? $providerResult['error'] : null
        ];

        $status = !empty($providerResult['success']) ? 'sent' : 'failed';

        $messageId = $messageModel->createMessage([
            'tenant_id' => $conversation['tenant_id'],
            'conversation_id' => $conversation['id'],
            'direction' => 'outbound',
            'type' => $deliveryPayload['type'],
            'content' => $deliveryPayload['content'],
            'media_url' => $deliveryPayload['media_url'],
            'metadata' => json_encode($metadata),
            'triggered_by' => isset($messageData['triggered_by']) ? $messageData['triggered_by'] : 'api',
            'flow_id' => isset($messageData['flow_id']) ? $messageData['flow_id'] : null,
            'sent_by_user_id' => isset($messageData['sent_by_user_id']) ? $messageData['sent_by_user_id'] : null,
            'status' => $status
        ]);

        return [
            'message_id' => $messageId,
            'status' => $status,
            'provider_result' => $providerResult
        ];
    }
}

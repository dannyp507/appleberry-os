<?php
// FILE: /app/services/ChannelProviderInterface.php

interface ChannelProviderInterface {
    /**
     * Send an outbound message through the configured provider.
     *
     * @param array $channel
     * @param array $recipient
     * @param array $message
     * @return array
     */
    public function sendMessage($channel, $recipient, $message);
}

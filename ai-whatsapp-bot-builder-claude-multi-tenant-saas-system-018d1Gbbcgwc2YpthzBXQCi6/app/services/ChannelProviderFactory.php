<?php
// FILE: /app/services/ChannelProviderFactory.php

class ChannelProviderFactory {
    /**
     * @param array $channel
     * @return ChannelProviderInterface
     */
    public static function make($channel) {
        $type = isset($channel['provider_type']) ? $channel['provider_type'] : 'sandbox';

        if ($type === 'sandbox') {
            require_once __DIR__ . '/SandboxChannelProvider.php';
            return new SandboxChannelProvider();
        }

        require_once __DIR__ . '/ConfiguredHttpChannelProvider.php';
        return new ConfiguredHttpChannelProvider();
    }
}

// src/hooks/useMapState.js
import { useState } from 'react';

/**
 * #comment Manages local state for the MapView component.
 */
export const useMapState = () => {
    const [isPlacingDummyCity, setIsPlacingDummyCity] = useState(false);
    const [unreadReportsCount, setUnreadReportsCount] = useState(0);
    const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

    return {
        isPlacingDummyCity,
        setIsPlacingDummyCity,
        unreadReportsCount,
        setUnreadReportsCount,
        unreadMessagesCount,
        setUnreadMessagesCount,
        isSettingsModalOpen,
        setIsSettingsModalOpen,
    };
};

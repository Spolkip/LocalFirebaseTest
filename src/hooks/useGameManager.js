// src/hooks/useGameManager.js
import { useState } from 'react';
import { useGame } from '../contexts/GameContext';

export const useGameManager = () => {
    const { gameState, worldId, loading } = useGame();
    const [view, setView] = useState('city');
    const [isChatOpen, setIsChatOpen] = useState(false);

    const showMap = () => setView('map');
    const showCity = () => setView('city');

    const isLoading = loading || !gameState;

    return {
        view,
        isChatOpen,
        setIsChatOpen,
        showMap,
        showCity,
        isLoading,
        worldId
    };
};
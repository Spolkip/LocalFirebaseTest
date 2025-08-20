import React from 'react';
import WorshipDisplay from './city/WorshipDisplay';
import TroopDisplay from './TroopDisplay';
import HeroDisplay from './city/HeroDisplay';
import { useGame } from '../contexts/GameContext';

const SideInfoPanel = ({ gameState, className, onOpenPowers, movements }) => {
    const { activeCityId } = useGame();
    if (!gameState) {
        return null;
    }
    return (
        <div className={className}>
            <WorshipDisplay
                godName={gameState.god}
                playerReligion={gameState.playerInfo.religion}
                worship={gameState.worship}
                buildings={gameState.buildings}
                onOpenPowers={onOpenPowers}
            />
            <HeroDisplay 
                heroes={gameState.heroes} 
                agents={gameState.agents} 
                movements={movements} 
                activeCityId={activeCityId} 
            />
            <TroopDisplay units={gameState.units || {}} />
        </div>
    );
};

export default SideInfoPanel;

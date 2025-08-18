import React from 'react';
import MovementItem from './MovementItem';
import './MovementsToolTip.css';
import { useGame } from '../../contexts/GameContext';

const MovementsTooltip = ({ movements, combinedSlots, onCancel, isLocked, countdown }) => {
    const { gameSettings } = useGame();

    const isTradeMovement = (m) => {
        if (m.type === 'trade') return true;

        if (m.status === 'returning' && m.resources && Object.values(m.resources).some(r => r > 0)) {
            if (!m.units || Object.values(m.units).every(count => count === 0)) {
                return true;
            }
        }
        return false;
    };


    const activeMovements = movements.filter(m => {
        if (gameSettings.hideReturningReports && m.status === 'returning') {
            return false;
        }
        return !isTradeMovement(m);
    });

    return (
        <div className="activity-tooltip">
            {activeMovements.length > 0 ? (
                activeMovements.map(movement => (
                    <MovementItem
                        key={movement.id}
                        movement={movement}
                        citySlots={combinedSlots}
                        onCancel={onCancel}
                    />
                ))
            ) : (
                <p className="p-4 text-center text-sm">No active movements.</p>
            )}
            <div className="tooltip-lock-timer">
                {isLocked ? '🔒' : countdown}
            </div>
        </div>
    );
};

export default MovementsTooltip;

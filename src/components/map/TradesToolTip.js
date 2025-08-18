// src/components/map/TradesToolTip.js
import React from 'react';
import MovementItem from './MovementItem';
import './TradesToolTip.css';

const TradesTooltip = ({ movements, combinedSlots, onCancel, isLocked, countdown }) => {
    // #comment Helper to identify if a movement is trade-related
    const isTradeMovement = (m) => {
        if (m.type === 'trade') return true;
        // It's also a trade if it's a returning trip carrying only resources
        if (m.status === 'returning' && m.resources && Object.values(m.resources).some(r => r > 0)) {
            if (!m.units || Object.values(m.units).every(count => count === 0)) {
                return true;
            }
        }
        return false;
    };

    const tradeMovements = movements.filter(isTradeMovement);

    return (
        <div className="activity-tooltip">
            {tradeMovements.length > 0 ? (
                tradeMovements.map(movement => (
                    <MovementItem
                        key={movement.id}
                        movement={movement}
                        citySlots={combinedSlots}
                        onCancel={onCancel}
                    />
                ))
            ) : (
                <p className="p-4 text-center text-sm">No active trade movements.</p>
            )}
            <div className="tooltip-lock-timer">
                {isLocked ? '🔒' : countdown}
            </div>
        </div>
    );
};

export default TradesTooltip;

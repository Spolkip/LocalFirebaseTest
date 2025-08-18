// src/components/map/MovementIndicator.js
import React from 'react';
import { motion } from 'framer-motion';

const TILE_SIZE = 32;

const MovementIndicator = React.memo(({ movement, citySlots, allMovements = [] }) => {
    if (!movement) return null;

    const isReturning = movement.status === 'returning';

    // #comment Prioritize using coordinates directly from the movement object.
    let originCity = isReturning ? movement.targetCoords : movement.originCoords;
    let targetCity = isReturning ? movement.originCoords : movement.targetCoords;

    // #comment Fallback to lookup method if coordinates are not on the movement object.
    if ((!originCity || !targetCity) && citySlots) {
        const originId = isReturning ? (movement.targetSlotId || movement.targetVillageId || movement.targetRuinId || movement.targetTownId) : movement.originCityId;
        const targetId = isReturning ? movement.originCityId : (movement.targetSlotId || movement.targetVillageId || movement.targetRuinId || movement.targetTownId);
        
        if (!originCity) originCity = citySlots[originId];
        if (!targetCity) targetCity = citySlots[targetId];
    }
    
    if (!originCity || !targetCity) {
        // console.warn(`Could not find origin or target for movement ${movement.id}`);
        return null;
    }

    const departureTime = movement.departureTime?.toDate().getTime() || Date.now();
    const arrivalTime = movement.arrivalTime?.toDate().getTime() || Date.now();
    const now = Date.now();
    
    let progress = 0;
    if (now < departureTime) progress = 0;
    else if (now > arrivalTime) progress = 1;
    else progress = (now - departureTime) / (arrivalTime - departureTime);

    const originX = originCity.x * TILE_SIZE + TILE_SIZE / 2;
    const originY = originCity.y * TILE_SIZE + TILE_SIZE / 2;
    const targetX = targetCity.x * TILE_SIZE + TILE_SIZE / 2;
    const targetY = targetCity.y * TILE_SIZE + TILE_SIZE / 2;

    const currentX = originX + (targetX - originX) * progress;
    const currentY = originY + (targetY - originY) * progress;

    const remainingTime = Math.max(0, (arrivalTime - now) / 1000);
    
    const totalUnits = movement.units ? Object.values(movement.units).reduce((sum, count) => sum + count, 0) : 0;
    const size = Math.min(24, 8 + Math.sqrt(totalUnits) * 2);

    const movementTypes = {
        attack: { color: '#ef4444', icon: '⚔️', lineColor: '#ef4444' },
        attack_village: { color: '#ef4444', icon: '⚔️', lineColor: '#ef4444' },
        attack_ruin: { color: '#ef4444', icon: '⚔️', lineColor: '#ef4444' },
        attack_god_town: { color: '#ef4444', icon: '⚔️', lineColor: '#ef4444' },
        reinforce: { color: '#3b82f6', icon: '🛡️', lineColor: '#3b82f6' },
        scout: { color: '#10b981', icon: '👁️', lineColor: '#10b981' },
        trade: { color: '#f59e0b', icon: '💰', lineColor: '#f59e0b' },
        return: { color: '#a855f7', icon: '↩️', lineColor: '#a855f7' },
        default: { color: '#6b7280', icon: '➡️', lineColor: '#6b7280' }
    };

    const config = movementTypes[isReturning ? 'return' : movement.type] || movementTypes.default;

    const overlappingMovements = (Array.isArray(allMovements)) ? allMovements.filter(m => {
        if (!m || m.id === movement.id) return false;
        return (
            (m.originCityId === movement.originCityId && m.targetCityId === movement.targetCityId) ||
            (m.originCityId === movement.targetCityId && m.targetCityId === movement.originCityId)
        );
    }) : [];

    const getBlendedColor = () => {
        if (overlappingMovements.length === 0) return config.lineColor;
        
        const colors = [config.lineColor];
        overlappingMovements.forEach(m => {
            if (!m) return;
            const otherConfig = movementTypes[m.type] || movementTypes.default;
            colors.push(otherConfig.lineColor);
        });

        const blended = colors.reduce((acc, color) => {
            if (!color) return acc;
            const hex = color.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            return {
                r: acc.r + r,
                g: acc.g + g,
                b: acc.b + b,
                count: acc.count + 1
            };
        }, { r: 0, g: 0, b: 0, count: 0 });

        const avgR = Math.round(blended.r / blended.count);
        const avgG = Math.round(blended.g / blended.count);
        const avgB = Math.round(blended.b / blended.count);

        return `#${avgR.toString(16).padStart(2, '0')}${avgG.toString(16).padStart(2, '0')}${avgB.toString(16).padStart(2, '0')}`;
    };

    const lineColor = getBlendedColor();
    const lineWidth = 3 + (overlappingMovements.length * 1.5);

    return (
        <>
            <div 
                className="absolute z-20"
                style={{
                    left: originX,
                    top: originY,
                    width: Math.sqrt(Math.pow(targetX - originX, 2) + Math.pow(targetY - originY, 2)),
                    height: lineWidth,
                    backgroundColor: lineColor,
                    opacity: 0.7,
                    transformOrigin: '0 0',
                    transform: `rotate(${Math.atan2(targetY - originY, targetX - originX)}rad)`,
                }}
            />
            <motion.div
                className="absolute z-30 flex items-center justify-center"
                style={{
                    left: currentX - size / 2,
                    top: currentY - size / 2,
                    width: size,
                    height: size,
                    backgroundColor: `${config.color}80`,
                    borderRadius: '50%',
                    border: `2px solid ${config.color}`,
                    fontSize: size * 0.6,
                }}
                animate={{
                    x: [0, (targetX - originX) * (1 - progress)],
                    y: [0, (targetY - originY) * (1 - progress)],
                }}
                transition={{
                    duration: remainingTime,
                    ease: "linear"
                }}
                whileHover={{ scale: 1.2 }}
            >
                {config.icon}
            </motion.div>
        </>
    );
});

export default MovementIndicator;

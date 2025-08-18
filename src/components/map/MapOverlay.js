// src/components/map/MapOverlay.js
import React, { useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const MINIMAP_SIZE = 175; // The size of the minimap canvas in pixels

const MapOverlay = ({ mouseCoords, pan, zoom, viewportSize, worldState, allCities, ruins, playerAlliance }) => {
    const minimapRef = useRef(null);
    const { currentUser } = useAuth();

    // #comment Calculate the sea name based on the center of the viewport
    const seaName = (() => {
        if (!viewportSize.width || !worldState) return 'Unknown Sea';
        const centerX = (-pan.x + viewportSize.width / 2) / (32 * zoom);
        const centerY = (-pan.y + viewportSize.height / 2) / (32 * zoom);
        const seaX = Math.floor(centerX / 100);
        const seaY = Math.floor(centerY / 100);
        return `Sea ${seaY}${seaX}`;
    })();

    // #comment Draw the minimap
    useEffect(() => {
        const canvas = minimapRef.current;
        if (!canvas || !worldState || !viewportSize.width || !currentUser) return;

        const ctx = canvas.getContext('2d');
        const { width: worldWidth, height: worldHeight, islands } = worldState;
        
        const scaleX = MINIMAP_SIZE / worldWidth;
        const scaleY = MINIMAP_SIZE / worldHeight;

        // Clear and draw background
        ctx.fillStyle = '#1e3a8a'; // Water color
        ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

        // Draw islands
        ctx.fillStyle = '#2a623d'; // Land color
        islands.forEach(island => {
            ctx.beginPath();
            ctx.arc(
                island.x * scaleX,
                island.y * scaleY,
                island.radius * Math.min(scaleX, scaleY),
                0,
                2 * Math.PI
            );
            ctx.fill();
        });

        // #comment Draw ruins
        if (ruins) {
            ctx.fillStyle = '#a855f7'; // Purple for ruins
            Object.values(ruins).forEach(ruin => {
                ctx.fillRect(ruin.x * scaleX - 1, ruin.y * scaleY - 1, 3, 3);
            });
        }

        // #comment Draw all cities with appropriate colors
        if (allCities) {
            Object.values(allCities).forEach(city => {
                if (!city.ownerId) return; // Skip empty slots

                let cityColor = '#f59e0b'; // Neutral - amber-500

                if (city.ownerId === currentUser.uid) {
                    cityColor = '#facc15'; // My City - yellow-400
                } else if (playerAlliance && city.alliance) {
                    if (city.alliance === playerAlliance.tag) {
                        cityColor = '#3b82f6'; // Alliance - blue-500
                    } else if (playerAlliance.diplomacy?.allies?.some(a => a.tag === city.alliance)) {
                        cityColor = '#22c55e'; // Ally - green-500
                    } else if (playerAlliance.diplomacy?.enemies?.some(e => e.tag === city.alliance)) {
                        cityColor = '#ef4444'; // Enemy - red-500
                    }
                }
                
                ctx.fillStyle = cityColor;
                ctx.fillRect(city.x * scaleX - 1, city.y * scaleY - 1, 3, 3);
            });
        }
        
        // Draw viewport rectangle
        const viewRectX = -pan.x / (32 * zoom) * scaleX;
        const viewRectY = -pan.y / (32 * zoom) * scaleY;
        const viewRectWidth = (viewportSize.width / (32 * zoom)) * scaleX;
        const viewRectHeight = (viewportSize.height / (32 * zoom)) * scaleY;

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(viewRectX, viewRectY, viewRectWidth, viewRectHeight);

    }, [worldState, allCities, ruins, playerAlliance, pan, zoom, viewportSize, currentUser]);


    return (
        <>
            <div className="minimap-container">
                <canvas ref={minimapRef} width={MINIMAP_SIZE} height={MINIMAP_SIZE} className="minimap-canvas"></canvas>
            </div>
            <div className="coords-info-container">
                <p>{seaName} ({mouseCoords.x}, {mouseCoords.y})</p>
            </div>
        </>
    );
};

export default MapOverlay;

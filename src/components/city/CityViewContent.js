// src/components/city/CityViewContent.js
import React, { useRef, useEffect, useCallback, useLayoutEffect, useState } from 'react';
import Cityscape from './Cityscape';
import SideInfoPanel from '../SideInfoPanel';
import buildingConfig from '../../gameData/buildings.json'; // Import building config

// #comment Dynamically import all building and special building images
const buildingImages = {};
const contexts = [
    require.context('../../images/buildings', false, /\.(png|jpe?g|svg)$/),
    require.context('../../images/special_buildings', false, /\.(png|jpe?g|svg)$/)
];

contexts.forEach(context => {
    context.keys().forEach((item) => {
        const key = item.replace('./', '');
        buildingImages[key] = context(item);
    });
});

const CITYSCAPE_WIDTH = 2000;
const CITYSCAPE_HEIGHT = 1700;

const CityViewContent = ({ cityGameState, handlePlotClick, onOpenPowers, gameSettings, onOpenSpecialBuildingMenu }) => {
    // Panning Logic (moved from CityView.js)
    const viewportRef = useRef(null);
    const cityContainerRef = useRef(null);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });

    const clampPan = useCallback((newPan) => {
        if (!viewportRef.current) return { x: 0, y: 0 };
        const { clientWidth, clientHeight } = viewportRef.current;
        const minX = clientWidth - CITYSCAPE_WIDTH;
        const minY = clientHeight - CITYSCAPE_HEIGHT;
        return {
            x: Math.max(minX, Math.min(0, newPan.x)),
            y: Math.max(minY, Math.min(0, newPan.y)),
        };
    }, []);

    useLayoutEffect(() => {
        if (!viewportRef.current) return;
        const { clientWidth, clientHeight } = viewportRef.current;
        setPan(clampPan({ x: (clientWidth - CITYSCAPE_WIDTH) / 2, y: (clientHeight - CITYSCAPE_HEIGHT) / 2 }));
    }, [clampPan]);

    useEffect(() => {
        const container = cityContainerRef.current;
        if (container) container.style.transform = `translate(${pan.x}px, ${pan.y}px)`;
    }, [pan]);

    const handleMouseDown = useCallback((e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        setStartPos({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        setIsPanning(true);
    }, [pan]);

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isPanning) return;
            setPan(clampPan({ x: e.clientX - startPos.x, y: e.clientY - startPos.y }));
        };
        const handleMouseUp = () => setIsPanning(false);
        if (isPanning) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isPanning, startPos, clampPan]);

    if (!gameSettings.showVisuals) {
        return (
            <main className="flex-grow w-full h-full relative overflow-y-auto p-4">
                <h2 className="text-2xl font-bold mb-4">City Buildings</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Object.entries(cityGameState.buildings).map(([id, data]) => {
                        if (data.level > 0) {
                            return (
                                <div key={id} className="bg-gray-800 p-3 rounded-lg cursor-pointer hover:bg-gray-700" onClick={() => handlePlotClick(id)}>
                                    <p className="font-bold text-lg text-yellow-400">{buildingConfig[id]?.name}</p>
                                    <p>Level {data.level}</p>
                                </div>
                            );
                        }
                        return null;
                    })}
                </div>
                 <SideInfoPanel 
                    gameState={cityGameState} 
                    className="absolute top-1/2 right-4 transform -translate-y-1/2 z-20" 
                    onOpenPowers={onOpenPowers}
                />
            </main>
        );
    }

    return (
        <main className="flex-grow w-full h-full relative overflow-hidden cursor-grab" ref={viewportRef} onMouseDown={handleMouseDown}>
            <div ref={cityContainerRef} style={{ transformOrigin: '0 0' }}>
                <Cityscape 
                    buildings={cityGameState.buildings} 
                    onBuildingClick={handlePlotClick} 
                    buildingImages={buildingImages} 
                    cityGameState={cityGameState} 
                    onOpenSpecialBuildingMenu={onOpenSpecialBuildingMenu} 
                />
            </div>
            <SideInfoPanel 
                gameState={cityGameState} 
                className="absolute top-1/2 right-4 transform -translate-y-1/2 z-20 flex flex-col gap-4" 
                onOpenPowers={onOpenPowers}
            />
        </main>
    );
};

export default CityViewContent;

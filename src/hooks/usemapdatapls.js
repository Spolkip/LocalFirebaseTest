import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

const CHUNK_SIZE = 10;
const TILE_SIZE = 32;

export const useMapData = (currentUser, worldId, worldState, pan, zoom, viewportSize) => {
    const [cachedData, setCachedData] = useState({});
    const [visibleSlots, setVisibleSlots] = useState({});
    const [visibleVillages, setVisibleVillages] = useState({});
    const [visibleRuins, setVisibleRuins] = useState({});
    const activeListenersRef = useRef({});

    const invalidateChunkCache = useCallback((x, y) => {
        const chunkX = Math.floor(x / CHUNK_SIZE);
        const chunkY = Math.floor(y / CHUNK_SIZE);
        const chunkKey = `${chunkX},${chunkY}`;
        setCachedData(prevCache => {
            const newCache = { ...prevCache };
            delete newCache[chunkKey];
            return newCache;
        });
    }, []);

    useEffect(() => {
        // #comment Cleanup all listeners on unmount
        return () => {
            Object.values(activeListenersRef.current).forEach(unsubArray => {
                if (Array.isArray(unsubArray)) {
                    unsubArray.forEach(unsub => unsub());
                }
            });
            activeListenersRef.current = {};
        };
    }, []);

    useEffect(() => {
        if (!worldState || viewportSize.width === 0 || zoom <= 0 || !worldId) {
            return;
        }

        const scaledTileSize = TILE_SIZE * zoom;
        const viewStartCol = Math.floor(-pan.x / scaledTileSize) - 1;
        const viewEndCol = Math.ceil((-pan.x + viewportSize.width) / scaledTileSize) + 1;
        const viewStartRow = Math.floor(-pan.y / scaledTileSize) - 1;
        const viewEndRow = Math.ceil((-pan.y + viewportSize.height) / scaledTileSize) + 1;

        const requiredChunks = new Set();
        for (let y = viewStartRow; y <= viewEndRow; y++) {
            for (let x = viewStartCol; x <= viewEndCol; x++) {
                const chunkKey = `${Math.floor(x / CHUNK_SIZE)},${Math.floor(y / CHUNK_SIZE)}`;
                requiredChunks.add(chunkKey);
            }
        }

        // Unsubscribe from chunks that are no longer visible
        Object.keys(activeListenersRef.current).forEach(chunkKey => {
            if (!requiredChunks.has(chunkKey)) {
                activeListenersRef.current[chunkKey].forEach(unsub => unsub());
                delete activeListenersRef.current[chunkKey];
            }
        });

        // Subscribe to new visible chunks
        requiredChunks.forEach(chunkKey => {
            if (!activeListenersRef.current[chunkKey]) {
                const [chunkX, chunkY] = chunkKey.split(',').map(Number);
                const collectionsToFetch = ['citySlots', 'villages', 'ruins'];
                const unsubscribers = [];

                collectionsToFetch.forEach(colName => {
                    const q = query(
                        collection(db, 'worlds', worldId, colName),
                        where('x', '>=', chunkX * CHUNK_SIZE), where('x', '<', (chunkX + 1) * CHUNK_SIZE),
                        where('y', '>=', chunkY * CHUNK_SIZE), where('y', '<', (chunkY + 1) * CHUNK_SIZE)
                    );

                    const unsubscribe = onSnapshot(q, (snapshot) => {
                        const chunkData = {};
                        snapshot.forEach(doc => {
                            chunkData[doc.id] = { id: doc.id, ...doc.data() };
                        });
                        setCachedData(prevCache => ({
                            ...prevCache,
                            [chunkKey]: {
                                ...prevCache[chunkKey],
                                [colName]: chunkData
                            }
                        }));
                    }, (error) => {
                        console.error(`Error fetching ${colName} for chunk ${chunkKey}:`, error);
                    });
                    unsubscribers.push(unsubscribe);
                });
                activeListenersRef.current[chunkKey] = unsubscribers;
            }
        });

    }, [pan, zoom, viewportSize, worldState, worldId]);
    
    useEffect(() => {
        if (viewportSize.width === 0) return;

        const scaledTileSize = TILE_SIZE * zoom;
        const viewStartCol = Math.floor(-pan.x / scaledTileSize);
        const viewEndCol = Math.ceil((-pan.x + viewportSize.width) / scaledTileSize);
        const viewStartRow = Math.floor(-pan.y / scaledTileSize);
        const viewEndRow = Math.ceil((-pan.y + viewportSize.height) / scaledTileSize);

        const newVisibleSlots = {};
        const newVisibleVillages = {};
        const newVisibleRuins = {};

        Object.values(cachedData).forEach(chunk => {
            Object.values(chunk.citySlots || {}).forEach(slot => {
                if (slot.x >= viewStartCol && slot.x <= viewEndCol && slot.y >= viewStartRow && slot.y <= viewEndRow) {
                    newVisibleSlots[slot.id] = slot;
                }
            });
            Object.values(chunk.villages || {}).forEach(village => {
                if (village.x >= viewStartCol && village.x <= viewEndCol && village.y >= viewStartRow && village.y <= viewEndRow) {
                    newVisibleVillages[village.id] = village;
                }
            });
            Object.values(chunk.ruins || {}).forEach(ruin => {
                if (ruin.x >= viewStartCol && ruin.x <= viewEndCol && ruin.y >= viewStartRow && ruin.y <= viewEndRow) {
                    newVisibleRuins[ruin.id] = ruin;
                }
            });
        });
        setVisibleSlots(newVisibleSlots);
        setVisibleVillages(newVisibleVillages);
        setVisibleRuins(newVisibleRuins);

    }, [cachedData, pan, zoom, viewportSize]);


    return {
        visibleSlots,
        visibleVillages,
        visibleRuins,
        invalidateChunkCache
    };
};

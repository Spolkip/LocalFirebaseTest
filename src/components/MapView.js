import React, { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { useAlliance } from '../contexts/AllianceContext';
import { db } from '../firebase/config';
import { doc, updateDoc, writeBatch, serverTimestamp, getDoc, collection, getDocs, query,orderBy, onSnapshot, where, collectionGroup } from 'firebase/firestore';
import island1 from '../images/islands/island_1.png';
import island2 from '../images/islands/island_2.png';
import SidebarNav from './map/SidebarNav';
import TopBar from './map/TopBar';
import MapGrid from './map/MapGrid';
import MapModals from './map/MapModals';
import SideInfoPanel from './SideInfoPanel';
import DivinePowers from './city/DivinePowers';
import QuestsButton from './QuestsButton';
import MapOverlay from './map/MapOverlay';
import WithdrawModal from './city/WithdrawModal';
import WonderBuilderModal from './alliance/WonderBuilderModal';
import WonderProgressModal from './alliance/WonderProgressModal';
import Modal from './shared/Modal';
import allianceWonders from '../gameData/alliance_wonders.json';
import { useMapInteraction } from '../hooks/useMapInteraction';
import { useMapData } from '../hooks/usemapdatapls';
import { useMapActions } from '../hooks/useMapActions';
import { useCityState } from '../hooks/useCityState';
import { useMapState } from '../hooks/useMapState';
import { useMapClickHandler } from '../hooks/useMapClickHandler';
import buildingConfig from '../gameData/buildings.json';

const TILE_SIZE = 32;
let mapViewCache = {
    cityPoints: null,
    scoutedCities: null,
    timestamp: 0,
};

const islandImageMap = {
    'island_1.png': island1,
    'island_2.png': island2,
};

const MapView = ({
    showCity,
    openModal,
    closeModal,
    modalState,
    unreadReportsCount,
    unreadMessagesCount,
    quests,
    claimReward,
    handleMessageAction,
    panToCoords,
    setPanToCoords,
    handleGoToCityFromProfile,
    movements,
    onCancelTrain,
    onCancelMovement,
    isUnderAttack,
    incomingAttackCount,
    onRenameCity,
    centerOnCity,
    onGodTownClick,
    handleOpenEvents,
    onSwitchCity,
    battlePoints,
    initialMapAction,
    setInitialMapAction,
    onOpenManagementPanel,
    onOpenNotes,
}) => {
    const { currentUser, userProfile } = useAuth();
    const { worldState, gameState, setGameState, worldId, playerCity, playerCities, conqueredVillages, conqueredRuins, gameSettings, activeCityId, playerCityPoints } = useGame();
    const { playerAlliance } = useAlliance();
    const viewportRef = useRef(null);
    const mapContainerRef = useRef(null);
    const { isPlacingDummyCity, setIsPlacingDummyCity } = useMapState();
    const { pan, zoom, viewportSize, borderOpacity, isPanning, handleMouseDown, goToCoordinates } = useMapInteraction(viewportRef, mapContainerRef, worldState, playerCity, centerOnCity);
    const { visibleSlots, visibleVillages, visibleRuins, invalidateChunkCache } = useMapData(currentUser, worldId, worldState, pan, zoom, viewportSize);
    const [message, setMessage] = useState('');
    const { travelTimeInfo, setTravelTimeInfo, handleActionClick, handleSendMovement, handleCreateDummyCity, handleWithdrawTroops, handleFoundCity } = useMapActions(openModal, closeModal, showCity, invalidateChunkCache, setMessage);
    const { getFarmCapacity, calculateUsedPopulation, calculateHappiness, getMarketCapacity, calculateTotalPoints, getProductionRates, getWarehouseCapacity } = useCityState(worldId);
    const [cityPoints, setCityPoints] = useState({});
    const [scoutedCities, setScoutedCities] = useState({});
    const [mouseCoords, setMouseCoords] = useState({ x: 0, y: 0 });
    const [controlledIslands, setControlledIslands] = useState({});
    const [wonderSpots, setWonderSpots] = useState({});
    const [wonderBuilderData, setWonderBuilderData] = useState(null);
    const [wonderProgressData, setWonderProgressData] = useState(null);
    const [allCitySlots, setAllCitySlots] = useState(null);
    const [godTowns, setGodTowns] = useState({});
    const [allWonders, setAllWonders] = useState([]);
    const [wonderInfo, setWonderInfo] = useState(null);

    const handleEnterCity = (cityId) => {
        onSwitchCity(cityId);
        showCity();
        closeModal('city');
    };

    useEffect(() => {
        if (!worldId) return;
        const wondersQuery = query(collection(db, 'worlds', worldId, 'alliances'), where('allianceWonder', '!=', null));
        const unsubscribe = onSnapshot(wondersQuery, (snapshot) => {
            const wonders = [];
            snapshot.forEach(doc => {
                wonders.push({
                    ...doc.data().allianceWonder,
                    allianceName: doc.data().name,
                    allianceTag: doc.data().tag,
                    allianceId: doc.id
                });
            });
            setAllWonders(wonders);
        });
        return () => unsubscribe();
    }, [worldId]);

    useEffect(() => {
        if (!worldId) return;
        const citySlotsRef = collection(db, 'worlds', worldId, 'citySlots');
        const unsubscribe = onSnapshot(citySlotsRef, (snapshot) => {
            const slots = {};
            snapshot.forEach(doc => {
                slots[doc.id] = { id: doc.id, ...doc.data() };
            });
            setAllCitySlots(slots);
        });

        const godTownsColRef = collection(db, 'worlds', worldId, 'godTowns');
        const unsubscribeGodTowns = onSnapshot(godTownsColRef, (snapshot) => {
            const townsData = {};
            snapshot.docs.forEach(doc => {
                townsData[doc.id] = { id: doc.id, ...doc.data() };
            });
            setGodTowns(townsData);
        });

        return () => {
            unsubscribe();
            unsubscribeGodTowns();
        };
    }, [worldId]);

    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;
        const handleMouseMove = (e) => {
            const rect = viewport.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const mapX = Math.floor((-pan.x + mouseX) / (32 * zoom));
            const mapY = Math.floor((-pan.y + mouseY) / (32 * zoom));
            setMouseCoords({ x: mapX, y: mapY });
        };
        viewport.addEventListener('mousemove', handleMouseMove);
        return () => viewport.removeEventListener('mousemove', handleMouseMove);
    }, [pan, zoom]);

    const fetchAllCityPoints = useCallback(async () => {
        if (!worldId || !worldState) return {};
        const points = {};
        const gamesGroupRef = collectionGroup(db, 'games');
        const q = query(gamesGroupRef, where('worldName', '==', worldState.name));
        const gamesSnapshot = await getDocs(q);
        for (const gameDoc of gamesSnapshot.docs) {
            const userId = gameDoc.ref.parent.parent.id;
            if (userId === currentUser.uid) continue;
            const citiesRef = collection(db, `users/${userId}/games`, worldId, 'cities');
            const citiesSnapshot = await getDocs(citiesRef);
            for (const cityDoc of citiesSnapshot.docs) {
                const cityData = cityDoc.data();
                if (cityData.slotId) {
                    const totalPoints = calculateTotalPoints(cityData);
                    points[cityData.slotId] = totalPoints;
                }
            }
        }
        return points;
    }, [worldId, worldState, calculateTotalPoints, currentUser.uid]);

    const fetchScoutedData = useCallback(async () => {
        if (!currentUser || !worldId) return {};
        const reportsRef = collection(db, 'users', currentUser.uid, 'worlds', worldId, 'reports');
        const q = query(reportsRef, orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        const latestScouts = {};
        snapshot.forEach(doc => {
            const report = doc.data();
            if (report.type === 'scout' && report.scoutSucceeded) {
                const targetId = report.targetSlotId;
                if (targetId && !latestScouts[targetId]) {
                    latestScouts[targetId] = report.units;
                }
            }
        });
        return latestScouts;
    }, [currentUser, worldId]);

    useEffect(() => {
        const now = Date.now();
        const CACHE_DURATION = 15 * 60 * 1000;
        if (now - mapViewCache.timestamp < CACHE_DURATION && mapViewCache.cityPoints) {
            setCityPoints(mapViewCache.cityPoints);
            setScoutedCities(mapViewCache.scoutedCities);
        } else {
            const fetchData = async () => {
                const pointsData = await fetchAllCityPoints();
                const scoutedData = await fetchScoutedData();
                setCityPoints(pointsData);
                setScoutedCities(scoutedData);
                mapViewCache = {
                    cityPoints: pointsData,
                    scoutedCities: scoutedData,
                    timestamp: now,
                };
            };
            fetchData();
        }
    }, [fetchAllCityPoints, fetchScoutedData]);

    useEffect(() => {
        if (panToCoords) {
            goToCoordinates(panToCoords.x, panToCoords.y);
            setPanToCoords(null);
        }
    }, [panToCoords, goToCoordinates, setPanToCoords]);

    const { onCitySlotClick, onVillageClick, onRuinClick } = useMapClickHandler({
        playerCity,
        isPlacingDummyCity,
        handleCreateDummyCity,
        setTravelTimeInfo,
        openModal,
        closeModal,
        setMessage,
        conqueredVillages,
        conqueredRuins,
        cityGameState: gameState,
    });

    const { availablePopulation, happiness, marketCapacity } = useMemo(() => {
        if (!gameState?.buildings) return { availablePopulation: 0, happiness: 0, marketCapacity: 0 };
        const maxPop = getFarmCapacity(gameState.buildings.farm?.level);
        const usedPop = calculateUsedPopulation(gameState.buildings, gameState.units, gameState.specialBuilding);
        const availablePop = maxPop - usedPop;
        const happinessValue = calculateHappiness(gameState.buildings);
        const marketCap = getMarketCapacity(gameState.buildings.market?.level);
        return { availablePopulation: availablePop, happiness: happinessValue, marketCapacity: marketCap };
    }, [gameState, getFarmCapacity, calculateUsedPopulation, calculateHappiness, getMarketCapacity]);

    const productionRates = useMemo(() => {
        if (!gameState) return { wood: 0, stone: 0, silver: 0 };
        return getProductionRates(gameState.buildings);
    }, [gameState, getProductionRates]);

    const handleOpenAlliance = () => openModal('alliance');

    const combinedSlots = useMemo(() => {
        const newSlots = { ...visibleSlots };
        for (const cityId in playerCities) {
            const pCity = playerCities[cityId];
            if (pCity && pCity.slotId) {
                const existingSlotData = newSlots[pCity.slotId] || {};
                newSlots[pCity.slotId] = {
                    ...existingSlotData,
                    ...pCity,
                    ownerId: currentUser.uid,
                    ownerUsername: userProfile.username
                };
            }
        }
        return newSlots;
    }, [visibleSlots, playerCities, currentUser.uid, userProfile.username]);

    useEffect(() => {
        if (initialMapAction?.type === 'open_city_modal') {
            const { coords } = initialMapAction;
            const targetX = parseFloat(coords.x);
            const targetY = parseFloat(coords.y);
            const citySlot = Object.values(combinedSlots).find(
                slot => slot.x === targetX && slot.y === targetY
            );
            if (citySlot) {
                onCitySlotClick(null, citySlot);
            }
            setInitialMapAction(null);
        }
    }, [initialMapAction, setInitialMapAction, combinedSlots, onCitySlotClick]);

    const combinedLocations = useMemo(() => ({ ...combinedSlots, ...visibleVillages, ...visibleRuins }), [combinedSlots, visibleVillages, visibleRuins]);

    const handleRushMovement = useCallback(async (movementId) => {
        if (userProfile?.is_admin) {
            await updateDoc(doc(db, 'worlds', worldId, 'movements', movementId), { arrivalTime: new Date() });
        }
    }, [userProfile, worldId]);

    const handleToggleDummyCityPlacement = () => {
        setIsPlacingDummyCity(prev => !prev);
        setMessage(isPlacingDummyCity ? 'Dummy city placement OFF.' : 'Dummy city placement ON.');
    };

    const handleCastSpell = async (power, targetCity) => {
        const currentState = gameState;
        if (!currentState?.god || (currentState.worship[currentState.god] || 0) < power.favorCost) {
            setMessage("Not enough favor.");
            return;
        }
        const batch = writeBatch(db);
        const casterGameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId);
        const newWorship = { ...currentState.worship, [currentState.god]: currentState.worship[currentState.god] - power.favorCost };
        batch.update(casterGameDocRef, { worship: newWorship });
        const isSelfCast = !targetCity;
        const targetOwnerId = isSelfCast ? currentUser.uid : targetCity.ownerId;
        const targetGameDocRef = doc(db, `users/${targetOwnerId}/games`, worldId);
        const targetGameSnap = await getDoc(targetGameDocRef);
        if (!targetGameSnap.exists()) {
            setMessage("Target city's data not found.");
            await batch.commit();
            setGameState({ ...gameState, worship: newWorship });
            return;
        }
        const targetGameState = targetGameSnap.data();
        let spellEffectMessage = '', casterMessage = '';
        switch (power.effect.type) {
            case 'add_resources':
            case 'add_multiple_resources': {
                const resourcesToAdd = power.effect.type === 'add_resources' ? { [power.effect.resource]: power.effect.amount } : power.effect.resources;
                const newResources = { ...targetGameState.resources };
                let resourcesReceivedMessage = [];
                for (const resource in resourcesToAdd) {
                    newResources[resource] = (newResources[resource] || 0) + resourcesToAdd[resource];
                    resourcesReceivedMessage.push(`${resourcesToAdd[resource]} ${resource}`);
                }
                batch.update(targetGameDocRef, { resources: newResources });
                casterMessage = isSelfCast ? `You blessed yourself with ${resourcesReceivedMessage.join(' & ')}!` : `You blessed ${targetGameState.cityName} with ${resourcesReceivedMessage.join(' & ')}.`;
                if (!isSelfCast) spellEffectMessage = `Your city ${targetGameState.cityName} was blessed with ${resourcesReceivedMessage.join(' & ')} by ${userProfile.username}!`;
                break;
            }
            case 'damage_building': {
                if (isSelfCast) break;
                const buildings = { ...targetGameState.buildings };
                const buildingKeys = Object.keys(buildings).filter(b => buildings[b].level > 0);
                if (buildingKeys.length > 0) {
                    const randomBuildingKey = buildingKeys[Math.floor(Math.random() * buildingKeys.length)];
                    buildings[randomBuildingKey].level = Math.max(0, buildings[randomBuildingKey].level - power.effect.amount);
                    spellEffectMessage = `Your ${buildingConfig[randomBuildingKey]?.name} in ${targetGameState.cityName} was damaged by divine power from ${userProfile.username}!`;
                    casterMessage = `You damaged a building in ${targetGameState.cityName}.`;
                    batch.update(targetGameDocRef, { buildings });
                } else {
                    casterMessage = `You tried to damage a building in ${targetGameState.cityName}, but there were none.`;
                }
                break;
            }
            default: setMessage("Spell effect not implemented."); return;
        }
        const casterReport = { type: 'spell_cast', title: `Spell cast: ${power.name}`, timestamp: serverTimestamp(), outcome: { message: casterMessage }, read: false };
        batch.set(doc(collection(db, `users/${currentUser.uid}/reports`)), casterReport);
        if (!isSelfCast) {
            const targetReport = { type: 'spell_received', title: `Divine Intervention!`, timestamp: serverTimestamp(), outcome: { message: spellEffectMessage, from: playerCity.cityName }, read: false };
            batch.set(doc(collection(db, `users/${targetOwnerId}/reports`)), targetReport);
        }
        try {
            await batch.commit();
            setMessage(`${power.name} has been cast!`);
            closeModal('divinePowers');
            if (isSelfCast) setGameState((await getDoc(casterGameDocRef)).data());
            else setGameState({ ...gameState, worship: newWorship });
        } catch (error) {
            console.error("Error casting spell:", error);
            setMessage("Failed to cast spell.");
        }
    };
    const handleGoToActiveCity = () => {
        if (activeCityId) {
            showCity(activeCityId);
        } else {
            setMessage("No active city to view.");
        }
    };
    const handleOpenWithdrawModal = (city) => {
        openModal('withdraw', city);
    };
    useEffect(() => {
        if (!worldState?.islands || !allCitySlots) {
            return;
        }
        const islandSlotCounts = {};
        const islandAllianceCounts = {};
        worldState.islands.forEach(island => {
            islandSlotCounts[island.id] = 0;
            islandAllianceCounts[island.id] = {};
        });
        Object.values(allCitySlots).forEach(slot => {
            if (slot.islandId && islandSlotCounts.hasOwnProperty(slot.islandId)) {
                islandSlotCounts[slot.islandId]++;
                if (slot.ownerId && slot.alliance) {
                    const allianceTag = slot.alliance;
                    if (!islandAllianceCounts[slot.islandId][allianceTag]) {
                        islandAllianceCounts[slot.islandId][allianceTag] = 0;
                    }
                    islandAllianceCounts[slot.islandId][allianceTag]++;
                }
            }
        });
        const newControlledIslands = {};
        for (const islandId in islandSlotCounts) {
            if (islandSlotCounts[islandId] > 0) {
                for (const allianceTag in islandAllianceCounts[islandId]) {
                    if (islandAllianceCounts[islandId][allianceTag] === islandSlotCounts[islandId]) {
                        newControlledIslands[islandId] = allianceTag;
                    }
                }
            }
        }
        setControlledIslands(newControlledIslands);
    }, [worldState, allCitySlots]);
    useEffect(() => {
        if (!worldState?.islands || !allCitySlots || !visibleVillages) {
            setWonderSpots({});
            return;
        }
        const newSpots = {};
        worldState.islands.forEach(island => {
            if (allWonders.some(w => w.islandId === island.id)) return;
            const centerX = Math.round(island.x);
            const centerY = Math.round(island.y);
            let bestSpot = null;
            let fallbackSpot = null;
            for (let r = 0; r < island.radius * 2 && !bestSpot; r++) {
                for (let dx = -r; dx <= r && !bestSpot; dx++) {
                    for (let dy = -r; dy <= r; dy++) {
                        if (dx*dx + dy*dy > r*r) continue;
                        const x = centerX + dx;
                        const y = centerY + dy;
                        if (x < 0 || x >= worldState.width || y < 0 || y >= worldState.height) continue;
                        const distSq = Math.pow(x - island.x, 2) + Math.pow(y - island.y, 2);
                        if (distSq > Math.pow(island.radius, 2)) continue;
                        const isCitySlot = Object.values(allCitySlots).some(s => s && s.x === x && s.y === y);
                        if (isCitySlot) continue;
                        const isVillage = Object.values(visibleVillages).some(v => v && v.x === x && v.y === y);
                        if (!isVillage) {
                            bestSpot = { x, y, islandId: island.id };
                            break;
                        } else if (!fallbackSpot) {
                            fallbackSpot = { x, y, islandId: island.id };
                        }
                    }
                }
            }
            const finalSpot = bestSpot || fallbackSpot;
            if (finalSpot) {
                newSpots[island.id] = finalSpot;
            }
        });
        setWonderSpots(newSpots);
    }, [worldState, allCitySlots, visibleVillages, allWonders]);
    const handleWonderSpotClick = (spotData) => {
        if (playerAlliance?.leader?.uid !== currentUser.uid) {
            setMessage("Only the alliance leader can begin construction of a wonder.");
            return;
        }
        if (playerAlliance.allianceWonder) {
            setMessage("Your alliance is already building a wonder elsewhere.");
            return;
        }
        setWonderBuilderData({ islandId: spotData.islandId, coords: { x: spotData.x, y: spotData.y } });
    };
    const handleConstructingWonderClick = (wonderData) => {
        if (playerAlliance && playerAlliance.id === wonderData.allianceId) {
            setWonderProgressData(wonderData);
        } else {
            const wonderConfig = allianceWonders[wonderData.id];
            setWonderInfo({
                title: wonderConfig.name,
                message: `Level ${wonderData.level}. Being built by ${wonderData.allianceName} [${wonderData.allianceTag}].`
            });
        }
    };
    const mapGrid = useMemo(() => {
        if (!worldState?.islands) return null;
        const grid = Array(worldState.height).fill(null).map(() => Array(worldState.width).fill({ type: 'water' }));
        worldState.islands.forEach(island => {
            if (!island.imageName) {
                const centerX = Math.round(island.x), centerY = Math.round(island.y);
                for (let i = -Math.floor(island.radius); i <= Math.ceil(island.radius); i++) {
                    for (let j = -Math.floor(island.radius); j <= Math.ceil(island.radius); j++) {
                        if (i * i + j * j <= island.radius * island.radius) {
                            const x = centerX + j, y = centerY + i;
                            if (y >= 0 && y < worldState.height && x >= 0 && x < worldState.width) {
                                grid[y][x] = { type: 'land', data: { hasImage: false } };
                            }
                        }
                    }
                }
            }
        });
        const mergeWithGrid = (items, type) => {
            Object.values(items).forEach(item => {
                if (item.x !== undefined && item.y !== undefined) {
                    const x = Math.round(item.x), y = Math.round(item.y);
                    if (y >= 0 && y < worldState.height && x >= 0 && x < worldState.width) {
                         if (!grid[y][x] || grid[y][x].type === 'water') {
                            grid[y][x] = { type: 'land', data: { hasImage: true } };
                        }
                        grid[y][x] = { type, data: { ...item, ...grid[y][x].data } };
                    }
                }
            });
        };
        mergeWithGrid(combinedSlots, 'city_slot');
        mergeWithGrid(visibleVillages, 'village');
        Object.values(visibleRuins).forEach(ruin => {
            const x = Math.round(ruin.x), y = Math.round(ruin.y);
            if (grid[y]?.[x]) grid[y][x] = { type: 'ruin', data: ruin };
        });
        Object.values(godTowns).forEach(town => {
            const x = Math.round(town.x), y = Math.round(town.y);
            if (grid[y]?.[x]) {
                grid[y][x] = { type: 'god_town', data: town };
            }
        });
        Object.values(wonderSpots).forEach(spot => {
            if (grid[spot.y]?.[spot.x]) {
                grid[spot.y][spot.x] = { type: 'wonder_spot', data: spot };
            }
        });
        allWonders.forEach(wonder => {
            if (wonder.x !== undefined && grid[wonder.y]?.[wonder.x]) {
                grid[wonder.y][wonder.x] = { type: 'constructing_wonder', data: wonder };
            }
        });
        return grid;
    }, [worldState, combinedSlots, visibleVillages, visibleRuins, godTowns, wonderSpots, allWonders]);
    const combinedCityPoints = useMemo(() => {
        return { ...cityPoints, ...playerCityPoints };
    }, [cityPoints, playerCityPoints]);
    return (
        <div className="w-full h-screen flex flex-col bg-gray-900 map-view-wrapper relative">
            {isUnderAttack && <div className="screen-glow-attack"></div>}
            <QuestsButton
                onOpenQuests={() => openModal('quests')}
                quests={quests}
            />
            <div className="flex-grow flex flex-row overflow-visible">
                <div className="main-content flex-grow relative map-surface">
                    <TopBar
                        view="map"
                        gameState={gameState}
                        availablePopulation={availablePopulation}
                        happiness={happiness}
                        worldState={worldState}
                        productionRates={productionRates}
                        getWarehouseCapacity={getWarehouseCapacity}
                        movements={movements}
                        onCancelTrain={onCancelTrain}
                        onCancelMovement={onCancelMovement}
                        combinedSlots={combinedLocations}
                        onOpenMovements={() => openModal('movements')}
                        isUnderAttack={isUnderAttack}
                        incomingAttackCount={incomingAttackCount}
                        onRenameCity={onRenameCity}
                        onSwitchCity={onSwitchCity}
                        battlePoints={battlePoints}
                        onOpenNotes={onOpenNotes}
                    />
                    <SidebarNav
                        onToggleView={handleGoToActiveCity}
                        view="map"
                        onOpenReports={() => openModal('reports')}
                        onOpenAlliance={handleOpenAlliance}
                        onOpenForum={() => openModal('allianceForum')}
                        onOpenMessages={() => openModal('messages')}
                        onOpenSettings={() => openModal('settings')}
                        onOpenProfile={() => openModal('profile')}
                        onOpenLeaderboard={() => openModal('leaderboard')}
                        onOpenQuests={() => openModal('quests')}
                        unreadReportsCount={unreadReportsCount}
                        unreadMessagesCount={unreadMessagesCount}
                        isAdmin={userProfile?.is_admin}
                        onToggleDummyCityPlacement={handleToggleDummyCityPlacement}
                        isAllianceMember={!!playerAlliance}
                        handleOpenEvents={handleOpenEvents}
                        onOpenManagementPanel={onOpenManagementPanel}
                    />
                    <SideInfoPanel gameState={gameState} className="absolute top-1/2 right-4 transform -translate-y-1/2 z-20 flex flex-col gap-4" onOpenPowers={() => openModal('divinePowers')} movements={movements} />
                    <MapOverlay
                        mouseCoords={mouseCoords}
                        pan={pan}
                        zoom={zoom}
                        viewportSize={viewportSize}
                        worldState={worldState}
                        allCities={combinedSlots}
                        ruins={visibleRuins}
                        playerAlliance={playerAlliance}
                    />
                    <div className="map-viewport" ref={viewportRef} onMouseDown={handleMouseDown} style={{ cursor: isPanning ? 'grabbing' : (isPlacingDummyCity ? 'crosshair' : 'grab') }}>
                        <div className="map-border top" style={{ opacity: borderOpacity.top }}></div>
                        <div className="map-border bottom" style={{ opacity: borderOpacity.bottom }}></div>
                        <div className="map-border left" style={{ opacity: borderOpacity.left }}></div>
                        <div className="map-border right" style={{ opacity: borderOpacity.right }}></div>
                        <div className="absolute inset-0 z-0">
                            <div ref={mapContainerRef} className="map-surface" style={{ width: worldState?.width * 32, height: worldState?.height * 32, transformOrigin: '0 0' }}>
                                {worldState?.islands && gameSettings.showVisuals && worldState.islands.map(island => (
                                    island.imageName && <img
                                        key={island.id}
                                        src={islandImageMap[island.imageName]}
                                        alt={island.name}
                                        style={{
                                            position: 'absolute',
                                            left: (island.x - island.radius) * TILE_SIZE,
                                            top: (island.y - island.radius) * TILE_SIZE,
                                            width: island.radius * 2 * TILE_SIZE,
                                            height: island.radius * 2 * TILE_SIZE,
                                            pointerEvents: 'none',
                                            zIndex: 1,
                                            userSelect: 'none',
                                            WebkitUserSelect: 'none',
                                            MozUserSelect: 'none',
                                            msUserSelect: 'none',
                                            WebkitUserDrag: 'none',
                                            userDrag: 'none',
                                        }}
                                    />
                                ))}
                                <div style={{ position: 'relative', zIndex: 2 }}>
                                    <MapGrid
                                        mapGrid={mapGrid}
                                        worldState={worldState}
                                        pan={pan}
                                        zoom={zoom}
                                        viewportSize={viewportSize}
                                        onCitySlotClick={onCitySlotClick}
                                        onVillageClick={onVillageClick}
                                        onRuinClick={onRuinClick}
                                        onGodTownClick={onGodTownClick}
                                        onWonderSpotClick={handleWonderSpotClick}
                                        onConstructingWonderClick={handleConstructingWonderClick}
                                        isPlacingDummyCity={isPlacingDummyCity}
                                        movements={movements}
                                        combinedSlots={combinedSlots}
                                        villages={visibleVillages}
                                        ruins={visibleRuins}
                                        godTowns={godTowns}
                                        playerAlliance={playerAlliance}
                                        conqueredVillages={conqueredVillages}
                                        gameSettings={gameSettings}
                                        cityPoints={combinedCityPoints}
                                        scoutedCities={scoutedCities}
                                        controlledIslands={controlledIslands}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {message && <Modal message={message} onClose={() => setMessage('')} />}
            {wonderInfo && <Modal title={wonderInfo.title} message={wonderInfo.message} onClose={() => setWonderInfo(null)} />}
            <MapModals
                modalState={modalState}
                closeModal={closeModal}
                gameState={gameState}
                playerCity={playerCity}
                travelTimeInfo={travelTimeInfo}
                handleSendMovement={handleSendMovement}
                handleCancelMovement={onCancelMovement}
                setMessage={setMessage}
                goToCoordinates={goToCoordinates}
                handleActionClick={handleActionClick}
                worldId={worldId}
                movements={movements}
                combinedSlots={combinedLocations}
                villages={visibleVillages}
                handleRushMovement={handleRushMovement}
                userProfile={userProfile}
                onCastSpell={handleCastSpell}
                onActionClick={handleMessageAction}
                marketCapacity={marketCapacity}
                onEnterCity={handleEnterCity}
                onSwitchCity={onSwitchCity}
                onWithdraw={handleOpenWithdrawModal}
                onFoundCity={handleFoundCity}
            />
            {modalState.isDivinePowersOpen && <DivinePowers godName={gameState.god} playerReligion={gameState.playerInfo.religion} favor={gameState.worship[gameState.god] || 0} onCastSpell={(power) => handleCastSpell(power, modalState.divinePowersTarget)} onClose={() => closeModal('divinePowers')} targetType={modalState.divinePowersTarget ? 'other' : 'self'} />}
            {modalState.isWithdrawModalOpen && (
                <WithdrawModal
                    city={modalState.withdrawModalData}
                    onClose={() => closeModal('withdraw')}
                    onWithdrawTroops={handleWithdrawTroops}
                />
            )}
            {wonderBuilderData && <WonderBuilderModal onClose={() => setWonderBuilderData(null)} {...wonderBuilderData} />}
            {wonderProgressData && <WonderProgressModal onClose={() => setWonderProgressData(null)} />}
        </div>
    );
};

export default MapView;
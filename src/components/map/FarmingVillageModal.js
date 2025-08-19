// src/components/map/FarmingVillageModal.js
import React, { useState, useEffect, useMemo } from 'react';
import Countdown from './Countdown';
import { db } from '../../firebase/config';
import { doc, runTransaction, serverTimestamp, onSnapshot, collection } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { useAlliance } from '../../contexts/AllianceContext';
import { resolveVillageRetaliation } from '../../utils/combat';
import resourceImage from '../../images/resources/resources.png';
import woodImage from '../../images/resources/wood.png';
import stoneImage from '../../images/resources/stone.png';
import silverImage from '../../images/resources/silver.png';

const demandOptions = [
    { name: '5 minutes', duration: 300, multiplier: 0.125, happinessCost: 0 },
    { name: '40 minutes', duration: 2400, multiplier: 1, happinessCost: 2 },
    { name: '2 hours', duration: 7200, multiplier: 3, happinessCost: 5 },
    { name: '4 hours', duration: 14400, multiplier: 4, happinessCost: 10 },
];

const FarmingVillageModal = ({ village: initialVillage, onClose, worldId, marketCapacity }) => {
    const { currentUser, userProfile } = useAuth();
    const { gameState, setGameState, countCitiesOnIsland, activeCityId } = useGame();
    const { playerAlliance } = useAlliance();
    const [village, setVillage] = useState(initialVillage);
    const [baseVillageData, setBaseVillageData] = useState(initialVillage);
    const [isProcessing, setIsProcessing] = useState(false);
    const [message, setMessage] = useState('');
    const [timeSinceCollection, setTimeSinceCollection] = useState(Infinity);
    const [activeTab, setActiveTab] = useState('demand');
    const [tradeAmount, setTradeAmount] = useState(0);
    const [plunderTimeLeft, setPlunderTimeLeft] = useState(0); // State for plunder cooldown

    const resourceImages = {
        wood: woodImage,
        stone: stoneImage,
        silver: silverImage,
    };

    useEffect(() => {
        if (!worldId || !village?.id || !currentUser) return;

        const playerVillageRef = doc(db, 'users', currentUser.uid, 'games', worldId, 'conqueredVillages', village.id);
        const unsubscribePlayerVillage = onSnapshot(playerVillageRef, (docSnap) => {
            if (docSnap.exists()) {
                setVillage(prev => ({ ...prev, ...docSnap.data() }));
            } else {
                onClose();
            }
        });

        const baseVillageRef = doc(db, 'worlds', worldId, 'villages', village.id);
        const unsubscribeBaseVillage = onSnapshot(baseVillageRef, (docSnap) => {
            if (docSnap.exists()) {
                setBaseVillageData(docSnap.data());
            }
        });

        return () => {
            unsubscribePlayerVillage();
            unsubscribeBaseVillage();
        };
    }, [worldId, village.id, currentUser, onClose]);

    useEffect(() => {
        if (!worldId || !village?.id || !baseVillageData) return;

        const interval = setInterval(async () => {
            const villageRef = doc(db, 'worlds', worldId, 'villages', village.id);
            try {
                await runTransaction(db, async (transaction) => {
                    const villageDoc = await transaction.get(villageRef);
                    if (!villageDoc.exists()) return;
                    const villageData = villageDoc.data();
                    
                    const lastUpdated = villageData.lastUpdated?.toDate() || new Date();
                    const now = new Date();
                    const elapsedHours = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);

                    if (elapsedHours > 0) {
                        const newResources = { ...(villageData.resources || {}) };
                        const productionRate = getVillageProductionRate(villageData.level);
                        const maxResources = getVillageMaxCapacity(villageData.level);
                        
                        Object.keys(productionRate).forEach(resource => {
                             newResources[resource] = Math.min(maxResources[resource], (newResources[resource] || 0) + productionRate[resource] * elapsedHours);
                        });

                        transaction.update(villageRef, { resources: newResources, lastUpdated: serverTimestamp() });
                    }
                });
            } catch (error) {
                console.error("Error updating village resources:", error);
            }
        }, 60000 * 5);
        
        return () => clearInterval(interval);
    }, [worldId, village.id, baseVillageData]);

    // This useEffect now handles happiness regeneration periodically.
    useEffect(() => {
        const happinessRegenInterval = setInterval(async () => {
            if (!worldId || !village?.id || !currentUser) return;
    
            const playerVillageRef = doc(db, 'users', currentUser.uid, 'games', worldId, 'conqueredVillages', village.id);
    
            try {
                await runTransaction(db, async (transaction) => {
                    const villageDoc = await transaction.get(playerVillageRef);
                    if (!villageDoc.exists()) return;
    
                    const villageData = villageDoc.data();
                    if (villageData.happiness >= 100) return;
    
                    const lastUpdated = villageData.happinessLastUpdated?.toDate() || new Date();
                    const now = new Date();
                    const elapsedMinutes = (now.getTime() - lastUpdated.getTime()) / (1000 * 60);
                    
                    const happinessToRegen = elapsedMinutes * (2 / 60); // 2 happiness per hour
    
                    if (happinessToRegen > 0) {
                        const newHappiness = Math.min(100, (villageData.happiness || 0) + happinessToRegen);
                        if (newHappiness > villageData.happiness) {
                            transaction.update(playerVillageRef, {
                                happiness: newHappiness,
                                happinessLastUpdated: serverTimestamp()
                            });
                        }
                    }
                });
            } catch (error) {
                console.error("Error regenerating village happiness:", error);
            }
        }, 60000); // Run every minute
    
        return () => clearInterval(happinessRegenInterval);
    }, [worldId, village?.id, currentUser]);

    const getVillageProductionRate = (level) => ({ wood: level * 100, stone: level * 100, silver: Math.floor(level * 50) });
    const getVillageMaxCapacity = (level) => ({ wood: 1000 + (level - 1) * 500, stone: 1000 + (level - 1) * 500, silver: 1000 + (level - 1) * 500 });

    useEffect(() => {
        if (village && village.lastCollected) {
            const updateTimer = () => {
                const lastCollectedTime = village.lastCollected.toDate().getTime();
                setTimeSinceCollection(Math.floor((Date.now() - lastCollectedTime) / 1000));
            };
            updateTimer();
            const interval = setInterval(updateTimer, 1000);
            return () => clearInterval(interval);
        }
    }, [village]);

    // #comment New useEffect for plunder cooldown
    useEffect(() => {
        if (village && village.lastPlundered) {
            const updateTimer = () => {
                const lastPlunderedTime = village.lastPlundered.toDate().getTime();
                const cooldownEndTime = lastPlunderedTime + 20 * 60 * 1000; // 20 minutes
                const remaining = Math.max(0, cooldownEndTime - Date.now());
                setPlunderTimeLeft(remaining / 1000);
            };
            updateTimer();
            const interval = setInterval(updateTimer, 1000);
            return () => clearInterval(interval);
        } else {
            setPlunderTimeLeft(0);
        }
    }, [village]);

    const getUpgradeCost = (level) => ({
        wood: Math.floor(200 * Math.pow(1.6, level - 1)),
        stone: Math.floor(200 * Math.pow(1.6, level - 1)),
        silver: Math.floor(100 * Math.pow(1.8, level - 1)),
    });

    // #comment Calculate the demand yields with a memoized hook to ensure the UI updates when the bonus changes.
    const demandYields = useMemo(() => {
        const citiesOnIsland = countCitiesOnIsland(village.islandId);
        const bonusMultiplier = citiesOnIsland > 1 ? 1.20 : 1.0;
        
        let demandBoost = 1.0;
        if (playerAlliance?.research) {
            const demandBoostLevel = playerAlliance.research.diplomatic_leverage?.level || 0;
            demandBoost += demandBoostLevel * 0.03;
        }

        return demandOptions.map(option => ({
            ...option,
            yield: {
                wood: baseVillageData ? Math.floor((baseVillageData.demandYield?.wood || 0) * option.multiplier * village.level * bonusMultiplier * demandBoost) : 0,
                stone: baseVillageData ? Math.floor((baseVillageData.demandYield?.stone || 0) * option.multiplier * village.level * bonusMultiplier * demandBoost) : 0,
                silver: baseVillageData ? Math.floor((baseVillageData.demandYield?.silver || 0) * option.multiplier * village.level * bonusMultiplier * demandBoost) : 0,
            }
        }));
    }, [village.level, village.islandId, baseVillageData, countCitiesOnIsland, playerAlliance]);

    const handleDemand = async (option) => {
        if (isProcessing || !baseVillageData) return;
        setIsProcessing(true);
        setMessage('');
    
        const playerVillageRef = doc(db, 'users', currentUser.uid, 'games', worldId, 'conqueredVillages', village.id);
        const cityDocRef = doc(db, 'users', currentUser.uid, 'games', worldId, 'cities', activeCityId);
        
        const citiesOnIsland = countCitiesOnIsland(village.islandId);
        const hasBonus = citiesOnIsland > 1;
        const bonusMultiplier = hasBonus ? 1.20 : 1.0;
    
        try {
            const updatedCityState = await runTransaction(db, async (transaction) => {
                const playerVillageDoc = await transaction.get(playerVillageRef);
                const cityDoc = await transaction.get(cityDocRef);
                if (!playerVillageDoc.exists() || !cityDoc.exists()) throw new Error("Your village or active city state not found.");
    
                const villageData = playerVillageDoc.data();
                const cityData = cityDoc.data();
                if (Date.now() < (villageData.lastCollected?.toDate().getTime() || 0) + option.duration * 1000) {
                    throw new Error('Not enough time has passed for this demand option.');
                }
    
                const newResources = { ...cityData.resources };
                const warehouseCapacity = Math.floor(1500 * Math.pow(1.4, cityData.buildings.warehouse.level - 1));
                
                const yieldAmount = {
                    wood: Math.floor((baseVillageData.demandYield.wood || 0) * option.multiplier * villageData.level * bonusMultiplier),
                    stone: Math.floor((baseVillageData.demandYield.stone || 0) * option.multiplier * villageData.level * bonusMultiplier),
                    silver: Math.floor((baseVillageData.demandYield.silver || 0) * option.multiplier * villageData.level * bonusMultiplier),
                };
    
                for (const [resource, amount] of Object.entries(yieldAmount)) {
                    newResources[resource] = Math.min(warehouseCapacity, (newResources[resource] || 0) + amount);
                }
    
                const happinessCost = option.happinessCost || 0;
                const newHappiness = Math.max(0, (villageData.happiness || 100) - happinessCost);
    
                transaction.update(cityDocRef, { resources: newResources });
                transaction.update(playerVillageRef, { 
                    lastCollected: serverTimestamp(),
                    happiness: newHappiness,
                    happinessLastUpdated: serverTimestamp()
                });
                return { ...cityData, resources: newResources };
            });
    
            setGameState(updatedCityState);
            
            let successMessage = "Successfully demanded resources! Village happiness decreased.";
            if (hasBonus) {
                successMessage += ` (+20% bonus for multiple cities on this island!)`;
            }
            setMessage(successMessage);
        } catch (error) {
            setMessage(`Failed to demand resources: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePlunder = async () => {
        if (isProcessing) return;
        if (plunderTimeLeft > 0) {
            setMessage(`You must wait before plundering again.`);
            return;
        }
        setIsProcessing(true);
        setMessage('');

        const playerVillageRef = doc(db, 'users', currentUser.uid, 'games', worldId, 'conqueredVillages', village.id);
        const cityDocRef = doc(db, 'users', currentUser.uid, 'games', worldId, 'cities', activeCityId);
        const baseVillageRef = doc(db, 'worlds', worldId, 'villages', village.id);
        const reportsRef = collection(db, 'users', currentUser.uid, 'worlds', worldId, 'reports');

        try {
            const newGameState = await runTransaction(db, async (transaction) => {
                const playerVillageDoc = await transaction.get(playerVillageRef);
                const cityDoc = await transaction.get(cityDocRef);
                const baseVillageDoc = await transaction.get(baseVillageRef);
                if (!playerVillageDoc.exists() || !cityDoc.exists() || !baseVillageDoc.exists()) throw new Error("Required data not found.");

                const villageData = playerVillageDoc.data();
                const cityData = cityDoc.data();
                const baseData = baseVillageDoc.data();
                const currentHappiness = villageData.happiness !== undefined ? villageData.happiness : 100;
                
                // Plunder always yields resources, regardless of revolt outcome
                const plunderAmount = { wood: Math.floor((baseData.resources.wood || 0) * 0.5), stone: Math.floor((baseData.resources.stone || 0) * 0.5), silver: Math.floor((baseData.resources.silver || 0) * 0.5) };
                const newPlayerResources = { ...cityData.resources };
                const newVillageResources = { ...baseData.resources };
                const warehouseCapacity = Math.floor(1500 * Math.pow(1.4, cityData.buildings.warehouse.level - 1));

                for(const res in plunderAmount) {
                    newPlayerResources[res] = Math.min(warehouseCapacity, newPlayerResources[res] + plunderAmount[res]);
                    newVillageResources[res] -= plunderAmount[res];
                }
                
                transaction.update(cityDocRef, { resources: newPlayerResources });
                transaction.update(baseVillageRef, { resources: newVillageResources });

                // Check for revolt: guaranteed if happiness is low
                if (currentHappiness <= 40) {
                    const retaliationLosses = resolveVillageRetaliation(cityData.units);
                    const newUnits = { ...cityData.units };
                    for(const unitId in retaliationLosses) newUnits[unitId] -= retaliationLosses[unitId];
                    
                    transaction.update(cityDocRef, { units: newUnits });
                    transaction.delete(playerVillageRef);

                    const report = { 
                        type: 'attack_village', 
                        title: `Revolt at ${baseData.name}!`, 
                        timestamp: serverTimestamp(), 
                        outcome: { attackerWon: false, message: `Your plunder attempt on a low-happiness village caused a revolt! You have lost control and suffered casualties, but secured the resources.`, plunder: plunderAmount }, 
                        attacker: { 
                            cityId: activeCityId,
                            cityName: cityData.cityName, 
                            ownerId: currentUser.uid,
                            username: userProfile.username,
                            x: cityData.x,
                            y: cityData.y,
                            units: {}, 
                            losses: retaliationLosses 
                        }, 
                        defender: { 
                            villageName: baseData.name,
                            x: baseData.x,
                            y: baseData.y
                        }, 
                        read: false 
                    };
                    transaction.set(doc(reportsRef), report);
                    return { ...cityData, units: newUnits, resources: newPlayerResources };
                } else {
                    // Successful plunder, no revolt
                    const newHappiness = Math.max(0, currentHappiness - 40);
                    transaction.update(playerVillageRef, { 
                        happiness: newHappiness, 
                        happinessLastUpdated: serverTimestamp(),
                        lastPlundered: serverTimestamp() // Set plunder cooldown
                    });
                    
                    const report = { 
                        type: 'attack_village', 
                        title: `Plunder of ${baseData.name} successful!`, 
                        timestamp: serverTimestamp(), 
                        outcome: { attackerWon: true, plunder: plunderAmount }, 
                        attacker: { 
                            cityId: activeCityId,
                            cityName: cityData.cityName,
                            ownerId: currentUser.uid,
                            username: userProfile.username,
                            x: cityData.x,
                            y: cityData.y
                        }, 
                        defender: { 
                            villageName: baseData.name,
                            x: baseData.x,
                            y: baseData.y
                        }, 
                        read: false 
                    };
                    transaction.set(doc(reportsRef), report);
                    return { ...cityData, resources: newPlayerResources };
                }
            });
            setGameState(newGameState);
            setMessage("Plunder successful! Resources have been seized.");
        } catch (error) {
            setMessage(`Plunder failed: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleUpgrade = async () => {
        if (isProcessing) return;
        setIsProcessing(true);
        setMessage('');

        const playerVillageRef = doc(db, 'users', currentUser.uid, 'games', worldId, 'conqueredVillages', village.id);
        const cityDocRef = doc(db, 'users', currentUser.uid, 'games', worldId, 'cities', activeCityId);
        const nextLevel = village.level + 1;
        const cost = getUpgradeCost(nextLevel);

        try {
            const newGameState = await runTransaction(db, async (transaction) => {
                const playerVillageDoc = await transaction.get(playerVillageRef);
                const cityDoc = await transaction.get(cityDocRef);
                if (!playerVillageDoc.exists() || !cityDoc.exists()) throw new Error("Your village or city state could not be found.");

                const cityData = cityDoc.data();
                if (cityData.resources.wood < cost.wood || cityData.resources.stone < cost.stone || cityData.resources.silver < cost.silver) {
                    throw new Error("Not enough resources in your city to upgrade the village.");
                }

                const newResources = { wood: cityData.resources.wood - cost.wood, stone: cityData.resources.stone - cost.stone, silver: cityData.resources.silver - cost.silver };
                transaction.update(cityDocRef, { resources: newResources });
                transaction.update(playerVillageRef, { level: nextLevel });
                return { ...cityData, resources: newResources };
            });

            setGameState(newGameState);
            setMessage(`Successfully upgraded village to level ${nextLevel}!`);
        } catch (error) {
            console.error("Error upgrading village: ", error);
            setMessage(`Failed to upgrade village: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleTrade = async () => {
        if (isProcessing || !baseVillageData || tradeAmount <= 0) return;
        if (tradeAmount > marketCapacity) {
            setMessage(`Trade amount cannot exceed your market capacity of ${marketCapacity}.`);
            return;
        }
        setIsProcessing(true);
        setMessage('');
    
        const cityDocRef = doc(db, 'users', currentUser.uid, 'games', worldId, 'cities', activeCityId);
        const villageRef = doc(db, 'worlds', worldId, 'villages', village.id);
    
        try {
            const newGameState = await runTransaction(db, async (transaction) => {
                const cityDoc = await transaction.get(cityDocRef);
                const villageDoc = await transaction.get(villageRef);
                if (!cityDoc.exists() || !villageDoc.exists()) throw new Error("Game state or village data not found.");
    
                const cityData = cityDoc.data();
                const villageData = villageDoc.data();
                const resourceToGive = villageData.demands;
                const resourceToGet = villageData.supplies;
                const amountToGet = Math.floor(tradeAmount / villageData.tradeRatio);
    
                if (cityData.resources[resourceToGive] < tradeAmount) throw new Error(`Not enough ${resourceToGive} to trade.`);
                if (villageData.resources[resourceToGet] < amountToGet) throw new Error(`The village does not have enough ${resourceToGet} to trade.`);
    
                const newPlayerResources = { ...cityData.resources };
                newPlayerResources[resourceToGive] -= tradeAmount;
                newPlayerResources[resourceToGet] += amountToGet;
    
                const newVillageResources = { ...villageData.resources };
                newVillageResources[resourceToGive] += tradeAmount;
                newVillageResources[resourceToGet] -= amountToGet;
    
                transaction.update(cityDocRef, { resources: newPlayerResources });
                transaction.update(villageRef, { resources: newVillageResources });
                return { ...cityData, resources: newPlayerResources };
            });
            
            setGameState(newGameState);
            setMessage(`Successfully traded ${tradeAmount} ${baseVillageData.demands} for ${Math.floor(tradeAmount / baseVillageData.tradeRatio)} ${baseVillageData.supplies}.`);
            setTradeAmount(0);
        } catch (error) {
            setMessage(`Trade failed: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const cost = getUpgradeCost(village.level + 1);
    const canAffordUpgrade = gameState && gameState.resources.wood >= cost.wood && gameState.resources.stone >= cost.stone && gameState.resources.silver >= cost.silver;
    const maxTradeAmount = baseVillageData && gameState ? Math.min(gameState.resources[baseVillageData.demands] || 0, Math.floor((baseVillageData.resources?.[baseVillageData.supplies] || 0) * (baseVillageData.tradeRatio || 1)), marketCapacity || 0) : 0;
    const plunderCooldownEndTime = village.lastPlundered ? new Date(village.lastPlundered.toDate().getTime() + 20 * 60 * 1000) : null;
    
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-4xl text-center border border-gray-600 pointer-events-auto" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-yellow-400">{`Farming Village: ${baseVillageData?.name || village.name} (Level ${village.level})`}</h2>
                    <h3 className="text-xl font-semibold text-white">Happiness: <span className="text-green-400">{Math.floor(village.happiness !== undefined ? village.happiness : 100)}%</span></h3>
                </div>
                <div className="flex border-b border-gray-600 my-4">
                    <button onClick={() => setActiveTab('demand')} className={`flex-1 p-2 text-lg font-bold transition-colors ${activeTab === 'demand' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Demand</button>
                    <button onClick={() => setActiveTab('plunder')} className={`flex-1 p-2 text-lg font-bold transition-colors ${activeTab === 'plunder' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Plunder</button>
                    <button onClick={() => setActiveTab('trade')} className={`flex-1 p-2 text-lg font-bold transition-colors ${activeTab === 'trade' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Trade</button>
                    <button onClick={() => setActiveTab('upgrade')} className={`flex-1 p-2 text-lg font-bold transition-colors ${activeTab === 'upgrade' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Upgrade</button>
                </div>
                <div className="p-4 text-white">
                    {activeTab === 'demand' && (
                        <div>
                            <h4 className="font-bold text-lg text-center mb-2">Demand Resources</h4>
                            <p className="text-center text-gray-400 text-sm mb-4">Choose an option to demand resources. Shorter times yield fewer resources.</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {demandYields.map(option => {
                                    const isAvailable = timeSinceCollection >= option.duration;
                                    return (
                                        <div key={option.name} className="bg-gray-900 border border-gray-700 p-2 rounded-lg text-center flex flex-col justify-between shadow-md">
                                            <div className="relative h-16 mb-2 flex justify-center items-center">
                                                <img src={resourceImage} alt="resources" className="w-16 h-16"/>
                                            </div>
                                            <div className="text-xs space-y-1 mb-2 text-left">
                                                <p className="flex justify-between px-1"><span>Wood:</span> <span className="font-bold text-yellow-300">{option.yield.wood}</span></p>
                                                <p className="flex justify-between px-1"><span>Stone:</span> <span className="font-bold text-gray-300">{option.yield.stone}</span></p>
                                                <p className="flex justify-between px-1"><span>Silver:</span> <span className="font-bold text-blue-300">{option.yield.silver}</span></p>
                                            </div>
                                            <div className="mt-auto">
                                                {isAvailable ? (
                                                    <button onClick={() => handleDemand(option)} disabled={isProcessing} className="btn btn-confirm w-full text-sm py-1">Demand ({option.name})</button>
                                                ) : (
                                                    <div className="text-center text-sm py-1 px-2 bg-gray-800 rounded">
                                                        <div className="font-mono text-red-400">
                                                            <Countdown arrivalTime={{ toDate: () => new Date(village.lastCollected.toDate().getTime() + option.duration * 1000) }} />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                    {activeTab === 'plunder' && (
                        <div>
                            <h4 className="font-bold text-lg text-center mb-2 text-red-400">Plunder Village</h4>
                            <p className="text-center text-gray-400 text-sm mb-4">Forcefully take resources from the village. This action is much faster and yields more than demanding, but it will significantly lower happiness and risks a revolt.</p>
                            <div className="bg-gray-900 p-4 rounded-lg">
                                <p className="mb-2">Current Happiness: <span className="font-bold text-green-400">{Math.floor(village.happiness !== undefined ? village.happiness : 100)}%</span></p>
                                <p className="text-xs text-gray-500 mb-4">Plundering a village with 40% or less happiness will cause it to revolt, and you will lose control of it.</p>
                                <button onClick={handlePlunder} disabled={isProcessing || plunderTimeLeft > 0} className="btn btn-danger w-full text-lg py-2">
                                    {isProcessing ? 'Plundering...' : (plunderTimeLeft > 0 ? 
                                        <Countdown arrivalTime={plunderCooldownEndTime} /> 
                                        : 'Launch Plunder Raid (-40 Happiness)')}
                                </button>
                            </div>
                        </div>
                    )}
                    {activeTab === 'trade' && (
                         <div>
                            <h4 className="font-bold text-lg text-center mb-2">Trade with Village</h4>
                            {baseVillageData ? (
                                <>
                                    <div className="flex justify-center items-center space-x-4 my-4">
                                        <div className="flex flex-col items-center"><span className="text-sm text-gray-400 capitalize">You Give</span><img src={resourceImages[baseVillageData.demands]} alt={baseVillageData.demands} className="w-12 h-12" /></div>
                                        <span className="text-3xl text-gray-400 font-bold">&rarr;</span>
                                        <div className="flex flex-col items-center"><span className="text-sm text-gray-400 capitalize">You Receive</span><img src={resourceImages[baseVillageData.supplies]} alt={baseVillageData.supplies} className="w-12 h-12" /></div>
                                    </div>
                                    <p className="text-center text-gray-400 text-sm mb-4">Trade Ratio: {baseVillageData.tradeRatio}:1 | Your Market Capacity: {marketCapacity}<span className="block mt-2 text-xs text-red-400 italic">(Trade amount is also limited by the village's current supplies)</span></p>
                                    <div className="bg-gray-700 p-4 rounded-lg">
                                        <div className="flex justify-between items-center mb-2"><span className="capitalize">Your {baseVillageData.demands}: {Math.floor(gameState.resources[baseVillageData.demands] || 0)}</span><span className="capitalize">Village's {baseVillageData.supplies}: {Math.floor(baseVillageData.resources?.[baseVillageData.supplies] || 0)}</span></div>
                                        <input type="range" min="0" max={maxTradeAmount || 0} value={tradeAmount} onChange={(e) => setTradeAmount(Number(e.target.value))} className="w-full"/>
                                        <div className="flex justify-between items-center mt-2"><span className="capitalize">You give: <span className="font-bold text-red-400">{tradeAmount} {baseVillageData.demands}</span></span><span className="capitalize">You receive: <span className="font-bold text-green-400">{Math.floor(tradeAmount / (baseVillageData.tradeRatio || 1))} {baseVillageData.supplies}</span></span></div>
                                        <button onClick={handleTrade} disabled={isProcessing || tradeAmount <= 0 || maxTradeAmount <= 0} className="btn btn-confirm w-full mt-4 py-2">Trade</button>
                                    </div>
                                </>
                            ) : (<p className="text-center text-gray-400 p-8">Loading trade information...</p>)}
                        </div>
                    )}
                     {activeTab === 'upgrade' && (
                        <div>
                           <p className="mb-4 text-center">Invest resources to upgrade this village for better yields.</p>
                            <div className="bg-gray-700 p-3 rounded-lg mb-4">
                                <h4 className="font-bold text-lg">Cost to Upgrade to Level {village.level + 1}:</h4>
                                <div className="flex justify-center items-center space-x-4 mt-2 text-yellow-300">
                                    <div className="flex items-center gap-1">
                                        <img src={woodImage} alt="Wood" className="w-6 h-6" />
                                        <span>{cost.wood}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <img src={stoneImage} alt="Stone" className="w-6 h-6" />
                                        <span>{cost.stone}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <img src={silverImage} alt="Silver" className="w-6 h-6" />
                                        <span>{cost.silver}</span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={handleUpgrade} disabled={isProcessing || !canAffordUpgrade} className="btn btn-primary py-3 px-4 w-40">{isProcessing ? 'Processing...' : 'Upgrade Village'}</button>
                        </div>
                    )}
                    {message && <p className="text-green-400 mt-4 text-center">{message}</p>}
                </div>
                 <button onClick={onClose} className="btn btn-primary px-6 py-2 mt-4">Close</button>
            </div>
        </div>
    );
};

export default FarmingVillageModal;

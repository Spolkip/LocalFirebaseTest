// src/components/WorldSelectionScreen.js
import React, { useState, useEffect} from 'react';
import { collection, getDocs, doc, writeBatch, serverTimestamp, getDoc, deleteDoc, query, limit, onSnapshot } from 'firebase/firestore';
import { signOut } from "firebase/auth";
import { db, auth } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import Modal from './shared/Modal';
import { generateIslands, generateCitySlots, generateFarmingVillages, generateRuins } from '../utils/worldGeneration';
import logoutIcon from '../images/logout.png';
import worldIcon from '../images/world_selection.png';
import './WorldSelectionScreen.css';

const ConfirmationModal = ({ message, onConfirm, onCancel, confirmText = 'Confirm', cancelText = 'Cancel' }) => {
    if (!message) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60"
            onClick={onCancel}
        >
            <div
                className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm text-center border border-gray-600"
                onClick={e => e.stopPropagation()}
            >
                <p className="mb-6 text-lg text-gray-300">{message}</p>
                <div className="flex justify-center space-x-4">
                    <button
                        onClick={onCancel}
                        className="btn btn-primary px-6 py-2"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className="btn btn-danger px-6 py-2"
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

const WorldSelectionScreen = ({ onWorldSelected }) => {
    const { currentUser, userProfile } = useAuth();
    const [worlds, setWorlds] = useState([]);
    const [userGames, setUserGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [newWorldName, setNewWorldName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [worldToDelete, setWorldToDelete] = useState(null);

    useEffect(() => {
        setLoading(true);
        const worldsCollectionRef = collection(db, 'worlds');
        const unsubscribeWorlds = onSnapshot(worldsCollectionRef, (worldsSnapshot) => {
            const worldsList = worldsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setWorlds(worldsList);
        }, (error) => {
            console.error("Error fetching worlds:", error);
            setMessage('Could not load world list.');
        });

        let unsubscribeGames;
        if (currentUser) {
            const gamesCollectionRef = collection(db, `users/${currentUser.uid}/games`);
            unsubscribeGames = onSnapshot(gamesCollectionRef, (gamesSnapshot) => {
                const gamesList = gamesSnapshot.docs.map(doc => doc.id);
                setUserGames(gamesList);
                setLoading(false);
            }, (error) => {
                console.error("Error fetching user games:", error);
                setLoading(false);
            });
        } else {
            setLoading(false);
        }

        return () => {
            unsubscribeWorlds();
            if (unsubscribeGames) {
                unsubscribeGames();
            }
        };
    }, [currentUser]);

    const handleCreateWorld = async (e) => {
        e.preventDefault();
        if (!newWorldName.trim()) {
            setMessage('Please enter a world name.');
            return;
        }

        setIsCreating(true);
        setMessage('Creating a new world, this may take a moment...');

        try {
            const worldId = newWorldName.trim().toLowerCase().replace(/\s+/g, '-');
            const worldDocRef = doc(db, 'worlds', worldId);

            const existingWorld = await getDoc(worldDocRef);
            if (existingWorld.exists()) {
                setMessage(`A world with the ID '${worldId}' already exists. Please choose a different name.`);
                setIsCreating(false);
                return;
            }

            const worldWidth = 100;
            const worldHeight = 100;
            const islandCount = 4;

            // Generate all world data
            const islands = generateIslands(worldWidth, worldHeight, islandCount);
            const citySlots = generateCitySlots(islands, worldWidth, worldHeight);
            const villages = generateFarmingVillages(islands, citySlots, worldWidth, worldHeight);
            const ruins = generateRuins(islands, worldWidth, worldHeight);

            const worldData = {
                name: newWorldName.trim(),
                islands,
                width: worldWidth,
                height: worldHeight,
                createdAt: serverTimestamp(),
                season: 'Spring',
                weather: 'Clear',
                seasonLastUpdate: serverTimestamp(),
                weatherLastUpdate: serverTimestamp()
            };

            await writeBatch(db).set(worldDocRef, worldData).commit();

            const batchSize = 400;

            // Batch write city slots
            const citySlotsCollectionRef = collection(db, 'worlds', worldId, 'citySlots');
            const slotEntries = Object.entries(citySlots);
            for (let i = 0; i < slotEntries.length; i += batchSize) {
                const batch = writeBatch(db);
                const chunk = slotEntries.slice(i, i + batchSize);
                setMessage(`Creating world... writing city data ${i + chunk.length}/${slotEntries.length}`);
                for (const [slotId, slotData] of chunk) {
                    const slotDocRef = doc(citySlotsCollectionRef, slotId);
                    batch.set(slotDocRef, slotData);
                }
                await batch.commit();
            }

            // Batch write villages
            const villagesCollectionRef = collection(db, 'worlds', worldId, 'villages');
            const villageEntries = Object.entries(villages);
            for (let i = 0; i < villageEntries.length; i += batchSize) {
                const batch = writeBatch(db);
                const chunk = villageEntries.slice(i, i + batchSize);
                setMessage(`Creating world... writing village data ${i + chunk.length}/${villageEntries.length}`);
                for (const [villageId, villageData] of chunk) {
                    const villageDocRef = doc(villagesCollectionRef, villageId);
                    batch.set(villageDocRef, { ...villageData, lastCollected: serverTimestamp() });
                }
                await batch.commit();
            }

            // Batch write ruins
            const ruinsCollectionRef = collection(db, 'worlds', worldId, 'ruins');
            const ruinEntries = Object.entries(ruins);
            for (let i = 0; i < ruinEntries.length; i += batchSize) {
                const batch = writeBatch(db);
                const chunk = ruinEntries.slice(i, i + batchSize);
                setMessage(`Creating world... writing ancient ruins ${i + chunk.length}/${ruinEntries.length}`);
                for (const [ruinId, ruinData] of chunk) {
                    const ruinDocRef = doc(ruinsCollectionRef, ruinId);
                    batch.set(ruinDocRef, ruinData);
                }
                await batch.commit();
            }

            setMessage('World created successfully!');
            onWorldSelected(worldId);

        } catch (error) {
            console.error("Error creating world:", error);
            setMessage(`Failed to create world: ${error.message}`);
        }
        setIsCreating(false);
        setNewWorldName('');
    };

    const handleDeleteWorld = async (worldId, worldName) => {
        setMessage(`Deleting world "${worldName}"... This may take a moment.`);
        try {
            const worldDocRef = doc(db, 'worlds', worldId);
            
            const deleteCollectionBatch = async (collectionRef) => {
                const q = query(collectionRef, limit(500));
                const snapshot = await getDocs(q);
                if (snapshot.size === 0) {
                    return 0;
                }
                const batch = writeBatch(db);
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                return snapshot.size;
            };

            // Delete subcollections
            let deletedCount;
            const citySlotsRef = collection(db, 'worlds', worldId, 'citySlots');
            while ((deletedCount = await deleteCollectionBatch(citySlotsRef)) > 0) {
                console.log(`Deleted ${deletedCount} city slots...`);
            }
            
            const villagesRef = collection(db, 'worlds', worldId, 'villages');
            while ((deletedCount = await deleteCollectionBatch(villagesRef)) > 0) {
                console.log(`Deleted ${deletedCount} villages...`);
            }

            const ruinsRef = collection(db, 'worlds', worldId, 'ruins');
             while ((deletedCount = await deleteCollectionBatch(ruinsRef)) > 0) {
                console.log(`Deleted ${deletedCount} ruins...`);
            }
            
            // Delete the main world doc
            await deleteDoc(worldDocRef);

            setMessage(`World "${worldName}" has been deleted successfully.`);
            // After deletion, re-fetch worlds to update the UI
            const worldsCollectionRef = collection(db, 'worlds');
            const worldsSnapshot = await getDocs(worldsCollectionRef);
            const worldsList = worldsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setWorlds(worldsList);

        } catch (error) {
            console.error("Error deleting world:", error);
            setMessage(`Failed to delete world: ${error.message}`);
        } finally {
            setWorldToDelete(null);
        }
    };

    if (loading) {
        return <div className="text-white text-center p-10">Loading Worlds...</div>;
    }

    const availableWorlds = worlds.filter(world => !userGames.includes(world.id));
    const joinedWorlds = worlds.filter(world => userGames.includes(world.id));

    return (
        <div className="w-full min-h-screen flex items-center justify-center p-4 world-selection-container">
            <Modal message={message} onClose={() => setMessage('')} />
            {worldToDelete && (
                <ConfirmationModal
                    message={`Are you sure you want to permanently delete the world "${worldToDelete.name}"? This will delete all your cities and progress within it.`}
                    onConfirm={() => handleDeleteWorld(worldToDelete.id, worldToDelete.name)}
                    onCancel={() => setWorldToDelete(null)}
                    confirmText="Delete World"
                />
            )}
            <div className="world-selection-window w-full max-w-4xl p-8 relative">
                <button
                    onClick={() => signOut(auth)}
                    className="absolute top-4 right-4 text-sm text-red-400 hover:text-red-300 px-3 py-1 rounded"
                >
                    <img src={logoutIcon} alt="Logout" className="w-8 h-8" />
                </button>
                <h1 className="font-title text-4xl text-center mb-8">SELECT A WORLD</h1>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <h2 className="font-title text-2xl mb-4">YOUR WORLDS</h2>
                        {joinedWorlds.length > 0 ? (
                            joinedWorlds.map(world => (
                                <div key={world.id} className="selection-card p-4 rounded-lg text-center mb-2 flex justify-between items-center">
                                    <div className="flex items-center cursor-pointer" onClick={() => onWorldSelected(world.id)}>
                                        <img src={worldIcon} alt="World" className="w-8 h-8 mr-4" />
                                        <h3 className="text-xl font-bold flex-grow text-left">{world.name}</h3>
                                    </div>
                                    {userProfile?.is_admin && (
                                        <button
                                            onClick={() => setWorldToDelete(world)}
                                            className="btn btn-danger px-3 py-1 text-xs rounded"
                                        >
                                            Delete
                                        </button>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p>You have not joined any worlds yet.</p>
                        )}
                    </div>

                    <div>
                        <h2 className="font-title text-2xl mb-4">JOIN A NEW WORLD</h2>
                        {availableWorlds.length > 0 ? (
                            availableWorlds.map(world => (
                                <div key={world.id} className="selection-card p-4 rounded-lg text-center mb-2 flex justify-between items-center">
                                    <div className="flex items-center cursor-pointer" onClick={() => onWorldSelected(world.id)}>
                                        <img src={worldIcon} alt="World" className="w-8 h-8 mr-4" />
                                        <h3 className="text-xl font-bold flex-grow text-left">{world.name}</h3>
                                    </div>
                                    {userProfile?.is_admin && (
                                        <button
                                            onClick={() => setWorldToDelete(world)}
                                            className="btn btn-danger px-3 py-1 text-xs rounded"
                                        >
                                            Delete
                                        </button>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p>No new worlds are available to join.</p>
                        )}
                    </div>
                </div>

                {userProfile?.is_admin && (
                    <div className="mt-12 border-t border-gray-700 pt-8">
                        <h2 className="font-title text-2xl mb-4">ADMIN PANEL</h2>
                        <form onSubmit={handleCreateWorld} className="flex flex-col sm:flex-row gap-4 mb-4">
                            <input
                                type="text"
                                value={newWorldName}
                                onChange={(e) => setNewWorldName(e.target.value)}
                                placeholder="Enter new world name"
                                className="flex-grow bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={isCreating}
                            />
                            <button type="submit" className="btn btn-confirm px-6 py-2" disabled={isCreating}>
                                {isCreating ? 'Creating...' : 'Create New World'}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WorldSelectionScreen;

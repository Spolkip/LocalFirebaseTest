import React, { useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase/config';
import { doc, writeBatch, collection, getDocs, query} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

const ConfirmationModal = ({ message, onConfirm, onCancel, confirmText = 'Confirm', cancelText = 'Cancel' }) => {
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-70">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm text-center border border-gray-600 text-white">
                <p className="mb-6 text-lg">{message}</p>
                <div className="flex justify-center space-x-4">
                    <button onClick={onCancel} className="btn btn-primary px-6 py-2">
                        {cancelText}
                    </button>
                    <button onClick={onConfirm} className="btn btn-danger px-6 py-2">
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};


const SettingsModal = ({ onClose }) => {
    const { gameSettings, setGameSettings, worldId, playerCity, activeCityId } = useGame();
    const { currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState('gameplay');
    const [confirmAction, setConfirmAction] = useState(null);

    const handleChange = (e) => {
        const { name, type, checked, value } = e.target;
        setGameSettings(prevSettings => ({
            ...prevSettings,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSave = () => {

        onClose();
    };

    const handleResetGame = async () => {
        if (!worldId || !currentUser || !playerCity || !activeCityId) {
            console.error("Missing world, user, or city data for reset.");
            setConfirmAction(null);
            return;
        }

        const batch = writeBatch(db);


        const ruinId = uuidv4();
        const ruinDocRef = doc(db, 'worlds', worldId, 'ruins', ruinId);
        const newRuinData = {
            id: ruinId,
            x: playerCity.x,
            y: playerCity.y,
            name: `Abandoned City of ${playerCity.cityName}`,
            ownerId: 'ruins',
            ownerUsername: 'Ancient Guardians',
            troops: {
                hoplite: 50,
                swordsman: 50,
                archer: 30
            },
            researchReward: `qol_research_${Math.floor(Math.random() * 3)}`
        };
        batch.set(ruinDocRef, newRuinData);


        const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', playerCity.slotId);
        batch.update(citySlotRef, {
            ownerId: null,
            ownerUsername: null,
            cityName: 'Unclaimed',
            ownerFaction: null,
            alliance: null,
            allianceName: null
        });

        const gameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId);


        const deleteSubcollection = async (subcollectionPath) => {
            const collectionRef = collection(gameDocRef, subcollectionPath);
            const q = query(collectionRef);
            const snapshot = await getDocs(q);
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
        };

        await deleteSubcollection('cities');
        await deleteSubcollection('conqueredVillages');
        await deleteSubcollection('conqueredRuins');
        await deleteSubcollection('quests');


        batch.delete(gameDocRef);


        try {
            await batch.commit();
            setConfirmAction(null);
            onClose();
        } catch (error) {
            console.error("Error resetting game:", error);
            setConfirmAction({
                message: `Failed to reset game: ${error.message}`,
                onConfirm: () => setConfirmAction(null),
                onCancel: () => setConfirmAction(null),
                confirmText: 'OK',
                cancelText: null
            });
        }
    };


    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
            {confirmAction && (
                <ConfirmationModal
                    message={confirmAction.message}
                    onConfirm={confirmAction.onConfirm}
                    onCancel={confirmAction.onCancel}
                    confirmText={confirmAction.confirmText}
                    cancelText={confirmAction.cancelText}
                />
            )}
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg border-2 border-gray-600 text-white" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-center text-yellow-400">Game Settings</h2>
                    <button onClick={onClose} className="text-gray-400 text-3xl leading-none hover:text-white">&times;</button>
                </div>

                <div className="settings-tabs mb-4 flex border-b border-gray-600">
                    <button onClick={() => setActiveTab('gameplay')} className={`flex-1 p-2 text-lg font-bold transition-colors ${activeTab === 'gameplay' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>Gameplay</button>
                    <button onClick={() => setActiveTab('display')} className={`flex-1 p-2 text-lg font-bold transition-colors ${activeTab === 'display' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>Display</button>
                    <button onClick={() => setActiveTab('notifications')} className={`flex-1 p-2 text-lg font-bold transition-colors ${activeTab === 'notifications' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>Notifications</button>
                    <button onClick={() => setActiveTab('keybindings')} className={`flex-1 p-2 text-lg font-bold transition-colors ${activeTab === 'keybindings' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>Keys</button>
                    <button onClick={() => setActiveTab('account')} className={`flex-1 p-2 text-lg font-bold transition-colors ${activeTab === 'account' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>Account</button>
                </div>

                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                    {activeTab === 'gameplay' && (
                        <>
                            <div className="flex justify-between items-center bg-gray-700 p-3 rounded-lg">
                                <label htmlFor="showVisuals" className="text-lg font-semibold">Enable Visuals</label>
                                <input
                                    type="checkbox"
                                    id="showVisuals"
                                    name="showVisuals"
                                    checked={gameSettings.showVisuals}
                                    onChange={handleChange}
                                    className="w-6 h-6 rounded text-blue-600 bg-gray-600 border-gray-500 focus:ring-blue-500"
                                />
                            </div>

                            <div className="flex justify-between items-center bg-gray-700 p-3 rounded-lg">
                                <label htmlFor="showGrid" className="text-lg font-semibold">Enable Grid</label>
                                <input
                                    type="checkbox"
                                    id="showGrid"
                                    name="showGrid"
                                    checked={gameSettings.showGrid}
                                    onChange={handleChange}
                                    className="w-6 h-6 rounded text-blue-600 bg-gray-600 border-gray-500 focus:ring-blue-500"
                                />
                            </div>

                            <div className="flex justify-between items-center bg-gray-700 p-3 rounded-lg">
                                <label htmlFor="animations" className="text-lg font-semibold">Enable Animations</label>
                                <input
                                    type="checkbox"
                                    id="animations"
                                    name="animations"
                                    checked={gameSettings.animations}
                                    onChange={handleChange}
                                    className="w-6 h-6 rounded text-blue-600 bg-gray-600 border-gray-500 focus:ring-blue-500"
                                />
                            </div>
                        </>
                    )}

                    {activeTab === 'display' && (
                        <>
                            <div className="flex justify-between items-center bg-gray-700 p-3 rounded-lg">
                                <label htmlFor="theme" className="text-lg font-semibold">Theme</label>
                                <select
                                    id="theme"
                                    name="theme"
                                    value={gameSettings.theme}
                                    onChange={handleChange}
                                    className="bg-gray-600 text-white p-2 rounded"
                                >
                                    <option value="dark">Dark</option>
                                    <option value="light">Light</option>
                                </select>
                            </div>
                            <div className="flex justify-between items-center bg-gray-700 p-3 rounded-lg">
                                <label htmlFor="mapZoomSensitivity" className="text-lg font-semibold">Map Zoom Sensitivity</label>
                                <input
                                    type="range"
                                    id="mapZoomSensitivity"
                                    name="mapZoomSensitivity"
                                    min="0.1"
                                    max="1"
                                    step="0.1"
                                    value={gameSettings.mapZoomSensitivity}
                                    onChange={handleChange}
                                    className="w-1/2"
                                />
                            </div>
                            <div className="flex justify-between items-center bg-gray-700 p-3 rounded-lg">
                                <label htmlFor="hideCompletedQuestsIcon" className="text-lg font-semibold">Hide Quest Icon When Done</label>
                                <input
                                    type="checkbox"
                                    id="hideCompletedQuestsIcon"
                                    name="hideCompletedQuestsIcon"
                                    checked={gameSettings.hideCompletedQuestsIcon || false}
                                    onChange={handleChange}
                                    className="w-6 h-6 rounded text-blue-600 bg-gray-600 border-gray-500 focus:ring-blue-500"
                                />
                            </div>
                        </>
                    )}
                    
                    {activeTab === 'keybindings' && (
                        <div>
                            <h3 className="text-xl font-semibold text-center mb-4">Keybindings</h3>
                            <div className="space-y-4">
                                <div>
                                    <h4 className="font-bold text-yellow-400 mb-2">General</h4>
                                    <div className="keybinding-list">
                                        <div className="keybinding-item"><span>M</span><span>Toggle Map/City View</span></div>
                                        <div className="keybinding-item"><span>G</span><span>Open Alliance</span></div>
                                        <div className="keybinding-item"><span>Q</span><span>Open Quests</span></div>
                                        <div className="keybinding-item"><span>Space</span><span>Center on Active City</span></div>
                                        <div className="keybinding-item"><span>F</span><span>Open Forum</span></div>
                                        <div className="keybinding-item"><span>I</span><span>Open Messages</span></div>
                                        <div className="keybinding-item"><span>L</span><span>Open Leaderboard</span></div>
                                        <div className="keybinding-item"><span>P</span><span>Open Profile</span></div>
                                        <div className="keybinding-item"><span>O</span><span>Open Settings</span></div>
                                        <div className="keybinding-item"><span>← / →</span><span>Cycle Cities</span></div>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-bold text-yellow-400 mb-2">City View</h4>
                                    <div className="keybinding-list">
                                        <div className="keybinding-item"><span>S</span><span>Open Senate</span></div>
                                        <div className="keybinding-item"><span>B</span><span>Open Barracks</span></div>
                                        <div className="keybinding-item"><span>H</span><span>Open Shipyard</span></div>
                                        <div className="keybinding-item"><span>U</span><span>Open Academy</span></div>
                                        <div className="keybinding-item"><span>K</span><span>Open Market</span></div>
                                        <div className="keybinding-item"><span>T</span><span>Open Temple</span></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'notifications' && (
                        <>
                            <div className="flex justify-between items-center bg-gray-700 p-3 rounded-lg">
                                <label htmlFor="attackNotifications" className="text-lg font-semibold">Incoming Attack Alerts</label>
                                <input
                                    type="checkbox"
                                    id="attackNotifications"
                                    name="attackNotifications"
                                    checked={gameSettings.attackNotifications}
                                    onChange={handleChange}
                                    className="w-6 h-6 rounded text-blue-600 bg-gray-600 border-gray-500 focus:ring-blue-500"
                                />
                            </div>
                            <div className="flex justify-between items-center bg-gray-700 p-3 rounded-lg">
                                <label htmlFor="tradeNotifications" className="text-lg font-semibold">Trade Completed Alerts</label>
                                <input
                                    type="checkbox"
                                    id="tradeNotifications"
                                    name="tradeNotifications"
                                    checked={gameSettings.tradeNotifications}
                                    onChange={handleChange}
                                    className="w-6 h-6 rounded text-blue-600 bg-gray-600 border-gray-500 focus:ring-blue-500"
                                />
                            </div>
                            <div className="flex justify-between items-center bg-gray-700 p-3 rounded-lg">
                                <label htmlFor="unitCompleteNotifications" className="text-lg font-semibold">Recruitment Complete</label>
                                <input
                                    type="checkbox"
                                    id="unitCompleteNotifications"
                                    name="unitCompleteNotifications"
                                    checked={gameSettings.unitCompleteNotifications}
                                    onChange={handleChange}
                                    className="w-6 h-6 rounded text-blue-600 bg-gray-600 border-gray-500 focus:ring-blue-500"
                                />
                            </div>
                            <div className="flex justify-between items-center bg-gray-700 p-3 rounded-lg">
                                <label htmlFor="hideReturningReports" className="text-lg font-semibold">Hide Returning Troop Reports</label>
                                <input
                                    type="checkbox"
                                    id="hideReturningReports"
                                    name="hideReturningReports"
                                    checked={gameSettings.hideReturningReports || false}
                                    onChange={handleChange}
                                    className="w-6 h-6 rounded text-blue-600 bg-gray-600 border-gray-500 focus:ring-blue-500"
                                />
                            </div>
                        </>
                    )}

                    {activeTab === 'account' && (
                        <>
                            <p className="text-sm text-gray-400">Warning: This action is irreversible!</p>
                            <button
                                onClick={() => setConfirmAction({
                                    message: "Are you absolutely sure you want to reset your game? This will destroy all your cities and cannot be undone.",
                                    onConfirm: handleResetGame,
                                    onCancel: () => setConfirmAction(null),
                                    confirmText: 'Reset Forever',
                                    cancelText: 'Cancel'
                                })}
                                className="btn btn-danger w-full py-2"
                            >
                                Reset Game
                            </button>
                        </>
                    )}
                </div>

                <div className="mt-6 flex justify-center space-x-4">
                    <button
                        onClick={handleSave}
                        className="btn btn-confirm py-2 px-6"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
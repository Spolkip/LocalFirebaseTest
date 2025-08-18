import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { useAlliance } from '../contexts/AllianceContext';
import { signOut } from "firebase/auth";
import { auth, db } from '../firebase/config';
import CityView from './CityView';
import MapView from './MapView';
import LoadingScreen from './shared/LoadingScreen';
import Chat from './chat/Chat';
import { useMovementProcessor } from '../hooks/useMovementProcessor';
import { useModalState } from '../hooks/useModalState';
import { useMapState } from '../hooks/useMapState';
import { useMapEvents } from '../hooks/useMapEvents';
import { useQuestTracker } from '../hooks/useQuestTracker';
import { useMapActions } from '../hooks/useMapActions';
import { useKeyboardControls } from '../hooks/useKeyboardControls';
import { useCityModalManager } from '../hooks/useCityModalManager';
import ReportsView from './ReportsView';
import MessagesView from './messaging/MessagesView';
import AllianceModal from './map/AllianceModal';
import AllianceCreation from './alliance/AllianceCreation';
import AllianceForum from './alliance/AllianceForum';
import SettingsModal from './shared/SettingsModal';
import ProfileView from './profile/ProfileView';
import Leaderboard from './leaderboard/Leaderboard';
import AllianceProfile from './profile/AllianceProfile';
import QuestsModal from './quests/QuestsModal';
import MovementsPanel from './map/MovementsPanel';
import SharedReportView from './SharedReportView';
import EventTrigger from './admin/EventTrigger';
import GodTownModal from './map/GodTownModal';
import { collection, onSnapshot, query, where, doc, updateDoc, runTransaction, serverTimestamp, getDocs} from 'firebase/firestore';
import unitConfig from '../gameData/units.json';
import logoutIcon from '../images/logout.png';
import worldIcon from '../images/world_selection.png';

let worldDataCache = {
    villages: null,
    ruins: null,
    lastFetchTimestamp: 0,
};

export const clearWorldDataCache = () => {
    worldDataCache = {
        villages: null,
        ruins: null,
        lastFetchTimestamp: 0,
    };
};

const getWarehouseCapacity = (level) => {
    if (!level) return 0;
    return Math.floor(1500 * Math.pow(1.4, level - 1));
};

const Game = ({ onBackToWorlds }) => {
    const { activeCityId, setActiveCityId, worldId, loading, gameState, playerCities, conqueredVillages, renameCity, playerCity, playerGameData } = useGame();
    const { currentUser, userProfile } = useAuth();
    const { acceptAllianceInvitation, declineAllianceInvitation, sendAllianceInvitation } = useAlliance();
    const [view, setView] = useState('city');
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [panToCoords, setPanToCoords] = useState(null);
    const [viewingReportId, setViewingReportId] = useState(null);
    const [selectedGodTownId, setSelectedGodTownId] = useState(null);
    const [initialMapAction, setInitialMapAction] = useState(null);
    const [movements, setMovements] = useState([]);
    const [villages, setVillages] = useState({});
    const [ruins, setRuins] = useState({});
    const [godTowns, setGodTowns] = useState({});
    const prevActiveCityIdRef = useRef();
    const prevViewRef = useRef();

    useMovementProcessor(worldId);
    const { modalState, openModal, closeModal } = useModalState();
    const { modalState: cityModalState, openModal: openCityModal, closeModal: closeCityModal, setModalState: setCityModalState } = useCityModalManager();
    const { unreadReportsCount, setUnreadReportsCount, unreadMessagesCount, setUnreadMessagesCount } = useMapState();

    const showMap = () => setView('map');
    const showCity = useCallback((cityId) => {
        if (cityId) setActiveCityId(cityId);
        setView('city');
    }, [setActiveCityId]);

    const { handleCancelMovement, handleActionClick } = useMapActions(openModal, closeModal, showCity, () => {});

    const toggleView = () => {
        setView(prevView => prevView === 'city' ? 'map' : 'city');
    };

    const centerOnCity = useCallback(() => {
        if (view === 'map' && playerCity) {
            setPanToCoords({ x: playerCity.x, y: playerCity.y });
        }
    }, [view, playerCity]);

    const switchCity = useCallback((cityId) => {
        setActiveCityId(cityId);
    }, [setActiveCityId]);

    // #comment This effect pans the map to the active city only when the city ID or view actually changes.
    useEffect(() => {
        if (view === 'map') {
            const hasCityChanged = activeCityId !== prevActiveCityIdRef.current;
            const hasViewChanged = view !== prevViewRef.current;

            if (hasCityChanged || hasViewChanged) {
                const nextCity = playerCities[activeCityId];
                if (nextCity) {
                    setPanToCoords({ x: nextCity.x, y: nextCity.y });
                }
            }
        }
        // #comment Update refs for the next render
        prevActiveCityIdRef.current = activeCityId;
        prevViewRef.current = view;
    }, [activeCityId, view, playerCities]);


    useEffect(() => {
        if (!currentUser || !worldId) return;

        const userDocRef = doc(db, "users", currentUser.uid);
        const gameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId);

        const updatePresence = async () => {
            const timestamp = serverTimestamp();
            try {
                await updateDoc(userDocRef, { lastSeen: timestamp });
                await updateDoc(gameDocRef, { lastSeen: timestamp });
            } catch (error) {
                if (error.code !== 'not-found') {
                    console.error("Failed to update presence:", error);
                }
            }
        };

        updatePresence();
        const presenceInterval = setInterval(updatePresence, 3 * 60 * 1000);

        const handleBeforeUnload = () => {
             if (currentUser) {
                updateDoc(userDocRef, { lastSeen: null });
                updateDoc(gameDocRef, { lastSeen: null });
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            clearInterval(presenceInterval);
            window.removeEventListener('beforeunload', handleBeforeUnload);
        }
    }, [currentUser, worldId]);

    const handleLogout = async () => {
        if (currentUser) {
            const userDocRef = doc(db, "users", currentUser.uid);
            const gameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId);
            await updateDoc(userDocRef, { lastSeen: null });
            await updateDoc(gameDocRef, { lastSeen: null });
        }
        signOut(auth);
    };

    const cycleCity = useCallback((direction) => {
        const sortedCities = Object.values(playerCities).sort((a, b) => a.cityName.localeCompare(b.cityName));
        const cityIds = sortedCities.map(c => c.id);
        if (cityIds.length <= 1) return;

        const currentIndex = cityIds.indexOf(activeCityId);
        let nextIndex;
        if (direction === 'right') {
            nextIndex = (currentIndex + 1) % cityIds.length;
        } else {
            nextIndex = (currentIndex - 1 + cityIds.length) % cityIds.length;
        }
        const nextCityId = cityIds[nextIndex];
        switchCity(nextCityId);
    }, [playerCities, activeCityId, switchCity]);

    useKeyboardControls({
        view,
        toggleView,
        openAlliance: () => openModal('alliance'),
        openQuests: () => openModal('quests'),
        centerOnCity,
        openForum: () => openModal('allianceForum'),
        openMessages: () => openModal('messages'),
        openLeaderboard: () => openModal('leaderboard'),
        openProfile: () => openModal('profile'),
        openSettings: () => openModal('settings'),
        cycleCityLeft: () => cycleCity('left'),
        cycleCityRight: () => cycleCity('right'),
        openSenate: () => openCityModal('isSenateViewOpen'),
        openBarracks: () => openCityModal('isBarracksMenuOpen'),
        openShipyard: () => openCityModal('isShipyardMenuOpen'),
        openAcademy: () => openCityModal('isAcademyMenuOpen'),
        openMarket: () => openCityModal('isMarketMenuOpen'),
        openTemple: () => openCityModal('isTempleMenuOpen'),
    });

    useEffect(() => {
        if (!worldId || !currentUser) return;

        const movementsRef = collection(db, 'worlds', worldId, 'movements');
        const q = query(movementsRef, where('involvedParties', 'array-contains', currentUser.uid));
        const unsubscribeMovements = onSnapshot(q, (snapshot) => {
            const allMovements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMovements(allMovements.sort((a, b) => a.arrivalTime.toMillis() - b.arrivalTime.toMillis()));
        });

        const fetchWorldData = async () => {
            const now = Date.now();
            const CACHE_DURATION = 15 * 60 * 1000;
            if (now - worldDataCache.lastFetchTimestamp < CACHE_DURATION && worldDataCache.villages && worldDataCache.ruins) {
                setVillages(worldDataCache.villages);
                setRuins(worldDataCache.ruins);
                return;
            }

            const villagesColRef = collection(db, 'worlds', worldId, 'villages');
            const villagesSnapshot = await getDocs(villagesColRef);
            const villagesData = {};
            villagesSnapshot.forEach(doc => {
                villagesData[doc.id] = { id: doc.id, ...doc.data() };
            });
            setVillages(villagesData);
            worldDataCache.villages = villagesData;

            const ruinsColRef = collection(db, 'worlds', worldId, 'ruins');
            const ruinsSnapshot = await getDocs(ruinsColRef);
            const ruinsData = {};
            ruinsSnapshot.forEach(doc => {
                ruinsData[doc.id] = { id: doc.id, ...doc.data() };
            });
            setRuins(ruinsData);
            worldDataCache.ruins = ruinsData;

            worldDataCache.lastFetchTimestamp = now;
        };

        fetchWorldData();

        const godTownsColRef = collection(db, 'worlds', worldId, 'godTowns');
        const unsubscribeGodTowns = onSnapshot(godTownsColRef, (snapshot) => {
            const townsData = {};
            snapshot.docs.forEach(doc => {
                townsData[doc.id] = { id: doc.id, ...doc.data() };
            });
            setGodTowns(townsData);
        });

        return () => {
            unsubscribeMovements();
            unsubscribeGodTowns();
        };
    }, [worldId, currentUser]);

    const handleCancelTrain = useCallback(async (item, queueType) => {
        const cityId = item.cityId;
        const cityState = playerCities[cityId];
        const queueName = queueType === 'heal' ? 'healQueue' : `${queueType}Queue`;
        const costField = queueType === 'heal' ? 'heal_cost' : 'cost';
        const refundField = queueType === 'heal' ? 'wounded' : 'units';

        if (!cityState || !cityState[queueName]) {
            return;
        }

        const cityDocRef = doc(db, 'users', currentUser.uid, 'games', worldId, 'cities', cityId);

        try {
            await runTransaction(db, async (transaction) => {
                const cityDoc = await transaction.get(cityDocRef);
                if (!cityDoc.exists()) throw new Error("City data not found.");
                const currentState = cityDoc.data();
                const itemIndex = currentState[queueName].findIndex(i => i.id === item.id);
                if (itemIndex === -1) throw new Error("Item not found in queue.");

                const newQueue = [...currentState[queueName]];
                const canceledTask = newQueue.splice(itemIndex, 1)[0];
                const unit = unitConfig[canceledTask.unitId];

                const capacity = getWarehouseCapacity(currentState.buildings.warehouse?.level);
                const newResources = { ...currentState.resources };
                newResources.wood = Math.min(capacity, newResources.wood + (unit[costField].wood || 0) * canceledTask.amount);
                newResources.stone = Math.min(capacity, newResources.stone + (unit[costField].stone || 0) * canceledTask.amount);
                newResources.silver = Math.min(capacity, newResources.silver + (unit[costField].silver || 0) * canceledTask.amount);

                const newRefundUnits = { ...currentState[refundField] };
                if (queueType === 'heal') {
                    newRefundUnits[canceledTask.unitId] = (newRefundUnits[canceledTask.unitId] || 0) + canceledTask.amount;
                }

                for (let i = itemIndex; i < newQueue.length; i++) {
                    const prevEndTime = (i === 0) ? Date.now() : (newQueue[i - 1].endTime.toDate ? newQueue[i - 1].endTime.toDate().getTime() : new Date(newQueue[i - 1].endTime).getTime());
                    const task = newQueue[i];
                    const taskUnit = unitConfig[task.unitId];
                    const taskTime = (queueType === 'heal' ? taskUnit.heal_time : taskUnit.cost.time) * task.amount;
                    newQueue[i].endTime = new Date(prevEndTime + taskTime * 1000);
                }

                const updates = {
                    resources: newResources,
                    [queueName]: newQueue,
                };

                if (queueType === 'heal') {
                    updates.wounded = newRefundUnits;
                }

                transaction.update(cityDocRef, updates);
            });
        } catch (error) {
            console.error("Error cancelling training:", error);
        }
    }, [worldId, currentUser, playerCities]);

    const handleRushMovement = useCallback(async (movementId) => {
        if (userProfile?.is_admin) {
            await updateDoc(doc(db, 'worlds', worldId, 'movements', movementId), { arrivalTime: new Date() });
        }
    }, [userProfile, worldId]);

    useMapEvents(currentUser, worldId, setUnreadReportsCount, setUnreadMessagesCount);
    const { quests, claimReward: claimQuestReward, isClaiming } = useQuestTracker(gameState);

    const { incomingAttackCount, isUnderAttack } = useMemo(() => {
        if (!movements || !playerCities) return { incomingAttackCount: 0, isUnderAttack: false };
        const cityIds = Object.keys(playerCities);
        const count = movements.filter(m =>
            (m.type === 'attack' && cityIds.includes(m.targetCityId) && m.status === 'moving') ||
            (m.type === 'attack_village' && m.targetVillageId && conqueredVillages[m.targetVillageId] && m.status === 'moving')
        ).length;
        return { incomingAttackCount: count, isUnderAttack: count > 0 };
    }, [movements, playerCities, conqueredVillages]);

    const combinedSlots = useMemo(() => ({ ...playerCities, ...villages, ...ruins }), [playerCities, villages, ruins]);

    const handleOpenProfile = (userId) => openModal('profile', { userId });
    const handleOpenAllianceProfile = (allianceId) => openModal('allianceProfile', { allianceId });

    const handleGoToCityFromProfile = useCallback((x, y) => {
        setView('map');
        setPanToCoords({x, y});
        closeModal('profile');
    }, [closeModal]);

    const handleGodTownClick = (townId) => {
        setSelectedGodTownId(townId);
    };

    const handleAttackGodTown = (townData) => {
        const targetData = {
            id: townData.id,
            name: townData.name,
            cityName: townData.name,
            x: townData.x,
            y: townData.y,
            isGodTownTarget: true,
            ...townData
        };
        handleActionClick('attack', targetData);
        setSelectedGodTownId(null);
    };

    const handleOpenEvents = () => {
        openModal('eventTrigger');
    };

    const handleAction = (type, data) => {
        closeModal('reports');
        if (viewingReportId) setViewingReportId(null);
        closeModal('allianceForum');
        closeModal('messages');

        switch (type) {
            case 'city_link':
                if (data.ownerId === currentUser.uid) {
                    const city = playerCities[data.cityId];
                    if (city) {
                        closeModal('reports');
                        if (data.cityId === activeCityId) {
                            openModal('ownActiveCity', city);
                        } else {
                            openModal('ownInactiveCity', city);
                        }
                    }
                } else {
                    setInitialMapAction({ type: 'open_city_modal', coords: data.coords });
                    setView('map');
                    closeModal('reports');
                }
                break;
            case 'profile':
                handleOpenProfile(data);
                break;
            case 'alliance_profile':
                handleOpenAllianceProfile(data);
                break;
            case 'go_to_city':
                setView('map');
                setPanToCoords({ x: parseFloat(data.x), y: parseFloat(data.y) });
                break;
            case 'go_to_city_and_open_modal':
                closeModal('reports');
                setInitialMapAction({ type: 'open_city_modal', coords: data });
                setView('map');
                break;
            case 'accept_invite':
                acceptAllianceInvitation(data).catch(err => alert(err.message));
                break;
            case 'decline_invite':
                declineAllianceInvitation(data).catch(err => alert(err.message));
                break;
            case 'view_report':
                setViewingReportId(data);
                break;
            case 'viewReinforcements':
                openModal('reinforcements', data);
                break;
            default:
                console.warn(`Unhandled action type: ${type}`);
        }
    };

    if (loading) {
        return <LoadingScreen message="Loading Game..." />;
    }

    return (
        <div className="w-full h-screen bg-gray-900 text-white relative">
            {view === 'city' && (
                <CityView
                    showMap={showMap}
                    worldId={worldId}
                    openModal={openModal}
                    unreadReportsCount={unreadReportsCount}
                    unreadMessagesCount={unreadMessagesCount}
                    isUnderAttack={isUnderAttack}
                    incomingAttackCount={incomingAttackCount}
                    handleOpenAlliance={() => openModal('alliance')}
                    handleOpenProfile={handleOpenProfile}
                    movements={movements}
                    onCancelTrain={handleCancelTrain}
                    onCancelMovement={handleCancelMovement}
                    combinedSlots={combinedSlots}
                    onRenameCity={renameCity}
                    quests={quests}
                    handleOpenEvents={handleOpenEvents}
                    onSwitchCity={switchCity}
                    battlePoints={playerGameData?.battlePoints || 0}
                    cityModalState={cityModalState}
                    openCityModal={openCityModal}
                    closeCityModal={closeCityModal}
                    setCityModalState={setCityModalState}
                />
            )}
            {view === 'map' && (
                <MapView
                    showCity={showCity}
                    openModal={openModal}
                    closeModal={closeModal}
                    modalState={modalState}
                    unreadReportsCount={unreadReportsCount}
                    unreadMessagesCount={unreadMessagesCount}
                    quests={quests}
                    claimReward={claimQuestReward}
                    handleMessageAction={handleAction}
                    panToCoords={panToCoords}
                    setPanToCoords={setPanToCoords}
                    handleGoToCityFromProfile={handleGoToCityFromProfile}
                    movements={movements}
                    villages={villages}
                    ruins={ruins}
                    godTowns={godTowns}
                    onCancelTrain={handleCancelTrain}
                    onCancelMovement={handleCancelMovement}
                    isUnderAttack={isUnderAttack}
                    incomingAttackCount={incomingAttackCount}
                    onRenameCity={renameCity}
                    centerOnCity={centerOnCity}
                    onGodTownClick={handleGodTownClick}
                    handleOpenEvents={handleOpenEvents}
                    onSwitchCity={switchCity}
                    battlePoints={playerGameData?.battlePoints || 0}
                    initialMapAction={initialMapAction}
                    setInitialMapAction={setInitialMapAction}
                />
            )}
            {/* Global Modals */}
            {modalState.isReportsPanelOpen && <ReportsView onClose={() => closeModal('reports')} onActionClick={handleAction} />}
            {modalState.isMessagesPanelOpen && <MessagesView onClose={() => closeModal('messages')} onActionClick={handleAction} initialRecipientId={modalState.actionDetails?.city?.ownerId} initialRecipientUsername={modalState.actionDetails?.city?.ownerUsername} />}
            {modalState.isAllianceModalOpen && <AllianceModal onClose={() => closeModal('alliance')} onOpenAllianceProfile={handleOpenAllianceProfile} openModal={openModal} />}
            {modalState.isAllianceCreationOpen && <AllianceCreation onClose={() => closeModal('allianceCreation')} />}
            {modalState.isAllianceForumOpen && <AllianceForum onClose={() => closeModal('allianceForum')} onActionClick={handleAction} />}
            {modalState.isQuestsModalOpen && <QuestsModal quests={quests} claimReward={claimQuestReward} isClaiming={isClaiming} onClose={() => closeModal('quests')} cityState={gameState} />}
            {modalState.isProfileModalOpen && <ProfileView
                onClose={() => closeModal('profile')}
                viewUserId={modalState.viewingProfileId}
                onGoToCity={handleGoToCityFromProfile}
                onInviteToAlliance={(targetUserId) => sendAllianceInvitation(targetUserId).catch(err => alert(err.message))}
                onOpenAllianceProfile={handleOpenAllianceProfile} />}
            {modalState.isLeaderboardOpen && <Leaderboard onClose={() => closeModal('leaderboard')} onOpenProfile={handleOpenProfile} onOpenAllianceProfile={handleOpenAllianceProfile} />}
            {modalState.isAllianceProfileOpen && <AllianceProfile allianceId={modalState.viewingAllianceId} onClose={() => closeModal('allianceProfile')} onOpenProfile={handleOpenProfile} />}
            {modalState.isSettingsModalOpen && <SettingsModal onClose={() => closeModal('settings')} />}
            {modalState.isEventTriggerOpen && userProfile?.is_admin && <EventTrigger onClose={() => closeModal('eventTrigger')} />}
            {viewingReportId && <SharedReportView reportId={viewingReportId} onClose={() => setViewingReportId(null)} onActionClick={handleAction} />}
            {selectedGodTownId && (
                <GodTownModal
                    townId={selectedGodTownId}
                    onClose={() => setSelectedGodTownId(null)}
                    onAttack={handleAttackGodTown}
                />
            )}
            {modalState.isMovementsPanelOpen && <MovementsPanel
                movements={movements}
                onClose={() => closeModal('movements')}
                combinedSlots={combinedSlots}
                villages={villages}
                onCancel={handleCancelMovement}
                onRush={handleRushMovement}
                isAdmin={userProfile?.is_admin}
            />}
            <div className="chat-container">
                <button onClick={() => setIsChatOpen(prev => !prev)} className="chat-toggle-button">
                    💬
                </button>
                <Chat isVisible={isChatOpen} onClose={() => setIsChatOpen(false)} />
            </div>
            <div className="absolute bottom-4 left-4 z-30 flex flex-col space-y-2">
                {view === 'map' && (
                    <button onClick={onBackToWorlds} className="p-2 rounded-full shadow-lg hover:bg-blue-500 transition-colors" title="Back to Worlds">
                        <img src={worldIcon} alt="Back to Worlds" className="w-8 h-8" />
                    </button>
                )}
                <button onClick={handleLogout} className="p-2 rounded-full shadow-lg hover:bg-blue-500 transition-colors" title="Logout">
                    <img src={logoutIcon} alt="Logout" className="w-8 h-8" />
                </button>
            </div>
        </div>
    );
};
export default Game;

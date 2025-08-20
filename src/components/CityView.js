import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Modal from './shared/Modal';
import CityModals from './city/CityModals';
import CityViewContent from './city/CityViewContent';
import DivinePowers from './city/DivinePowers';
import { useCityState } from '../hooks/useCityState';
import { useGame } from '../contexts/GameContext';
import { useCityActions } from '../hooks/useCityActions';
import { useHeroActions } from '../hooks/actions/useHeroActions';
import { useAgentActions } from '../hooks/actions/useAgentActions';
import SidebarNav from './map/SidebarNav';
import TopBar from './map/TopBar';
import QuestsButton from './QuestsButton';
import { useAlliance } from '../contexts/AllianceContext';

const CityView = ({
    showMap,
    worldId,
    openModal,
    unreadReportsCount,
    unreadMessagesCount,
    isUnderAttack,
    incomingAttackCount,
    handleOpenAlliance,
    handleOpenProfile,
    movements,
    onCancelTrain,
    onCancelMovement,
    combinedSlots,
    onRenameCity,
    quests,
    handleOpenEvents,
    onSwitchCity,
    battlePoints,
    cityModalState,
    openCityModal,
    closeCityModal,
    setCityModalState,
    onOpenManagementPanel,
}) => {
    const { currentUser, userProfile } = useAuth();
    const { gameSettings, worldState } = useGame();
    const { playerAlliance } = useAlliance();
    const {isInstantBuild, setIsInstantBuild} = useGame();
    const {isInstantResearch, setIsInstantResearch} = useGame();
    const {isInstantUnits, setIsInstantUnits} = useGame();
    const [message, setMessage] = useState('');
    const {
        cityGameState, setCityGameState, getUpgradeCost, getFarmCapacity,
        calculateUsedPopulation, getProductionRates, getWarehouseCapacity,
        getHospitalCapacity, saveGameState, getResearchCost, calculateHappiness,
        getMaxWorkerSlots, getMarketCapacity,
    } = useCityState(worldId, isInstantBuild, isInstantResearch, isInstantUnits);
    const actions = useCityActions({
        cityGameState, setCityGameState, saveGameState, worldId, userProfile, currentUser,
        getUpgradeCost, getResearchCost, getFarmCapacity, calculateUsedPopulation, isInstantUnits,
        setMessage, openModal: openCityModal, closeModal: closeCityModal, setModalState: setCityModalState,
        setIsInstantBuild, setIsInstantResearch, setIsInstantUnits, getMaxWorkerSlots
    });
    const { onRecruitHero, onActivateSkill, onAssignHero, onUnassignHero, onReleaseHero } = useHeroActions(cityGameState, saveGameState, setMessage);
    const { onRecruitAgent, onAssignAgent } = useAgentActions(cityGameState, saveGameState, setMessage);

    const { availablePopulation, happiness } = useMemo(() => {
        if (!cityGameState) return { availablePopulation: 0, happiness: 0 };
        const maxPopulation = getFarmCapacity(cityGameState.buildings?.farm?.level);
        const usedPopulation = calculateUsedPopulation(cityGameState);
        const availablePopulation = maxPopulation - usedPopulation;
        const happinessValue = calculateHappiness(cityGameState.buildings);
        return { availablePopulation, happiness: happinessValue };
    }, [cityGameState, getFarmCapacity, calculateUsedPopulation, calculateHappiness]);

    const productionRates = useMemo(() => {
        if (!cityGameState) return { wood: 0, stone: 0, silver: 0 };
        return getProductionRates(cityGameState.buildings);
    }, [cityGameState, getProductionRates]);

    if (!cityGameState) {
        return <div className="text-white text-center p-10">Loading City...</div>;
    }

    return (
        <div className="w-full h-screen bg-gray-900 city-view-wrapper relative">
            <Modal message={message} onClose={() => setMessage('')} />
            <QuestsButton
                onOpenQuests={() => openModal('quests')}
                quests={quests}
            />
            <SidebarNav
                onToggleView={showMap}
                view="city"
                onOpenReports={() => openModal('reports')}
                onOpenAlliance={handleOpenAlliance}
                onOpenForum={() => openModal('allianceForum')}
                onOpenMessages={() => openModal('messages')}
                onOpenSettings={() => openModal('settings')}
                onOpenProfile={() => handleOpenProfile()}
                onOpenLeaderboard={() => openModal('leaderboard')}
                onOpenQuests={() => openModal('quests')}
                unreadReportsCount={unreadReportsCount}
                unreadMessagesCount={unreadMessagesCount}
                isAdmin={userProfile?.is_admin}
                onToggleDummyCityPlacement={() => {}}
                onOpenCheats={() => openCityModal('isCheatMenuOpen')}
                isAllianceMember={!!playerAlliance}
                handleOpenEvents={handleOpenEvents}
                onOpenHeroesAltar={() => openCityModal('isHeroesAltarOpen')}
                onOpenManagementPanel={onOpenManagementPanel}
            />
            <div className="h-full w-full flex flex-col">
                <TopBar
                    view="city"
                    gameState={cityGameState}
                    availablePopulation={availablePopulation}
                    happiness={happiness}
                    worldState={worldState}
                    productionRates={productionRates}
                    movements={movements}
                    onCancelTrain={onCancelTrain}
                    onCancelMovement={onCancelMovement}
                    combinedSlots={combinedSlots}
                    onOpenMovements={() => openModal('movements')}
                    isUnderAttack={isUnderAttack}
                    incomingAttackCount={incomingAttackCount}
                    onRenameCity={onRenameCity}
                    getWarehouseCapacity={getWarehouseCapacity}
                    onSwitchCity={onSwitchCity}
                    battlePoints={battlePoints}
                />
                <CityViewContent
                    cityGameState={cityGameState}
                    handlePlotClick={actions.handlePlotClick}
                    onOpenPowers={() => openCityModal('isDivinePowersOpen')}
                    gameSettings={gameSettings}
                    onOpenSpecialBuildingMenu={() => openCityModal('isSpecialBuildingMenuOpen')}
                    movements={movements}
                />
            </div>
            <CityModals
                cityGameState={cityGameState}
                worldId={worldId}
                currentUser={currentUser}
                userProfile={userProfile}
                isInstantBuild={isInstantBuild}
                getUpgradeCost={getUpgradeCost}
                getFarmCapacity={getFarmCapacity}
                getWarehouseCapacity={getWarehouseCapacity}
                getHospitalCapacity={getHospitalCapacity}
                getProductionRates={getProductionRates}
                calculateUsedPopulation={calculateUsedPopulation}
                saveGameState={saveGameState}
                handleUpgrade={actions.handleUpgrade}
                handleCancelBuild={actions.handleCancelBuild}
                handleTrainTroops={actions.handleTrainTroops}
                handleCancelTrain={actions.handleCancelTrain}
                handleFireTroops={actions.handleFireTroops}
                handleStartResearch={actions.handleStartResearch}
                handleCancelResearch={actions.handleCancelResearch}
                handleWorshipGod={actions.handleWorshipGod}
                handleCheat={actions.handleCheat}
                handleHealTroops={actions.handleHealTroops}
                handleCancelHeal={actions.handleCancelHeal}
                availablePopulation={availablePopulation}
                modalState={cityModalState}
                openModal={openCityModal}
                closeModal={closeCityModal}
                setMessage={setMessage}
                onAddWorker={actions.handleAddWorker}
                onRemoveWorker={actions.handleRemoveWorker}
                getMaxWorkerSlots={getMaxWorkerSlots}
                getMarketCapacity={getMarketCapacity}
                handleBuildSpecialBuilding={actions.handleBuildSpecialBuilding}
                handleDemolish={actions.handleDemolish}
                handleDemolishSpecialBuilding={actions.handleDemolishSpecialBuilding}
                handleSpawnGodTown={actions.handleSpawnGodTown}
                onRecruitHero={onRecruitHero}
                onActivateSkill={onActivateSkill}
                onAssignHero={onAssignHero}
                onUnassignHero={onUnassignHero}
                onApplyWorkerPreset={actions.applySenateWorkerPreset}
                onReleaseHero={onReleaseHero}
                onRecruitAgent={onRecruitAgent}
                onAssignAgent={onAssignAgent}
                movements={movements}
            />
            {cityModalState.isDivinePowersOpen && (
                <DivinePowers
                    godName={cityGameState.god}
                    playerReligion={cityGameState.playerInfo.religion}
                    favor={cityGameState.worship[cityGameState.god] || 0}
                    onCastSpell={actions.handleCastSpell}
                    onClose={() => closeCityModal('isDivinePowersOpen')}
                />
            )}
        </div>
    );
};

export default CityView;

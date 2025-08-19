import { useState } from 'react';

// #comment Manages the state of all modals in the map view.
export const useModalState = () => {
    const [modalState, setModalState] = useState({
        selectedCity: null,
        selectedVillage: null,
        actionDetails: null,
        isMovementsPanelOpen: false,
        isReportsPanelOpen: false,
        isAllianceModalOpen: false,
        isAllianceCreationOpen: false,
        isMessagesPanelOpen: false,
        isDivinePowersOpen: false,
        divinePowersTarget: null,
        isProfileModalOpen: false,
        isAllianceForumOpen: false,
        isLeaderboardOpen: false,
        isAllianceProfileOpen: false,
        isQuestsModalOpen: false,
        isSettingsModalOpen: false,
        isRecruitmentPanelOpen: false,
        isTradesPanelOpen: false,
        isWithdrawModalOpen: false,
        withdrawModalData: null,
        isReinforcementsModalOpen: false,
        reinforcementsModalData: null,
        isEventTriggerOpen: false,
        viewingProfileId: null,
        viewingAllianceId: null,
        isEmptyCityModalOpen: false,
        emptyCityModalData: null,
    });

    // #comment Opens a modal of a given type with optional data.
    const openModal = (type, data) => {
        setModalState(prevState => {
            switch (type) {
                case 'city': return { ...prevState, selectedCity: data };
                case 'village': return { ...prevState, selectedVillage: data };
                case 'action': return { ...prevState, actionDetails: data };
                case 'movements': return { ...prevState, isMovementsPanelOpen: true };
                case 'reports': return { ...prevState, isReportsPanelOpen: true };
                case 'alliance': return { ...prevState, isAllianceModalOpen: true };
                case 'allianceCreation': return { ...prevState, isAllianceCreationOpen: true };
                case 'messages': return { ...prevState, isMessagesPanelOpen: true };
                case 'divinePowers': return { ...prevState, isDivinePowersOpen: true, divinePowersTarget: data?.targetCity || null };
                case 'profile': return { ...prevState, isProfileModalOpen: true, viewingProfileId: data?.userId || null };
                case 'allianceForum': return { ...prevState, isAllianceForumOpen: true };
                case 'leaderboard': return { ...prevState, isLeaderboardOpen: true };
                case 'allianceProfile': return { ...prevState, isAllianceProfileOpen: true, viewingAllianceId: data?.allianceId || null };
                case 'quests': return { ...prevState, isQuestsModalOpen: true };
                case 'settings': return { ...prevState, isSettingsModalOpen: true };
                case 'recruitment': return { ...prevState, isRecruitmentPanelOpen: true };
                case 'trades': return { ...prevState, isTradesPanelOpen: true };
                case 'eventTrigger': return { ...prevState, isEventTriggerOpen: true };
                case 'withdraw': return { ...prevState, isWithdrawModalOpen: true, withdrawModalData: data };
                case 'reinforcements': return { ...prevState, isReinforcementsModalOpen: true, reinforcementsModalData: data };
                case 'emptyCity': return { ...prevState, isEmptyCityModalOpen: true, emptyCityModalData: data };
                default: return prevState;
            }
        });
    };

    // #comment Closes a modal of a given type.
    const closeModal = (type) => {
        setModalState(prevState => {
            switch (type) {
                case 'city': return { ...prevState, selectedCity: null };
                case 'village': return { ...prevState, selectedVillage: null };
                case 'action': return { ...prevState, actionDetails: null };
                case 'movements': return { ...prevState, isMovementsPanelOpen: false };
                case 'reports': return { ...prevState, isReportsPanelOpen: false };
                case 'alliance': return { ...prevState, isAllianceModalOpen: false };
                case 'allianceCreation': return { ...prevState, isAllianceCreationOpen: false };
                case 'messages': return { ...prevState, isMessagesPanelOpen: false };
                case 'divinePowers': return { ...prevState, isDivinePowersOpen: false, divinePowersTarget: null };
                case 'profile': return { ...prevState, isProfileModalOpen: false, viewingProfileId: null };
                case 'allianceForum': return { ...prevState, isAllianceForumOpen: false };
                case 'leaderboard': return { ...prevState, isLeaderboardOpen: false };
                case 'allianceProfile': return { ...prevState, isAllianceProfileOpen: false, viewingAllianceId: null };
                case 'quests': return { ...prevState, isQuestsModalOpen: false };
                case 'settings': return { ...prevState, isSettingsModalOpen: false };
                case 'recruitment': return { ...prevState, isRecruitmentPanelOpen: false };
                case 'trades': return { ...prevState, isTradesPanelOpen: false };
                case 'eventTrigger': return { ...prevState, isEventTriggerOpen: false };
                case 'withdraw': return { ...prevState, isWithdrawModalOpen: false, withdrawModalData: null };
                case 'reinforcements': return { ...prevState, isReinforcementsModalOpen: false, reinforcementsModalData: null };
                case 'emptyCity': return { ...prevState, isEmptyCityModalOpen: false, emptyCityModalData: null };
                default: return prevState;
            }
        });
    };

    return {
        modalState,
        openModal,
        closeModal,
    };
};

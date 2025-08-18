// src/hooks/useMapClickHandler.js
import { calculateDistance } from '../utils/travel';
import { getVillageTroops } from '../utils/combat';

export const useMapClickHandler = ({
    playerCity,
    isPlacingDummyCity,
    handleCreateDummyCity,
    setTravelTimeInfo,
    openModal,
    closeModal,
    setMessage,
    conqueredVillages,
    conqueredRuins,
}) => {

    const onCitySlotClick = (e, slotData) => {
        if (!playerCity) {
            setMessage("Your city data is still loading. Please wait a moment.");
            return;
        }
        closeModal('village');
        if (isPlacingDummyCity && !slotData.ownerId) {
            handleCreateDummyCity(slotData.id, slotData);
            return;
        }

        if (slotData.ownerId) {
             const distance = calculateDistance(playerCity, slotData);
             setTravelTimeInfo({ distance });

            // The slotData is already the complete, merged data object for the city.
            const cityData = slotData;
            
            // #comment Get the position of the click to place the radial menu
            const rect = e.currentTarget.getBoundingClientRect();
            const position = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
            };

            const modalData = { ...cityData, position };
            openModal('city', modalData);

        } else {
            setMessage('This plot is empty. Future updates will allow colonization!');
        }
    };

    const onVillageClick = (e, villageData) => {
        if (!playerCity) {
            setMessage("Your city data is still loading. Please wait a moment.");
            return;
        }
        closeModal('city');
        if (playerCity.islandId !== villageData.islandId) {
            setMessage("You can only interact with villages on islands where you have a city.");
            return;
        }

        const isConqueredByPlayer = conqueredVillages && conqueredVillages[villageData.id];

        if (isConqueredByPlayer) {
            openModal('village', { ...villageData, ...conqueredVillages[villageData.id] });
        } else {
            const distance = calculateDistance(playerCity, villageData);
            setTravelTimeInfo({ distance });
            const targetData = {
                id: villageData.id,
                name: villageData.name,
                cityName: villageData.name,
                ownerId: null,
                ownerUsername: 'Neutral',
                x: villageData.x,
                y: villageData.y,
                islandId: villageData.islandId,
                isVillageTarget: true,
                troops: getVillageTroops(villageData),
                level: villageData.level || 1,
                demands: villageData.demands,
                supplies: villageData.supplies,
                tradeRatio: villageData.tradeRatio
            };
            openModal('city', targetData);
        }
    };

    const onRuinClick = (e, ruinData) => {
        if (!playerCity) {
            setMessage("Your city data is still loading. Please wait a moment.");
            return;
        }
        closeModal('city');
        closeModal('village');
        const distance = calculateDistance(playerCity, ruinData);
        setTravelTimeInfo({ distance });

        const isConqueredByYou = conqueredRuins && conqueredRuins[ruinData.id];

        const targetData = {
            id: ruinData.id,
            name: ruinData.name,
            cityName: ruinData.name,
            ownerId: ruinData.ownerId || 'ruins',
            ownerUsername: ruinData.ownerUsername || 'Ancient Guardians',
            x: ruinData.x,
            y: ruinData.y,
            isRuinTarget: true,
            troops: ruinData.troops,
            researchReward: ruinData.researchReward,
            isConqueredByYou: !!isConqueredByYou
        };
        openModal('city', targetData);
    };

    return { onCitySlotClick, onVillageClick, onRuinClick };
};
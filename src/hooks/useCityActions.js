// src/hooks/useCityActions.js
import { useAdminActions } from './actions/useAdminActions';
import { useBuildingActions } from './actions/useBuildingActions';
import { useDivineActions } from './actions/useDivineActions';
import { useResearchActions } from './actions/useResearchActions';
import { useUnitActions } from './actions/useUnitActions';
import { useWorkerActions } from './actions/useWorkerActions';

/**
 * #comment A custom hook to aggregate all city-related actions from smaller, focused hooks.
 */
export const useCityActions = (props) => {
    const { cityGameState, openModal, setModalState } = props;

    // Instantiate all individual action hooks
    const adminActions = useAdminActions(props);
    const buildingActions = useBuildingActions(props);
    const divineActions = useDivineActions(props);
    const researchActions = useResearchActions(props);
    const unitActions = useUnitActions(props);
    const workerActions = useWorkerActions(props);

    // #comment Handles clicks on building plots in the city view.
    const handlePlotClick = (buildingId) => {
        const buildingData = cityGameState.buildings[buildingId];
        if (!buildingData || buildingData.level === 0) {
            // #comment If the special building plot is clicked and it's not built, open the menu
            if (buildingId === 'special_building_plot') {
                if (cityGameState.specialBuilding) {
                    openModal('isSpecialBuildingPanelOpen');
                } else {
                    openModal('isSpecialBuildingMenuOpen');
                }
                return;
            }
            openModal('isSenateViewOpen');
            return;
        }
        switch (buildingId) {
            case 'senate': openModal('isSenateViewOpen'); break;
            case 'barracks': openModal('isBarracksMenuOpen'); break;
            case 'shipyard': openModal('isShipyardMenuOpen'); break;
            case 'temple': openModal('isTempleMenuOpen'); break;
            case 'divine_temple': openModal('isDivineTempleMenuOpen'); break;
            case 'cave': openModal('isCaveMenuOpen'); break;
            case 'academy': openModal('isAcademyMenuOpen'); break;
            case 'hospital': openModal('isHospitalMenuOpen'); break;
            case 'market': openModal('isMarketMenuOpen'); break;
            case 'heroes_altar': openModal('isHeroesAltarOpen'); break;
            case 'prison': openModal('isPrisonMenuOpen'); break; // #comment Open prison menu
            // #comment Handle special building plot click
            case 'special_building_plot':
                if (cityGameState.specialBuilding) {
                    openModal('isSpecialBuildingPanelOpen');
                } else {
                    openModal('isSpecialBuildingMenuOpen');
                }
                break;
            default: setModalState(prev => ({ ...prev, selectedBuildingId: buildingId })); break;
        }
    };

    // Combine all actions into a single object
    return {
        ...adminActions,
        ...buildingActions,
        ...divineActions,
        ...researchActions,
        ...unitActions,
        ...workerActions,
        handlePlotClick,
    };
};
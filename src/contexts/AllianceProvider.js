// src/contexts/AllianceProvider.js
import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from "firebase/firestore";
import { db } from '../firebase/config';
import { useGame } from './GameContext';
import AllianceContext from './AllianceContext';
import { useAllianceActions } from '../hooks/actions/useAllianceActions';
import { useAllianceBankActions } from '../hooks/actions/useAllianceBank';
import { useAllianceDiplomacyActions } from '../hooks/actions/useAllianceDiplomacy';
import { useAllianceManagementActions } from '../hooks/actions/useAllianceManagement';
import { useAllianceResearchActions } from '../hooks/actions/useAllianceResearch';
import { useAllianceWonderActions } from '../hooks/actions/useAllianceWonderActions'; // Import new hook

export const AllianceProvider = ({ children }) => {
    const { worldId, playerGameData } = useGame();
    const [playerAlliance, setPlayerAlliance] = useState(null);

    useEffect(() => {
        if (!worldId || !playerGameData || !playerGameData.alliance) {
            setPlayerAlliance(null);
            return;
        }

        const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', playerGameData.alliance);
        const unsubscribe = onSnapshot(allianceDocRef, (allianceSnap) => {
            if (allianceSnap.exists()) {
                setPlayerAlliance({ id: allianceSnap.id, ...allianceSnap.data() });
            } else {
                setPlayerAlliance(null);
            }
        });

        return () => unsubscribe();
    }, [worldId, playerGameData]);

    const allianceActions = useAllianceActions(playerAlliance);
    const bankActions = useAllianceBankActions(playerAlliance);
    const diplomacyActions = useAllianceDiplomacyActions(playerAlliance);
    const managementActions = useAllianceManagementActions(playerAlliance);
    const researchActions = useAllianceResearchActions(playerAlliance);
    const wonderActions = useAllianceWonderActions(playerAlliance);

    const value = {
        playerAlliance,
        ...allianceActions,
        ...bankActions,
        ...diplomacyActions,
        ...managementActions,
        ...researchActions,
        ...wonderActions
    };

    return (
        <AllianceContext.Provider value={value}>
            {children}
        </AllianceContext.Provider>
    );
};

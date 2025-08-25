import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { db } from '../firebase/config';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import vipConfig from '../gameData/vip.json';
import './VipDisplay.css';

const VipDisplay = () => {
    const { currentUser } = useAuth();
    const { worldId, playerGameData } = useGame();
    const [canClaim, setCanClaim] = useState(false);
    const [isClaiming, setIsClaiming] = useState(false);

    useEffect(() => {
        if (playerGameData?.lastVipPointsClaimed) {
            const lastClaimDate = playerGameData.lastVipPointsClaimed.toDate();
            const now = new Date();
            if (now.getDate() !== lastClaimDate.getDate() || now.getMonth() !== lastClaimDate.getMonth() || now.getFullYear() !== lastClaimDate.getFullYear()) {
                setCanClaim(true);
            } else {
                setCanClaim(false);
            }
        } else if (playerGameData) {
            setCanClaim(true);
        }
    }, [playerGameData]);

    const handleClaimVipPoints = async () => {
        if (!canClaim || isClaiming || !playerGameData) return;
        setIsClaiming(true);

        const gameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId);
        const currentPoints = playerGameData.vipPoints || 0;
        const newPoints = currentPoints + vipConfig.dailyPoints;
        let newLevel = playerGameData.vipLevel || 1;

        if (newLevel < vipConfig.pointsPerLevel.length && newPoints >= vipConfig.pointsPerLevel[newLevel]) {
            newLevel++;
        }

        try {
            await updateDoc(gameDocRef, {
                vipPoints: newPoints,
                vipLevel: newLevel,
                lastVipPointsClaimed: serverTimestamp()
            });
        } catch (error) {
            console.error("Error claiming VIP points:", error);
        } finally {
            setIsClaiming(false);
        }
    };
    
    const vipLevel = playerGameData?.vipLevel || 1;
    const currentVipPoints = playerGameData?.vipPoints || 0;
    const pointsForNextLevel = vipConfig.pointsPerLevel[vipLevel] || Infinity;
    const progress = pointsForNextLevel === Infinity ? 100 : (currentVipPoints / pointsForNextLevel) * 100;

    return (
        <div className="vip-container">
            <div className="vip-header">
                <span>VIP {vipLevel}</span>
                {canClaim && <button className="vip-claim-btn" onClick={handleClaimVipPoints} disabled={isClaiming}>Claim</button>}
            </div>
            <div className="vip-progress-bar-bg" title={`${currentVipPoints} / ${pointsForNextLevel === Infinity ? 'MAX' : pointsForNextLevel} VIP Points`}>
                <div className="vip-progress-bar" style={{ width: `${progress}%` }}></div>
            </div>
        </div>
    );
};

export default VipDisplay;
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { db } from '../../firebase/config';
import { doc, runTransaction, collection, serverTimestamp, getDocs, query, limit } from "firebase/firestore";
import allianceResearch from '../../gameData/allianceResearch.json';

const calculateBankCapacity = (alliance) => {
    if (!alliance) return 0;
    const baseCapacity = 100000;
    const researchLevel = alliance.research?.reinforced_vaults?.level || 0;
    const researchBonus = allianceResearch.reinforced_vaults.effect.value * researchLevel;
    return baseCapacity + researchBonus;
};

export const useAllianceBankActions = (playerAlliance) => {
    const { currentUser, userProfile } = useAuth();
    const { worldId, activeCityId } = useGame();

    const donateToBank = async (donation) => {
        if (!playerAlliance) throw new Error("You are not in an alliance.");
        if (Object.values(donation).every(v => v === 0)) throw new Error("Donation amount cannot be zero.");

        const cityDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', activeCityId);
        const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
        const logRef = doc(collection(allianceDocRef, 'bank_logs'));
        const eventRef = doc(collection(allianceDocRef, 'events'));
        const userBankActivityRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'bankActivity', 'activity');

        await runTransaction(db, async (transaction) => {
            const cityDoc = await transaction.get(cityDocRef);
            const allianceDoc = await transaction.get(allianceDocRef);
            const userActivityDoc = await transaction.get(userBankActivityRef);

            if (!cityDoc.exists() || !allianceDoc.exists()) throw new Error("City or Alliance data not found.");

            const cityData = cityDoc.data();
            const allianceData = allianceDoc.data();
            const bankCapacity = calculateBankCapacity(allianceData);

            const userActivityData = userActivityDoc.exists() ? userActivityDoc.data() : { lastDonation: 0, dailyDonationTotal: 0, lastDonationDate: new Date(0).toISOString().split('T')[0] };
            const now = new Date();
            const today = now.toISOString().split('T')[0];

            if (now.getTime() - (userActivityData.lastDonation || 0) < 5 * 60 * 1000) {
                const waitTime = Math.ceil((5 * 60 * 1000 - (now.getTime() - userActivityData.lastDonation)) / 1000);
                throw new Error(`You must wait ${waitTime} seconds between donations.`);
            }

            let dailyTotal = userActivityData.dailyDonationTotal || 0;
            if(userActivityData.lastDonationDate !== today) {
                dailyTotal = 0;
            }

            const totalDonation = Object.values(donation).reduce((a, b) => a + b, 0);
            if (dailyTotal + totalDonation > 50000) {
                throw new Error(`You have reached your daily donation limit of 50,000. You have ${50000 - dailyTotal} left to donate today.`);
            }

            const newCityResources = { ...cityData.resources };
            const newBank = { ...(allianceData.bank || { wood: 0, stone: 0, silver: 0 }) };

            for (const resource in donation) {
                if ((newCityResources[resource] || 0) < donation[resource]) throw new Error(`Not enough ${resource}.`);
                if ((newBank[resource] || 0) + donation[resource] > bankCapacity) throw new Error(`Bank is full for ${resource}. Capacity: ${bankCapacity.toLocaleString()}`);
                newCityResources[resource] -= donation[resource];
                newBank[resource] = (newBank[resource] || 0) + donation[resource];
            }

            transaction.update(cityDocRef, { resources: newCityResources });
            transaction.update(allianceDocRef, { bank: newBank });
            transaction.set(userBankActivityRef, {
                lastDonation: now.getTime(),
                dailyDonationTotal: dailyTotal + totalDonation,
                lastDonationDate: today
            }, { merge: true });

            transaction.set(logRef, {
                type: 'donation',
                user: userProfile.username,
                resources: donation,
                timestamp: serverTimestamp()
            });

            const donationAmounts = Object.entries(donation).filter(([,a]) => a > 0).map(([r,a]) => `${a.toLocaleString()} ${r}`).join(', ');
            transaction.set(eventRef, {
                type: 'bank_donation',
                text: `${userProfile.username} donated ${donationAmounts} to the bank.`,
                timestamp: serverTimestamp()
            });
        });
    };

    const distributeFromBank = async (targetMemberUid, distribution) => {
        if (!playerAlliance) throw new Error("You are not in an alliance.");
        if (Object.values(distribution).every(v => v === 0)) throw new Error("Distribution amount cannot be zero.");

        const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
        const logRef = doc(collection(allianceDocRef, 'bank_logs'));
        const eventRef = doc(collection(allianceDocRef, 'events'));

        const targetCitiesRef = collection(db, `users/${targetMemberUid}/games`, worldId, 'cities');
        const q = query(targetCitiesRef, limit(1));
        const targetCitiesSnap = await getDocs(q);
        if (targetCitiesSnap.empty) throw new Error("Target member has no cities in this world.");
        const targetCityDoc = targetCitiesSnap.docs[0];
        const targetCityRef = targetCityDoc.ref;

        await runTransaction(db, async (transaction) => {
            const allianceDoc = await transaction.get(allianceDocRef);
            const targetCitySnap = await transaction.get(targetCityRef);
            if (!allianceDoc.exists() || !targetCitySnap.exists()) throw new Error("Alliance or target city data not found.");

            const allianceData = allianceDoc.data();
            const targetCityData = targetCitySnap.data();
            const newBank = { ...(allianceData.bank || { wood: 0, stone: 0, silver: 0 }) };
            const newCityResources = { ...targetCityData.resources };

            for (const resource in distribution) {
                if ((newBank[resource] || 0) < distribution[resource]) throw new Error(`Not enough ${resource} in the bank.`);
                newBank[resource] -= distribution[resource];
                newCityResources[resource] = (newCityResources[resource] || 0) + distribution[resource];
            }

            transaction.update(allianceDocRef, { bank: newBank });
            transaction.update(targetCityRef, { resources: newCityResources });

            const targetUsername = allianceData.members.find(m => m.uid === targetMemberUid)?.username || 'Unknown';
            transaction.set(logRef, {
                type: 'distribution',
                from: userProfile.username,
                to: targetUsername,
                resources: distribution,
                timestamp: serverTimestamp()
            });

            const distributionAmounts = Object.entries(distribution).filter(([,a]) => a > 0).map(([r,a]) => `${a.toLocaleString()} ${r}`).join(', ');
            transaction.set(eventRef, {
                type: 'bank_distribution',
                text: `${userProfile.username} distributed ${distributionAmounts} to ${targetUsername}.`,
                timestamp: serverTimestamp()
            });
        });
    };

    const withdrawFromBank = async (withdrawal) => {
        if (!playerAlliance) throw new Error("You are not in an alliance.");
        if (Object.values(withdrawal).every(v => v === 0)) throw new Error("Withdrawal amount cannot be zero.");

        const cityDocRef = doc(db, `users/${currentUser.uid}/games`, worldId, 'cities', activeCityId);
        const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
        const logRef = doc(collection(allianceDocRef, 'bank_logs'));

        await runTransaction(db, async (transaction) => {
            const cityDoc = await transaction.get(cityDocRef);
            const allianceDoc = await transaction.get(allianceDocRef);
            if (!cityDoc.exists() || !allianceDoc.exists()) throw new Error("City or Alliance data not found.");

            const cityData = cityDoc.data();
            const allianceData = allianceDoc.data();
            const newCityResources = { ...cityData.resources };
            const newBank = { ...allianceData.bank };

            for (const resource in withdrawal) {
                if (newBank[resource] < withdrawal[resource]) throw new Error(`Not enough ${resource} in the bank.`);
                newBank[resource] -= withdrawal[resource];
                newCityResources[resource] = (newCityResources[resource] || 0) + withdrawal[resource];
            }

            transaction.update(cityDocRef, { resources: newCityResources });
            transaction.update(allianceDocRef, { bank: newBank });
            transaction.set(logRef, {
                type: 'withdrawal',
                user: userProfile.username,
                resources: withdrawal,
                timestamp: serverTimestamp()
            });
        });
    };

    return { donateToBank, distributeFromBank, withdrawFromBank };
};

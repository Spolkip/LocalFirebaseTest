// src/hooks/actions/useAllianceActions.js
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { db } from '../../firebase/config';
import { doc, runTransaction, collection, getDocs, updateDoc, arrayUnion, writeBatch, getDoc, arrayRemove, addDoc, serverTimestamp } from "firebase/firestore";
import { sendSystemMessage } from '../../utils/sendSystemMessage';
import allianceResearch from '../../gameData/allianceResearch.json';
import { clearMemberCache } from '../../components/alliance/AllianceMembers';

const calculateMaxMembers = (alliance) => {
    const baseMax = 20;
    const researchLevel = alliance.research?.expanded_charter?.level || 0;
    const researchBonus = allianceResearch.expanded_charter.effect.value * researchLevel;
    return baseMax + researchBonus;
};

export const useAllianceActions = (playerAlliance) => {
    const { currentUser, userProfile } = useAuth();
    const { worldId} = useGame();

    const createAlliance = async (name, tag) => {
        if (!currentUser || !worldId || !userProfile) return;

        const citiesRef = collection(db, `users/${currentUser.uid}/games`, worldId, 'cities');
        const citiesSnap = await getDocs(citiesRef);
        const userCitySlotIds = citiesSnap.docs.map(doc => doc.data().slotId);

        if (userCitySlotIds.length === 0) {
            throw new Error("You must have a city to create an alliance.");
        }

        const allianceId = tag.toUpperCase();
        const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', allianceId);
        const gameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId);
        const eventsRef = collection(db, 'worlds', worldId, 'alliances', allianceId, 'events');

        try {
            await runTransaction(db, async (transaction) => {
                const allianceDoc = await transaction.get(allianceDocRef);
                if (allianceDoc.exists()) {
                    throw new Error("An alliance with this tag already exists.");
                }

                const gameDoc = await transaction.get(gameDocRef);
                if (!gameDoc.exists()) {
                    throw new Error("Player game data not found.");
                }

                const playerData = gameDoc.data();
                if (playerData.alliance) {
                    throw new Error("You are already in an alliance.");
                }

                const newAlliance = {
                    name,
                    tag: allianceId,
                    leader: { uid: currentUser.uid, username: userProfile.username },
                    members: [{ uid: currentUser.uid, username: userProfile.username, rank: 'Leader' }],
                    research: {},
                    bank: { wood: 0, stone: 0, silver: 0, capacity: 100000 },
                    diplomacy: { allies: [], enemies: [], requests: [] },
                    settings: {
                        status: 'open',
                        description: `A new alliance, '${name}', has been formed!`,
                        privateDescription: '',
                    },
                    ranks: [
                        { id: 'Leader', name: 'Leader', permissions: {
                            manageRanks: true, manageSettings: true, manageDiplomacy: true, inviteMembers: true, kickMembers: true, banMembers: true, recommendResearch: true, viewSecretForums: true, manageBank: true, withdrawFromBank: true, proposeTreaties: true, viewMemberActivity: true
                        }},
                        { id: 'Member', name: 'Member', permissions: {
                            manageRanks: false, manageSettings: false, manageDiplomacy: false, inviteMembers: false, kickMembers: false, banMembers: false, recommendResearch: false, viewSecretForums: false, manageBank: false, withdrawFromBank: false, proposeTreaties: false, viewMemberActivity: false
                        }}
                    ],
                    banned: [],
                    applications: [],
                };

                transaction.set(allianceDocRef, newAlliance);
                transaction.update(gameDocRef, { alliance: allianceId });


                for (const slotId of userCitySlotIds) {
                    const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', slotId);
                    transaction.update(citySlotRef, { alliance: allianceId, allianceName: name });
                }
                
                transaction.set(doc(eventsRef), {
                    type: 'alliance_created',
                    text: `The alliance '${name}' [${tag.toUpperCase()}] was founded by ${userProfile.username}.`,
                    timestamp: serverTimestamp(),
                });
            });
        } catch (error) {
            console.error("Error creating alliance: ", error);
            throw error;
        }
    };

    const updateAllianceSettings = async (settings) => {
        if (!playerAlliance) return;
        const member = playerAlliance.members.find(m => m.uid === currentUser.uid);
        const rank = playerAlliance.ranks.find(r => r.id === member?.rank);
        if (!rank?.permissions?.manageSettings) return;

        const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
        await updateDoc(allianceDocRef, { settings });

        const eventsRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'events');
        await addDoc(eventsRef, {
            type: 'settings_updated',
            text: `${userProfile.username} updated the alliance settings.`,
            timestamp: serverTimestamp(),
        });
    };

    const applyToAlliance = async (allianceId) => {
        if (!currentUser || !worldId || !userProfile) {
            throw new Error("User or world not identified.");
        }
        if (playerAlliance) {
            throw new Error("You are already in an alliance.");
        }

        const allianceRef = doc(db, 'worlds', worldId, 'alliances', allianceId);

        const allianceSnap = await getDoc(allianceRef);
        if (allianceSnap.exists()) {
            const allianceData = allianceSnap.data();
            if (allianceData.banned?.some(b => b.uid === currentUser.uid)) {
                throw new Error("You are banned from this alliance.");
            }
            const existingApplication = allianceData.applications?.find(app => app.userId === currentUser.uid);
            if (existingApplication) {
                throw new Error("You have already applied to this alliance.");
            }

            await updateDoc(allianceRef, {
                applications: arrayUnion({
                    userId: currentUser.uid,
                    username: userProfile.username,
                    timestamp: new Date()
                })
            });

            const leaderId = allianceData.leader.uid;
            const leaderUsername = allianceData.leader.username;
            const messageText = `You have a new application for [alliance id=${allianceId}]${allianceData.name}[/alliance] from [player id=${currentUser.uid}]${userProfile.username}[/player].`;
            await sendSystemMessage(leaderId, leaderUsername, messageText, worldId);

        } else {
            throw new Error("Alliance not found.");
        }
    };

    const leaveAlliance = async () => {
        if (!playerAlliance) throw new Error("You are not in an alliance.");
        if (playerAlliance.leader.uid === currentUser.uid && playerAlliance.members.length > 1) {
            throw new Error("Leaders must pass leadership before leaving.");
        }

        const citiesRef = collection(db, `users/${currentUser.uid}/games`, worldId, 'cities');
        const citiesSnap = await getDocs(citiesRef);
        const userCitySlotIds = citiesSnap.docs.map(doc => doc.data().slotId);

        const allianceRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
        const gameRef = doc(db, `users/${currentUser.uid}/games`, worldId);
        const eventsRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'events');

        await runTransaction(db, async (transaction) => {
            if (playerAlliance.members.length === 1) {
                transaction.delete(allianceRef);
            } else {
                const memberToRemove = playerAlliance.members.find(m => m.uid === currentUser.uid);
                if (memberToRemove) {
                    transaction.update(allianceRef, {
                        members: arrayRemove(memberToRemove)
                    });
                }
            }
            transaction.update(gameRef, { alliance: null });
            for (const slotId of userCitySlotIds) {
                const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', slotId);
                transaction.update(citySlotRef, { alliance: null, allianceName: null });
            }
            transaction.set(doc(eventsRef), {
                type: 'member_left',
                text: `${userProfile.username} has left the alliance.`,
                timestamp: serverTimestamp(),
            });
        });
        
        clearMemberCache();
    };

    const disbandAlliance = async () => {
        if (!playerAlliance || playerAlliance.leader.uid !== currentUser.uid) {
            throw new Error("You are not the leader of this alliance.");
        }

        const allianceRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
        const batch = writeBatch(db);

        for (const member of playerAlliance.members) {
            const gameRef = doc(db, `users/${member.uid}/games`, worldId);
            batch.update(gameRef, { alliance: null });

            const citiesRef = collection(db, `users/${member.uid}/games`, worldId, 'cities');
            const citiesSnap = await getDocs(citiesRef);
            citiesSnap.forEach(cityDoc => {
                const cityData = cityDoc.data();
                if (cityData.slotId) {
                    const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', cityData.slotId);
                    batch.update(citySlotRef, { alliance: null, allianceName: null });
                }
            });
        }
        batch.delete(allianceRef);
        await batch.commit();
    };

    const joinOpenAlliance = async (allianceId) => {
        if (!currentUser || !worldId || !userProfile) throw new Error("User or world not identified.");
        if (playerAlliance) throw new Error("You are already in an alliance.");

        const citiesRef = collection(db, `users/${currentUser.uid}/games`, worldId, 'cities');
        const citiesSnap = await getDocs(citiesRef);
        const userCitySlotIds = citiesSnap.docs.map(doc => doc.data().slotId);

        const allianceRef = doc(db, 'worlds', worldId, 'alliances', allianceId);
        const gameRef = doc(db, `users/${currentUser.uid}/games`, worldId);
        const eventsRef = collection(db, 'worlds', worldId, 'alliances', allianceId, 'events');

        await runTransaction(db, async (transaction) => {
            const allianceDoc = await transaction.get(allianceRef);
            if (!allianceDoc.exists()) throw new Error("Alliance not found.");

            const allianceData = allianceDoc.data();
            if (allianceData.banned?.some(b => b.uid === currentUser.uid)) {
                throw new Error("You are banned from this alliance.");
            }
            if (allianceData.settings.status !== 'open') throw new Error("This alliance is not open for joining.");


            const maxMembers = calculateMaxMembers(allianceData);
            if (allianceData.members.length >= maxMembers) {
                throw new Error("This alliance is full.");
            }

            transaction.update(allianceRef, {
                members: arrayUnion({ uid: currentUser.uid, username: userProfile.username, rank: 'Member' })
            });
            transaction.update(gameRef, { alliance: allianceId });

            for (const slotId of userCitySlotIds) {
                const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', slotId);
                transaction.update(citySlotRef, { alliance: allianceId, allianceName: allianceData.name });
            }
            transaction.set(doc(eventsRef), {
                type: 'member_joined',
                text: `${userProfile.username} has joined the alliance.`,
                timestamp: serverTimestamp(),
            });
        });
        clearMemberCache();
    };

    return { createAlliance, updateAllianceSettings, applyToAlliance, leaveAlliance, disbandAlliance, joinOpenAlliance };
};

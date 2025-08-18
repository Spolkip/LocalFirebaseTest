// src/hooks/actions/useAllianceDiplomacy.js
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { db } from '../../firebase/config';
import { doc, runTransaction, collection, getDocs, query, where, addDoc, updateDoc, serverTimestamp, arrayUnion, arrayRemove, getDoc } from "firebase/firestore";
import { sendSystemMessage } from '../../utils/sendSystemMessage';

export const useAllianceDiplomacyActions = (playerAlliance) => {
    const { currentUser, userProfile } = useAuth();
    const { worldId } = useGame();

    const sendAllyRequest = async (targetAllianceTag) => {
        if (!playerAlliance) throw new Error("You are not in an alliance.");
        const member = playerAlliance.members.find(m => m.uid === currentUser.uid);
        const rank = playerAlliance.ranks.find(r => r.id === member?.rank);
        if (!rank?.permissions?.manageDiplomacy) throw new Error("You don't have permission to do this.");

        const alliancesRef = collection(db, 'worlds', worldId, 'alliances');
        const q = query(alliancesRef, where("tag", "==", targetAllianceTag.toUpperCase()));
        const targetAllianceSnap = await getDocs(q);
        if (targetAllianceSnap.empty) {
            throw new Error("Alliance with that tag not found.");
        }
        const targetAllianceDoc = targetAllianceSnap.docs[0];
        const targetAllianceData = targetAllianceDoc.data();
        const targetAllianceId = targetAllianceDoc.id;

        if (playerAlliance.id === targetAllianceId) {
            throw new Error("You cannot send an ally request to your own alliance.");
        }
        if (playerAlliance.diplomacy?.allies?.some(a => a.id === targetAllianceId)) {
            throw new Error("You are already allied with this alliance.");
        }
        if (playerAlliance.diplomacy?.enemies?.some(e => e.id === targetAllianceId)) {
            throw new Error("You cannot send an ally request to an enemy. Remove them from your enemies first.");
        }

        const targetAllianceRef = doc(db, 'worlds', worldId, 'alliances', targetAllianceId);
        await updateDoc(targetAllianceRef, {
            'diplomacy.requests': arrayUnion({
                id: playerAlliance.id,
                name: playerAlliance.name,
                tag: playerAlliance.tag
            })
        });

        const allianceEventsRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'events');
        await addDoc(allianceEventsRef, {
            type: 'diplomacy',
            text: `${userProfile.username} sent an ally request to [${targetAllianceTag}].`,
            timestamp: serverTimestamp(),
        });


        const targetLeaderId = targetAllianceData.leader.uid;
        const targetLeaderUsername = targetAllianceData.leader.username;
        const messageText = `Your alliance has received an ally request from [alliance id=${playerAlliance.id}]${playerAlliance.name}[/alliance]. You can accept or reject it in your alliance's diplomacy tab.`;
        await sendSystemMessage(targetLeaderId, targetLeaderUsername, messageText, worldId);
    };

    const declareEnemy = async (targetAllianceId) => {
        if (!playerAlliance) throw new Error("You are not in an alliance.");
        const member = playerAlliance.members.find(m => m.uid === currentUser.uid);
        const rank = playerAlliance.ranks.find(r => r.id === member?.rank);
        if (!rank?.permissions?.manageDiplomacy) throw new Error("You don't have permission to do this.");

        if (playerAlliance.diplomacy?.allies?.some(a => a.id === targetAllianceId)) {
            throw new Error("You cannot declare an ally as an enemy.");
        }
        if (playerAlliance.diplomacy?.enemies?.some(e => e.id === targetAllianceId)) {
            throw new Error("This alliance is already an enemy.");
        }
        const ownAllianceRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
        const targetAllianceDoc = await getDoc(doc(db, 'worlds', worldId, 'alliances', targetAllianceId));
        if (!targetAllianceDoc.exists()) {
            throw new Error("Target alliance not found.");
        }
        const targetData = targetAllianceDoc.data();
        await updateDoc(ownAllianceRef, {
            'diplomacy.enemies': arrayUnion({
                id: targetAllianceId,
                name: targetData.name,
                tag: targetData.tag
            })
        });
        const allianceEventsRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'events');
        await addDoc(allianceEventsRef, {
            type: 'diplomacy',
            text: `${userProfile.username} declared [${targetAllianceId}] as an enemy.`,
            timestamp: serverTimestamp(),
        });
    };

    const handleDiplomacyResponse = async (targetAllianceId, action) => {
        if (!playerAlliance) throw new Error("You are not in an alliance.");
        const member = playerAlliance.members.find(m => m.uid === currentUser.uid);
        const rank = playerAlliance.ranks.find(r => r.id === member?.rank);
        if (!rank?.permissions?.manageDiplomacy) throw new Error("You don't have permission to do this.");

        const ownAllianceRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
        const targetAllianceRef = doc(db, 'worlds', worldId, 'alliances', targetAllianceId);

        const ownEventsRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'events');
        const targetEventsRef = collection(db, 'worlds', worldId, 'alliances', targetAllianceId, 'events');

        await runTransaction(db, async (transaction) => {
            const ownAllianceDoc = await transaction.get(ownAllianceRef);
            const targetAllianceDoc = await transaction.get(targetAllianceRef);

            if (!ownAllianceDoc.exists()) throw new Error("Your alliance data not found.");
            if (!targetAllianceDoc.exists()) throw new Error("Target alliance not found.");

            const ownData = ownAllianceDoc.data();
            const targetData = targetAllianceDoc.data();

            const targetInfo = { id: targetAllianceId, name: targetData.name, tag: targetData.tag };
            const ownInfo = { id: playerAlliance.id, name: ownData.name, tag: ownData.tag };

            const ownDiplomacy = ownData.diplomacy || { allies: [], enemies: [], requests: [] };
            const targetDiplomacy = targetData.diplomacy || { allies: [], enemies: [], requests: [] };

            switch(action) {
                case 'accept':
                    if (ownDiplomacy.enemies?.some(e => e.id === targetAllianceId)) {
                        throw new Error("You cannot ally with an enemy. Remove them from your enemies list first.");
                    }
                    transaction.update(ownAllianceRef, { 'diplomacy.requests': arrayRemove(targetInfo), 'diplomacy.allies': arrayUnion(targetInfo) });
                    transaction.update(targetAllianceRef, { 'diplomacy.allies': arrayUnion(ownInfo) });
                    addDoc(ownEventsRef, { type: 'diplomacy', text: `${userProfile.username} accepted the ally request from [${targetInfo.tag}].`, timestamp: serverTimestamp() });
                    addDoc(targetEventsRef, { type: 'diplomacy', text: `[${ownInfo.tag}] has accepted your ally request.`, timestamp: serverTimestamp() });
                    break;
                case 'reject':
                    transaction.update(ownAllianceRef, { 'diplomacy.requests': arrayRemove(targetInfo) });
                    addDoc(ownEventsRef, { type: 'diplomacy', text: `${userProfile.username} rejected the ally request from [${targetInfo.tag}].`, timestamp: serverTimestamp() });
                    break;
                case 'removeAlly':
                    const allyInOwnList = ownDiplomacy.allies.find(a => a.id === targetAllianceId);
                    const allyInTargetList = targetDiplomacy.allies.find(a => a.id === playerAlliance.id);

                    if (allyInOwnList) {
                        transaction.update(ownAllianceRef, { 'diplomacy.allies': arrayRemove(allyInOwnList) });
                    }
                    if (allyInTargetList) {
                        transaction.update(targetAllianceRef, { 'diplomacy.allies': arrayRemove(allyInTargetList) });
                    }

                    addDoc(ownEventsRef, { type: 'diplomacy', text: `${userProfile.username} terminated the alliance with [${targetInfo.tag}].`, timestamp: serverTimestamp() });
                    addDoc(targetEventsRef, { type: 'diplomacy', text: `The alliance with [${ownInfo.tag}] has been terminated.`, timestamp: serverTimestamp() });
                    break;
                case 'removeEnemy':
                    const enemyInOwnList = ownDiplomacy.enemies.find(e => e.id === targetAllianceId);
                    if (enemyInOwnList) {
                        transaction.update(ownAllianceRef, { 'diplomacy.enemies': arrayRemove(enemyInOwnList) });
                    }
                    addDoc(ownEventsRef, { type: 'diplomacy', text: `${userProfile.username} removed [${targetInfo.tag}] from the enemies list.`, timestamp: serverTimestamp() });
                    break;
                default:
                    throw new Error("Invalid diplomacy action.");
            }
        });
    };

    const proposeTreaty = async (targetAllianceTag, treatyDetails) => {
        if (!playerAlliance) throw new Error("You are not in an alliance.");
        const member = playerAlliance.members.find(m => m.uid === currentUser.uid);
        const rank = playerAlliance.ranks.find(r => r.id === member?.rank);
        if (!rank?.permissions?.proposeTreaties) throw new Error("You don't have permission to do this.");

        const alliancesRef = collection(db, 'worlds', worldId, 'alliances');
        const q = query(alliancesRef, where("tag", "==", targetAllianceTag.toUpperCase()));
        const targetAllianceSnap = await getDocs(q);
        if (targetAllianceSnap.empty) throw new Error("Alliance with that tag not found.");
        const targetAlliance = { id: targetAllianceSnap.docs[0].id, ...targetAllianceSnap.docs[0].data() };
        const targetLeaderId = targetAlliance.leader.uid;
        const targetLeaderUsername = targetAlliance.leader.username;

        const treatyMessage = `Alliance ${playerAlliance.name} [${playerAlliance.tag}] has proposed a treaty to you.\n\nDetails:\n${treatyDetails.message}\n\n[action=view_treaty,treatyId=TEMP]View Treaty[/action]`;

        await sendSystemMessage(targetLeaderId, targetLeaderUsername, treatyMessage, worldId);

        const eventsRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'events');
        await addDoc(eventsRef, {
            type: 'treaty_proposed',
            text: `${userProfile.username} proposed a treaty to [${targetAllianceTag}].`,
            timestamp: serverTimestamp(),
        });
    };

    return { sendAllyRequest, declareEnemy, handleDiplomacyResponse, proposeTreaty };
};

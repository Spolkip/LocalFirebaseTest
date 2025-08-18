// src/hooks/actions/useAllianceManagement.js
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { db } from '../../firebase/config';
import { doc, runTransaction, collection, getDocs, query, where, addDoc, updateDoc, serverTimestamp, arrayUnion, arrayRemove, deleteDoc, getDoc } from "firebase/firestore";
import { sendSystemMessage } from '../../utils/sendSystemMessage';
import allianceResearch from '../../gameData/allianceResearch.json';
import { clearMemberCache } from '../../components/alliance/AllianceMembers';

const calculateMaxMembers = (alliance) => {
    const baseMax = 20;
    const researchLevel = alliance.research?.expanded_charter?.level || 0;
    const researchBonus = allianceResearch.expanded_charter.effect.value * researchLevel;
    return baseMax + researchBonus;
};

export const useAllianceManagementActions = (playerAlliance) => {
    const { currentUser, userProfile } = useAuth();
    const { worldId } = useGame();

    const sendAllianceInvitation = async (targetUserId) => {
        if (!playerAlliance) {
            throw new Error("You do not have permission to send invitations.");
        }
        const member = playerAlliance.members.find(m => m.uid === currentUser.uid);
        const rank = playerAlliance.ranks.find(r => r.id === member?.rank);
        if (!rank?.permissions?.inviteMembers) {
            throw new Error("You do not have permission to send invitations.");
        }
        if (!targetUserId) {
            throw new Error("Target user ID is not specified.");
        }

        try {
            const targetUserDoc = await getDoc(doc(db, 'users', targetUserId));
            if (!targetUserDoc.exists()) {
                throw new Error("Target user not found.");
            }
            const targetUsername = targetUserDoc.data().username;


            const invitesRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'invitations');
            await addDoc(invitesRef, {
                invitedUserId: targetUserId,
                invitedUsername: targetUsername,
                sentAt: serverTimestamp(),
                sentBy: userProfile.username
            });


            const allianceEventsRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'events');
            await addDoc(allianceEventsRef, {
                type: 'invitation_sent',
                text: `${userProfile.username} invited ${targetUsername} to the alliance.`,
                timestamp: serverTimestamp(),
            });


            const messageText = `You have been invited to join the alliance "${playerAlliance.name}".\n\n[action=accept_invite,allianceId=${playerAlliance.id}]Accept Invitation[/action]\n[action=decline_invite,allianceId=${playerAlliance.id}]Decline Invitation[/action]`;
            await sendSystemMessage(targetUserId, targetUsername, messageText, worldId);

        } catch (error) {
            console.error("Error sending invitation:", error);

            throw error;
        }
    };

    const revokeAllianceInvitation = async (invitedUserId) => {
        if (!playerAlliance) return;
        const member = playerAlliance.members.find(m => m.uid === currentUser.uid);
        const rank = playerAlliance.ranks.find(r => r.id === member?.rank);
        if (!rank?.permissions?.inviteMembers) return;

        const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
        const invitesRef = collection(allianceDocRef, 'invitations');
        const q = query(invitesRef, where('invitedUserId', '==', invitedUserId));

        try {
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                const inviteDoc = snapshot.docs[0];
                const inviteData = inviteDoc.data();
                const invitedUsername = inviteData.invitedUsername || 'a player';


                const allianceEventsRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'events');
                await addDoc(allianceEventsRef, {
                    type: 'invitation_revoked',
                    text: `${userProfile.username} has revoked the invitation for ${invitedUsername}.`,
                    timestamp: serverTimestamp(),
                });


                await deleteDoc(inviteDoc.ref);
            }
        } catch (error) {
            console.error("Error revoking invitation:", error);
            throw error;
        }
    };

    const declineAllianceInvitation = async (allianceId) => {
        if (!currentUser || !worldId) throw new Error("User or world not identified.");

        const invitesRef = collection(db, 'worlds', worldId, 'alliances', allianceId, 'invitations');
        const q = query(invitesRef, where('invitedUserId', '==', currentUser.uid));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            throw new Error("Invitation not found. It may have been revoked or already handled.");
        }

        const inviteDocRef = snapshot.docs[0].ref;
        await deleteDoc(inviteDocRef);
    };

    const acceptAllianceInvitation = async (allianceId) => {
        if (!currentUser || !worldId) return;

        const citiesRef = collection(db, `users/${currentUser.uid}/games`, worldId, 'cities');
        const citiesSnap = await getDocs(citiesRef);
        const userCitySlotIds = citiesSnap.docs.map(doc => doc.data().slotId);

        const newAllianceDocRef = doc(db, 'worlds', worldId, 'alliances', allianceId);
        const gameDocRef = doc(db, `users/${currentUser.uid}/games`, worldId);

        const invitesRef = collection(db, 'worlds', worldId, 'alliances', allianceId, 'invitations');
        const q = query(invitesRef, where('invitedUserId', '==', currentUser.uid));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            throw new Error("Invitation not found. It may have been revoked or already handled.");
        }
        const inviteDocRef = snapshot.docs[0].ref;

        try {
            await runTransaction(db, async (transaction) => {
                const inviteDoc = await transaction.get(inviteDocRef);
                if (!inviteDoc.exists()) {
                    throw new Error("Invitation was handled by another action.");
                }

                const newAllianceDoc = await transaction.get(newAllianceDocRef);
                const gameDoc = await transaction.get(gameDocRef);

                if (!newAllianceDoc.exists()) throw new Error("Alliance no longer exists.");
                if (!gameDoc.exists()) throw new Error("Your game data was not found.");

                const newAllianceData = newAllianceDoc.data();
                if (newAllianceData.banned?.some(b => b.uid === currentUser.uid)) {
                    transaction.delete(inviteDocRef);
                    throw new Error("You are banned from this alliance.");
                }
                const gameData = gameDoc.data();
                const oldAllianceId = gameData.alliance;

                if (oldAllianceId === allianceId) throw new Error("You are already in this alliance.");

                const maxMembers = calculateMaxMembers(newAllianceData);
                if (newAllianceData.members.length >= maxMembers) {
                    throw new Error("This alliance is full.");
                }

                if (oldAllianceId) {
                    const oldAllianceDocRef = doc(db, 'worlds', worldId, 'alliances', oldAllianceId);
                    const oldAllianceDoc = await transaction.get(oldAllianceDocRef);
                    if (oldAllianceDoc.exists()) {
                        const oldAllianceData = oldAllianceDoc.data();
                        const updatedMembers = oldAllianceData.members.filter(m => m.uid !== currentUser.uid);
                        transaction.update(oldAllianceDocRef, { members: updatedMembers });

                        const oldAllianceEventsRef = doc(collection(db, 'worlds', worldId, 'alliances', oldAllianceId, 'events'));
                        transaction.set(oldAllianceEventsRef, {
                            type: 'member_left',
                            text: `${userProfile.username} has left the alliance to join ${newAllianceData.name}.`,
                            timestamp: serverTimestamp(),
                        });
                    }
                }

                const newMembers = [...newAllianceData.members, { uid: currentUser.uid, username: userProfile.username, rank: 'Member' }];
                transaction.update(newAllianceDocRef, { members: newMembers });
                transaction.update(gameDocRef, { alliance: allianceId });

                const newAllianceEventsRef = doc(collection(db, 'worlds', worldId, 'alliances', allianceId, 'events'));
                transaction.set(newAllianceEventsRef, {
                    type: 'member_joined',
                    text: `${userProfile.username} has joined the alliance.`,
                    timestamp: serverTimestamp(),
                });

                for (const slotId of userCitySlotIds) {
                    const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', slotId);
                    transaction.update(citySlotRef, { alliance: allianceId, allianceName: newAllianceData.name });
                }

                transaction.delete(inviteDocRef);
            });
            clearMemberCache();
        } catch (error) {
            console.error("Error accepting invitation:", error);
            alert(`Failed to join alliance: ${error.message}`);
        }
    };

    const handleApplication = async (application, allianceId, action) => {
        if (!playerAlliance) throw new Error("You don't have permission to do this.");
        const member = playerAlliance.members.find(m => m.uid === currentUser.uid);
        const rank = playerAlliance.ranks.find(r => r.id === member?.rank);
        if (!rank?.permissions?.inviteMembers) {
            throw new Error("You don't have permission to do this.");
        }

        const allianceRef = doc(db, 'worlds', worldId, 'alliances', allianceId);
        const applicantGameRef = doc(db, `users/${application.userId}/games`, worldId);

        const citiesRef = collection(db, `users/${application.userId}/games`, worldId, 'cities');
        const citiesSnap = await getDocs(citiesRef);
        const userCitySlotIds = citiesSnap.docs.map(doc => doc.data().slotId);

        await runTransaction(db, async (transaction) => {
            const allianceDoc = await transaction.get(allianceRef);
            const applicantGameDoc = await transaction.get(applicantGameRef);

            if (!allianceDoc.exists()) throw new Error("Alliance data not found.");

            const allianceData = allianceDoc.data();

            const appToRemove = allianceData.applications?.find(app => app.userId === application.userId);
            if (appToRemove) {
                transaction.update(allianceRef, { applications: arrayRemove(appToRemove) });
            } else {
                return;
            }

            if (action === 'accept') {
                if (allianceData.banned?.some(b => b.uid === application.userId)) {
                    throw new Error("This player is banned from your alliance.");
                }
                if (!applicantGameDoc.exists()) throw new Error("Applicant's game data not found.");
                const applicantGameData = applicantGameDoc.data();
                if (applicantGameData.alliance) {
                    throw new Error("This player has already joined another alliance.");
                }

                const maxMembers = calculateMaxMembers(allianceData);
                if (allianceData.members.length >= maxMembers) {
                    throw new Error("This alliance is full and cannot accept new members.");
                }

                transaction.update(allianceRef, {
                    members: arrayUnion({ uid: application.userId, username: application.username, rank: 'Member' })
                });
                transaction.update(applicantGameRef, { alliance: allianceId });

                for (const slotId of userCitySlotIds) {
                    const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', slotId);
                    transaction.update(citySlotRef, { alliance: allianceId, allianceName: allianceData.name });
                }
            }
        });

        if (action === 'accept') {
            clearMemberCache();
        }
    };

    const kickAllianceMember = async (memberId) => {
        if (!playerAlliance) throw new Error("You are not in an alliance.");
        const memberToKick = playerAlliance.members.find(m => m.uid === memberId);
        if (!memberToKick) throw new Error("Member not found.");

        if (memberId === currentUser.uid) throw new Error("You cannot kick yourself.");
        if (memberId === playerAlliance.leader.uid) throw new Error("You cannot kick the leader.");

        const allianceRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
        const gameRef = doc(db, `users/${memberId}/games`, worldId);
        const citiesRef = collection(db, `users/${memberId}/games`, worldId, 'cities');
        const citiesSnap = await getDocs(citiesRef);
        const userCitySlotIds = citiesSnap.docs.map(doc => doc.data().slotId);

        await runTransaction(db, async (transaction) => {
            transaction.update(allianceRef, { members: arrayRemove(memberToKick) });
            transaction.update(gameRef, { alliance: null });
            for (const slotId of userCitySlotIds) {
                const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', slotId);
                transaction.update(citySlotRef, { alliance: null, allianceName: null });
            }
        });

        const allianceEventsRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'events');
        await addDoc(allianceEventsRef, {
            type: 'member_kicked',
            text: `${userProfile.username} has kicked ${memberToKick.username} from the alliance.`,
            timestamp: serverTimestamp(),
        });

        const messageText = `You have been kicked from the alliance "${playerAlliance.name}" by ${userProfile.username}.`;
        await sendSystemMessage(memberId, memberToKick.username, messageText, worldId);

        clearMemberCache();
    };

    const banAllianceMember = async (memberId) => {
        if (!playerAlliance) throw new Error("You are not in an alliance.");
        const memberToBan = playerAlliance.members.find(m => m.uid === memberId);
        if (!memberToBan) throw new Error("Member not found.");

        if (memberId === currentUser.uid) throw new Error("You cannot ban yourself.");
        if (memberId === playerAlliance.leader.uid) throw new Error("You cannot ban the leader.");

        const allianceRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
        const gameRef = doc(db, `users/${memberId}/games`, worldId);
        const citiesRef = collection(db, `users/${memberId}/games`, worldId, 'cities');
        const citiesSnap = await getDocs(citiesRef);
        const userCitySlotIds = citiesSnap.docs.map(doc => doc.data().slotId);

        await runTransaction(db, async (transaction) => {
            transaction.update(allianceRef, {
                members: arrayRemove(memberToBan),
                banned: arrayUnion({ uid: memberToBan.uid, username: memberToBan.username })
            });
            transaction.update(gameRef, { alliance: null });
            for (const slotId of userCitySlotIds) {
                const citySlotRef = doc(db, 'worlds', worldId, 'citySlots', slotId);
                transaction.update(citySlotRef, { alliance: null, allianceName: null });
            }
        });

        const allianceEventsRef = collection(db, 'worlds', worldId, 'alliances', playerAlliance.id, 'events');
        await addDoc(allianceEventsRef, {
            type: 'member_banned',
            text: `${userProfile.username} has banned ${memberToBan.username} from the alliance.`,
            timestamp: serverTimestamp(),
        });

        const messageText = `You have been banned from the alliance "${playerAlliance.name}" by ${userProfile.username}.`;
        await sendSystemMessage(memberId, memberToBan.username, messageText, worldId);

        clearMemberCache();
    };


    const createAllianceRank = async (rank) => {
        if (!playerAlliance || playerAlliance.leader.uid !== currentUser.uid) return;

        const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
        const newRanks = [...playerAlliance.ranks, rank];
        await updateDoc(allianceDocRef, { ranks: newRanks });
    };

    const updateAllianceMemberRank = async (memberId, newRankId) => {
        if (!playerAlliance || playerAlliance.leader.uid !== currentUser.uid) return;

        const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
        const updatedMembers = playerAlliance.members.map(member =>
            member.uid === memberId ? { ...member, rank: newRankId } : member
        );
        await updateDoc(allianceDocRef, { members: updatedMembers });
    };

    const updateRanksOrder = async (newRanks) => {
        if (!playerAlliance || playerAlliance.leader.uid !== currentUser.uid) {
            throw new Error("You don't have permission to do this.");
        }
        const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);
        await updateDoc(allianceDocRef, { ranks: newRanks });
    };

    const updateAllianceRank = async (rankId, updatedRankData) => {
        if (!playerAlliance || playerAlliance.leader.uid !== currentUser.uid) {
            throw new Error("You don't have permission to do this.");
        }
        const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);

        const newRanks = playerAlliance.ranks.map(rank =>
            rank.id === rankId ? { ...rank, ...updatedRankData, id: updatedRankData.name, name: updatedRankData.name } : rank
        );

        const updatedMembers = playerAlliance.members.map(member =>
            member.rank === rankId ? { ...member, rank: updatedRankData.name } : member
        );

        await updateDoc(allianceDocRef, { ranks: newRanks, members: updatedMembers });
    };

    const deleteAllianceRank = async (rankId) => {
        if (!playerAlliance || playerAlliance.leader.uid !== currentUser.uid) {
            throw new Error("You don't have permission to do this.");
        }
        const allianceDocRef = doc(db, 'worlds', worldId, 'alliances', playerAlliance.id);

        if (playerAlliance.members.some(m => m.rank === rankId)) {
            throw new Error("Cannot delete rank as it is still assigned to members.");
        }

        const newRanks = playerAlliance.ranks.filter(rank => rank.id !== rankId);

        await updateDoc(allianceDocRef, { ranks: newRanks });
    };

    return { sendAllianceInvitation, revokeAllianceInvitation, acceptAllianceInvitation, declineAllianceInvitation, handleApplication, kickAllianceMember, banAllianceMember, createAllianceRank, updateAllianceMemberRank, updateRanksOrder, updateAllianceRank, deleteAllianceRank };
};

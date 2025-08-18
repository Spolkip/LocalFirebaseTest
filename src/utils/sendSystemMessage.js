import { collection, query, where, getDocs, doc, setDoc, addDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from '../firebase/config';

export const sendSystemMessage = async (targetUserId, targetUsername, messageText, worldId) => {
    const systemId = 'system';
    const systemUsername = 'System';

    // #comment Use a sorted array for a consistent document ID/query
    const participants = [systemId, targetUserId].sort();
    const conversationQuery = query(
        collection(db, 'worlds', worldId, 'conversations'),
        where('participants', '==', participants)
    );
    const conversationSnapshot = await getDocs(conversationQuery);

    let conversationRef;
    if (conversationSnapshot.empty) {
        conversationRef = doc(collection(db, 'worlds', worldId, 'conversations'));
        await setDoc(conversationRef, {
            participants: participants,
            participantUsernames: {
                [systemId]: systemUsername,
                [targetUserId]: targetUsername,
            },
            lastMessage: { text: messageText.substring(0, 30) + '...', senderId: systemId, timestamp: serverTimestamp() },
            readBy: [], // #comment Initialize as unread for the target
        });
    } else {
        conversationRef = conversationSnapshot.docs[0].ref;
    }

    // #comment Add the actual message to the subcollection
    await addDoc(collection(conversationRef, 'messages'), {
        text: messageText,
        senderId: systemId,
        senderUsername: systemUsername,
        isSystem: true,
        timestamp: serverTimestamp(),
    });

    // #comment Update the conversation's last message and mark as unread for the recipient
    await updateDoc(conversationRef, {
        lastMessage: { text: messageText.substring(0, 30) + '...', senderId: systemId, timestamp: serverTimestamp() },
        readBy: [], // #comment Reset readBy to ensure it appears as a new message
    });
};

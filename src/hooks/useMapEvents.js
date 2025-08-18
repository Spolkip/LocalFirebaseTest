// src/hooks/useMapEvents.js
import { useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

/**
 * #comment Manages event listeners and side effects for the MapView.
 */
export const useMapEvents = (currentUser, worldId, setUnreadReportsCount, setUnreadMessagesCount) => {
    useEffect(() => {
        if (!currentUser || !worldId) return;

        // #comment Listener for unread reports
        const reportsQuery = query(collection(db, 'users', currentUser.uid, 'worlds', worldId, 'reports'), where('read', '==', false));
        const unsubscribeReports = onSnapshot(reportsQuery, (snapshot) => {
            setUnreadReportsCount(snapshot.size);
        });

        // #comment Listener for unread messages
        const conversationsQuery = query(
            collection(db, 'worlds', worldId, 'conversations'),
            where('participants', 'array-contains', currentUser.uid)
        );
        const unsubscribeMessages = onSnapshot(conversationsQuery, (snapshot) => {
            let unreadCount = 0;
            snapshot.forEach(doc => {
                const convo = doc.data();
                if (convo.lastMessage && convo.lastMessage.senderId !== currentUser.uid && !convo.readBy.includes(currentUser.uid)) {
                    unreadCount++;
                }
            });
            setUnreadMessagesCount(unreadCount);
        });

        return () => {
            unsubscribeReports();
            unsubscribeMessages();
        };
    }, [currentUser, worldId, setUnreadReportsCount, setUnreadMessagesCount]);
};

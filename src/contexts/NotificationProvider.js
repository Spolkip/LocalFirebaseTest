import React, { useState, useCallback, useRef } from 'react';
import NotificationContext from './NotificationContext';
import Notification from '../components/shared/Notification';
import { v4 as uuidv4 } from 'uuid';

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);
    const recentNotifications = useRef(new Set());

    const addNotification = useCallback((message) => {
        // #comment Prevent the same notification from appearing in rapid succession
        if (recentNotifications.current.has(message)) {
            return;
        }

        const id = uuidv4();
        setNotifications(prev => [...prev, { id, message }]);
        recentNotifications.current.add(message);

        // #comment Remove the message from the recent set after a short delay to allow it to be shown again later
        setTimeout(() => {
            recentNotifications.current.delete(message);
        }, 2000); // 2-second cooldown for the same message
    }, []);

    const removeNotification = useCallback((id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    return (
        <NotificationContext.Provider value={{ addNotification }}>
            {children}
            <div className="fixed bottom-5 right-5 z-[100]">
                {notifications.map(notification => (
                    <Notification
                        key={notification.id}
                        message={notification.message}
                        onClose={() => removeNotification(notification.id)}
                    />
                ))}
            </div>
        </NotificationContext.Provider>
    );
};

import React, { useEffect, useState, useCallback } from 'react';
import './Notification.css';
import archerIcon from '../../images/troops/archers.png';

const Notification = ({ message, onClose }) => {
    const [visible, setVisible] = useState(true);

    const handleClose = useCallback(() => {
        setVisible(false);
        // #comment Wait for the hide animation to finish before removing the component
        setTimeout(() => {
            onClose();
        }, 400);
    }, [onClose]);

    useEffect(() => {
        // #comment Automatically close the notification after 5 seconds
        const timer = setTimeout(() => {
            handleClose();
        }, 5000);

        return () => clearTimeout(timer);
    }, [handleClose]);

    return (
        <div className={`notification-container ${visible ? 'show' : ''}`}>
            <div className="notification-icon-container">
                <img src={archerIcon} alt="Notification Icon" className="notification-icon" />
            </div>
            <div className="notification-content">
                <p>{message}</p>
            </div>
            <button onClick={handleClose} className="notification-close-btn">&times;</button>
        </div>
    );
};

export default Notification;

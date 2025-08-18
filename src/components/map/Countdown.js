// src/components/map/Countdown.js
import React, { useState, useEffect } from 'react';

// #comment Displays a live countdown to a specific time.
const Countdown = ({ arrivalTime }) => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        // #comment Safely converts various timestamp formats into a JS Date object.
        const getSafeDate = (timestamp) => {
            if (!timestamp) return null;
            // Handles live Firestore Timestamp objects
            if (typeof timestamp.toDate === 'function') {
                return timestamp.toDate();
            }
            // Handles serialized Firestore Timestamps (plain objects)
            if (timestamp.seconds && typeof timestamp.seconds === 'number') {
                return new Date(timestamp.seconds * 1000);
            }
            // Handles JS Dates or millisecond numbers
            return new Date(timestamp);
        };

        const arrival = getSafeDate(arrivalTime);

        // #comment If the date is invalid or in the past, show 'Completed'.
        if (!arrival || isNaN(arrival.getTime())) {
            setTimeLeft('Completed');
            return;
        }

        const calculateTimeLeft = () => {
            const now = new Date();
            const difference = arrival - now;

            if (difference > 0) {
                const totalSeconds = Math.ceil(difference / 1000);
                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const seconds = totalSeconds % 60;
                setTimeLeft(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
            } else {
                setTimeLeft('Completed');
            }
        };

        calculateTimeLeft();
        const interval = setInterval(calculateTimeLeft, 1000);

        return () => clearInterval(interval);
    }, [arrivalTime]);

    return <span>{timeLeft}</span>;
};

export default Countdown;

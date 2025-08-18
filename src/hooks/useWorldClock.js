// src/hooks/useWorldClock.js
import { useEffect } from 'react';
import { db } from '../firebase/config';
import { doc, writeBatch, serverTimestamp } from 'firebase/firestore';

/**
 * #comment A custom hook to manage the world's season and weather updates.
 */
export const useWorldClock = (worldId, worldState) => {
    useEffect(() => {
        const checkForSeasonAndWeatherUpdate = async () => {
            if (!worldState) return;

            const now = new Date();
            const worldDocRef = doc(db, 'worlds', worldId);
            const batch = writeBatch(db);
            let needsUpdate = false;

            const seasons = ['Spring', 'Summer', 'Autumn', 'Winter'];
            const weathers = ['Clear', 'Rainy', 'Windy', 'Foggy', 'Stormy'];

            // #comment season changes every 7 days
            const seasonDuration = 7 * 24 * 60 * 60 * 1000;
            const lastSeasonUpdate = worldState.seasonLastUpdate?.toDate() || new Date(0);
            if (now.getTime() - lastSeasonUpdate.getTime() > seasonDuration) {
                const currentSeasonIndex = seasons.indexOf(worldState.season || 'Winter');
                const nextSeason = seasons[(currentSeasonIndex + 1) % seasons.length];
                batch.update(worldDocRef, { season: nextSeason, seasonLastUpdate: serverTimestamp() });
                needsUpdate = true;
            }

            // #comment weather changes every 3 hours
            const weatherDuration = 3 * 60 * 60 * 1000;
            const lastWeatherUpdate = worldState.weatherLastUpdate?.toDate() || new Date(0);
            if (now.getTime() - lastWeatherUpdate.getTime() > weatherDuration) {
                const nextWeather = weathers[Math.floor(Math.random() * weathers.length)];
                batch.update(worldDocRef, { weather: nextWeather, weatherLastUpdate: serverTimestamp() });
                needsUpdate = true;
            }

            if (needsUpdate) {
                try {
                    await batch.commit();
                    console.log("Season/Weather updated by client check.");
                } catch (error) {
                    console.error("Error updating season/weather: ", error);
                }
            }
        };

        checkForSeasonAndWeatherUpdate();
    }, [worldId, worldState]);
};

// src/utils/travel.js
/**
 * Calculates the Euclidean distance between two points (cities).
 * @param {object} cityA - The starting city with x, y coordinates.
 * @param {object} cityB - The destination city with x, y coordinates.
 * @returns {number} The distance between the two cities in map tiles.
 */
export function calculateDistance(cityA, cityB) {
    if (!cityA || !cityB) return 0;
    const dx = cityA.x - cityB.x;
    const dy = cityA.y - cityB.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculates the travel time in seconds based on distance, speed, and conditions.
 * @param {number} distance - The distance to travel.
 * @param {number} speed - The base speed of the slowest unit.
 * @param {string|null} mode - The type of movement.
 * @param {object|null} worldState - The current state of the world (for season/weather).
 * @param {Array<string>} unitTypes - An array of unit types in the army ('land', 'naval').
 * @param {number} windSpeed - A random wind speed value (0-10) based on weather.
 * @returns {number} The travel time in seconds.
 */
export function calculateTravelTime(distance, speed, mode = null, worldState = null, unitTypes = [], windSpeed = 0) {
    // #comment Special fast calculation for scout and trade modes
    if (mode === 'scout' || mode === 'trade') {
        const minTime = 15; // 15 seconds minimum
        const maxTime = 300; // 5 minutes maximum
        const timePerTile = 15; // 15 seconds per tile, making nearby islands very fast to reach
        return Math.max(minTime, Math.min(maxTime, distance * timePerTile));
    }

    let modifiedSpeed = speed;
    const hasLand = unitTypes.includes('land');
    const hasNaval = unitTypes.includes('naval');
    const hasFlying = unitTypes.includes('flying');

    if (worldState) {
        // #comment Season effects on LAND units
        if (hasLand) {
            switch(worldState.season) {
                case 'Summer':
                    modifiedSpeed *= 1.1; // 10% faster on dry summer roads
                    break;
                case 'Winter':
                    modifiedSpeed *= 0.8; // 20% slower in snow/mud
                    break;
                default: // Spring, Autumn
                    break;
            }
        }

        // #comment Weather effects on units
        if (hasNaval || hasFlying) {
            // #comment Wind speed modifier for naval units.
            // A speed of 5 is neutral. Lower is a headwind (slower), higher is a tailwind (faster).
            // Max headwind (0 knots) = -25% speed. Max tailwind (10 knots) = +25% speed.
            const windModifier = 1 + ((windSpeed - 5) / 10) * 0.5; // Ranges from 0.75 to 1.25
            modifiedSpeed *= windModifier;
        }

        switch(worldState.weather) {
            case 'Rainy':
                if (hasLand) modifiedSpeed *= 0.9; // 10% slower on muddy ground
                break;
            case 'Stormy':
                // #comment Storms have a general large penalty on top of wind effects
                if (hasNaval || hasFlying) modifiedSpeed *= 0.8; // Additional 20% penalty
                if (hasLand) modifiedSpeed *= 0.8;
                break;
            case 'Foggy':
                modifiedSpeed *= 0.75; // 25% slower for everyone due to low visibility
                break;
            default: // Clear, Windy
                break;
        }
    }

    // Regular calculation for other movements
    if (modifiedSpeed <= 0) return Infinity;
    const worldSpeedFactor = 5;
    const hours = distance / (modifiedSpeed * worldSpeedFactor);
    return hours * 3600; // Convert hours to seconds
}


/**
 * Formats a duration in seconds into a readable HH:MM:SS format.
 * @param {number} totalSeconds - The total seconds to format.
 * @returns {string} The formatted time string.
 */
export function formatTravelTime(totalSeconds) {
    if (totalSeconds === Infinity) return 'N/A';
    if (isNaN(totalSeconds)) return 'Invalid Time';

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    const pad = (num) => num.toString().padStart(2, '0');

    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

// src/utils/worldGeneration.js

// Add a list of available island images
const islandImages = ['island_1.png'];

// INDICATORS:
// You can manually adjust the coordinates for city and village placements for each island image here.
// The 'x' and 'y' values are relative to the center of the island image.
// Positive 'x' is to the right, negative 'x' is to the left.
// Positive 'y' is down, negative 'y' is up.
const islandLayouts = {
    'island_1.png': {
        citySlots: [
            { x: -1, y: 4 },    // Bottom bay
            { x: 5, y: 1 },    // Right side
            { x: 2, y: 5 },    // Bottom right
            { x: 5, y: -1 },   // Far right peninsula
            { x: -6, y: 1 },   // Far left
            { x: -6, y: 1 },   // Left side
            { x: -3, y: 1 },   // Bottom left
            { x: -6, y: -2 },  // Far left top
            { x: 4, y: -4 },   // Top right
            { x: 0, y: -5 }    // Top middle
        ],
        villages: [
            { x: -3, y: -1 }, { x: 1, y: -1}, { x: 4, y: -1 }, { x: 0, y: 0}, { x:-2, y: 0}
        ]
    },
};


export const generateIslands = (width, height, count) => {
    const islands = [];
    const minMargin = 10; // Margin between islands
    const maxMargin = 12; // Margin between islands
    const mapEdgeMargin = 10; // Margin from the map edge
    const maxAttempts = 20;

    // If only one island is to be generated, create a large central one.
    if (count === 1) {
        const radius = Math.min(width, height) / 2.5; // Make it large
        islands.push({
            id: `island-0`,
            name: `The Central Isle`,
            x: Math.floor(width / 2),
            y: Math.floor(height / 2),
            radius: radius,
            imageName: islandImages[Math.floor(Math.random() * islandImages.length)],
        });
        return islands;
    }

    const checkCollision = (newIsland, existingIslands) => {
        for (const existing of existingIslands) {
            const distance = Math.sqrt(
                Math.pow(newIsland.x - existing.x, 2) +
                Math.pow(newIsland.y - existing.y, 2)
            );
            const margin = minMargin + Math.random() * (maxMargin - minMargin);
            if (distance < newIsland.radius + existing.radius + margin) {
                return true;
            }
        }
        return false;
    };

    for (let i = 0; i < count; i++) {
        let island = {};
        let hasCollision = true;
        let attempts = 0;

        while (hasCollision && attempts < maxAttempts) {
            const radius = Math.random() * 2 + 6; // Radius between 6 and 8 tiles

            // Calculate spawnable area, considering map edge margin and island radius
            const spawnableWidth = width - (mapEdgeMargin * 2) - (radius * 2);
            const spawnableHeight = height - (mapEdgeMargin * 2) - (radius * 2);

            if (spawnableWidth <= 0 || spawnableHeight <= 0) {
                // This can happen if the map is too small for the margins and islands
                console.error("Map is too small to generate islands with the specified margins.");
                break; // Exit the while loop
            }

            // Calculate random coordinates within the spawnable area
            const randomX = Math.floor(Math.random() * spawnableWidth);
            const randomY = Math.floor(Math.random() * spawnableHeight);

            island = {
                id: `island-${Date.now()}-${i}`,
                name: `Island ${i + 1}`,
                // Offset coordinates by the margin and radius
                x: mapEdgeMargin + radius + randomX,
                y: mapEdgeMargin + radius + randomY,
                radius: radius,
                imageName: islandImages[Math.floor(Math.random() * islandImages.length)],
            };
            hasCollision = checkCollision(island, islands);
            attempts++;
        }

        if (!hasCollision) {
            islands.push(island);
        }
    }
    return islands;
};

export const generateCitySlots = (islands, worldWidth, worldHeight) => {
    const citySlots = {};
    let slotIndex = 0;

    islands.forEach(island => {
        const layout = islandLayouts[island.imageName];
        if (layout) {
            // Use predefined layout for cities
            layout.citySlots.forEach(relativePos => {
                const x = Math.round(island.x + relativePos.x);
                const y = Math.round(island.y + relativePos.y);

                if (x >= 0 && x < worldWidth && y >= 0 && y < worldHeight) {
                    const slotId = `${island.id}-slot-${slotIndex++}`;
                    citySlots[slotId] = {
                        islandId: island.id,
                        x,
                        y,
                        ownerId: null,
                        cityName: 'Unclaimed',
                        ownerEmail: null,
                        ownerUsername: null,
                        ownerFaction: null
                    };
                }
            });
        }
        // NOTE: The procedural fallback has been removed to ensure consistency.
        // If an island image does not have a layout in islandLayouts, it will not have cities.
    });

    return citySlots;
};


function generateVillageTroops(level) {
    return { swordsman: 15, archer: 10 };
}

const villageNames = [
    "Oakhaven", "Willow Creek", "Stonebridge", "Riverbend", "Greenfield", "Fairview",
    "Maplewood", "Pinehurst", "Cedarbrook", "Elmwood", "Ashworth", "Birchwood",
    "Silver Creek", "Goldcrest", "Ironwood", "Copperhill", "Crystal Falls", "Amberwood"
];


export const generateFarmingVillages = (islands, citySlots, worldWidth, worldHeight) => {
    const villages = {};
    const occupiedSlots = new Set(Object.values(citySlots).map(slot => `${slot.x},${slot.y}`));
    let villageIndex = 0;

    const demandCooldowns = [300, 1200, 5400, 14400];

    islands.forEach(island => {
        const layout = islandLayouts[island.imageName];
        if (layout) {
            // Use predefined layout for villages
            layout.villages.forEach(relativePos => {
                const x = Math.round(island.x + relativePos.x);
                const y = Math.round(island.y + relativePos.y);
                if (occupiedSlots.has(`${x},${y}`)) return;

                const villageId = `v${island.id}-${villageIndex++}`;
                const resources = ['wood', 'stone', 'silver'];
                let demands = resources.splice(Math.floor(Math.random() * resources.length), 1)[0];
                let supplies = resources.splice(Math.floor(Math.random() * resources.length), 1)[0];

                villages[villageId] = {
                    id: villageId, x, y, islandId: island.id, name: villageNames[Math.floor(Math.random() * villageNames.length)],
                    level: 1, demandYield: { wood: 50, stone: 50, silver: 20 },
                    resources: { wood: 500, stone: 500, silver: 500 }, maxResources: 1200, lastDemandTime: 0,
                    demandCooldown: demandCooldowns[Math.floor(Math.random() * demandCooldowns.length)],
                    troops: generateVillageTroops(1), tradeRatio: 1.25, demands, supplies
                };
                occupiedSlots.add(`${x},${y}`);
            });
        } else {
            // Fallback procedural generation for inland villages
            const centerX = Math.round(island.x);
            const centerY = Math.round(island.y);
            const numVillages = Math.min(Math.floor(island.radius), 5);
            for (let i = 0; i < numVillages; i++) {
                const angle = Math.random() * 2 * Math.PI;
                const distance = Math.random() * (island.radius - 3); // Place away from the edge
                const x = Math.round(centerX + distance * Math.cos(angle));
                const y = Math.round(centerY + distance * Math.sin(angle));

                if (!occupiedSlots.has(`${x},${y}`)) {
                    const villageId = `v${island.id}-${i}`;
                    villages[villageId] = { id: villageId, x, y, islandId: island.id, name: "Inland Hamlet", level: 1, /* ... other properties */ };
                    occupiedSlots.add(`${x},${y}`);
                }
            }
        }
    });

    return villages;
};

// Generates ruins in water tiles
export const generateRuins = (islands, worldWidth, worldHeight) => {
    const ruins = {};
    const ruinCount = Math.floor((worldWidth * worldHeight) / 500); // Adjust density as needed
    const minDistanceFromLand = 3; // Minimum tiles away from any land tile

    const isLand = (x, y) => {
        for (const island of islands) {
            const distSq = Math.pow(x - island.x, 2) + Math.pow(y - island.y, 2);
            if (distSq <= Math.pow(island.radius + minDistanceFromLand, 2)) {
                return true;
            }
        }
        return false;
    };

    for (let i = 0; i < ruinCount; i++) {
        let x, y;
        let attempts = 0;
        do {
            x = Math.floor(Math.random() * worldWidth);
            y = Math.floor(Math.random() * worldHeight);
            attempts++;
        } while (isLand(x, y) && attempts < 100);

        if (attempts < 100) {
            const ruinId = `ruin-${x}-${y}`;
            ruins[ruinId] = {
                id: ruinId,
                x,
                y,
                name: "Forgotten Ruins",
                type: 'ruin', // To distinguish from villages
                troops: {
                    hoplite: 100 + Math.floor(Math.random() * 50),
                    cavalry: 50 + Math.floor(Math.random() * 25),
                    trireme: 20 + Math.floor(Math.random() * 10) // Naval defense
                },
                researchReward: `qol_research_${i % 3}` // Example reward cycles through the 3 QoL researches
            };
        }
    }
    return ruins;
};

export const generateGodTowns = (islands, worldWidth, worldHeight, count = 1) => {
    const godTowns = {};
    const minDistanceFromLand = 5;
    const transformationDuration = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    const isLand = (x, y) => {
        for (const island of islands) {
            const distSq = Math.pow(x - island.x, 2) + Math.pow(y - island.y, 2);
            if (distSq <= Math.pow(island.radius + minDistanceFromLand, 2)) {
                return true;
            }
        }
        return false;
    };

    for (let i = 0; i < count; i++) {
        let x, y;
        let attempts = 0;
        do {
            x = Math.floor(Math.random() * worldWidth);
            y = Math.floor(Math.random() * worldHeight);
            attempts++;
        } while (isLand(x, y) && attempts < 100);

        if (attempts < 100) {
            const townId = `god-town-${Date.now()}-${i}`;
            const spawnTime = new Date();
            godTowns[townId] = {
                id: townId,
                x,
                y,
                name: "Strange Ruins",
                stage: "ruins",
                puzzleId: `puzzle_${(i % 3) + 1}`,
                troops: { 
                    'manticore': 500,
                    'medusa': 500,
                    'pegasus': 500,
                    'sphinx': 500,
                    'phoenix': 500,
                    'serpopard': 500
                },
                spawnTime: spawnTime,
                transformationTime: new Date(spawnTime.getTime() + transformationDuration),
            };
        }
    }
    return godTowns;
};

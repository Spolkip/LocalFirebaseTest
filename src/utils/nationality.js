// src/utils/nationality.js
import unitConfig from '../gameData/units.json';

const nationUnitMap = {
    'Athenian': {
        'swordsman': 'swordsman_athenian',
        'archer': 'archer_athenian',
        'hoplite': 'hoplite_athenian',
        'cavalry': 'cavalry_athenian',
        'trireme': 'trireme_athenian'
    },
    'Spartan': {
        'swordsman': 'swordsman_spartan',
        'archer': 'archer_spartan',
        'hoplite': 'hoplite_spartan',
        'cavalry': 'cavalry_spartan',
        'trireme': 'trireme_spartan'
    },
    'Corinthian': {
        'swordsman': 'swordsman_corinthian',
        'archer': 'archer_corinthian',
        'hoplite': 'hoplite_corinthian',
        'cavalry': 'cavalry_corinthian',
        'trireme': 'trireme_corinthian'
    },
    'Julian': {
        'swordsman': 'swordsman_roman',
        'archer': 'archer_roman',
        'hoplite': 'hoplite_roman',
        'cavalry': 'cavalry_roman',
        'trireme': 'trireme_roman'
    },
    'Cornelian': {
        'swordsman': 'swordsman_roman',
        'archer': 'archer_roman',
        'hoplite': 'hoplite_roman',
        'cavalry': 'cavalry_roman',
        'trireme': 'trireme_roman'
    },
    'Fabian': {
        'swordsman': 'swordsman_roman',
        'archer': 'archer_roman',
        'hoplite': 'hoplite_roman',
        'cavalry': 'cavalry_roman',
        'trireme': 'trireme_roman'
    }
};

export const getNationalUnitId = (nation, genericUnitType) => {
    return nationUnitMap[nation]?.[genericUnitType] || null;
};

// #comment Gets the specific unit ID for a reward based on a player's nation
export const getNationalUnitReward = (nation, genericUnitType) => {
    // Map Roman nations to a single unit set
    let effectiveNation = nation;
    if (['Julian', 'Cornelian', 'Fabian'].includes(nation)) {
        effectiveNation = 'Julian';
    }
    
    // Convert generic unit type (e.g., 'generic_archer') to base type ('archer')
    const baseType = genericUnitType.replace('generic_', '');
    
    // Look up the specific unit ID in the map
    return nationUnitMap[effectiveNation]?.[baseType] || baseType;
};

// #comment Helper to find the generic type of a national unit
export const getGenericUnitType = (nationalUnitId) => {
    for (const nation in nationUnitMap) {
        for (const genericType in nationUnitMap[nation]) {
            if (nationUnitMap[nation][genericType] === nationalUnitId) {
                return genericType;
            }
        }
    }
    return null; 
};


export const getTrainableUnits = (nation) => {
    const nationalUnits = Object.keys(unitConfig).filter(id => {
        const unit = unitConfig[id];
        // #comment Ensure we only get LAND units that are nation-specific
        if (unit.nation && unit.type === 'land') {
            if (['Julian', 'Cornelian', 'Fabian'].includes(nation)) {
                return unit.nation === 'Julian';
            }
            return unit.nation === nation;
        }
        return false;
    });

    // #comment Return only the national units, excluding the generic ones.
    return nationalUnits;
};

export const getTrainableNavalUnits = (nation) => {
    const nationalUnits = Object.keys(unitConfig).filter(id => {
        const unit = unitConfig[id];
        // #comment Make sure we only get nation-specific NAVAL units
        if (unit.nation && unit.type === 'naval') {
            if (['Julian', 'Cornelian', 'Fabian'].includes(nation)) {
                return unit.nation === 'Julian';
            }
            return unit.nation === nation;
        }
        return false;
    });

    // #comment Add generic NAVAL units that are not nation-specific
    const genericUnits = Object.keys(unitConfig).filter(id => {
        const unit = unitConfig[id];
        return !unit.nation && !unit.mythical && unit.type === 'naval';
    });
    
    return [...new Set([...nationalUnits, ...genericUnits])];
};

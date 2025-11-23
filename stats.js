// --- GLOBAL STATISTICS ---
const STATS = {
    'pasta_boiled': { label: 'Pasta Water Boiled (L)', value: 0, category: 'Logistics' },
    'axis_fuel_evap': { label: 'Axis Fuel Evaporated (L)', value: 0, category: 'Logistics' },
    'cw_fuel_evap': { label: 'CW Fuel Evaporated (L)', value: 0, category: 'Logistics' },
    'breakdowns': { label: 'Mechanical Breakdowns', value: 0, category: 'Maintenance' },
    'repairs': { label: 'Field Repairs Completed', value: 0, category: 'Maintenance' },
    'ghibli_days': { label: 'Days of Sandstorm', value: 0, category: 'Weather' },
    'loc_failures': { label: 'LOC Failures', value: 0, category: 'Supply' },
    'stores_consumed': { label: 'Stores Consumed (Tons)', value: 0, category: 'Logistics' },
    'combat_engagements': { label: 'Combat Engagements', value: 0, category: 'Combat' },
    'italian_morale_failures': { label: 'Italian Morale Failures', value: 0, category: 'Morale' }
};

let GLOBAL_GAME_REF = null;


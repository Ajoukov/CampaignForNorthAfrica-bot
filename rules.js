// --- GAME RULES ---

const Rule_Pasta = {
    citation: '[Case 52.6]',
    execute: (unit) => {
        if (unit.nationality !== 'ITALIAN') return;
        
        if (Math.random() < 0.1) {
            const required = 10;
            if (unit.supplies.water >= required) {
                unit.supplies.water -= required;
                STATS.pasta_boiled.value += required;
                logger.log('[Case 52.6]', `Italian unit ${unit.name} boils pasta. Water reserves depleted by ${required}L.`);
            } else {
                unit.cohesion -= 15;
                STATS.italian_morale_failures.value++;
                logger.log('[Case 52.6]', `DISASTER: ${unit.name} lacks water for pasta! Cohesion collapses.`, 'CRITICAL');
            }
        }
    }
};

const Rule_Evaporation = {
    citation: '[Case 44.3]',
    execute: (unit, weatherTemp) => {
        let rate = (unit.faction === 'AXIS') ? 0.03 : 0.07;
        if (weatherTemp > 35) rate *= 1.5;
        
        const loss = Math.ceil(unit.supplies.fuel * rate);
        if (loss > 0) {
            unit.supplies.fuel = Math.max(0, unit.supplies.fuel - loss);
            
            if (unit.faction === 'AXIS') {
                STATS.axis_fuel_evap.value += loss;
            } else {
                STATS.cw_fuel_evap.value += loss;
            }
            
            if (Math.random() < 0.05) {
                logger.log('[Case 44.3]', `${unit.faction} fuel evaporation: ${loss}L lost to heat (${Math.floor(weatherTemp)}°C).`);
            }
        }
    }
};

const Rule_Breakdown = {
    citation: '[Case 12.0]',
    execute: (unit, terrain) => {
        if (unit.status === 'BROKEN') return;
        
        let risk = 0.01;
        if (terrain === 'ROUGH') risk = 0.05;
        if (terrain === 'ESCARPMENT') risk = 0.15;
        
        if (Math.random() < risk) {
            unit.status = 'BROKEN';
            STATS.breakdowns.value++;
            logger.log('[Case 12.0]', `${unit.name} suffers mechanical failure in ${terrain}.`, 'WARN');
        }
    }
};

const Rule_LOC = {
    citation: '[Case 31.2]',
    execute: (unit, dumps) => {
        let valid = false;
        
        for (let dump of dumps) {
            if (dump.faction !== unit.faction) continue;
            
            const d = Math.sqrt(Math.pow(unit.q - dump.q, 2) + Math.pow(unit.r - dump.r, 2));
            if (d < 20) { 
                valid = true; 
                break; 
            }
        }
        
        if (!valid) {
            STATS.loc_failures.value++;
            unit.cohesion -= 2;
            
            if (Math.random() < 0.05) {
                logger.log('[Case 31.2]', `${unit.name} is OUT OF SUPPLY. LOC severed.`, 'WARN');
            }
        }
    }
};

const Rule_Ghibli = {
    citation: '[Case 91.0]',
    execute: (weather) => {
        if (!weather.ghibli && weather.temp > 30 && Math.random() < 0.05) {
            weather.ghibli = true;
            STATS.ghibli_days.value++;
            logger.log('[Case 91.0]', `METEOROLOGICAL ALERT: Ghibli (Sandstorm) begins. Visibility 0.`, 'WARN');
        } else if (weather.ghibli && Math.random() < 0.2) {
            weather.ghibli = false;
            logger.log('[Case 91.0]', `Ghibli subsides. Air operations may resume.`);
        }
    }
};


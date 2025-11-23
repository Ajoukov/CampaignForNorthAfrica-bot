// ============================================================================
// CAMPAIGN FOR NORTH AFRICA - ADVANCED RULES (Sections 16-30)
// ============================================================================
// Implementation of advanced land game rules
// ============================================================================

// ============================================================================
// [16.0] PATROLS AND RECONNAISSANCE
// ============================================================================

class PatrolsAndReconnaissance {
    // [16.1] Which Units May Patrol
    static canPatrol(unit) {
        // Reconnaissance, armored car, and tank units can patrol
        return unit.type === CNA_Rules.UnitType.RECCE_BN || 
               unit.type === CNA_Rules.UnitType.TANK_BN ||
               (unit.characteristics && unit.characteristics.cpa >= 20);
    }
    
    // [16.2] Restrictions on Patrolling
    static checkPatrolRestrictions(unit, gameState) {
        if (unit.status !== 'ACTIVE') return { canPatrol: false, reason: 'Unit not active' };
        if (unit.cohesionLevel < -15) return { canPatrol: false, reason: 'Cohesion too low' };
        
        // Weather restrictions
        if (gameState.weather.ghibli) return { canPatrol: false, reason: 'Sandstorm' };
        
        return { canPatrol: true };
    }
    
    // [16.3-16.5] Execute Patrol
    static executePatrol(unit, targetHex, gameState) {
        const result = {
            survival: false,
            information: null,
            losses: 0,
            dummyDetected: false
        };
        
        // [16.6] Patrol Survival Table
        const survivalRoll = Math.floor(Math.random() * 10) + 1;
        const moraleMod = unit.morale || 0;
        
        if (survivalRoll + moraleMod >= 5) {
            result.survival = true;
            
            // [16.7] Reconnaissance Table
            const reconRoll = Math.floor(Math.random() * 10) + 1;
            
            if (reconRoll >= 7) {
                // Successful reconnaissance
                const targetHexData = gameState.map[targetHex.q][targetHex.r];
                const enemyUnits = targetHexData.units.filter(u => u.faction !== unit.faction);
                
                result.information = {
                    enemyPresent: enemyUnits.length > 0,
                    estimatedStrength: this.estimateStrength(enemyUnits),
                    terrain: targetHexData.type,
                    fortifications: targetHexData.fortificationLevel || 0
                };
                
                // [16.4] Dummy Tank Formation detection
                if (targetHexData.dummyFormation && reconRoll >= 9) {
                    result.dummyDetected = true;
                }
            }
        } else {
            // Patrol lost
            result.losses = Math.ceil(unit.currentTOE * 0.1);
            unit.currentTOE -= result.losses;
        }
        
        return result;
    }
    
    static estimateStrength(units) {
        const total = units.reduce((sum, u) => sum + (u.currentTOE || 1), 0);
        // Add uncertainty
        const variance = Math.floor(Math.random() * 5) - 2;
        return Math.max(0, total + variance);
    }
    
    // [16.4] Dummy Tank Formations
    static createDummyFormation(hex, faction, gameState) {
        const hexData = gameState.map[hex.q][hex.r];
        hexData.dummyFormation = {
            faction: faction,
            apparentStrength: Math.floor(Math.random() * 5) + 3
        };
    }
}

// ============================================================================
// [17.0] MORALE
// ============================================================================

class MoraleSystem {
    // [17.1] Unit Basic Morale Ratings
    static getBasicMorale(unit) {
        const moraleByNationality = {
            'GERMAN': 2,
            'BRITISH': 1,
            'AUSTRALIAN': 1,
            'NEW_ZEALAND': 1,
            'INDIAN': 0,
            'ITALIAN': 0,
            'FRENCH': 1
        };
        return moraleByNationality[unit.nationality] || 0;
    }
    
    // [17.2] Adjustments to Basic Morale Ratings
    static calculateCurrentMorale(unit, gameState) {
        let morale = unit.morale || this.getBasicMorale(unit);
        
        // Cohesion effects
        if (unit.cohesionLevel >= 5) morale += 1;
        if (unit.cohesionLevel <= -15) morale -= 2;
        
        // Supply effects
        if (unit.supplies.water < 100) morale -= 1;
        if (unit.supplies.fuel < 100) morale -= 1;
        
        // Recent combat results
        if (unit.recentVictory) morale += 1;
        if (unit.recentDefeat) morale -= 1;
        
        return Math.max(-3, Math.min(3, morale));
    }
    
    // [17.3] Training
    static applyTraining(unit, weeks) {
        if (!unit.trainingLevel) unit.trainingLevel = 0;
        
        unit.trainingLevel += weeks;
        
        // [17.6] Training Chart
        if (unit.trainingLevel >= 4) {
            unit.morale = Math.min(3, (unit.morale || 0) + 1);
            unit.trainingLevel = 0;
            return true; // Training completed
        }
        return false;
    }
    
    // [17.4] Morale Modification Table
    static getMoraleModifier(unit, situation) {
        const currentMorale = this.calculateCurrentMorale(unit);
        
        let modifier = currentMorale * 0.1; // 10% per morale point
        
        // Situational modifiers
        if (situation === 'ATTACKING') {
            if (currentMorale >= 2) modifier += 0.15;
        } else if (situation === 'DEFENDING') {
            if (currentMorale >= 1) modifier += 0.1;
        }
        
        return modifier;
    }
    
    // [17.5] Voluntary Surrender of Units
    static checkSurrender(unit, enemyStrength) {
        const morale = this.calculateCurrentMorale(unit);
        
        if (morale <= -2 && unit.cohesionLevel < -20) {
            const surrenderRoll = Math.floor(Math.random() * 10) + 1;
            const oddsRatio = enemyStrength / (unit.currentTOE || 1);
            
            if (surrenderRoll <= 3 && oddsRatio >= 3) {
                return true; // Unit surrenders
            }
        }
        return false;
    }
}

// ============================================================================
// [18.0] RESERVE STATUS
// ============================================================================

class ReserveStatus {
    // [18.1] Which Units May Be Placed in Reserve
    static canPlaceInReserve(unit, gameState) {
        // Must be within 10 hexes of supply source
        const nearSupply = this.isNearSupplySource(unit, gameState);
        if (!nearSupply) return false;
        
        // Must not be in enemy ZOC
        if (CNA_Rules.ZoneOfControl.isInEnemyZOC(unit.position, unit.faction, gameState)) {
            return false;
        }
        
        return true;
    }
    
    // [18.2] Effects of Reserve Status
    static applyReserveEffects(unit) {
        // Units in reserve gain reorganization points
        CNA_Rules.CapabilityPointSystem.applyReorganizationPoints(unit, 3);
        
        // Reduced CP costs for all actions
        unit.reserveBonus = 0.5; // 50% CP reduction
        
        // Can respond to enemy breakthrough
        unit.canReactToBreakthrough = true;
    }
    
    static isNearSupplySource(unit, gameState) {
        for (let dump of gameState.dumps) {
            if (dump.faction !== unit.faction) continue;
            const dist = CNA_Rules.Movement.hexDistance(unit.position, dump);
            if (dist <= 10) return true;
        }
        return false;
    }
}

// ============================================================================
// [19.0] ORGANIZATION AND REORGANIZATION
// ============================================================================

class OrganizationSystem {
    // [19.1] Difference Between "Assigned" and "Attached" Units
    static assignUnit(unit, parentUnit) {
        if (!parentUnit.assignedUnits) parentUnit.assignedUnits = [];
        if (!parentUnit.assignedUnits.includes(unit.id)) {
            parentUnit.assignedUnits.push(unit.id);
            unit.assignedTo = parentUnit.id;
        }
    }
    
    static attachUnit(unit, parentUnit) {
        if (!parentUnit.attachedUnits) parentUnit.attachedUnits = [];
        if (!parentUnit.attachedUnits.includes(unit.id)) {
            parentUnit.attachedUnits.push(unit.id);
            unit.attachedTo = parentUnit.id;
            unit.currentParent = parentUnit.id;
        }
    }
    
    static detachUnit(unit, parentUnit) {
        if (parentUnit.attachedUnits) {
            parentUnit.attachedUnits = parentUnit.attachedUnits.filter(id => id !== unit.id);
            unit.attachedTo = null;
            unit.currentParent = null;
        }
    }
    
    // [19.3] Formation Organization Chart - Check if formation is valid
    static checkFormationOrganization(unit, gameState) {
        if (unit.type === CNA_Rules.UnitType.HQ_DIVISION) {
            const maxBrigades = unit.maxBrigades || 3;
            const currentBrigades = (unit.attachedBrigades || []).length;
            return currentBrigades <= maxBrigades;
        }
        return true;
    }
    
    // [19.6] Rebuilding Depleted Units
    static rebuildUnit(unit, replacementPoints, type) {
        const needed = unit.characteristics.maxTOE - unit.currentTOE;
        const available = Math.min(replacementPoints, needed);
        
        unit.currentTOE += available;
        
        // Restore some cohesion when rebuilding
        if (available > 0) {
            CNA_Rules.CapabilityPointSystem.applyReorganizationPoints(unit, 2);
        }
        
        return available; // Return points used
    }
    
    // [19.7] Axis Battle Groups
    static formBattleGroup(units, gameState) {
        const battleGroup = {
            id: `BG_${Date.now()}`,
            name: `Battle Group ${units[0].name.split(' ')[0]}`,
            type: CNA_Rules.UnitType.HQ_BRIGADE,
            faction: units[0].faction,
            nationality: units[0].nationality,
            position: units[0].position,
            attachedUnits: units.map(u => u.id),
            characteristics: CNA_Rules.UnitCharacteristicsDB['GER_INF_BN'],
            currentTOE: 1,
            cohesionLevel: 0,
            morale: 1
        };
        
        return battleGroup;
    }
}

// ============================================================================
// [23.0] ENGINEERS
// ============================================================================

class Engineers {
    // [23.1] Engineer Units
    static isEngineerUnit(unit) {
        return unit.type === CNA_Rules.UnitType.ENGINEER_BN;
    }
    
    // [23.2] Uses of Engineers
    static getEngineerCapabilities() {
        return {
            CONSTRUCT_FORTIFICATIONS: 2, // CP cost
            CLEAR_MINEFIELDS: 3,
            BUILD_ROADS: 4,
            BUILD_BRIDGES: 5,
            DEMOLITION: 2,
            REPAIR_FACILITIES: 3
        };
    }
    
    static clearMinefield(engineer, minefieldHex, gameState) {
        const hexData = gameState.map[minefieldHex.q][minefieldHex.r];
        
        if (!hexData.minefields || hexData.minefields.length === 0) {
            return { success: false, message: 'No minefield present' };
        }
        
        // Roll for success
        const roll = Math.floor(Math.random() * 10) + 1;
        const moraleMod = engineer.morale || 0;
        
        if (roll + moraleMod >= 6) {
            // Successfully clear one minefield level
            hexData.minefields.pop();
            return { success: true, message: 'Minefield cleared' };
        } else {
            // Engineer casualties
            engineer.currentTOE = Math.max(0, engineer.currentTOE - 0.1);
            return { success: false, message: 'Clearing failed - casualties sustained' };
        }
    }
}

// ============================================================================
// [24.0] CONSTRUCTION
// ============================================================================

class Construction {
    // [24.1] How Construction Works
    static executeConstruction(units, project, gameState) {
        const engineers = units.filter(u => Engineers.isEngineerUnit(u));
        const totalCP = engineers.reduce((sum, u) => sum + u.characteristics.cpa, 0);
        
        if (!project.progressPoints) project.progressPoints = 0;
        project.progressPoints += totalCP * 0.1; // Each CP contributes to progress
        
        // [24.2] Adverse Effects on Construction
        if (gameState.weather.ghibli) {
            project.progressPoints *= 0.5; // Sandstorm halves progress
        }
        
        return project;
    }
    
    // [24.3] Constructing Minefields
    static constructMinefield(hex, faction, density, gameState) {
        const hexData = gameState.map[hex.q][hex.r];
        
        if (!hexData.minefields) hexData.minefields = [];
        
        const minefield = {
            faction: faction,
            density: density, // 'LIGHT', 'MEDIUM', 'HEAVY'
            constructed: gameState.gameTurn.turnNumber
        };
        
        hexData.minefields.push(minefield);
        
        return {
            success: true,
            cpCost: density === 'LIGHT' ? 5 : density === 'MEDIUM' ? 10 : 15
        };
    }
    
    // [24.4] Constructing Fortifications
    static constructFortification(hex, level, gameState) {
        const hexData = gameState.map[hex.q][hex.r];
        const currentLevel = hexData.fortificationLevel || 0;
        
        if (currentLevel >= 3) {
            return { success: false, message: 'Maximum fortification level reached' };
        }
        
        hexData.fortificationLevel = currentLevel + 1;
        
        return {
            success: true,
            newLevel: hexData.fortificationLevel,
            cpCost: hexData.fortificationLevel * 10
        };
    }
    
    // [24.5] Road Construction
    static constructRoad(fromHex, toHex, gameState) {
        const hexData = gameState.map[toHex.q][toHex.r];
        
        if (hexData.type === 'ROAD' || hexData.type === 'TRACK') {
            return { success: false, message: 'Road already exists' };
        }
        
        hexData.type = 'TRACK'; // First build track, can upgrade to road later
        
        return {
            success: true,
            cpCost: 20,
            message: 'Track constructed'
        };
    }
    
    // [24.8] Constructing Repair Facilities
    static constructRepairFacility(hex, type, gameState) {
        const hexData = gameState.map[hex.q][hex.r];
        
        if (hexData.type !== 'CITY') {
            return { success: false, message: 'Repair facilities must be in cities' };
        }
        
        if (!hexData.facilities) hexData.facilities = [];
        
        hexData.facilities.push({
            type: type, // 'FIELD_WORKSHOP', 'MAJOR_DEPOT'
            capacity: type === 'FIELD_WORKSHOP' ? 5 : 20,
            constructed: gameState.gameTurn.turnNumber
        });
        
        return { success: true, cpCost: type === 'FIELD_WORKSHOP' ? 15 : 50 };
    }
    
    // [24.9] Constructing Supply Dumps
    static constructSupplyDump(hex, faction, gameState) {
        const hexData = gameState.map[hex.q][hex.r];
        
        const dump = {
            q: hex.q,
            r: hex.r,
            faction: faction,
            name: `Field Dump ${gameState.dumps.length + 1}`,
            supplies: { fuel: 1000, water: 1000, ammunition: 500, stores: 500 },
            capacity: 5000,
            dummy: false
        };
        
        gameState.dumps.push(dump);
        hexData.supplyDump = dump;
        
        return { success: true, cpCost: 10 };
    }
    
    static constructDummyDump(hex, faction, gameState) {
        const result = this.constructSupplyDump(hex, faction, gameState);
        if (result.success) {
            const dump = gameState.dumps[gameState.dumps.length - 1];
            dump.dummy = true;
            dump.supplies = { fuel: 0, water: 0, ammunition: 0, stores: 0 };
        }
        return result;
    }
}

// ============================================================================
// [25.0] FORTIFICATIONS
// ============================================================================

class Fortifications {
    // [25.1] Fortification Levels (0-3)
    static getFortificationBonus(level) {
        const bonuses = {
            0: { defense: 1.0, name: 'None' },
            1: { defense: 1.3, name: 'Hasty' },
            2: { defense: 1.6, name: 'Prepared' },
            3: { defense: 2.0, name: 'Fortified' }
        };
        return bonuses[level] || bonuses[0];
    }
    
    // [25.2] Effects of Fortifications
    static applyFortificationEffects(defenders, fortLevel) {
        const bonus = this.getFortificationBonus(fortLevel);
        
        return {
            defenseMultiplier: bonus.defense,
            barrageReduction: fortLevel * 0.2, // Reduce barrage effectiveness
            antiArmorBonus: fortLevel * 0.5    // Improved anti-armor defense
        };
    }
}

// ============================================================================
// [26.0] MINEFIELDS
// ============================================================================

class Minefields {
    // [26.1] Types of Minefields
    static getMinefieldEffect(density) {
        const effects = {
            'LIGHT': { movementCost: 2, damage: 0.1 },
            'MEDIUM': { movementCost: 4, damage: 0.2 },
            'HEAVY': { movementCost: 6, damage: 0.3 }
        };
        return effects[density] || effects['LIGHT'];
    }
    
    // [26.2] Effects of Minefields
    static checkMinefieldDamage(unit, minefield) {
        const effect = this.getMinefieldEffect(minefield.density);
        const roll = Math.floor(Math.random() * 10) + 1;
        
        if (roll <= 5) {
            // Unit takes damage
            const damage = Math.ceil(unit.currentTOE * effect.damage);
            unit.currentTOE = Math.max(0, unit.currentTOE - damage);
            
            return {
                hit: true,
                damage: damage,
                message: `Unit struck minefield - ${damage} casualties`
            };
        }
        
        return { hit: false, damage: 0 };
    }
}

// ============================================================================
// [27.0] DESERT RAIDERS & COMMANDOS
// ============================================================================

class DesertRaiders {
    // [27.1] The Long Range Desert Group (LRDG)
    static createLRDG(gameState) {
        return {
            id: 'LRDG',
            name: 'Long Range Desert Group',
            type: 'SPECIAL_FORCES',
            faction: 'CW',
            nationality: 'BRITISH',
            characteristics: {
                cpa: 45,
                stealth: 9,
                raidCapability: 8
            },
            position: { q: 145, r: 5 },
            status: 'ACTIVE',
            currentTOE: 1
        };
    }
    
    // [27.2] Die Sonderkommando Almasy
    static createAlmasy(gameState) {
        return {
            id: 'ALMASY',
            name: 'Sonderkommando Almasy',
            type: 'SPECIAL_FORCES',
            faction: 'AXIS',
            nationality: 'GERMAN',
            characteristics: {
                cpa: 40,
                stealth: 8,
                raidCapability: 7
            },
            position: { q: 5, r: 3 },
            status: 'ACTIVE',
            currentTOE: 1
        };
    }
    
    // [27.3-27.5] Execute Raid
    static executeRaid(raider, targetHex, gameState) {
        const result = {
            success: false,
            detected: false,
            damage: 0,
            message: ''
        };
        
        // Detection roll
        const detectionRoll = Math.floor(Math.random() * 10) + 1;
        const stealthMod = raider.characteristics.stealth || 5;
        
        if (detectionRoll > stealthMod) {
            result.detected = true;
            result.message = 'Raid detected - aborted';
            return result;
        }
        
        // Raid execution
        const raidRoll = Math.floor(Math.random() * 10) + 1;
        const raidMod = raider.characteristics.raidCapability || 5;
        
        if (raidRoll + raidMod >= 12) {
            result.success = true;
            
            const hexData = gameState.map[targetHex.q][targetHex.r];
            
            // Target supply dump
            if (hexData.supplyDump) {
                const damagePercent = 0.2 + Math.random() * 0.3; // 20-50% damage
                Object.keys(hexData.supplyDump.supplies).forEach(key => {
                    const damage = Math.floor(hexData.supplyDump.supplies[key] * damagePercent);
                    hexData.supplyDump.supplies[key] -= damage;
                    result.damage += damage;
                });
                result.message = `Successful raid - destroyed ${Math.floor(result.damage)} supply points`;
            } else {
                result.message = 'Raid successful but no valuable targets found';
            }
        }
        
        return result;
    }
    
    // [27.8] Special Air Service Brigade
    static createSAS(gameState) {
        return {
            id: 'SAS',
            name: 'Special Air Service',
            type: 'SPECIAL_FORCES',
            faction: 'CW',
            nationality: 'BRITISH',
            characteristics: {
                cpa: 50,
                stealth: 10,
                raidCapability: 9,
                airfieldAttack: 10
            },
            position: { q: 145, r: 5 },
            status: 'ACTIVE',
            currentTOE: 1
        };
    }
}

// ============================================================================
// [28.0] PRISONERS
// ============================================================================

class Prisoners {
    // [28.1] The Care and Feeding of Prisoners
    static capturePrisoners(defeatedUnit, capturingFaction, gameState) {
        const prisoners = {
            count: defeatedUnit.currentTOE,
            nationality: defeatedUnit.nationality,
            location: defeatedUnit.position,
            captor: capturingFaction,
            waterCost: defeatedUnit.currentTOE * 2, // Per turn
            guardRequired: Math.ceil(defeatedUnit.currentTOE * 0.1)
        };
        
        if (!gameState.prisoners) gameState.prisoners = [];
        gameState.prisoners.push(prisoners);
        
        return prisoners;
    }
    
    // [28.2] Guards and Escapes
    static checkPrisonerEscape(prisoners, guards) {
        if (guards < prisoners.guardRequired) {
            const escapeRoll = Math.floor(Math.random() * 10) + 1;
            const guardRatio = guards / prisoners.guardRequired;
            
            if (escapeRoll >= 7 * guardRatio) {
                const escapees = Math.ceil(prisoners.count * 0.3);
                prisoners.count -= escapees;
                return { escaped: true, count: escapees };
            }
        }
        return { escaped: false, count: 0 };
    }
    
    // [28.3] Captured Equipment
    static captureEquipment(defeatedUnit, capturingFaction) {
        const captured = {
            fuel: Math.floor(defeatedUnit.supplies.fuel * 0.5),
            water: Math.floor(defeatedUnit.supplies.water * 0.5),
            ammunition: Math.floor(defeatedUnit.supplies.ammunition * 0.3),
            vehicles: defeatedUnit.attachedTrucks || 0
        };
        
        return captured;
    }
}

// ============================================================================
// [29.0] WEATHER (Enhanced)
// ============================================================================

class WeatherSystem {
    // [29.1] Weather Determination (expanded from basic version)
    static determineWeather(gameState) {
        const month = gameState.gameTurn.date.getMonth();
        const roll = Math.floor(Math.random() * 10) + 1;
        
        // [29.2] Normal Weather
        let condition = 'NORMAL';
        let temp = 25 + (month - 5) * 3; // Seasonal variation
        
        // [29.3] Hot Weather (summer months)
        if (month >= 5 && month <= 8) {
            temp = 35 + Math.random() * 10;
            if (temp > 40) {
                condition = 'HOT';
            }
        }
        
        // [29.4] Sandstorms (Ghibli)
        if (roll >= 8 && temp > 30) {
            condition = 'SANDSTORM';
            gameState.weather.ghibli = true;
        } else {
            gameState.weather.ghibli = false;
        }
        
        // [29.5] Rainstorms (winter months)
        if (month <= 2 || month >= 10) {
            if (roll >= 9) {
                condition = 'RAIN';
                temp = 15 + Math.random() * 10;
            }
        }
        
        gameState.weather.condition = condition;
        gameState.weather.temp = temp;
        
        return gameState.weather;
    }
    
    static getWeatherEffects(weather) {
        const effects = {
            'NORMAL': { movementMod: 1.0, combatMod: 1.0, supplyMod: 1.0 },
            'HOT': { movementMod: 0.8, combatMod: 0.9, supplyMod: 0.7 },
            'SANDSTORM': { movementMod: 0, combatMod: 0, supplyMod: 0.5 },
            'RAIN': { movementMod: 0.6, combatMod: 0.8, supplyMod: 0.9 }
        };
        
        return effects[weather.condition] || effects['NORMAL'];
    }
}

// ============================================================================
// [30.0] THE MEDITERRANEAN FLEET (Commonwealth)
// ============================================================================

class MediterraneanFleet {
    // [30.1] Commonwealth Naval Counters
    static createFleetUnit(name, type, firepower) {
        return {
            name: name,
            type: type, // 'BATTLESHIP', 'CRUISER', 'DESTROYER'
            firepower: firepower,
            damage: 0,
            location: 'ALEXANDRIA',
            status: 'AVAILABLE'
        };
    }
    
    // [30.2] Off-Shore Bombardment
    static executeBombardment(ship, targetHex, gameState) {
        if (ship.status !== 'AVAILABLE') {
            return { success: false, message: 'Ship not available' };
        }
        
        // Check if hex is coastal
        const hexData = gameState.map[targetHex.q][targetHex.r];
        const coastalRange = this.isCoastal(targetHex, gameState);
        
        if (!coastalRange) {
            return { success: false, message: 'Target out of range' };
        }
        
        // Execute bombardment (similar to artillery)
        const hits = Math.floor(ship.firepower * (0.5 + Math.random() * 0.5));
        
        return {
            success: true,
            hits: hits,
            message: `Naval bombardment: ${hits} hits`
        };
    }
    
    // [30.3] Attacking Ships and Their Repair
    static damageShip(ship, damagePoints) {
        ship.damage += damagePoints;
        
        if (ship.damage >= 10) {
            ship.status = 'SUNK';
            return { sunk: true };
        } else if (ship.damage >= 5) {
            ship.status = 'DAMAGED';
            return { damaged: true };
        }
        
        return { operational: true };
    }
    
    static repairShip(ship, facilityLevel) {
        const repairPoints = facilityLevel * 2;
        ship.damage = Math.max(0, ship.damage - repairPoints);
        
        if (ship.damage === 0) {
            ship.status = 'AVAILABLE';
        }
        
        return ship.damage;
    }
    
    // [30.5] Naval Transport of Troops
    static transportTroops(ship, units, destination) {
        const capacity = ship.type === 'BATTLESHIP' ? 2 : 
                        ship.type === 'CRUISER' ? 3 : 5;
        
        const totalStacking = units.reduce((sum, u) => 
            sum + (u.characteristics.stackingPoints || 1), 0
        );
        
        if (totalStacking > capacity) {
            return { success: false, message: 'Exceeds ship capacity' };
        }
        
        return {
            success: true,
            eta: 1, // 1 operations stage
            destination: destination
        };
    }
    
    static isCoastal(hex, gameState) {
        // Check if hex is within 1 hex of sea
        const adjacent = CNA_Rules.ZoneOfControl.getAdjacentZOCHexes(hex, null, gameState);
        
        for (let adjHex of adjacent) {
            if (gameState.map[adjHex.q][adjHex.r].type === 'SEA') {
                return true;
            }
        }
        return false;
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof window !== 'undefined') {
    window.CNA_AdvancedRules = {
        PatrolsAndReconnaissance,
        MoraleSystem,
        ReserveStatus,
        OrganizationSystem,
        Engineers,
        Construction,
        Fortifications,
        Minefields,
        DesertRaiders,
        Prisoners,
        WeatherSystem,
        MediterraneanFleet
    };
}


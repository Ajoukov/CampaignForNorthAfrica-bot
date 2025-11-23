// ============================================================================
// CAMPAIGN FOR NORTH AFRICA - CORE RULES ENGINE (Sections 1-15)
// ============================================================================
// Implementation of the full land game rules system
// Based on SPI's Campaign for North Africa (1979)
// ============================================================================

// ============================================================================
// [3.0] GLOSSARY AND UNIT DEFINITIONS
// ============================================================================

const UnitType = {
    HQ_DIVISION: 'HQ_DIVISION',
    HQ_BRIGADE: 'HQ_BRIGADE',
    HQ_REGIMENT: 'HQ_REGIMENT',
    INFANTRY_BN: 'INFANTRY_BN',
    TANK_BN: 'TANK_BN',
    RECCE_BN: 'RECCE_BN',
    ARTILLERY_BN: 'ARTILLERY_BN',
    ANTITANK_BN: 'ANTITANK_BN',
    ANTIAIR_BN: 'ANTIAIR_BN',
    ENGINEER_BN: 'ENGINEER_BN',
    TRUCK_UNIT: 'TRUCK_UNIT'
};

const TerrainType = {
    CLEAR: { moveCost: 1, stackLimit: 10, name: 'Clear' },
    ROUGH: { moveCost: 2, stackLimit: 8, name: 'Rough' },
    ROAD: { moveCost: 0.5, stackLimit: 15, name: 'Road' },
    TRACK: { moveCost: 0.75, stackLimit: 12, name: 'Track' },
    ESCARPMENT: { moveCost: 4, stackLimit: 5, name: 'Escarpment' },
    SALT_MARSH: { moveCost: 999, stackLimit: 2, name: 'Salt Marsh' },
    WADI: { moveCost: 2, stackLimit: 8, name: 'Wadi' },
    CITY: { moveCost: 1, stackLimit: 20, name: 'City' },
    SEA: { moveCost: 999, stackLimit: 0, name: 'Sea' }
};

// ============================================================================
// [3.5] UNIT CHARACTERISTICS
// ============================================================================

class UnitCharacteristics {
    constructor(data) {
        this.cpa = data.cpa || 10;                    // Capability Point Allowance
        this.stackingPoints = data.stackingPoints || 1;
        this.antiAir = data.antiAir || 0;
        this.barrage = data.barrage || 0;
        this.antiArmor = data.antiArmor || 0;
        this.vulnerability = data.vulnerability || 0;  // For gun units
        this.armorProtection = data.armorProtection || 0;
        this.closeAssaultOff = data.closeAssaultOff || 0;
        this.closeAssaultDef = data.closeAssaultDef || 0;
        this.maxTOE = data.maxTOE || 1;               // Max TOE Strength Points
        this.motorized = data.motorized || false;
    }
}

// Sample unit characteristics for different nations
const UnitCharacteristicsDB = {
    // Commonwealth Units
    'CW_INF_BN': new UnitCharacteristics({
        cpa: 10, stackingPoints: 1, closeAssaultOff: 3, closeAssaultDef: 4, maxTOE: 1
    }),
    'CW_TANK_BN': new UnitCharacteristics({
        cpa: 25, stackingPoints: 1, antiArmor: 4, vulnerability: 2, 
        armorProtection: 3, closeAssaultOff: 4, closeAssaultDef: 3, maxTOE: 10
    }),
    'CW_ARTILLERY_BN': new UnitCharacteristics({
        cpa: 15, stackingPoints: 1, barrage: 3, vulnerability: 1, maxTOE: 4
    }),
    
    // German Units
    'GER_INF_BN': new UnitCharacteristics({
        cpa: 10, stackingPoints: 1, closeAssaultOff: 4, closeAssaultDef: 5, maxTOE: 1
    }),
    'GER_TANK_BN': new UnitCharacteristics({
        cpa: 30, stackingPoints: 1, antiArmor: 5, vulnerability: 2,
        armorProtection: 4, closeAssaultOff: 5, closeAssaultDef: 4, maxTOE: 15
    }),
    'GER_PANZERGRENADIER_BN': new UnitCharacteristics({
        cpa: 20, stackingPoints: 1, closeAssaultOff: 5, closeAssaultDef: 5, 
        maxTOE: 1, motorized: true
    }),
    
    // Italian Units
    'IT_INF_BN': new UnitCharacteristics({
        cpa: 8, stackingPoints: 1, closeAssaultOff: 2, closeAssaultDef: 3, maxTOE: 1
    }),
    'IT_TANK_BN': new UnitCharacteristics({
        cpa: 20, stackingPoints: 1, antiArmor: 2, vulnerability: 3,
        armorProtection: 2, closeAssaultOff: 2, closeAssaultDef: 2, maxTOE: 7
    })
};

// ============================================================================
// [5.0] THE SEQUENCE OF PLAY
// ============================================================================

class GameTurn {
    constructor(turnNumber, date) {
        this.turnNumber = turnNumber;
        this.date = date;
        this.operationsStage = 1; // 1, 2, or 3
        this.phase = 'INITIATIVE';
        this.playerA = null; // Player with initiative moves first/last
        this.playerB = null;
        this.segment = 'MOVEMENT';
    }
}

const SequencePhases = {
    STRATEGIC: [
        'REINFORCEMENT_ARRIVAL',
        'REPLACEMENT_PLANNING',
        'CONSTRUCTION',
        'ORGANIZATION',
        'WEATHER_DETERMINATION'
    ],
    OPERATIONS_STAGE: [
        'NAVAL_CONVOY',
        'TRUCK_CONVOY_MOVEMENT',
        'MOVEMENT_COMBAT',
        'RAIL_MOVEMENT',
        'ADMINISTRATIVE'
    ]
};

// ============================================================================
// [6.0] THE CAPABILITY POINT SYSTEM
// ============================================================================

class CapabilityPointSystem {
    // [6.1] How the CPA System Works
    static calculateAvailableCP(unit, operationsStage) {
        const baseCPA = unit.characteristics.cpa;
        const cpUsed = unit.cpExpenditure[operationsStage] || 0;
        return Math.max(0, baseCPA - cpUsed);
    }
    
    // [6.2] Cohesion - Disorganization and Reorganization Points
    static applyDisorganizationPoints(unit, dp) {
        unit.cohesionLevel -= dp;
        
        // [6.26] Unit with cohesion -26 or worse is destroyed
        if (unit.cohesionLevel <= -26) {
            unit.status = 'DESTROYED';
            return true;
        }
        return false;
    }
    
    static applyReorganizationPoints(unit, rp) {
        unit.cohesionLevel = Math.min(10, unit.cohesionLevel + rp);
    }
    
    // [6.24] Earning Reorganization Points
    static checkReorganizationPoints(unit, conditions) {
        let rp = 0;
        
        // Unit expends no CP in an Operations Stage
        if (conditions.noMovement && conditions.noCombat) {
            rp += 3;
        }
        
        // Unit in reserve status
        if (unit.reserveStatus) {
            rp += 2;
        }
        
        // Unit within 5 hexes of parent HQ
        if (conditions.nearHQ) {
            rp += 1;
        }
        
        return rp;
    }
    
    // [6.3] CP Cost Summary
    static getCPCost(action, unit, context = {}) {
        const costs = {
            // Movement
            MOVE_PER_HEX: (terrain) => TerrainType[terrain]?.moveCost || 1,
            BREAK_CONTACT: 2,
            BREAK_ENGAGED: 4,
            RETREAT_PER_HEX: 1,
            
            // Combat
            PHASING_ATTACK: 5,
            PHASING_PROBE: 1,
            NON_PHASING_DEFEND: 3,
            NON_PHASING_DEFEND_POOR_ODDS: 1, // [11.27] When assault diff is -4 or worse
            
            // Barrage
            BARRAGE: 5,
            
            // Other Actions
            CONSTRUCT: 3,
            ORGANIZE: 2,
            LOAD_UNLOAD: 1
        };
        
        return costs[action] ? 
            (typeof costs[action] === 'function' ? costs[action](context) : costs[action]) 
            : 0;
    }
}

// ============================================================================
// [7.0] INITIATIVE
// ============================================================================

class Initiative {
    // [7.1] The Mechanics of Initiative
    static determineInitiative(gameTurn, axisMod, cwMod) {
        const axisDie = Math.floor(Math.random() * 10) + 1;
        const cwDie = Math.floor(Math.random() * 10) + 1;
        
        const axisTotal = axisDie + axisMod;
        const cwTotal = cwDie + cwMod;
        
        if (axisTotal > cwTotal) {
            return 'AXIS';
        } else if (cwTotal > axisTotal) {
            return 'CW';
        } else {
            // Tie - reroll
            return this.determineInitiative(gameTurn, axisMod, cwMod);
        }
    }
    
    // [7.2] Initiative Ratings Chart (simplified)
    static getInitiativeModifier(faction, gameTurn) {
        // Historical modifiers based on time period
        const year = gameTurn.date.getFullYear();
        const month = gameTurn.date.getMonth();
        
        if (faction === 'AXIS') {
            if (year === 1941 && month >= 2 && month <= 10) return 3; // Rommel arrives
            if (year === 1942 && month >= 0 && month <= 6) return 2;
            return 0;
        } else {
            if (year === 1940) return 2; // Early Commonwealth advantage
            if (year === 1942 && month >= 10) return 3; // El Alamein
            return 0;
        }
    }
}

// ============================================================================
// [8.0] LAND MOVEMENT
// ============================================================================

class Movement {
    // [8.1] How to Move Units
    static moveUnit(unit, fromHex, toHex, gameState) {
        const result = {
            success: false,
            cpCost: 0,
            message: '',
            newPosition: null
        };
        
        // Check if unit can move
        if (!this.canMove(unit, gameState)) {
            result.message = 'Unit cannot move';
            return result;
        }
        
        // Calculate CP cost
        const moveCost = this.calculateMoveCost(unit, fromHex, toHex, gameState);
        result.cpCost = moveCost;
        
        // Check if unit has enough CP
        const availableCP = CapabilityPointSystem.calculateAvailableCP(
            unit, 
            gameState.currentOperationsStage
        );
        
        if (moveCost > availableCP) {
            // Unit can still move but gains disorganization points
            const dp = moveCost - availableCP;
            CapabilityPointSystem.applyDisorganizationPoints(unit, dp);
        }
        
        // Execute move
        unit.cpExpenditure[gameState.currentOperationsStage] = 
            (unit.cpExpenditure[gameState.currentOperationsStage] || 0) + moveCost;
        
        result.success = true;
        result.newPosition = toHex;
        
        // [8.14] Check if moved into enemy ZOC
        if (ZoneOfControl.isInEnemyZOC(toHex, unit.faction, gameState)) {
            result.message = 'Unit must stop - entered enemy ZOC';
            unit.stoppedInZOC = true;
        }
        
        return result;
    }
    
    // [8.2] The Concept of Continual Movement
    static canContinueMoving(unit, gameState) {
        // [8.23] Only units within 2 hexes of enemy can move again
        const nearestEnemy = this.findNearestEnemy(unit, gameState);
        return nearestEnemy && nearestEnemy.distance <= 2;
    }
    
    // [8.3] Terrain Effects on Movement
    static calculateMoveCost(unit, fromHex, toHex, gameState) {
        const terrain = gameState.map[toHex.q][toHex.r].type;
        const baseCost = TerrainType[terrain]?.moveCost || 1;
        
        // Motorized units have different costs
        if (unit.characteristics.motorized || unit.attachedTrucks > 0) {
            return baseCost * 0.5; // Motorized movement bonus
        }
        
        return baseCost;
    }
    
    // [8.17] Non-motorized units movement restrictions
    static canMove(unit, gameState) {
        if (unit.status !== 'ACTIVE') return false;
        if (unit.cohesionLevel <= -26) return false;
        
        const cpa = unit.characteristics.cpa;
        const cpUsed = unit.cpExpenditure[gameState.currentOperationsStage] || 0;
        
        // Non-motorized units can't expend more than 50% over base CPA
        if (cpa <= 10) {
            const maxAllowed = cpa * 1.5;
            if (cpUsed >= maxAllowed) return false;
        }
        
        return true;
    }
    
    static findNearestEnemy(unit, gameState) {
        let nearest = null;
        let minDist = Infinity;
        
        for (let enemy of gameState.units) {
            if (enemy.faction === unit.faction) continue;
            if (enemy.status !== 'ACTIVE') continue;
            
            const dist = this.hexDistance(unit.position, enemy.position);
            if (dist < minDist) {
                minDist = dist;
                nearest = enemy;
            }
        }
        
        return nearest ? { unit: nearest, distance: minDist } : null;
    }
    
    static hexDistance(hex1, hex2) {
        return Math.sqrt(Math.pow(hex1.q - hex2.q, 2) + Math.pow(hex1.r - hex2.r, 2));
    }
    
    // [8.5] Reaction Movement
    static canReact(unit, triggeringUnit, gameState) {
        // Non-phasing player can react to phasing player movement
        if (unit.faction === gameState.phasingPlayer) return false;
        
        const dist = this.hexDistance(unit.position, triggeringUnit.position);
        return dist <= 3; // Can react if within 3 hexes
    }
}

// ============================================================================
// [9.0] STACKING
// ============================================================================

class Stacking {
    // [9.1] The Stacking Point System
    static calculateStackingPoints(hexUnits) {
        let total = 0;
        
        for (let unit of hexUnits) {
            // HQ units with no attached combat units = 0 stacking points
            if (unit.type.includes('HQ') && !unit.hasAttachedCombatUnits) {
                continue;
            }
            
            total += unit.characteristics.stackingPoints;
        }
        
        return total;
    }
    
    // [9.2] Unit Equivalents - Shell calculation
    static isShellUnit(unit) {
        if (unit.type === UnitType.HQ_DIVISION) {
            // Division is shell if 50% or less brigades attached
            const maxBrigades = unit.maxBrigades || 2;
            const currentBrigades = unit.attachedBrigades?.length || 0;
            return currentBrigades <= maxBrigades * 0.5;
        }
        
        if (unit.type === UnitType.HQ_BRIGADE) {
            // Brigade is shell if less than 2/3 battalions attached
            const maxBattalions = unit.maxBattalions || 3;
            const currentBattalions = unit.attachedBattalions?.length || 0;
            return currentBattalions < maxBattalions * 0.67;
        }
        
        if (unit.type.includes('_BN')) {
            // Battalion is shell if less than 50% of TOE strength
            return unit.currentTOE < unit.characteristics.maxTOE * 0.5;
        }
        
        return false;
    }
    
    // [9.3] The Effects of Stacking
    static checkStackingViolation(hex, terrain, gameState) {
        const units = gameState.map[hex.q][hex.r].units;
        const stackingPoints = this.calculateStackingPoints(units);
        const limit = TerrainType[terrain]?.stackLimit || 10;
        
        return {
            valid: stackingPoints <= limit,
            current: stackingPoints,
            limit: limit,
            overflow: Math.max(0, stackingPoints - limit)
        };
    }
    
    // [9.33] Road/Track stacking restrictions
    static checkRoadStackingLimit(hex, gameState) {
        const terrain = gameState.map[hex.q][hex.r].type;
        if (terrain !== 'ROAD' && terrain !== 'TRACK') return true;
        
        const motorizedUnits = gameState.map[hex.q][hex.r].units.filter(u => 
            u.characteristics.motorized || u.attachedTrucks > 0
        );
        
        const motorizedStacking = this.calculateStackingPoints(motorizedUnits);
        return motorizedStacking <= 5; // Max 5 stacking points on roads
    }
}

// ============================================================================
// [10.0] ZONES OF CONTROL
// ============================================================================

class ZoneOfControl {
    // [10.1] Which Units Exert a Zone of Control
    static exertsZOC(unit) {
        // [10.14] Units with cohesion -26 or worse don't exert ZOC
        if (unit.cohesionLevel <= -26) return false;
        
        // [10.15] Units with less than 10 raw defensive close assault strength
        const defStrength = this.calculateRawDefensiveStrength(unit);
        if (defStrength < 10) return false;
        
        // Combat units exert ZOC
        if (unit.type.includes('_BN') && unit.status === 'ACTIVE') {
            return true;
        }
        
        return false;
    }
    
    static calculateRawDefensiveStrength(unit) {
        const char = unit.characteristics;
        return char.closeAssaultDef * (unit.currentTOE || 1);
    }
    
    // [10.2] Effects of Zones of Control
    static getAdjacentZOCHexes(hex, faction, gameState) {
        const zocHexes = [];
        const adjacentOffsets = [
            [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1]
        ];
        
        for (let [dq, dr] of adjacentOffsets) {
            const adjHex = { q: hex.q + dq, r: hex.r + dr };
            
            // Check bounds
            if (!gameState.map[adjHex.q] || !gameState.map[adjHex.q][adjHex.r]) {
                continue;
            }
            
            const terrain = gameState.map[adjHex.q][adjHex.r].type;
            
            // [10.21] ZOC doesn't extend into certain terrain
            if (terrain === 'SEA') continue;
            
            zocHexes.push(adjHex);
        }
        
        return zocHexes;
    }
    
    static isInEnemyZOC(hex, unitFaction, gameState) {
        const hexData = gameState.map[hex.q][hex.r];
        if (!hexData) return false;
        
        // Check all adjacent hexes for enemy units
        const adjacent = this.getAdjacentZOCHexes(hex, unitFaction, gameState);
        
        for (let adjHex of adjacent) {
            const adjHexData = gameState.map[adjHex.q][adjHex.r];
            if (!adjHexData.units) continue;
            
            for (let unit of adjHexData.units) {
                if (unit.faction !== unitFaction && this.exertsZOC(unit)) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    // [10.3] ZOC Combat Requirements (Holding Off)
    static requiresCombat(unit, gameState) {
        if (!this.isInEnemyZOC(unit.position, unit.faction, gameState)) {
            return false;
        }
        
        // [10.32] Artillery/AT/AA units don't have to attack
        if (unit.type === UnitType.ARTILLERY_BN || 
            unit.type === UnitType.ANTITANK_BN ||
            unit.type === UnitType.ANTIAIR_BN) {
            return false;
        }
        
        return true;
    }
}

// ============================================================================
// [11.0] THE COMBAT SYSTEM
// ============================================================================

class CombatSystem {
    // [11.3] Calculation of Combat Strengths
    static calculateCombatStrength(units, type = 'CLOSE_ASSAULT') {
        let totalStrength = 0;
        
        for (let unit of units) {
            const char = unit.characteristics;
            
            switch(type) {
                case 'CLOSE_ASSAULT_OFF':
                    totalStrength += char.closeAssaultOff * (unit.currentTOE || 1);
                    break;
                case 'CLOSE_ASSAULT_DEF':
                    totalStrength += char.closeAssaultDef * (unit.currentTOE || 1);
                    break;
                case 'BARRAGE':
                    totalStrength += char.barrage * (unit.currentTOE || 1);
                    break;
                case 'ANTI_ARMOR':
                    totalStrength += char.antiArmor * (unit.currentTOE || 1);
                    break;
            }
        }
        
        return totalStrength;
    }
}

// ============================================================================
// [12.0] BARRAGE (Artillery Combat)
// ============================================================================

class Barrage {
    // [12.1] Artillery Positions
    static canBarrage(unit) {
        return unit.characteristics.barrage > 0 && unit.ammunition > 0;
    }
    
    // [12.2] Target Selection
    static executeBarrage(firingUnits, targetHex, gameState) {
        const result = {
            success: false,
            hits: 0,
            casualties: [],
            message: ''
        };
        
        // Calculate total barrage strength
        const totalBarrageStrength = CombatSystem.calculateCombatStrength(
            firingUnits, 
            'BARRAGE'
        );
        
        if (totalBarrageStrength === 0) {
            result.message = 'No barrage capability';
            return result;
        }
        
        // Apply terrain modifiers [12.3]
        const terrain = gameState.map[targetHex.q][targetHex.r].type;
        let modifier = 1.0;
        
        if (terrain === 'ROUGH') modifier = 0.75;
        if (terrain === 'ESCARPMENT') modifier = 0.5;
        if (terrain === 'CITY') modifier = 0.6;
        
        const effectiveStrength = Math.floor(totalBarrageStrength * modifier);
        
        // Roll for effect [12.4]
        const die = Math.floor(Math.random() * 10) + 1;
        const adjustedRoll = die + Math.floor(effectiveStrength / 10);
        
        // Determine result
        if (adjustedRoll >= 8) {
            result.hits = Math.floor(effectiveStrength / 5);
            result.success = true;
            result.message = `Barrage effective - ${result.hits} hits`;
        } else if (adjustedRoll >= 5) {
            result.hits = 1;
            result.success = true;
            result.message = 'Barrage causes light casualties';
        } else {
            result.message = 'Barrage ineffective';
        }
        
        // Expend ammunition
        for (let unit of firingUnits) {
            if (unit.ammunition) {
                unit.ammunition -= 1;
            }
        }
        
        return result;
    }
}

// ============================================================================
// [13.0] RETREAT BEFORE ASSAULT
// ============================================================================

class RetreatBeforeAssault {
    // [13.1] Which Units May Retreat Before Assault
    static canRetreatBeforeAssault(units, gameState) {
        // Units must not be in contact or engaged
        for (let unit of units) {
            if (unit.contact || unit.engaged) return false;
        }
        return true;
    }
    
    // [13.2] How to Retreat Before Assault
    static executeRetreat(units, numHexes, gameState) {
        const cpCostPerHex = 2; // Retreat costs 2 CP per hex
        const totalCost = numHexes * cpCostPerHex;
        
        for (let unit of units) {
            unit.cpExpenditure[gameState.currentOperationsStage] = 
                (unit.cpExpenditure[gameState.currentOperationsStage] || 0) + totalCost;
        }
        
        return {
            success: true,
            cpCost: totalCost,
            hexesRetreated: numHexes
        };
    }
}

// ============================================================================
// [14.0] ANTI-ARMOR COMBAT
// ============================================================================

class AntiArmorCombat {
    // [14.1] Which Units May Participate
    static canParticipate(unit) {
        return unit.characteristics.antiArmor > 0;
    }
    
    // [14.4] Assessing Anti-Armor Damage
    static executeAntiArmorFire(firingUnits, targetUnits, gameState) {
        const result = {
            damagePoints: 0,
            destroyedTanks: 0,
            casualties: []
        };
        
        // Calculate total anti-armor strength
        const aaStrength = CombatSystem.calculateCombatStrength(
            firingUnits,
            'ANTI_ARMOR'
        );
        
        // Roll on Anti-Armor CRT
        const die = Math.floor(Math.random() * 10) + 1;
        result.damagePoints = Math.floor((die + aaStrength) / 3);
        
        // Apply damage to armor
        for (let target of targetUnits) {
            if (target.characteristics.armorProtection > 0) {
                const damage = result.damagePoints - target.characteristics.armorProtection;
                if (damage > 0) {
                    // Tank destroyed
                    target.currentTOE = Math.max(0, target.currentTOE - 1);
                    result.destroyedTanks++;
                    result.casualties.push(target);
                }
            }
        }
        
        return result;
    }
}

// ============================================================================
// [15.0] CLOSE ASSAULT
// ============================================================================

class CloseAssault {
    // [15.2] How Close Assault Occurs
    static executeCloseAssault(attackers, defenders, terrain, gameState) {
        const result = {
            success: false,
            attackerCasualties: 0,
            defenderCasualties: 0,
            outcome: '',
            attackerRetreat: 0,
            defenderRetreat: 0
        };
        
        // [15.1] Calculate strengths
        let attackStrength = CombatSystem.calculateCombatStrength(
            attackers,
            'CLOSE_ASSAULT_OFF'
        );
        
        let defenseStrength = CombatSystem.calculateCombatStrength(
            defenders,
            'CLOSE_ASSAULT_DEF'
        );
        
        // [15.3] Apply terrain effects
        const terrainMod = this.getTerrainModifier(terrain);
        defenseStrength *= terrainMod;
        
        // [15.4] Combined arms bonus
        if (this.hasCombinedArms(attackers)) {
            attackStrength *= 1.2;
        }
        
        // [15.5] Organizational size modifier
        const sizeMod = this.getOrganizationalSizeModifier(attackers);
        attackStrength *= sizeMod;
        
        // [15.6] Morale effects
        const moraleMod = this.getMoraleModifier(attackers, defenders);
        attackStrength *= moraleMod.attacker;
        defenseStrength *= moraleMod.defender;
        
        // [15.7] Calculate odds and roll on CRT
        const odds = attackStrength / Math.max(1, defenseStrength);
        const crtResult = this.rollOnCRT(odds);
        
        // [15.8] Determine casualties
        result.attackerCasualties = this.calculateCasualties(attackers, crtResult.attackerLoss);
        result.defenderCasualties = this.calculateCasualties(defenders, crtResult.defenderLoss);
        
        result.outcome = crtResult.outcome;
        result.attackerRetreat = crtResult.attackerRetreat;
        result.defenderRetreat = crtResult.defenderRetreat;
        result.success = true;
        
        return result;
    }
    
    // [15.3] Terrain Effects on Close Assault
    static getTerrainModifier(terrain) {
        const modifiers = {
            'CLEAR': 1.0,
            'ROUGH': 1.5,
            'ESCARPMENT': 2.0,
            'CITY': 1.8,
            'WADI': 1.3
        };
        return modifiers[terrain] || 1.0;
    }
    
    // [15.4] Combined Arms Effect
    static hasCombinedArms(units) {
        let hasInfantry = false;
        let hasTanks = false;
        
        for (let unit of units) {
            if (unit.type === UnitType.INFANTRY_BN) hasInfantry = true;
            if (unit.type === UnitType.TANK_BN) hasTanks = true;
        }
        
        return hasInfantry && hasTanks;
    }
    
    // [15.5] Effect of Assaulting Force Organizational Size
    static getOrganizationalSizeModifier(units) {
        // Division-sized attacks get bonus
        let stackingTotal = Stacking.calculateStackingPoints(units);
        
        if (stackingTotal >= 5) return 1.3;  // Division+
        if (stackingTotal >= 3) return 1.15; // Brigade
        return 1.0;
    }
    
    // [15.6] Effects of Morale on Close Assault
    static getMoraleModifier(attackers, defenders) {
        const avgAttackerMorale = this.getAverageMorale(attackers);
        const avgDefenderMorale = this.getAverageMorale(defenders);
        
        return {
            attacker: 1.0 + (avgAttackerMorale / 10),
            defender: 1.0 + (avgDefenderMorale / 10)
        };
    }
    
    static getAverageMorale(units) {
        if (units.length === 0) return 0;
        let total = 0;
        for (let unit of units) {
            total += unit.morale || 0;
        }
        return total / units.length;
    }
    
    // [15.7] How to Use the Close Assault Combat Results Table
    static rollOnCRT(odds) {
        const die = Math.floor(Math.random() * 10) + 1;
        
        // Simplified CRT based on odds
        if (odds >= 4) {
            return {
                outcome: 'DE', // Defender Eliminated
                attackerLoss: 0.1,
                defenderLoss: 1.0,
                attackerRetreat: 0,
                defenderRetreat: 0
            };
        } else if (odds >= 2) {
            if (die >= 7) {
                return {
                    outcome: 'DR', // Defender Retreat
                    attackerLoss: 0.2,
                    defenderLoss: 0.3,
                    attackerRetreat: 0,
                    defenderRetreat: 2
                };
            } else {
                return {
                    outcome: 'EX', // Exchange
                    attackerLoss: 0.3,
                    defenderLoss: 0.3,
                    attackerRetreat: 0,
                    defenderRetreat: 0
                };
            }
        } else if (odds >= 1) {
            return {
                outcome: 'E', // Engaged
                attackerLoss: 0.1,
                defenderLoss: 0.1,
                attackerRetreat: 0,
                defenderRetreat: 0
            };
        } else {
            return {
                outcome: 'AR', // Attacker Retreat
                attackerLoss: 0.4,
                defenderLoss: 0.1,
                attackerRetreat: 2,
                defenderRetreat: 0
            };
        }
    }
    
    // [15.8] Determining Casualties
    static calculateCasualties(units, lossPercentage) {
        let totalCasualties = 0;
        
        for (let unit of units) {
            const losses = Math.ceil(unit.currentTOE * lossPercentage);
            unit.currentTOE = Math.max(0, unit.currentTOE - losses);
            totalCasualties += losses;
            
            if (unit.currentTOE === 0) {
                unit.status = 'DESTROYED';
            }
        }
        
        return totalCasualties;
    }
    
    // [15.9] Probes
    static executeProbe(probers, defenders, gameState) {
        // Probe costs only 1 CP instead of 5
        const result = {
            success: false,
            information: '',
            cpCost: 1
        };
        
        // Probe reveals defender strength
        const defStrength = CombatSystem.calculateCombatStrength(
            defenders,
            'CLOSE_ASSAULT_DEF'
        );
        
        result.information = `Defender strength approximately ${defStrength}`;
        result.success = true;
        
        // Small chance of casualties
        if (Math.random() < 0.2) {
            this.calculateCasualties(probers, 0.05);
            result.information += ' - Probe suffered light casualties';
        }
        
        return result;
    }
}

// ============================================================================
// EXPORT
// ============================================================================

// Make classes available globally
if (typeof window !== 'undefined') {
    window.CNA_Rules = {
        UnitType,
        TerrainType,
        UnitCharacteristics,
        UnitCharacteristicsDB,
        GameTurn,
        SequencePhases,
        CapabilityPointSystem,
        Initiative,
        Movement,
        Stacking,
        ZoneOfControl,
        CombatSystem,
        Barrage,
        RetreatBeforeAssault,
        AntiArmorCombat,
        CloseAssault
    };
}


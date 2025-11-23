// ============================================================================
// CAMPAIGN FOR NORTH AFRICA - GAME ENGINE
// ============================================================================
// Comprehensive game state management using rules from sections 1-15
// ============================================================================

class CNAGameEngine {
    constructor() {
        this.gameState = {
            // [5.1] Game Turn Information
            gameTurn: new CNA_Rules.GameTurn(1, new Date(1940, 8, 13)),
            currentOperationsStage: 1,
            currentPhase: 'MOVEMENT',
            phasingPlayer: null,
            nonPhasingPlayer: null,
            
            // Map and Units
            map: [],
            units: [],
            dumps: [],
            
            // Game Control
            speed: 1,
            paused: false,
            
            // Weather
            weather: { temp: 35, ghibli: false, condition: 'NORMAL' }
        };
        
        this.initialize();
    }
    
    // ========================================================================
    // INITIALIZATION
    // ========================================================================
    
    initialize() {
        this.initializeMap();
        this.deployInitialForces();
        this.gameState.paused = false;
        
        // [7.0] Determine initial initiative
        this.determineInitiative();
        
        logger.log('[5.0]', 'Game Turn 1 begins - September 13, 1940', 'INFO');
    }
    
    initializeMap() {
        // Create 150x20 hex grid representing Tripoli to Alexandria
        for(let q = 0; q < 150; q++) {
            this.gameState.map[q] = [];
            
            // Coastline calculations based on historical geography
            let coastR = this.calculateCoastline(q);
            
            for(let r = 0; r < 20; r++) {
                let terrain = this.determineTerrain(q, r, coastR);
                
                this.gameState.map[q][r] = {
                    q: q,
                    r: r,
                    type: terrain,
                    units: [],
                    fortificationLevel: 0,
                    minefields: [],
                    supplyDump: null
                };
                
                // Add major cities
                this.addCities(q, r, coastR);
            }
        }
    }
    
    calculateCoastline(q) {
        if (q < 30) {
            return 2; // Tripolitania
        } else if (q >= 30 && q < 60) {
            // Gulf of Sirte
            let x = (q - 45) / 15;
            return Math.floor(2 + (1 - x*x) * 6);
        } else if (q >= 60 && q < 90) {
            // Cyrenaica Bulge
            let x = (q - 75) / 15;
            return Math.floor(1 + (x*x));
        } else {
            return 3; // Egypt
        }
    }
    
    determineTerrain(q, r, coastR) {
        if (r < coastR) {
            return 'SEA';
        } else if (r === coastR) {
            return 'ROAD'; // Coastal road
        } else {
            // Qattara Depression
            if (q > 110 && q < 135 && r > coastR + 3 && r < coastR + 8) {
                return 'SALT_MARSH';
            }
            // Jebel Akhdar escarpment
            else if (q > 65 && q < 85 && r === coastR + 1) {
                return 'ESCARPMENT';
            }
            // Random rough terrain
            else if (Math.random() < 0.1) {
                return 'ROUGH';
            }
            return 'CLEAR';
        }
    }
    
    addCities(q, r, coastR) {
        if (r === coastR) {
            const cities = [
                { q: 5, name: 'Tripoli', faction: 'AXIS' },
                { q: 45, name: 'Sirte', faction: 'AXIS' },
                { q: 75, name: 'Benghazi', faction: 'AXIS' },
                { q: 95, name: 'Tobruk', faction: 'CW' },
                { q: 115, name: 'Mersa Matruh', faction: 'CW' },
                { q: 130, name: 'El Alamein', faction: 'CW' },
                { q: 145, name: 'Alexandria', faction: 'CW' }
            ];
            
            for (let city of cities) {
                if (q === city.q) {
                    this.gameState.map[q][r].type = 'CITY';
                    this.gameState.dumps.push({
                        q: q,
                        r: r,
                        faction: city.faction,
                        name: city.name,
                        supplies: { fuel: 10000, water: 10000, ammo: 5000, stores: 5000 }
                    });
                }
            }
        }
    }
    
    // ========================================================================
    // [4.4] UNIT DEPLOYMENT - Historical Starting Positions
    // ========================================================================
    
    deployInitialForces() {
        // AXIS FORCES (Italian 10th Army - Libya, September 1940)
        this.createUnit({
            id: 'IT_10_ARMY_HQ',
            name: '10th Army HQ',
            faction: 'AXIS',
            nationality: 'ITALIAN',
            type: CNA_Rules.UnitType.HQ_DIVISION,
            position: { q: 75, r: 4 },
            characteristicsKey: 'IT_INF_BN',
            morale: 0,
            currentTOE: 1,
            hasAttachedCombatUnits: true
        });
        
        // Italian Infantry Divisions
        for (let i = 0; i < 6; i++) {
            this.createUnit({
                id: `IT_DIV_${i}`,
                name: `Italian ${i+1}° Division`,
                faction: 'AXIS',
                nationality: 'ITALIAN',
                type: CNA_Rules.UnitType.INFANTRY_BN,
                position: { q: 10 + i * 10, r: 4 },
                characteristicsKey: 'IT_INF_BN',
                morale: 0,
                currentTOE: 1
            });
        }
        
        // Italian Armor
        this.createUnit({
            id: 'IT_ARIETE',
            name: 'Ariete Armored Division',
            faction: 'AXIS',
            nationality: 'ITALIAN',
            type: CNA_Rules.UnitType.TANK_BN,
            position: { q: 70, r: 4 },
            characteristicsKey: 'IT_TANK_BN',
            morale: 1,
            currentTOE: 5
        });
        
        // COMMONWEALTH FORCES (Western Desert Force)
        this.createUnit({
            id: 'CW_WDF_HQ',
            name: 'Western Desert Force HQ',
            faction: 'CW',
            nationality: 'BRITISH',
            type: CNA_Rules.UnitType.HQ_DIVISION,
            position: { q: 115, r: 5 },
            characteristicsKey: 'CW_INF_BN',
            morale: 1,
            currentTOE: 1,
            hasAttachedCombatUnits: true
        });
        
        // 7th Armoured Division ("Desert Rats")
        this.createUnit({
            id: 'CW_7_ARMOURED',
            name: '7th Armoured Division',
            faction: 'CW',
            nationality: 'BRITISH',
            type: CNA_Rules.UnitType.TANK_BN,
            position: { q: 110, r: 5 },
            characteristicsKey: 'CW_TANK_BN',
            morale: 2,
            currentTOE: 8
        });
        
        // Commonwealth Infantry
        for (let i = 0; i < 3; i++) {
            this.createUnit({
                id: `CW_INF_${i}`,
                name: `Commonwealth ${['4th Indian', '6th Australian', 'New Zealand'][i]} Division`,
                faction: 'CW',
                nationality: 'BRITISH',
                type: CNA_Rules.UnitType.INFANTRY_BN,
                position: { q: 120 + i * 8, r: 5 },
                characteristicsKey: 'CW_INF_BN',
                morale: 1,
                currentTOE: 1
            });
        }
    }
    
    createUnit(config) {
        const unit = {
            id: config.id,
            name: config.name,
            faction: config.faction,
            nationality: config.nationality,
            type: config.type,
            position: config.position,
            
            // [3.5] Unit Characteristics
            characteristics: CNA_Rules.UnitCharacteristicsDB[config.characteristicsKey],
            
            // [17.0] Morale
            morale: config.morale || 0,
            
            // Current Strength
            currentTOE: config.currentTOE || 1,
            
            // [6.2] Cohesion
            cohesionLevel: 0,
            
            // [6.1] CP Expenditure tracking (per operations stage)
            cpExpenditure: { 1: 0, 2: 0, 3: 0 },
            
            // Status
            status: 'ACTIVE', // ACTIVE, BROKEN, DESTROYED
            
            // [18.0] Reserve Status
            reserveStatus: false,
            
            // Combat states
            contact: false,
            engaged: false,
            stoppedInZOC: false,
            
            // Supplies (for logistics game)
            supplies: {
                fuel: 1000,
                water: 1000,
                ammunition: 500,
                stores: 500
            },
            
            // Attached units
            attachedTrucks: 0,
            attachedBrigades: config.attachedBrigades || [],
            attachedBattalions: config.attachedBattalions || [],
            hasAttachedCombatUnits: config.hasAttachedCombatUnits || false,
            
            // Organization
            maxBrigades: config.maxBrigades || 2,
            maxBattalions: config.maxBattalions || 3
        };
        
        this.gameState.units.push(unit);
        
        // Add unit to map hex
        const hex = this.gameState.map[config.position.q][config.position.r];
        if (hex) {
            hex.units.push(unit);
        }
        
        logger.log('[4.4]', `Deployed: ${unit.name} at (${unit.position.q},${unit.position.r})`);
        
        return unit;
    }
    
    // ========================================================================
    // [5.0] GAME TURN SEQUENCE
    // ========================================================================
    
    advanceTurn() {
        // Check if all 3 operations stages completed
        if (this.gameState.currentOperationsStage >= 3) {
            // End of turn - advance to next turn
            this.gameState.gameTurn.turnNumber++;
            this.gameState.gameTurn.date.setDate(
                this.gameState.gameTurn.date.getDate() + 7
            );
            this.gameState.currentOperationsStage = 1;
            
            // Strategic Phase
            this.executeStrategicPhase();
            
            // Determine new initiative
            this.determineInitiative();
            
            logger.log('[5.1]', 
                `Game Turn ${this.gameState.gameTurn.turnNumber} - ${this.dateString}`, 
                'INFO'
            );
        } else {
            // Advance to next operations stage
            this.gameState.currentOperationsStage++;
            
            // Determine who moves first this stage
            if (this.gameState.phasingPlayer === 'AXIS') {
                // Axis player chooses
                this.gameState.phasingPlayer = Math.random() > 0.5 ? 'AXIS' : 'CW';
            }
        }
        
        // Reset CP expenditure for new operations stage
        for (let unit of this.gameState.units) {
            unit.cpExpenditure[this.gameState.currentOperationsStage] = 0;
        }
    }
    
    executeStrategicPhase() {
        // [20.0] Reinforcements
        this.processReinforcements();
        
        // [29.0] Weather Determination
        this.determineWeather();
        
        // [6.24] Reorganization for units not moving
        for (let unit of this.gameState.units) {
            const rp = CNA_Rules.CapabilityPointSystem.checkReorganizationPoints(unit, {
                noMovement: true,
                noCombat: true,
                nearHQ: this.isNearHQ(unit)
            });
            
            if (rp > 0) {
                CNA_Rules.CapabilityPointSystem.applyReorganizationPoints(unit, rp);
            }
        }
    }
    
    // ========================================================================
    // [7.0] INITIATIVE
    // ========================================================================
    
    determineInitiative() {
        const axisMod = CNA_Rules.Initiative.getInitiativeModifier(
            'AXIS',
            this.gameState.gameTurn
        );
        const cwMod = CNA_Rules.Initiative.getInitiativeModifier(
            'CW',
            this.gameState.gameTurn
        );
        
        const winner = CNA_Rules.Initiative.determineInitiative(
            this.gameState.gameTurn,
            axisMod,
            cwMod
        );
        
        this.gameState.phasingPlayer = winner;
        this.gameState.nonPhasingPlayer = winner === 'AXIS' ? 'CW' : 'AXIS';
        
        logger.log('[7.0]', 
            `Initiative: ${winner} (Axis +${axisMod}, CW +${cwMod})`
        );
    }
    
    // ========================================================================
    // [29.0] WEATHER
    // ========================================================================
    
    determineWeather() {
        // Temperature variation
        this.gameState.weather.temp += (Math.random() - 0.5) * 3;
        this.gameState.weather.temp = Math.max(20, Math.min(50, this.gameState.weather.temp));
        
        // [29.4] Sandstorms (Ghibli)
        Rule_Ghibli.execute(this.gameState.weather);
        
        // [29.5] Rainstorms (rare)
        if (Math.random() < 0.02 && this.gameState.weather.temp < 25) {
            this.gameState.weather.condition = 'RAIN';
            logger.log('[29.5]', 'Rainstorm begins - movement restricted', 'WARN');
        } else if (this.gameState.weather.condition === 'RAIN' && Math.random() < 0.3) {
            this.gameState.weather.condition = 'NORMAL';
        }
    }
    
    // ========================================================================
    // AI SIMULATION (Simplified)
    // ========================================================================
    
    tick() {
        if (this.gameState.paused) return;
        
        // Weather effects
        this.applyWeatherEffects();
        
        // Simulate unit actions
        this.simulateUnitActions();
        
        // Check for end of operations stage
        if (Math.random() < 0.05) {
            this.advanceTurn();
        }
        
        // Update 3D visualization
        if (typeof update3D !== 'undefined') {
            update3D(this.gameState.units);
        }
    }
    
    simulateUnitActions() {
        // Simple AI: units move toward enemy
        for (let unit of this.gameState.units) {
            if (unit.status !== 'ACTIVE') continue;
            if (this.gameState.weather.ghibli) continue; // No movement in sandstorms
            
            // Attempt movement
            if (Math.random() < 0.3) {
                this.simulateMovement(unit);
            }
            
            // [21.0] Check for breakdown
            Rule_Breakdown.execute(unit, this.gameState.map[unit.position.q][unit.position.r].type);
            
            // Logistics effects
            Rule_Evaporation.execute(unit, this.gameState.weather.temp);
            Rule_Pasta.execute(unit);
            Rule_LOC.execute(unit, this.gameState.dumps);
            
            // Repair broken units
            if (unit.status === 'BROKEN' && Math.random() < 0.05) {
                unit.status = 'ACTIVE';
                STATS.repairs.value++;
                logger.log('[22.2]', `${unit.name} repairs completed`);
            }
        }
    }
    
    simulateMovement(unit) {
        const targetDirection = unit.faction === 'AXIS' ? 1 : -1;
        const dq = (Math.random() > 0.7) ? targetDirection : (Math.random() > 0.5 ? 1 : -1);
        const dr = Math.floor(Math.random() * 3) - 1;
        
        const newQ = Math.min(149, Math.max(0, unit.position.q + dq));
        const newR = Math.min(19, Math.max(0, unit.position.r + dr));
        const newHex = { q: newQ, r: newR };
        
        // [8.1] Attempt to move unit
        const moveResult = CNA_Rules.Movement.moveUnit(
            unit,
            unit.position,
            newHex,
            this.gameState
        );
        
        if (moveResult.success) {
            // Remove from old hex
            const oldHex = this.gameState.map[unit.position.q][unit.position.r];
            oldHex.units = oldHex.units.filter(u => u.id !== unit.id);
            
            // Add to new hex
            const newHexData = this.gameState.map[newQ][newR];
            newHexData.units.push(unit);
            unit.position = newHex;
        }
    }
    
    applyWeatherEffects() {
        // [29.3] Hot weather effects
        if (this.gameState.weather.temp > 40) {
            for (let unit of this.gameState.units) {
                if (Math.random() < 0.01) {
                    unit.cohesionLevel -= 1;
                }
            }
        }
    }
    
    // ========================================================================
    // HELPER METHODS
    // ========================================================================
    
    isNearHQ(unit) {
        // Check if unit is within 5 hexes of a friendly HQ
        for (let otherUnit of this.gameState.units) {
            if (otherUnit.faction !== unit.faction) continue;
            if (!otherUnit.type.includes('HQ')) continue;
            
            const dist = CNA_Rules.Movement.hexDistance(unit.position, otherUnit.position);
            if (dist <= 5) return true;
        }
        return false;
    }
    
    processReinforcements() {
        // Simplified reinforcement system
        // [20.1] Add new units based on historical schedule
        const turn = this.gameState.gameTurn.turnNumber;
        
        // Example: Afrika Korps arrives turn 20 (Feb 1941)
        if (turn === 20) {
            this.createUnit({
                id: 'GER_5_LIGHT',
                name: '5th Light Division (Afrika Korps)',
                faction: 'AXIS',
                nationality: 'GERMAN',
                type: CNA_Rules.UnitType.HQ_DIVISION,
                position: { q: 5, r: 3 },
                characteristicsKey: 'GER_INF_BN',
                morale: 2,
                currentTOE: 1,
                hasAttachedCombatUnits: true
            });
            
            logger.log('[20.1]', 'Afrika Korps arrives in Tripoli!', 'INFO');
        }
    }
    
    get dateString() {
        return this.gameState.gameTurn.date.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }
    
    // ========================================================================
    // GAME CONTROL
    // ========================================================================
    
    setSpeed(v) {
        this.gameState.speed = v;
        if (typeof document !== 'undefined') {
            document.getElementById('speed-display').innerText = 
                v === 0 ? 'PAUSED' : v + 'x';
        }
    }
    
    adjustSpeed(mult) {
        if (this.gameState.speed === 0) this.gameState.speed = 1;
        this.gameState.speed *= mult;
        this.setSpeed(this.gameState.speed);
    }
    
    loop() {
        if (!this.gameState.paused && this.gameState.speed > 0) {
            if (Math.random() < 0.1 * this.gameState.speed) {
                this.tick();
            }
        }
        requestAnimationFrame(() => this.loop());
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.CNAGameEngine = CNAGameEngine;
}


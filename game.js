// --- GAME CLASS ---
class Game {
    constructor() {
        this.turn = 1;
        this.date = new Date(1940, 8, 13);
        this.units = [];
        this.dumps = [];
        this.map = [];
        this.speed = 1;
        this.paused = true;
        this.weather = { temp: 35, ghibli: false };
        this.init();
    }
    
    get dateString() { 
        return this.date.toLocaleDateString('en-GB', { 
            day: 'numeric', 
            month: 'short', 
            year: 'numeric' 
        }); 
    }
    
    init() {
        // HISTORICAL MAP GENERATION (Tripoli to Alexandria, 150x20 grid)
        for(let q = 0; q < 150; q++) {
            this.map[q] = [];
            
            // Coastline calculations
            let coastR = 2; 
            if (q < 30) {
                coastR = 2; // Tripolitania
            } else if (q >= 30 && q < 60) { 
                // Gulf of Sirte
                let x = (q - 45) / 15; 
                coastR = 2 + (1 - x*x) * 6; 
            } else if (q >= 60 && q < 90) { 
                // Cyrenaica Bulge
                let x = (q - 75) / 15;
                coastR = 1 + (x*x);
            } else { 
                coastR = 3; // Egypt
            }
            
            coastR = Math.floor(coastR);

            for(let r = 0; r < 20; r++) {
                let t = 'CLEAR';
                
                if (r < coastR) {
                    t = 'SEA';
                } else if (r === coastR) {
                    t = 'ROAD'; 
                } else {
                    // Qattara Depression
                    if (q > 110 && q < 135 && r > coastR + 3 && r < coastR + 8) {
                        t = 'SALT_MARSH';
                    } 
                    // Jebel Akhdar escarpment
                    else if (q > 65 && q < 85 && r === coastR + 1) {
                        t = 'ESCARPMENT';
                    } 
                    else if (Math.random() < 0.1) {
                        t = 'ROUGH';
                    }
                }
                
                // Cities along the coast
                if (r === coastR) {
                    if (q === 5) { 
                        t = 'CITY'; 
                        this.dumps.push({q, r, faction: 'AXIS', name: 'Tripoli'}); 
                    } 
                    if (q === 45) { 
                        t = 'CITY'; 
                    } 
                    if (q === 75) { 
                        t = 'CITY'; 
                        this.dumps.push({q, r, faction: 'AXIS', name: 'Benghazi'}); 
                    } 
                    if (q === 95) { 
                        t = 'CITY'; 
                        this.dumps.push({q, r, faction: 'CW', name: 'Tobruk'}); 
                    } 
                    if (q === 130) { 
                        t = 'CITY'; 
                        this.dumps.push({q, r, faction: 'CW', name: 'El Alamein'}); 
                    } 
                    if (q === 145) { 
                        t = 'CITY'; 
                        this.dumps.push({q, r, faction: 'CW', name: 'Alexandria'}); 
                    }
                }
                
                this.map[q][r] = { type: t, units: [] };
            }
        }
        
        // DEPLOY UNITS
        for(let i = 0; i < 15; i++) {
            this.units.push({
                id: i, 
                name: `Axis Unit ${i}`, 
                faction: 'AXIS', 
                nationality: i < 8 ? 'ITALIAN' : 'GERMAN',
                q: Math.floor(Math.random() * 20) + 10, 
                r: 4, 
                supplies: {fuel: 1000, water: 1000, stores: 500}, 
                cohesion: 100, 
                status: 'ACTIVE'
            });
        }
        
        for(let i = 15; i < 30; i++) {
            this.units.push({
                id: i, 
                name: `CW Unit ${i}`, 
                faction: 'CW', 
                nationality: 'BRITISH',
                q: Math.floor(Math.random() * 20) + 110, 
                r: 5,
                supplies: {fuel: 1000, water: 1000, stores: 500}, 
                cohesion: 100, 
                status: 'ACTIVE'
            });
        }
        
        this.paused = false;
    }

    setSpeed(v) { 
        this.speed = v; 
        document.getElementById('speed-display').innerText = v === 0 ? 'PAUSED' : v + 'x';
    }
    
    adjustSpeed(mult) {
        if (this.speed === 0) this.speed = 1;
        this.speed *= mult;
        this.setSpeed(this.speed);
    }
    
    loop() {
        if (!this.paused && this.speed > 0) {
            if (Math.random() < 0.1 * this.speed) {
                this.tick();
            }
        }
        requestAnimationFrame(() => this.loop());
    }

    tick() {
        Rule_Ghibli.execute(this.weather);
        this.weather.temp += (Math.random() - 0.5);
        
        const unit = this.units[Math.floor(Math.random() * this.units.length)];
        
        if (unit.status === 'ACTIVE') {
            if (!this.weather.ghibli) {
                const dq = (Math.random() > 0.5) ? (unit.faction === 'AXIS' ? 1 : -1) : (Math.random() > 0.5 ? 1 : -1); 
                const dr = Math.floor(Math.random() * 3) - 1;
                const nq = Math.min(149, Math.max(0, unit.q + dq));
                const nr = Math.min(19, Math.max(0, unit.r + dr));
                
                if (this.map[nq][nr].type !== 'SEA') {
                    unit.q = nq; 
                    unit.r = nr;
                    Rule_Breakdown.execute(unit, this.map[nq][nr].type);
                }
            }
            
            Rule_Evaporation.execute(unit, this.weather.temp);
            Rule_Pasta.execute(unit);
            Rule_LOC.execute(unit, this.dumps);
        } else if (unit.status === 'BROKEN') {
            if (Math.random() < 0.05) {
                unit.status = 'ACTIVE';
                STATS.repairs.value++;
                logger.log('[Case 12.4]', `${unit.name} repairs completed.`);
            }
        }
        
        if (Math.random() < 0.01) {
            this.turn++;
            this.date.setDate(this.date.getDate() + 1);
        }
        
        update3D(this.units); 
    }
}


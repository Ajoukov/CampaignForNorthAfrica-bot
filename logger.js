// --- LOGGER CLASS ---
class Logger {
    constructor() { 
        this.logs = []; 
    }
    
    log(ruleRef, message, type = 'INFO') {
        const entry = {
            id: Date.now() + Math.random(),
            turn: GLOBAL_GAME_REF ? GLOBAL_GAME_REF.turn : 0,
            date: GLOBAL_GAME_REF ? GLOBAL_GAME_REF.dateString : 'Pre-War',
            ruleRef, 
            message, 
            type
        };
        this.logs.unshift(entry);
        
        // Update Live Ticker
        const ticker = document.getElementById('live-ticker');
        const el = document.createElement('div');
        el.className = `border-l-2 pl-2 ${
            type === 'WARN' ? 'border-yellow-500 text-yellow-200' : 
            type === 'CRITICAL' ? 'border-red-500 text-red-300' : 
            'border-blue-500 text-gray-300'
        }`;
        el.innerHTML = `<span class="opacity-50 mr-2">[${entry.date}]</span> <span class="text-yellow-500 font-bold">${ruleRef}</span> ${message}`;
        ticker.prepend(el);
        
        if (ticker.children.length > 5) {
            ticker.lastChild.remove();
        }
        
        this.renderNewspaperEntry(entry);
    }

    renderNewspaperEntry(entry) {
        const paper = document.getElementById('newspaper-content');
        if (!paper) return;
        
        const div = document.createElement('div');
        div.className = "border-b border-gray-300 pb-4";
        div.innerHTML = `
            <div class="flex justify-between items-baseline mb-1">
                <span class="font-bold text-sm uppercase tracking-wide text-gray-500">${entry.date} &mdash; Turn ${entry.turn}</span>
                <span class="font-mono text-xs bg-black text-white px-2 py-0.5">${entry.ruleRef}</span>
            </div>
            <p class="text-lg leading-relaxed ${entry.type === 'CRITICAL' ? 'text-red-800 font-bold' : 'text-gray-800'}">${entry.message}</p>
        `;
        paper.prepend(div);
    }
    
    // Export logs to downloadable file
    exportLogs() {
        const logText = this.logs.map(log => 
            `[${log.date} Turn ${log.turn}] [${log.ruleRef}] ${log.type}: ${log.message}`
        ).join('\n');
        
        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cna-debug-log-${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('✅ Logs exported:', this.logs.length, 'entries');
    }
    
    // Get diagnostic information
    getDiagnostics() {
        const gameRef = window.GLOBAL_GAME_REF;
        const diagnostics = {
            timestamp: new Date().toISOString(),
            gameExists: !!gameRef,
            logsCount: this.logs.length,
            gameState: 'NOT_INITIALIZED'
        };
        
        if (gameRef) {
            try {
                diagnostics.gameState = {
                    exists: !!gameRef.gameState,
                    units: gameRef.gameState?.units?.length || 0,
                    paused: gameRef.gameState?.paused,
                    speed: gameRef.gameState?.speed,
                    turn: gameRef.gameState?.gameTurn?.turnNumber,
                    date: gameRef.dateString || 'N/A',
                    weather: gameRef.gameState?.weather?.condition || 'N/A'
                };
            } catch (e) {
                diagnostics.error = e.message;
            }
        }
        
        console.log('🔍 DIAGNOSTICS:', JSON.stringify(diagnostics, null, 2));
        return diagnostics;
    }
    
    // Print detailed diagnostic report
    printDiagnosticReport() {
        console.log('='.repeat(80));
        console.log('CAMPAIGN FOR NORTH AFRICA - DIAGNOSTIC REPORT');
        console.log('='.repeat(80));
        
        const diag = this.getDiagnostics();
        console.log('Game Reference:', diag.gameExists ? '✅ EXISTS' : '❌ MISSING');
        console.log('Total Logs:', diag.logsCount);
        
        if (diag.gameState && typeof diag.gameState === 'object') {
            console.log('\nGame State:');
            console.log('  Units:', diag.gameState.units);
            console.log('  Speed:', diag.gameState.speed);
            console.log('  Paused:', diag.gameState.paused);
            console.log('  Turn:', diag.gameState.turn);
            console.log('  Date:', diag.gameState.date);
            console.log('  Weather:', diag.gameState.weather);
        }
        
        console.log('\nRecent Logs (last 10):');
        this.logs.slice(0, 10).forEach((log, i) => {
            console.log(`  ${i+1}. [${log.ruleRef}] ${log.message}`);
        });
        
        console.log('\n' + '='.repeat(80));
        console.log('To export full logs, run: logger.exportLogs()');
        console.log('='.repeat(80));
    }
}

const logger = new Logger();


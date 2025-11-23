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
}

const logger = new Logger();


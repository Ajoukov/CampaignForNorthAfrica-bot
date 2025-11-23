// --- UI CONTROLLER ---
const ui = {
    toggleStats: () => {
        document.getElementById('modal-stats').classList.toggle('hidden');
        ui.filterStats();
    },
    
    toggleNewspaper: () => {
        document.getElementById('modal-newspaper').classList.toggle('hidden');
    },
    
    filterStats: () => {
        const query = document.getElementById('stats-search').value.toLowerCase();
        const grid = document.getElementById('stats-grid');
        grid.innerHTML = '';
        
        Object.keys(STATS).forEach(key => {
            const stat = STATS[key];
            if (stat.label.toLowerCase().includes(query) || stat.category.toLowerCase().includes(query)) {
                const el = document.createElement('div');
                el.className = "bg-gray-800 p-4 rounded border border-gray-700 flex justify-between items-center";
                el.innerHTML = `
                    <div>
                        <div class="text-xs text-gray-500 uppercase">${stat.category}</div>
                        <div class="text-sm font-bold text-gray-200">${stat.label}</div>
                    </div>
                    <div class="text-xl font-mono text-blue-400">${stat.value.toLocaleString()}</div>
                `;
                grid.appendChild(el);
            }
        });
    },
    
    updateInspector: (q, r) => {
        const panel = document.getElementById('inspector-content');
        
        // Get gameState from global reference
        const gameState = GLOBAL_GAME_REF.gameState || GLOBAL_GAME_REF;
        const tile = gameState.map[q][r];
        const units = gameState.units.filter(u => u.position && u.position.q === q && u.position.r === r);
        const dump = gameState.dumps.find(d => d.q === q && d.r === r);
        
        document.getElementById('insp-coords').innerText = `[${q}, ${r}]`;
        
        let html = `<div class="mb-2 pb-1 border-b border-gray-700 text-yellow-500 font-bold uppercase">${tile.type}</div>`;
        
        if (dump) {
            html += `<div class="text-xs bg-yellow-900 text-yellow-100 p-2 mb-2 rounded border border-yellow-600">
                <div class="font-bold">🏭 ${dump.name}</div>
                <div class="text-[10px] mt-1">${dump.faction} Supply Dump</div>
            </div>`;
        }
        
        if (units.length === 0) {
            html += `<div class="text-gray-500 italic text-sm">Sector Clear - No Units Present</div>`;
        } else {
            units.forEach(u => {
                const cohesionColor = u.cohesionLevel >= 0 ? 'text-green-400' : 
                                     u.cohesionLevel >= -10 ? 'text-yellow-400' : 'text-red-400';
                const statusColor = u.status === 'ACTIVE' ? 'text-green-400' : 
                                   u.status === 'BROKEN' ? 'text-orange-400' : 'text-red-400';
                
                html += `
                    <div class="bg-white/5 p-2 rounded mb-2 border border-white/10 hover:bg-white/10 transition">
                        <div class="flex justify-between text-xs font-bold ${u.faction === 'AXIS' ? 'text-red-400' : 'text-blue-400'} mb-1">
                            <span>${u.name}</span>
                            <span class="text-gray-500">${u.nationality.substr(0,3)}</span>
                        </div>
                        
                        ${u.type ? `<div class="text-[9px] text-gray-500 mb-1">${u.type.replace(/_/g, ' ')}</div>` : ''}
                        
                        <div class="grid grid-cols-2 gap-1 text-[10px] font-mono">
                            <div class="text-gray-400">Status:</div>
                            <div class="${statusColor}">${u.status}</div>
                            
                            <div class="text-gray-400">Cohesion:</div>
                            <div class="${cohesionColor}">${u.cohesionLevel || 0}</div>
                            
                            ${u.currentTOE ? `
                            <div class="text-gray-400">Strength:</div>
                            <div class="text-blue-300">${u.currentTOE}/${u.characteristics?.maxTOE || '?'} TOE</div>
                            ` : ''}
                            
                            ${u.morale !== undefined ? `
                            <div class="text-gray-400">Morale:</div>
                            <div class="text-purple-300">${u.morale >= 0 ? '+' : ''}${u.morale}</div>
                            ` : ''}
                        </div>
                        
                        ${u.supplies ? `
                        <div class="mt-2 pt-1 border-t border-gray-700 grid grid-cols-2 gap-1 text-[9px]">
                            <div class="text-gray-500">💧 Water: <span class="text-blue-400">${Math.floor(u.supplies.water)}</span></div>
                            <div class="text-gray-500">⛽ Fuel: <span class="text-yellow-400">${Math.floor(u.supplies.fuel)}</span></div>
                            <div class="text-gray-500">💥 Ammo: <span class="text-red-400">${Math.floor(u.supplies.ammunition || 0)}</span></div>
                            <div class="text-gray-500">📦 Stores: <span class="text-green-400">${Math.floor(u.supplies.stores || 0)}</span></div>
                        </div>
                        ` : ''}
                    </div>
                `;
            });
        }
        
        panel.innerHTML = html;
    }
};


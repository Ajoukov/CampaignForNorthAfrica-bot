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
        const tile = game.map[q][r];
        const units = game.units.filter(u => u.q === q && u.r === r);
        const dump = game.dumps.find(d => d.q === q && d.r === r);
        
        document.getElementById('insp-coords').innerText = `[${q}, ${r}]`;
        
        let html = `<div class="mb-2 pb-1 border-b border-gray-700 text-yellow-500 font-bold">${tile.type}</div>`;
        
        if (dump) {
            html += `<div class="text-xs bg-yellow-900 text-yellow-100 p-1 mb-2 rounded">🏭 ${dump.name} (${dump.faction})</div>`;
        }
        
        if (units.length === 0) {
            html += `<div class="text-gray-600">Sector Clear</div>`;
        } else {
            units.forEach(u => {
                html += `
                    <div class="bg-white/5 p-2 rounded mb-1 border border-white/10">
                        <div class="flex justify-between text-xs font-bold ${u.faction === 'AXIS' ? 'text-red-400' : 'text-blue-400'}">
                            <span>${u.name}</span>
                            <span>${u.nationality.substr(0,3)}</span>
                        </div>
                        <div class="grid grid-cols-2 gap-2 mt-1 text-[10px] text-gray-400 font-mono">
                            <div>W: ${Math.floor(u.supplies.water)}</div>
                            <div>F: ${Math.floor(u.supplies.fuel)}</div>
                            <div>${u.status}</div>
                            <div>${u.cohesion}%</div>
                        </div>
                    </div>
                `;
            });
        }
        
        panel.innerHTML = html;
    }
};


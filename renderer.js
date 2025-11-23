// --- 3D RENDERER ---
let scene, camera, renderer, controls, unitMeshes = new Map();
let cityMarkers = [];
let dumpMarkers = [];
const HEX_SIZE = 0.5;

function init3D() {
    const container = document.getElementById('game-layer');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    
    const aspect = window.innerWidth / window.innerHeight;
    const d = 40;
    camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
    
    // CENTER CAMERA on the map (approx x=75, z=10 in grid space)
    camera.position.set(65, 50, 50); 
    
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);
    
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(65, 0, 7.5); 
    controls.enableRotate = false;
    
    // Map Left Click to PAN
    controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
    };
    controls.update();
    
    // Enhanced Lighting
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(65, 50, 20);
    scene.add(dirLight);
    
    const dirLight2 = new THREE.DirectionalLight(0xffd700, 0.5);
    dirLight2.position.set(-20, 30, -10);
    scene.add(dirLight2);
    
    scene.add(new THREE.AmbientLight(0xa0a0a0));

    // Window Resize
    window.addEventListener('resize', () => {
        const aspect = window.innerWidth / window.innerHeight;
        camera.left = -d * aspect;
        camera.right = d * aspect;
        camera.top = d;
        camera.bottom = -d;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    animate();
}

function getHexPos(q, r) {
    const width = Math.sqrt(3) * HEX_SIZE;
    const height = 2 * HEX_SIZE;
    const x = width * (q + 0.5 * (r % 2));
    const z = height * 0.75 * r;
    return { x, z };
}

function renderTerrain(mapData) {
    // Materials
    const matClear = new THREE.MeshLambertMaterial({ color: 0xd2b48c }); // Tan
    const matRough = new THREE.MeshLambertMaterial({ color: 0xa08c70 }); // Brown
    const matEscarp = new THREE.MeshLambertMaterial({ color: 0x8b4513 }); // Dark
    const matRoad = new THREE.MeshLambertMaterial({ color: 0x555555 }); // Grey
    const matCity = new THREE.MeshLambertMaterial({ color: 0xffffff }); // White
    const matMarsh = new THREE.MeshLambertMaterial({ color: 0x1e293b }); // Dark Swamp
    const matSea = new THREE.MeshLambertMaterial({ color: 0x1e3a8a }); // Deep Blue

    // Hex Geometry
    const hexGeo = new THREE.CylinderGeometry(HEX_SIZE, HEX_SIZE, 0.2, 6);
    
    // Create hexagonal outline (top only)
    function createHexOutline() {
        const points = [];
        for (let i = 0; i <= 6; i++) {
            const angle = (Math.PI / 3) * i;
            points.push(new THREE.Vector3(
                HEX_SIZE * Math.cos(angle),
                0,
                HEX_SIZE * Math.sin(angle)
            ));
        }
        const hexOutlineGeo = new THREE.BufferGeometry().setFromPoints(points);
        return hexOutlineGeo;
    }
    
    const hexOutlineGeo = createHexOutline();
    const hexOutlineMat = new THREE.LineBasicMaterial({ color: 0x444444, linewidth: 1 });

    // Infinite Backdrop Planes
    // Sea (North)
    const seaPlaneGeo = new THREE.PlaneGeometry(500, 500);
    const seaPlaneMat = new THREE.MeshLambertMaterial({ color: 0x1e3a8a, side: THREE.DoubleSide });
    const seaPlane = new THREE.Mesh(seaPlaneGeo, seaPlaneMat);
    seaPlane.rotation.x = -Math.PI / 2;
    seaPlane.rotation.z = -0.005;
    seaPlane.position.set(75, -0.2, -248.5);
    scene.add(seaPlane);

    // Desert (South)
    const landPlaneGeo = new THREE.PlaneGeometry(500, 500);
    const landPlaneMat = new THREE.MeshLambertMaterial({ color: 0xd2b48c, side: THREE.DoubleSide });
    const landPlane = new THREE.Mesh(landPlaneGeo, landPlaneMat);
    landPlane.rotation.x = -Math.PI / 2;
    landPlane.position.set(75, -0.3, 230);
    scene.add(landPlane);

    for(let q = 0; q < mapData.length; q++) {
        for(let r = 0; r < mapData[0].length; r++) {
            const tile = mapData[q][r];
            
            let mat = matClear;
            let yOff = 0;
            
            if (tile.type === 'SEA') {
                mat = matSea;
                yOff = -0.1;
            } else if (tile.type === 'ROUGH') { 
                mat = matRough; 
                yOff = 0.1; 
            } else if (tile.type === 'ESCARPMENT') { 
                mat = matEscarp; 
                yOff = 0.2; 
            } else if (tile.type === 'ROAD') {
                mat = matRoad;
            } else if (tile.type === 'CITY') { 
                mat = matCity; 
                yOff = 0.2;
                
                // Add city marker - tall building
                const cityGeo = new THREE.BoxGeometry(HEX_SIZE * 0.5, 1.5, HEX_SIZE * 0.5);
                const cityMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
                const cityMarker = new THREE.Mesh(cityGeo, cityMat);
                const pos = getHexPos(q, r);
                cityMarker.position.set(pos.x, 0.75, pos.z);
                scene.add(cityMarker);
                cityMarkers.push(cityMarker);
            } else if (tile.type === 'SALT_MARSH') {
                mat = matMarsh;
            }
            
            const mesh = new THREE.Mesh(hexGeo, mat);
            const pos = getHexPos(q, r);
            mesh.position.set(pos.x, yOff, pos.z);
            mesh.userData = { q, r }; // Store coords for clicking
            scene.add(mesh);
            
            // Add hex grid outline on top (except for sea hexes)
            if (tile.type !== 'SEA') {
                const outline = new THREE.Line(hexOutlineGeo, hexOutlineMat);
                outline.position.set(pos.x, yOff + 0.11, pos.z);
                // outline.rotation.x = Math.PI / 2; // Rotate to lay flat on top
                outline.rotation.y = Math.PI / 6; // Rotate 30 degrees to align with hex
                scene.add(outline);
            }
        }
    }
    
    // Add supply dump markers
    if (GLOBAL_GAME_REF && GLOBAL_GAME_REF.gameState) {
        const dumps = GLOBAL_GAME_REF.gameState.dumps;
        if (dumps) {
            dumps.forEach(dump => {
                const dumpGeo = new THREE.ConeGeometry(HEX_SIZE * 0.3, 0.8, 4);
                const dumpColor = dump.faction === 'AXIS' ? 0xff0000 : 0x0000ff;
                const dumpMat = new THREE.MeshLambertMaterial({ color: dumpColor });
                const dumpMarker = new THREE.Mesh(dumpGeo, dumpMat);
                const pos = getHexPos(dump.q, dump.r);
                dumpMarker.position.set(pos.x + 0.3, 1.2, pos.z);
                dumpMarker.rotation.y = Math.PI / 4;
                scene.add(dumpMarker);
                dumpMarkers.push(dumpMarker);
            });
        }
    }
}

function update3D(units) {
    if (!units) return;
    
    units.forEach((u, index) => {
        if (!u.position) return; // Skip units without position
        
        let meshGroup = unitMeshes.get(u.id);
        
        if (!meshGroup) {
            // Create a group to hold multiple meshes for each unit
            meshGroup = new THREE.Group();
            
            // Determine unit type and create appropriate geometry
            let mainMesh;
            const factionColor = u.faction === 'AXIS' ? 0xff4444 : 0x4488ff;
            const nationalityColor = getNationalityColor(u.nationality);
            
            if (u.type && u.type.includes('TANK')) {
                // Tank units - larger, tank-shaped
                const tankBody = new THREE.BoxGeometry(HEX_SIZE * 0.6, HEX_SIZE * 0.3, HEX_SIZE * 0.8);
                const tankTurret = new THREE.CylinderGeometry(HEX_SIZE * 0.25, HEX_SIZE * 0.25, HEX_SIZE * 0.3, 8);
                
                const bodyMesh = new THREE.Mesh(tankBody, 
                    new THREE.MeshLambertMaterial({ color: nationalityColor }));
                const turretMesh = new THREE.Mesh(tankTurret, 
                    new THREE.MeshLambertMaterial({ color: factionColor }));
                
                turretMesh.position.y = 0.3;
                meshGroup.add(bodyMesh);
                meshGroup.add(turretMesh);
                mainMesh = bodyMesh;
            } else if (u.type && u.type.includes('HQ')) {
                // HQ units - flag/star shape
                const starGeo = new THREE.ConeGeometry(HEX_SIZE * 0.4, HEX_SIZE * 0.8, 5);
                mainMesh = new THREE.Mesh(starGeo, 
                    new THREE.MeshLambertMaterial({ color: factionColor }));
                mainMesh.rotation.x = Math.PI;
                meshGroup.add(mainMesh);
            } else if (u.type && u.type.includes('ARTILLERY')) {
                // Artillery - cannon shape
                const baseGeo = new THREE.BoxGeometry(HEX_SIZE * 0.4, HEX_SIZE * 0.2, HEX_SIZE * 0.4);
                const barrelGeo = new THREE.CylinderGeometry(HEX_SIZE * 0.1, HEX_SIZE * 0.1, HEX_SIZE * 0.6, 8);
                
                const base = new THREE.Mesh(baseGeo, 
                    new THREE.MeshLambertMaterial({ color: nationalityColor }));
                const barrel = new THREE.Mesh(barrelGeo, 
                    new THREE.MeshLambertMaterial({ color: 0x333333 }));
                
                barrel.rotation.z = Math.PI / 2;
                barrel.position.x = HEX_SIZE * 0.3;
                barrel.position.y = 0.1;
                
                meshGroup.add(base);
                meshGroup.add(barrel);
                mainMesh = base;
            } else {
                // Infantry and other units - simple block
                const geo = new THREE.BoxGeometry(HEX_SIZE * 0.5, HEX_SIZE * 0.5, HEX_SIZE * 0.5);
                mainMesh = new THREE.Mesh(geo, 
                    new THREE.MeshLambertMaterial({ color: factionColor }));
                meshGroup.add(mainMesh);
            }
            
            // Add status indicator ring
            const ringGeo = new THREE.TorusGeometry(HEX_SIZE * 0.4, HEX_SIZE * 0.05, 8, 16);
            const ringMesh = new THREE.Mesh(ringGeo, 
                new THREE.MeshBasicMaterial({ color: 0xffff00 }));
            ringMesh.rotation.x = Math.PI / 2;
            ringMesh.position.y = -HEX_SIZE * 0.3;
            ringMesh.visible = false;
            meshGroup.add(ringMesh);
            meshGroup.userData.statusRing = ringMesh;
            
            scene.add(meshGroup);
            unitMeshes.set(u.id, meshGroup);
        }
        
        // Update position (FIX: use u.position.q and u.position.r)
        const pos = getHexPos(u.position.q, u.position.r);
        meshGroup.position.set(pos.x, 0.3, pos.z);
        
        // Update status indicators
        const statusRing = meshGroup.userData.statusRing;
        if (statusRing) {
            if (u.status === 'BROKEN') {
                statusRing.visible = true;
                statusRing.material.color.setHex(0xff0000); // Red for broken
                meshGroup.rotation.y += 0.02; // Spin broken units
            } else if (u.cohesionLevel && u.cohesionLevel < -10) {
                statusRing.visible = true;
                statusRing.material.color.setHex(0xffaa00); // Orange for low cohesion
            } else if (u.status === 'DESTROYED') {
                meshGroup.visible = false; // Hide destroyed units
            } else {
                statusRing.visible = false;
                meshGroup.rotation.y = 0;
            }
        }
        
        // Scale based on TOE strength
        if (u.currentTOE && u.characteristics && u.characteristics.maxTOE) {
            const scale = 0.5 + (u.currentTOE / u.characteristics.maxTOE) * 0.5;
            meshGroup.scale.set(scale, scale, scale);
        }
    });
    
    // Remove destroyed units
    unitMeshes.forEach((mesh, id) => {
        const unit = units.find(u => u.id === id);
        if (!unit || unit.status === 'DESTROYED') {
            scene.remove(mesh);
            unitMeshes.delete(id);
        }
    });
}

function getNationalityColor(nationality) {
    const colors = {
        'ITALIAN': 0x009246,  // Italian green
        'GERMAN': 0x808080,   // German grey
        'BRITISH': 0x8B4513,  // British tan
        'AUSTRALIAN': 0x228B22, // Australian green
        'NEW_ZEALAND': 0x000080, // NZ navy blue
        'INDIAN': 0xD2691E    // Indian brown
    };
    return colors[nationality] || 0x888888;
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    
    // Animate city markers (pulsing)
    const time = Date.now() * 0.001;
    cityMarkers.forEach((marker, i) => {
        marker.position.y = 0.75 + Math.sin(time + i) * 0.1;
    });
    
    // Animate supply dump markers (rotation)
    dumpMarkers.forEach((marker, i) => {
        marker.rotation.y += 0.01;
    });
    
    renderer.render(scene, camera);
}

// Add visual effect for combat
function addCombatEffect(q, r) {
    const pos = getHexPos(q, r);
    
    // Create explosion particles
    const particleGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
    
    for (let i = 0; i < 10; i++) {
        const particle = new THREE.Mesh(particleGeo, particleMat);
        particle.position.set(
            pos.x + (Math.random() - 0.5) * 2,
            1 + Math.random() * 2,
            pos.z + (Math.random() - 0.5) * 2
        );
        scene.add(particle);
        
        // Animate and remove after delay
        setTimeout(() => {
            let alpha = 1.0;
            const fadeInterval = setInterval(() => {
                alpha -= 0.1;
                if (alpha <= 0) {
                    scene.remove(particle);
                    clearInterval(fadeInterval);
                }
            }, 50);
        }, 100);
    }
}

// Add movement trail effect
function addMovementTrail(fromQ, fromR, toQ, toR, faction) {
    const from = getHexPos(fromQ, fromR);
    const to = getHexPos(toQ, toR);
    
    const points = [
        new THREE.Vector3(from.x, 0.3, from.z),
        new THREE.Vector3(to.x, 0.3, to.z)
    ];
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ 
        color: faction === 'AXIS' ? 0xff4444 : 0x4488ff,
        linewidth: 2
    });
    
    const line = new THREE.Line(geometry, material);
    scene.add(line);
    
    // Remove after delay
    setTimeout(() => {
        scene.remove(line);
    }, 2000);
}

// Mouse interaction for Inspector
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('mousedown', (event) => {
    if (event.target.closest('button')) return;
    
    // Calculate mouse position
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children);
    
    if (intersects.length > 0) {
        const obj = intersects[0].object;
        if (obj.userData && obj.userData.q !== undefined) {
            ui.updateInspector(obj.userData.q, obj.userData.r);
        }
    }
});


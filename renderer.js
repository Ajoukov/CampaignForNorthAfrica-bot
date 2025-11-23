// --- 3D RENDERER ---
let scene, camera, renderer, controls, unitMeshes = new Map();
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
    
    // Lighting
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(65, 50, 20);
    scene.add(dirLight);
    scene.add(new THREE.AmbientLight(0x808080));

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

    // Infinite Backdrop Planes
    // Sea (North)
    const seaPlaneGeo = new THREE.PlaneGeometry(500, 500);
    const seaPlaneMat = new THREE.MeshLambertMaterial({ color: 0x1e3a8a, side: THREE.DoubleSide });
    const seaPlane = new THREE.Mesh(seaPlaneGeo, seaPlaneMat);
    seaPlane.rotation.x = -Math.PI / 2;
    seaPlane.position.set(75, -0.2, -248);
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
                yOff = 0.3; 
            } else if (tile.type === 'ROAD') {
                mat = matRoad;
            } else if (tile.type === 'CITY') { 
                mat = matCity; 
                yOff = 0.2; 
            } else if (tile.type === 'SALT_MARSH') {
                mat = matMarsh;
            }
            
            const mesh = new THREE.Mesh(hexGeo, mat);
            const pos = getHexPos(q, r);
            mesh.position.set(pos.x, yOff, pos.z);
            mesh.userData = { q, r }; // Store coords for clicking
            scene.add(mesh);
        }
    }
}

function update3D(units) {
    if (!units) return;
    
    units.forEach(u => {
        let mesh = unitMeshes.get(u.id);
        if (!mesh) {
            const geo = new THREE.BoxGeometry(HEX_SIZE, HEX_SIZE, HEX_SIZE);
            const mat = new THREE.MeshLambertMaterial({ 
                color: u.faction === 'AXIS' ? 0xef4444 : 0x3b82f6 
            });
            mesh = new THREE.Mesh(geo, mat);
            scene.add(mesh);
            unitMeshes.set(u.id, mesh);
        }
        
        const pos = getHexPos(u.q, u.r);
        mesh.position.set(pos.x, 0.4, pos.z);
        
        if (u.status === 'BROKEN') {
            mesh.rotation.y += 0.1;
        } else {
            mesh.rotation.y = 0;
        }
    });
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
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


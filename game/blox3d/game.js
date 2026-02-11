(function () {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 6, 10);

    // Camera control state (mouse drag to orbit, wheel to zoom)
    let cameraYaw = 0; // radians, 0 = behind on +Z
    let cameraPitch = -0.25; // radians (negative looks down)
    let cameraDistance = 10;
    let isDragging = false;
    let lastX = 0, lastY = 0;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Pointer controls for camera orbit
    renderer.domElement.addEventListener('pointerdown', (e) => { isDragging = true; lastX = e.clientX; lastY = e.clientY; renderer.domElement.setPointerCapture(e.pointerId); });
    window.addEventListener('pointerup', () => { isDragging = false; });
    window.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
        cameraYaw -= dx * 0.005;
        cameraPitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, cameraPitch - dy * 0.005));
    });
    // Zoom with wheel
    renderer.domElement.addEventListener('wheel', (e) => { cameraDistance = Math.max(3, Math.min(30, cameraDistance + e.deltaY * 0.01)); });

    const ambient = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 10, 7);
    scene.add(dir);

    // Ground
    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x228B22 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1;
    scene.add(ground);

    // Player
    // Player (Luffy-inspired stylized model + arm ability)
    function createPlayerModel() {
        const group = new THREE.Group();

        // Body
        const bodyGeo = new THREE.CylinderGeometry(0.5, 0.6, 1.2, 12);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff4d4d });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.6;
        group.add(body);

        // Head
        const headGeo = new THREE.SphereGeometry(0.45, 16, 16);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xffe0c0 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.5;
        group.add(head);

        // Straw hat (stylized)
        const hatBrim = new THREE.TorusGeometry(0.65, 0.12, 8, 40);
        const brimMat = new THREE.MeshStandardMaterial({ color: 0xffd700 });
        const brim = new THREE.Mesh(hatBrim, brimMat);
        brim.rotation.x = Math.PI / 2;
        brim.position.y = 1.85;
        group.add(brim);

        const hatTopGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.2, 12);
        const hatTop = new THREE.Mesh(hatTopGeo, brimMat);
        hatTop.position.y = 2.0;
        group.add(hatTop);

        // Simple legs
        const legGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.8, 8);
        const legMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b });
        const leftLeg = new THREE.Mesh(legGeo, legMat);
        leftLeg.position.set(-0.18, 0.0, 0);
        const rightLeg = leftLeg.clone();
        rightLeg.position.x = 0.18;
        group.add(leftLeg, rightLeg);

        // Arm (right) — will be animated for Gum-Gum
        const armGeo = new THREE.BoxGeometry(0.16, 0.16, 1.0);
        armGeo.translate(0, 0, 0.5); // move geometry so back end sits at local origin (shoulder)
        const armMat = new THREE.MeshStandardMaterial({ color: 0xffd27f });
        const arm = new THREE.Mesh(armGeo, armMat);
        arm.position.set(0.45, 1.2, 0); // shoulder offset in local space
        arm.name = 'arm';
        group.add(arm);

        // store refs
        group.userData = { body, head, arm };
        return group;
    }

    const player = createPlayerModel();
    player.position.set(0, 0.5, 0);
    scene.add(player);
    player.velocity = new THREE.Vector3();

    // GLTF loader to replace placeholder player with high-quality model if available
    let mixer = null;
    if (THREE && THREE.GLTFLoader) {
        try {
            const gltfLoader = new THREE.GLTFLoader();
            gltfLoader.load('luffy.glb', function (gltf) {
                const model = gltf.scene;
                // scale and center model
                model.scale.setScalar(1.0);
                model.position.set(0, 0, 0);
                // remove placeholder children and attach model to player group
                while (player.children.length) player.remove(player.children[0]);
                player.add(model);
                // setup mixer for animations (if any)
                if (gltf.animations && gltf.animations.length) {
                    mixer = new THREE.AnimationMixer(model);
                    const action = mixer.clipAction(gltf.animations[0]);
                    action.play();
                }
                console.log('Loaded luffy.glb and attached to player');
            }, undefined, function (err) {
                console.warn('Failed to load luffy.glb:', err);
            });
        } catch (e) {
            console.warn('GLTFLoader not available or failed to construct', e);
        }
    }

    // Floating islands
    const islands = [];
    function addIsland(x, y, z) {
        const g = new THREE.BoxGeometry(4, 0.6, 4);
        const m = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const mesh = new THREE.Mesh(g, m);
        mesh.position.set(x, y, z);
        scene.add(mesh);
        islands.push(mesh);
    }
    addIsland(0, 0, z = -8);
    addIsland(6, 2, -4);
    addIsland(-6, 3, 0);

    // Fruits (pickups)
    const fruits = [];
    function spawnFruit(x, y, z, color) {
        const g = new THREE.SphereGeometry(0.35, 12, 12);
        const m = new THREE.MeshStandardMaterial({ color });
        const mesh = new THREE.Mesh(g, m);
        mesh.position.set(x, y, z);
        mesh.userData.collected = false;
        scene.add(mesh);
        fruits.push(mesh);
    }
    spawnFruit(6, 3.5, -4, 0xff0000);
    spawnFruit(-6, 3.5, 0, 0x00ffcc);
    spawnFruit(0, 0.6, -8, 0xffff00);

    // UI
    const fruitCountEl = document.getElementById('fruitCount');
    const messageEl = document.getElementById('message');
    let fruitCount = 0;

    // Controls
    const keys = {};
    window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
    window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

    // Gum-Gum arm state
    let armCharging = false;
    let armCharge = 0; // 0..1
    let armState = 'idle'; // idle, charging, shooting
    let armShootTimer = 0;
    const armShootDuration = 0.18;
    const baseArmLength = 1.0;
    const projectiles = [];

    // Simple physics params
    const GRAVITY = -20;
    let speed = 5;
    let canJump = true;

    function playerOnGround() {
        if (player.position.y <= 0.5) return true;
        for (let isl of islands) {
            const dx = Math.abs(player.position.x - isl.position.x);
            const dz = Math.abs(player.position.z - isl.position.z);
            const within = dx < 2 && dz < 2;
            if (within && Math.abs(player.position.y - (isl.position.y + 0.3)) < 1) return true;
        }
        return false;
    }

    function showMessage(text, ms = 1500) {
        messageEl.style.display = 'block';
        messageEl.textContent = text;
        setTimeout(() => messageEl.style.display = 'none', ms);
    }

    // Camera follow using orbit variables
    function updateCamera() {
        const px = player.position.x, py = player.position.y, pz = player.position.z;
        const cp = Math.cos(cameraPitch), sp = Math.sin(cameraPitch);
        const cy = Math.cos(cameraYaw), sy = Math.sin(cameraYaw);
        const desired = new THREE.Vector3(
            px + Math.sin(cameraYaw) * cameraDistance * cp,
            py + cameraDistance * sp + 1.0,
            pz + Math.cos(cameraYaw) * cameraDistance * cp
        );
        camera.position.lerp(desired, 0.12);
        camera.lookAt(new THREE.Vector3(px, py + 1.0, pz));
    }

    // Main loop
    const clock = new THREE.Clock();
    function animate() {
        const dt = Math.min(0.05, clock.getDelta());

        // Input (camera-relative movement)
        const forwardIn = (keys['w'] ? 1 : 0) - (keys['s'] ? 1 : 0);
        const strafeIn = (keys['d'] ? 1 : 0) - (keys['a'] ? 1 : 0);
        if (forwardIn !== 0 || strafeIn !== 0) {
            const yaw = cameraYaw;
            const forwardVec = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
            const rightVec = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
            const moveVec = forwardVec.multiplyScalar(forwardIn).add(rightVec.multiplyScalar(strafeIn));
            if (moveVec.lengthSq() > 0) moveVec.normalize();
            moveVec.multiplyScalar(speed * dt);
            player.position.add(moveVec);
        }

        // Jump
        if (keys[' '] && canJump && playerOnGround()) {
            player.velocity.y = 8;
            canJump = false;
        }

        // Gravity
        player.velocity.y += GRAVITY * dt;
        player.position.y += player.velocity.y * dt;

        if (player.position.y < 0.5) {
            player.position.y = 0.5;
            player.velocity.y = 0;
            canJump = true;
        }

        // Fruit pickup
        for (let f of fruits) {
            if (f.userData.collected) continue;
            if (player.position.distanceTo(f.position) < 0.8) {
                f.userData.collected = true;
                scene.remove(f);
                fruitCount++;
                fruitCountEl.textContent = fruitCount;
                // simple effect: increase speed briefly
                speed = 9;
                setTimeout(() => speed = 5, 4000);
                showMessage('Fruit collected! Speed boosted');
            }
        }

        // Gum-Gum input: start charging while K held, release to shoot
        if (keys['k'] && armState === 'idle') {
            armState = 'charging';
            armCharging = true;
            armCharge = 0;
        }
        if (!keys['k'] && armCharging && armState === 'charging') {
            armState = 'shooting';
            armCharging = false;
            armShootTimer = armShootDuration;
        }

        // Arm visuals & animation
        const armMesh = player.userData && player.userData.arm;
        const shoulderWorld = new THREE.Vector3().copy(player.position).add(new THREE.Vector3(0, 1.2, 0));
        if (armState === 'charging' && armMesh) {
            armCharge = Math.min(1, armCharge + dt * 1.4);
            const backDir = new THREE.Vector3();
            camera.getWorldDirection(backDir);
            backDir.multiplyScalar(-1).setY(0).normalize();
            const target = shoulderWorld.clone().add(backDir.clone().multiplyScalar(0.6 + armCharge * 1.2));
            armMesh.lookAt(target);
            armMesh.scale.z = 1 + armCharge * 2.2;
        }

        // Shooting animation: interpolate arm from pulled-back to forward, spawn projectile at mid-point
        if (armState === 'shooting' && armMesh) {
            armShootTimer -= dt;
            const t = 1 - Math.max(0, armShootTimer) / armShootDuration; // 0->1 through animation
            const backDir = new THREE.Vector3();
            camera.getWorldDirection(backDir);
            backDir.multiplyScalar(-1).setY(0).normalize();
            const forwardDir = new THREE.Vector3();
            camera.getWorldDirection(forwardDir).setY(0).normalize();
            const backTarget = shoulderWorld.clone().add(backDir.clone().multiplyScalar(0.6 + armCharge * 1.2));
            const forwardTarget = shoulderWorld.clone().add(forwardDir.clone().multiplyScalar(0.8 + armCharge * 2.2));
            const currentTarget = backTarget.clone().lerp(forwardTarget, t);
            armMesh.lookAt(currentTarget);
            armMesh.scale.z = 1 + (1 + armCharge * 2.5) * (0.8 + t * 1.2);

            // spawn projectile near peak (once when t crosses ~0.35)
            if (t > 0.35 && !armMesh.userData.fired) {
                armMesh.userData.fired = true;
                const dir = forwardDir.clone().normalize();
                const speedFactor = 18 + armCharge * 40;
                const projGeo = new THREE.SphereGeometry(0.12, 8, 8);
                const projMat = new THREE.MeshStandardMaterial({ color: 0xffd27f });
                const proj = new THREE.Mesh(projGeo, projMat);
                const tip = shoulderWorld.clone().add(forwardDir.clone().multiplyScalar(0.9 + armMesh.scale.z * baseArmLength));
                proj.position.copy(tip);
                proj.userData = { vel: dir.clone().multiplyScalar(speedFactor), life: 1.5 };
                scene.add(proj);
                projectiles.push(proj);
            }

            if (armShootTimer <= 0) {
                armState = 'idle';
                armCharge = 0;
                if (armMesh.userData) armMesh.userData.fired = false;
                // reset arm size/rotation
                armMesh.scale.z = 1;
            }
        }



        // Update projectiles
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const p = projectiles[i];
            p.position.add(p.userData.vel.clone().multiplyScalar(dt));
            p.userData.life -= dt;
            // check fruit collision
            for (let f of fruits) {
                if (f.userData.collected) continue;
                if (p.position.distanceTo(f.position) < 0.8) {
                    f.userData.collected = true;
                    scene.remove(f);
                    fruitCount++;
                    fruitCountEl.textContent = fruitCount;
                    showMessage('Fruit knocked away!');
                }
            }
            if (p.userData.life <= 0) {
                scene.remove(p);
                projectiles.splice(i, 1);
            }
        }

        // update gltf animation mixer if present
        if (mixer) mixer.update(dt);

        // Simple floating islands bob
        const t = performance.now() * 0.001;
        islands.forEach((isl, i) => isl.position.y += Math.sin(t + i) * 0.0005);

        updateCamera();
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    }

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
})();

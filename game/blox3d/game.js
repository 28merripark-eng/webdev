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

    // Mouse position for arm aiming
    let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Pointer controls for camera orbit & track mouse for arm aiming
    renderer.domElement.addEventListener('pointerdown', (e) => { isDragging = true; lastX = e.clientX; lastY = e.clientY; renderer.domElement.setPointerCapture(e.pointerId); });
    window.addEventListener('pointerup', () => { isDragging = false; });
    window.addEventListener('pointermove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        if (!isDragging) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
        cameraYaw -= dx * 0.012;
        cameraPitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, cameraPitch - dy * 0.012));
    });
    // Zoom with wheel (increased sensitivity)
    renderer.domElement.addEventListener('wheel', (e) => { e.preventDefault(); cameraDistance = Math.max(3, Math.min(30, cameraDistance + e.deltaY * 0.02)); }, { passive: false });

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
                // heuristics: scale down/up if model too large/small
                const bbox = new THREE.Box3().setFromObject(model);
                const size = bbox.getSize(new THREE.Vector3()).length();
                if (size > 5) model.scale.setScalar(1 / (size / 2.5));
                else if (size < 0.8) model.scale.setScalar(1.6);

                model.position.set(0, 0, 0);
                // remove placeholder children and attach model to player group
                while (player.children.length) player.remove(player.children[0]);
                player.add(model);

                // Setup animation mixer and actions map
                if (gltf.animations && gltf.animations.length) {
                    mixer = new THREE.AnimationMixer(model);
                    const actions = {};
                    gltf.animations.forEach((clip) => {
                        actions[clip.name] = mixer.clipAction(clip);
                    });

                    // helper to pick best-named clip
                    function findClip(names) {
                        for (let n of names) {
                            if (actions[n]) return actions[n];
                        }
                        // fallback to first
                        const keys = Object.keys(actions);
                        return keys.length ? actions[keys[0]] : null;
                    }

                    const idleAction = findClip(['Idle', 'idle', 'IDLE', 'Idle_01', 'Idle_0']);
                    const runAction = findClip(['Run', 'run', 'Walk', 'walk', 'RUN']);
                    const attackAction = findClip(['Attack', 'attack', 'Punch', 'punch', 'Attack_01']);

                    let currentAction = null;
                    function playAction(next) {
                        if (!next || currentAction === next) return;
                        if (currentAction) {
                            currentAction.fadeOut(0.15);
                        }
                        next.reset().fadeIn(0.15).play();
                        currentAction = next;
                    }

                    // start idle
                    if (idleAction) playAction(idleAction);

                    // expose to outer scope for movement/attack switching
                    player.userData._anims = { idleAction, runAction, attackAction, playAction };

                    // Report animations found
                    const animNames = gltf.animations.map(a => a.name).join(', ') || '(none)';
                    updateDebug(`✓ Loaded luffy.glb\nAnimations: ${animNames}`);
                } else {
                    updateDebug('✓ Loaded luffy.glb\n(no animations found)');
                }

                console.log('Loaded luffy.glb and attached to player');
            }, undefined, function (err) {
                console.warn('Failed to load luffy.glb:', err);
                updateDebug('✗ Failed to load luffy.glb.\nCheck file exists in game/blox3d/ folder.\nError: ' + err.message);
            });
        } catch (e) {
            console.warn('GLTFLoader not available or failed to construct', e);
            updateDebug('✗ GLTFLoader error: ' + e.message);
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
    const debugEl = document.getElementById('debug');
    let fruitCount = 0;

    // Debug function
    function updateDebug(text) {
        if (debugEl) debugEl.textContent = text;
    }
    updateDebug('Status: Using placeholder model. Place luffy.glb in game/blox3d/ folder.');

    // Controls
    const keys = {};
    window.addEventListener('keydown', e => {
        const key = e.key.toLowerCase();
        keys[key] = true;
        // Gear switching
        if (key === '2') {
            gearLevel = gearLevel === 2 ? 1 : 2;
            gearSpeedMult = gearLevel === 2 ? 1.5 : 1.0;
            gearLevelEl.textContent = gearLevel;
            showMessage(`Gear ${gearLevel}! Speed x${gearSpeedMult.toFixed(1)}`);
        }
        if (key === '3') {
            gearLevel = gearLevel === 3 ? 1 : 3;
            gearSpeedMult = gearLevel === 3 ? 2.5 : 1.0;
            gearLevelEl.textContent = gearLevel;
            showMessage(`Gear ${gearLevel}! Speed x${gearSpeedMult.toFixed(1)}`);
        }
    });
    window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

    // Gum-Gum arm state
    let armCharging = false;
    let armCharge = 0; // 0..1
    let armState = 'idle'; // idle, charging, shooting
    let armShootTimer = 0;
    const armShootDuration = 0.12; // faster teleport-like punch
    const baseArmLength = 1.0;

    // Gear modes
    let gearLevel = 1; // 1, 2, or 3
    const gearLevelEl = document.getElementById('gearLevel');
    let gearSpeedMult = 1.0; // speed multiplier based on gear

    // Simple physics params
    const GRAVITY = -20;
    let speed = 5;
    let canJump = true;
    let currentGearEndTime = 0; // timer for gear mode duration

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

    const PLAYER_RADIUS = 0.45;

    // simple sphere vs AABB test against islands
    function collidesWithIslands(pos) {
        for (let isl of islands) {
            // island box is 4 x 0.6 x 4 with center at isl.position
            const hx = 2.0, hy = 0.3, hz = 2.0;
            const minX = isl.position.x - hx, maxX = isl.position.x + hx;
            const minY = isl.position.y - hy, maxY = isl.position.y + hy;
            const minZ = isl.position.z - hz, maxZ = isl.position.z + hz;
            const cx = Math.max(minX, Math.min(pos.x, maxX));
            const cy = Math.max(minY, Math.min(pos.y, maxY));
            const cz = Math.max(minZ, Math.min(pos.z, maxZ));
            const dx = cx - pos.x, dy = cy - pos.y, dz = cz - pos.z;
            const dist2 = dx * dx + dy * dy + dz * dz;
            if (dist2 < PLAYER_RADIUS * PLAYER_RADIUS) return true;
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
            moveVec.multiplyScalar(speed * gearSpeedMult * dt);
            // test horizontal collision before applying
            const candidate = player.position.clone().add(new THREE.Vector3(moveVec.x, 0, moveVec.z));
            if (!collidesWithIslands(candidate)) {
                player.position.add(moveVec);
            } else {
                // try sliding on X then Z separately
                const candX = player.position.clone().add(new THREE.Vector3(moveVec.x, 0, 0));
                const candZ = player.position.clone().add(new THREE.Vector3(0, 0, moveVec.z));
                if (!collidesWithIslands(candX)) player.position.x = candX.x;
                else if (!collidesWithIslands(candZ)) player.position.z = candZ.z;
            }
        }

        // Jump
        if (keys[' '] && canJump && playerOnGround()) {
            const jumpPower = 8 * (1 + (gearLevel - 1) * 0.3); // boost jump with gear
            player.velocity.y = jumpPower;
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

                //speed
                speed = 100000000;
                setTimeout(() => speed = 100000, 4000);
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

        // Make player face the camera (yaw)
        player.rotation.y = cameraYaw;

        // Arm visuals & animation (aim toward mouse pointer)
        const armMesh = player.userData && player.userData.arm;
        const shoulderWorld = new THREE.Vector3().copy(player.position).add(new THREE.Vector3(0, 1.2, 0));

        // Calculate aim direction from mouse position using raycasting
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2((mouseX / window.innerWidth) * 2 - 1, -(mouseY / window.innerHeight) * 2 + 1);
        raycaster.setFromCamera(mouse, camera);
        
        // Get aim direction - cast ray and find a point far ahead
        const aimDir = raycaster.ray.direction.clone().setY(0).normalize();
        const behindDir = aimDir.clone().multiplyScalar(-1); // opposite of aim direction (back)
        const frontDir = aimDir.clone(); // aim direction (forward)

        if (armState === 'charging' && armMesh) {
            armCharge = Math.min(1, armCharge + dt * 1.4);
            // Stretch arm straight back (pull back away from aim direction)
            const backDistance = 0.6 + armCharge * 2.0;
            const backTarget = shoulderWorld.clone().add(behindDir.clone().multiplyScalar(backDistance));
            armMesh.lookAt(backTarget);
            armMesh.scale.z = 1 + armCharge * 2.8;
        }

        // Shooting animation: teleport arm from back to aim direction instantly, then retract
        if (armState === 'shooting' && armMesh) {
            armShootTimer -= dt;
            const t = Math.min(1, 1 - Math.max(0, armShootTimer) / armShootDuration); // 0->1 through animation

            // Teleport: if t < 0.1, go to forward; if t > 0.9, retract
            if (t < 0.1) {
                // Instantly at forward position (aim toward mouse)
                const frontDistance = 0.8 + armCharge * 2.5;
                const frontTarget = shoulderWorld.clone().add(frontDir.clone().multiplyScalar(frontDistance));
                armMesh.lookAt(frontTarget);
                armMesh.scale.z = 1 + (1 + armCharge * 3) * 1.2;
            } else if (t > 0.7) {
                // Start retracting back
                const retractAmount = (t - 0.7) / 0.3; // 0->1 over last 30% of animation
                const frontDistance = (0.8 + armCharge * 2.5) * (1 - retractAmount * 0.8);
                const frontTarget = shoulderWorld.clone().add(frontDir.clone().multiplyScalar(Math.max(0.3, frontDistance)));
                armMesh.lookAt(frontTarget);
                armMesh.scale.z = Math.max(1, 1 + (1 + armCharge * 3) * (1 - retractAmount));
            } else {
                // Hold at full extension
                const frontDistance = 0.8 + armCharge * 2.5;
                const frontTarget = shoulderWorld.clone().add(frontDir.clone().multiplyScalar(frontDistance));
                armMesh.lookAt(frontTarget);
                armMesh.scale.z = 1 + (1 + armCharge * 3) * 1.2;
            }

            // mark fired once at peak
            if (t > 0.1 && !armMesh.userData.fired) {
                armMesh.userData.fired = true;
            }

            if (armShootTimer <= 0) {
                armState = 'idle';
                armCharge = 0;
                if (armMesh.userData) armMesh.userData.fired = false;
                // reset arm size/rotation
                armMesh.scale.z = 1;
            }
        }





        // update gltf animation mixer if present
        if (mixer) mixer.update(dt);

        // animation switching: idle/run/attack
        const anims = player.userData && player.userData._anims;
        if (anims) {
            const moving = (forwardIn !== 0 || strafeIn !== 0) && playerOnGround();
            if (armState === 'shooting' && anims.attackAction) {
                // play attack once
                anims.playAction(anims.attackAction);
            } else if (moving && anims.runAction) {
                anims.playAction(anims.runAction);
            } else if (anims.idleAction) {
                anims.playAction(anims.idleAction);
            }
        }

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

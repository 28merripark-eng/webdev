(function () {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 6, 10);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

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
        function createPlayerModel(){
            const group = new THREE.Group();

            // Body
            const bodyGeo = new THREE.CylinderGeometry(0.5, 0.6, 1.2, 12);
            const bodyMat = new THREE.MeshStandardMaterial({color:0xff4d4d});
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.position.y = 0.6;
            group.add(body);

            // Head
            const headGeo = new THREE.SphereGeometry(0.45, 16, 16);
            const headMat = new THREE.MeshStandardMaterial({color:0xffe0c0});
            const head = new THREE.Mesh(headGeo, headMat);
            head.position.y = 1.5;
            group.add(head);

            // Straw hat (stylized)
            const hatBrim = new THREE.TorusGeometry(0.65, 0.12, 8, 40);
            const brimMat = new THREE.MeshStandardMaterial({color:0xffd700});
            const brim = new THREE.Mesh(hatBrim, brimMat);
            brim.rotation.x = Math.PI/2;
            brim.position.y = 1.85;
            group.add(brim);

            const hatTopGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.2, 12);
            const hatTop = new THREE.Mesh(hatTopGeo, brimMat);
            hatTop.position.y = 2.0;
            group.add(hatTop);

            // Simple legs
            const legGeo = new THREE.CylinderGeometry(0.18,0.18,0.8,8);
            const legMat = new THREE.MeshStandardMaterial({color:0x2b2b2b});
            const leftLeg = new THREE.Mesh(legGeo, legMat);
            leftLeg.position.set(-0.18,0.0,0);
            const rightLeg = leftLeg.clone();
            rightLeg.position.x = 0.18;
            group.add(leftLeg, rightLeg);

            // Arm (right) — will be animated for Gum-Gum
            const armGeo = new THREE.CylinderGeometry(0.12,0.12,1.0,8);
            const armMat = new THREE.MeshStandardMaterial({color:0xffd27f});
            const arm = new THREE.Mesh(armGeo, armMat);
            arm.geometry.translate(0, -0.5, 0); // pivot at shoulder
            arm.position.set(0.6, 1.2, 0);
            arm.rotation.z = Math.PI/2;
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

    // Camera follow
    function updateCamera() {
        const desired = new THREE.Vector3(player.position.x, player.position.y + 4, player.position.z + 8);
        camera.position.lerp(desired, 0.08);
        camera.lookAt(player.position.x, player.position.y + 1, player.position.z);
    }

    // Main loop
    const clock = new THREE.Clock();
    function animate() {
        const dt = Math.min(0.05, clock.getDelta());

        // Input
        const forward = (keys['w'] ? 1 : 0) - (keys['s'] ? 1 : 0);
        const strafe = (keys['d'] ? 1 : 0) - (keys['a'] ? 1 : 0);

        const dir = new THREE.Vector3(strafe, 0, forward).normalize();
        if (dir.lengthSq() > 0) {
            const move = dir.multiplyScalar(speed * dt);
            player.position.add(new THREE.Vector3(move.x, 0, move.z));
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
        if (keys['k'] && armState === 'idle'){
            armState = 'charging';
            armCharging = true;
            armCharge = 0;
        }
        if (!keys['k'] && armCharging && armState === 'charging'){
            armState = 'shooting';
            armCharging = false;
        }

        // Arm charging animation
        const armMesh = player.userData && player.userData.arm;
        if (armState === 'charging' && armMesh){
            armCharge = Math.min(1, armCharge + dt * 1.2);
            armMesh.scale.set(1, 1, 1 + armCharge * 2);
            armMesh.position.x = 0.6 + (-0.5 * armCharge);
        }

        // Shooting: spawn a projectile forward based on camera direction
        if (armState === 'shooting'){
            const dir = new THREE.Vector3();
            camera.getWorldDirection(dir);
            dir.y = Math.max(-0.1, dir.y);
            dir.normalize();
            const speedFactor = 18 + armCharge * 30;
            const projGeo = new THREE.CylinderGeometry(0.08,0.08,1,8);
            const projMat = new THREE.MeshStandardMaterial({color:0xffd27f});
            const proj = new THREE.Mesh(projGeo, projMat);
            proj.geometry.translate(0, -0.5, 0);
            proj.position.copy(player.position).add(new THREE.Vector3(0,1.2,0)).add(dir.clone().multiplyScalar(1));
            proj.userData = { vel: dir.clone().multiplyScalar(speedFactor), life: 1.2 };
            scene.add(proj);
            projectiles.push(proj);
            // reset arm visual
            if (armMesh){
                armMesh.scale.set(1,1,1);
                armMesh.position.set(0.6,1.2,0);
            }
            armCharge = 0;
            armState = 'idle';
        }

        // Update projectiles
        for (let i = projectiles.length-1; i>=0; i--){
            const p = projectiles[i];
            p.position.add(p.userData.vel.clone().multiplyScalar(dt));
            p.userData.life -= dt;
            // check fruit collision
            for (let f of fruits){
                if (f.userData.collected) continue;
                if (p.position.distanceTo(f.position) < 0.8){
                    f.userData.collected = true;
                    scene.remove(f);
                    fruitCount++;
                    fruitCountEl.textContent = fruitCount;
                    showMessage('Fruit knocked away!');
                }
            }
            if (p.userData.life <= 0){
                scene.remove(p);
                projectiles.splice(i,1);
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

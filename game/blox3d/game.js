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
    const player = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), new THREE.MeshStandardMaterial({ color: 0xffd27f }));
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

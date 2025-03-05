document.addEventListener('DOMContentLoaded', () => {
  // Discord webhook function
  async function logToDiscord(message) {
    const webhookUrl = 'https://discord.com/api/webhooks/1344528479936577667/5ZxcuOpHahBlLIiA5_Sdo26M-FPFYgTIOxjbxbnXZnXmqvkEcclMFthLatmqteVK1aIU';
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message })
      });
    } catch (error) {
      console.error('Failed to log to Discord:', error);
    }
  }
  // Scene setup
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000);
  document.body.appendChild(renderer.domElement);

  // Font loader setup (fixed to use THREE.FontLoader)
  const damageFontLoader = new THREE.FontLoader(); // Changed from FontLoader to THREE.FontLoader
  let damageFont;
  damageFontLoader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', (font) => {
    damageFont = font;
    console.log('Font loaded successfully');
  }, undefined, (error) => {
    console.error('Font loading error:', error);
  });

  // Minimap setup
  const minimapCanvas = document.getElementById('minimap');
  const minimapCtx = minimapCanvas.getContext('2d');
  const mapSize = 1000;

  // UI elements
  const healthFill = document.getElementById('health-fill');
  const ammoText = document.getElementById('ammo');
  const killsText = document.getElementById('kills');
  const killfeed = document.getElementById('killfeed');
  const gameOver = document.getElementById('game-over');
  const pilotNameText = document.getElementById('pilot-name');
  let shotsFired = 0;
  let kills = 0;


  // Sound effects
  const shootSound = document.getElementById('shoot-sound');
  const explosionSound = document.getElementById('explosion-sound');
  const hitSound = document.getElementById('hit-sound');
  const deathSound = document.getElementById('death-sound');

  // Ensure sounds load and play
  shootSound.load();
  explosionSound.load();
  hitSound.load();
  deathSound.load();

  // Crosshair setup
  const crosshairCanvas = document.getElementById('crosshair');
  const crosshairCtx = crosshairCanvas.getContext('2d');
  crosshairCanvas.width = window.innerWidth;
  crosshairCanvas.height = window.innerHeight;

  // Improved ship design with better visuals
  const createPlayerShip = () => {
    const shipGroup = new THREE.Group();

    // Main body (fuselage)
    const bodyGeometry = new THREE.CylinderGeometry(0.5, 0.8, 2.5, 8);
    const bodyMaterial = new THREE.MeshPhongMaterial({
      color: 0x3498db,
      specular: 0x111111,
      shininess: 30
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.rotation.x = Math.PI / 2;
    shipGroup.add(body);

    // Cockpit
    const cockpitGeometry = new THREE.SphereGeometry(0.6, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const cockpitMaterial = new THREE.MeshPhongMaterial({
      color: 0x2ecc71,
      specular: 0xffffff,
      shininess: 100,
      transparent: true,
      opacity: 0.7
    });
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.position.set(0, 0.3, -0.7);
    shipGroup.add(cockpit);

    // Wings
    const wingGeometry = new THREE.BoxGeometry(3, 0.1, 1);
    const wingMaterial = new THREE.MeshPhongMaterial({ color: 0x3498db });
    const wings = new THREE.Mesh(wingGeometry, wingMaterial);
    wings.position.set(0, 0, 0.5);
    shipGroup.add(wings);

    // Engine glow (point lights)
    const engineLight1 = new THREE.PointLight(0x00ffff, 1, 2);
    engineLight1.position.set(0, 0, 1.3);
    shipGroup.add(engineLight1);

    // Weapon hardpoints
    const weaponGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.8);
    const weaponMaterial = new THREE.MeshPhongMaterial({ color: 0x7f8c8d });
    const weaponLeft = new THREE.Mesh(weaponGeometry, weaponMaterial);
    weaponLeft.position.set(-1.2, 0, 0);
    shipGroup.add(weaponLeft);

    const weaponRight = new THREE.Mesh(weaponGeometry, weaponMaterial);
    weaponRight.position.set(1.2, 0, 0);
    shipGroup.add(weaponRight);

    return shipGroup;
  };

  document.getElementById('share-x-btn').onclick = () => {
    const tweetText = `I just played this awesome 3D space shooter game! 🚀🔥 Try it out here: https://im2slothy.com/pilot - @Im2Slothy`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(url, '_blank');
    logToDiscord(`Someone clicked the share button! Tweet: "${tweetText}" - ${new Date().toISOString()}`);
};

  // Player ship
  const playerShip = createPlayerShip();
  playerShip.health = 5;
  playerShip.position.set(0, 0, 0);
  playerShip.rotation.set(0, 0, 0);
  playerShip.velocity = new THREE.Vector3(0, 0, 0);
  playerShip.angularVelocity = new THREE.Vector3(0, 0, 0);
  scene.add(playerShip);

  // Powerups (moved to top level)
  const powerUps = [];

  // Add lighting to the scene
  const ambientLight = new THREE.AmbientLight(0x404040);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(5, 5, 5);
  scene.add(directionalLight);

  // AI ships
  const aiShips = [];

  // Create visually improved AI ship
  const createAIShip = () => {
    const shipGroup = new THREE.Group();

    // Main body
    const bodyGeometry = new THREE.CylinderGeometry(0.5, 0.8, 2.5, 8);
    const bodyMaterial = new THREE.MeshPhongMaterial({
      color: 0xe74c3c,
      specular: 0x111111,
      shininess: 30
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.rotation.x = Math.PI / 2;
    shipGroup.add(body);

    // Cockpit
    const cockpitGeometry = new THREE.SphereGeometry(0.6, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const cockpitMaterial = new THREE.MeshPhongMaterial({
      color: 0xf39c12,
      specular: 0xffffff,
      shininess: 100,
      transparent: true,
      opacity: 0.7
    });
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.position.set(0, 0.3, -0.7);
    shipGroup.add(cockpit);

    // Wings
    const wingGeometry = new THREE.BoxGeometry(3, 0.1, 1);
    const wingMaterial = new THREE.MeshPhongMaterial({ color: 0xe74c3c });
    const wings = new THREE.Mesh(wingGeometry, wingMaterial);
    wings.position.set(0, 0, 0.5);
    shipGroup.add(wings);

    // Add healthbar
    const healthBar = new THREE.Group();
    const barWidth = 1.5;
    const barHeight = 0.2;
    const bgGeometry = new THREE.PlaneGeometry(barWidth, barHeight);
    const fillGeometry = new THREE.PlaneGeometry(barWidth, barHeight);
    const bgMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
    const fillMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const bg = new THREE.Mesh(bgGeometry, bgMaterial);
    const fill = new THREE.Mesh(fillGeometry, fillMaterial);
    fill.scale.x = 1;
    fill.position.x = -barWidth / 2 * (1 - fill.scale.x);
    healthBar.add(bg, fill);
    healthBar.position.set(0, 1.5, 0);
    shipGroup.healthBar = healthBar;
    shipGroup.add(healthBar);

    return shipGroup;
  };

  // Other players with healthbars
  const otherPlayers = {};
  const bullets = [];
  const asteroids = [];

  // Improved bullet visuals
  const bulletGeometry = new THREE.SphereGeometry(0.1, 8, 8);
  const bulletMaterial = new THREE.MeshPhongMaterial({
    color: 0xffff00,
    emissive: 0xffff00,
    emissiveIntensity: 0.5
  });

  // Improved asteroid visuals
  const createAsteroid = (size) => {
    const geometry = new THREE.IcosahedronGeometry(size, 1);
    const material = new THREE.MeshStandardMaterial({
      color: 0xaaaaaa,
      roughness: 0.9,
      metalness: 0.1
    });
    const asteroid = new THREE.Mesh(geometry, material);

    // Create some surface details
    const detailCount = Math.floor(3 + Math.random() * 5);
    for (let i = 0; i < detailCount; i++) {
      const cratGeo = new THREE.SphereGeometry(size * 0.3, 4, 4);
      const cratMat = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.8,
        metalness: 0.2
      });
      const crater = new THREE.Mesh(cratGeo, cratMat);

      // Random position on asteroid
      const phi = Math.random() * Math.PI * 2;
      const theta = Math.random() * Math.PI;
      crater.position.set(
        size * Math.sin(theta) * Math.cos(phi),
        size * Math.sin(theta) * Math.sin(phi),
        size * Math.cos(theta)
      );

      // Random rotation
      crater.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );

      // Scale to create crater effect
      crater.scale.set(0.5, 0.5, 0.2);

      asteroid.add(crater);
    }

    return asteroid;
  };

  // Bullet speed (fast for dynamic feel)
  const bulletSpeed = 8.0; // Increased bullet speed

  // Improved movement constants
  const maxSpeed = 1.2; // Significantly increased max speed
  const acceleration = 0.05; // Increased acceleration for responsiveness
  const deceleration = 0.02; // Reduced deceleration for smoother movement
  const rotationSpeed = 0.15; // Faster rotation for better control
  const rollSpeed = 0.1; // New roll speed for banking

  // Create better looking stars
  const createStars = () => {
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 10000;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);

    for (let i = 0; i < starCount * 3; i += 3) {
      // Positions (distributed in a sphere)
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 1000 + Math.random() * 1000; // Far away

      starPositions[i] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starPositions[i + 2] = radius * Math.cos(phi);

      // Random star colors (white to blue to red)
      const colorType = Math.random();
      if (colorType < 0.6) {
        // White to blue-white
        starColors[i] = 0.8 + Math.random() * 0.2;
        starColors[i + 1] = 0.8 + Math.random() * 0.2;
        starColors[i + 2] = 0.9 + Math.random() * 0.1;
      } else if (colorType < 0.8) {
        // Blue
        starColors[i] = 0.5 + Math.random() * 0.2;
        starColors[i + 1] = 0.5 + Math.random() * 0.2;
        starColors[i + 2] = 0.8 + Math.random() * 0.2;
      } else if (colorType < 0.95) {
        // Yellow
        starColors[i] = 0.9 + Math.random() * 0.1;
        starColors[i + 1] = 0.9 + Math.random() * 0.1;
        starColors[i + 2] = 0.6 + Math.random() * 0.2;
      } else {
        // Red
        starColors[i] = 0.9 + Math.random() * 0.1;
        starColors[i + 1] = 0.5 + Math.random() * 0.2;
        starColors[i + 2] = 0.5 + Math.random() * 0.2;
      }

      // Random star sizes (mostly small, occasionally larger)
      const sizeFactor = Math.random();
      if (sizeFactor > 0.99) {
        starSizes[i / 3] = 0.5 + Math.random() * 0.5; // Few big stars
      } else if (sizeFactor > 0.95) {
        starSizes[i / 3] = 0.3 + Math.random() * 0.2; // Some medium stars
      } else {
        starSizes[i / 3] = 0.1 + Math.random() * 0.1; // Mostly tiny stars
      }
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    starGeometry.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));

    const starMaterial = new THREE.PointsMaterial({
      size: 1.0,
      vertexColors: true,
      sizeAttenuation: true
    });

    return new THREE.Points(starGeometry, starMaterial);
  };

  const stars = createStars();
  scene.add(stars);

  // PeerJS setup
  const peer = new Peer();
  let connections = [];
  let myPlayerName = 'Player'; // Default name

  // Name input
  const playerNameInput = document.getElementById('player-name');
  playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      myPlayerName = playerNameInput.value.trim() || 'Player';
      document.getElementById('play-button').click(); // Trigger play
    }
  });

  peer.on('open', (id) => {
    console.log('My PeerJS ID: ' + id);
  });

  peer.on('connection', (conn) => {
    connections.push(conn);
    conn.on('data', (data) => {
      if (data.type === 'position') {
        if (!otherPlayers[conn.peer]) {
          const otherShip = createAIShip(); // Use same function for other player ships
          otherShip.health = 5; // Match player health
          scene.add(otherShip);
          otherPlayers[conn.peer] = otherShip;
        }
        otherPlayers[conn.peer].position.set(data.x, data.y, data.z);
        otherPlayers[conn.peer].rotation.y = data.rotationY || 0; // Sync yaw
        otherPlayers[conn.peer].rotation.x = data.rotationX || 0; // Sync pitch for third-person
        otherPlayers[conn.peer].rotation.z = data.rotationZ || 0; // Sync roll
      } else if (data.type === 'bullet') {
        spawnEnemyBullet(data.x, data.y, data.z, data.dirX, data.dirY, data.dirZ, conn.peer);
      } else if (data.type === 'hit') {
        playerShip.health--;
        if (playerShip.health <= 0) {
          playerShip.visible = false;
          explosion(playerShip.position, 2.0); // Bigger explosion
          showGameOver();
          freezeGame();
          addKillfeed(conn.peer, myPlayerName); // Enemy killed player
          deathSound.play(); // Play death sound
        }
        updateUI();
        hitSound.play(); // Play hit sound
      }
    });
  });

  function connectToPeer(id) {
    const conn = peer.connect(id);
    connections.push(conn);
    conn.on('open', () => console.log('Connected to: ' + id));
    conn.on('data', (data) => {
      if (data.type === 'position') {
        if (!otherPlayers[conn.peer]) {
          const otherShip = createAIShip();
          otherShip.health = 5;
          scene.add(otherShip);
          otherPlayers[conn.peer] = otherShip;
        }
        otherPlayers[conn.peer].position.set(data.x, data.y, data.z);
        otherPlayers[conn.peer].rotation.y = data.rotationY || 0; // Sync yaw
        otherPlayers[conn.peer].rotation.x = data.rotationX || 0; // Sync pitch for third-person
        otherPlayers[conn.peer].rotation.z = data.rotationZ || 0; // Sync roll
      } else if (data.type === 'bullet') {
        spawnEnemyBullet(data.x, data.y, data.z, data.dirX, data.dirY, data.dirZ, conn.peer);
      } else if (data.type === 'hit') {
        playerShip.health--;
        if (playerShip.health <= 0) {
          playerShip.visible = false;
          explosion(playerShip.position, 2.0);
          showGameOver();
          freezeGame();
          addKillfeed(conn.peer, myPlayerName);
          deathSound.play();
        }
        updateUI();
        hitSound.play();
      }
    });
  }

  // Declare gamePaused variable
  let gamePaused = false;

  // Define onMouseDown function
  function onMouseDown(e) {
    //if (!gameStarted || gamePaused) return;

    if (e.button === 0) { // Left mouse button (MB1)
      shootBullet();
    }
  }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Update crosshair canvas size
    crosshairCanvas.width = window.innerWidth;
    crosshairCanvas.height = window.innerHeight;
}

  function createPowerUp(position) {
    const geometry = new THREE.DodecahedronGeometry(1);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
    const powerUp = new THREE.Mesh(geometry, material);
    powerUp.position.copy(position);
    powerUp.type = Math.random() > 0.5 ? 'speed' : 'shield';
    scene.add(powerUp);
    powerUps.push(powerUp);
  }

  function updatePowerUps() {
    powerUps.forEach((powerUp, index) => {
      powerUp.rotation.x += 0.05;
      powerUp.rotation.y += 0.05;
  
      if (playerShip.position.distanceTo(powerUp.position) < 2 && playerShip.visible) {
        if (powerUp.type === 'speed') {
          maxSpeed = 2.0; // Double speed
          setTimeout(() => maxSpeed = 1.2, 5000); // 5 sec boost
        } else if (powerUp.type === 'shield') {
          playerShip.health = Math.min(playerShip.health + 2, 5); // +2 health, cap at 5
          updateUI();
        }
        scene.remove(powerUp);
        powerUps.splice(index, 1);
      }
    });
  }

  // Play button
  document.getElementById('play-button').addEventListener('click', () => {
    document.getElementById('landing-page').style.display = 'none';
    enableAudio();
    startGame();
    const message = `${myPlayerName} started a game! - ${new Date().toISOString()}`;
    logToDiscord(message);
  });

function enableAudio() {
    shootSound.play().catch(() => {});
    explosionSound.play().catch(() => {});
    hitSound.play().catch(() => {});
    deathSound.play().catch(() => {});
}


  let gameStarted = false; // Prevents movement/shooting before pressing play

  // Game initialization
  function startGame() {
    gameStarted = true;

  // Initialize crosshair position
  crosshairX = window.innerWidth / 2;
  crosshairY = window.innerHeight / 2;
  crosshairCanvas.style.left = `${crosshairX}px`;
  crosshairCanvas.style.top = `${crosshairY}px`;

    // Attach controls
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('resize', onWindowResize);

    spawnAsteroids();
    spawnAIShip();
    updateUI();
    updateCrosshair();

    // Lock the mouse when the game starts
    document.body.requestPointerLock();

    // Ensure pointer lock stays active
    document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement !== document.body) {
            document.body.requestPointerLock();
        }
    });

    // Hide the default cursor
    document.body.style.cursor = 'none';

    // Start animation loop
    animate();
}

function shootBullet() {
  if (!gameStarted || gamePaused) return;

  let direction = new THREE.Vector3(0, 0, -1).applyQuaternion(playerShip.quaternion).normalize();
  
  // Find nearest AI ship within a 60° cone and 500-unit range
  let nearestAI = null;
  let minAngle = Math.cos(Math.PI / 3); // 60° cone
  let closestDist = Infinity;
  aiShips.forEach(ai => {
    if (!ai.visible) return;
    const toAI = ai.position.clone().sub(playerShip.position);
    const dist = toAI.length();
    if (dist > 500) return;
    const toAINormalized = toAI.clone().normalize();
    const dot = direction.dot(toAINormalized);
    if (dot > minAngle && dist < closestDist) {
      nearestAI = ai;
      closestDist = dist;
    }
  });

  // Set initial direction with slight homing
  if (nearestAI) {
    const toAI = nearestAI.position.clone().sub(playerShip.position);
    const aiVelocity = nearestAI.velocity || new THREE.Vector3();
    const leadTime = toAI.length() / bulletSpeed;
    const leadPos = nearestAI.position.clone().add(aiVelocity.multiplyScalar(leadTime));
    const targetDir = leadPos.sub(playerShip.position).normalize();
    direction.lerp(targetDir, 0.5); // Initial nudge
    direction.normalize();
  }

  const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial.clone());
  bullet.position.copy(playerShip.position);
  bullet.velocity = direction.multiplyScalar(bulletSpeed);
  bullet.owner = peer.id;
  bullet.target = nearestAI; // Assign target for homing

  if (nearestAI) {
    bullet.material.emissiveIntensity = 1.0; // Glow when homing
  }

  const trail = createBulletTrail();
  trail.position.copy(bullet.position);
  scene.add(trail);
  bullet.trail = trail;

  scene.add(bullet);
  bullets.push(bullet);

  shootSound.currentTime = 0;
  shootSound.play();

  shotsFired++;
  updateUI();
}

function updateBullets() {
  bullets.forEach((bullet, index) => {
    // Initialize homing timer if not set (runs once when bullet is created)
    if (!bullet.hasOwnProperty('homingTime')) {
      bullet.homingTime = performance.now(); // Start time
      bullet.homingDuration = 500; // 1.5 seconds (adjustable: 1000 = 1s, 2000 = 2s)
    }

    // Check if homing should still be active
    const elapsed = performance.now() - bullet.homingTime;
    if (bullet.target && bullet.target.visible && elapsed < bullet.homingDuration) {
      // Homing active: adjust velocity toward target
      const toTarget = bullet.target.position.clone().sub(bullet.position);
      const targetVelocity = bullet.target.velocity || new THREE.Vector3();
      const leadTime = toTarget.length() / bulletSpeed;
      const leadPos = bullet.target.position.clone().add(targetVelocity.multiplyScalar(leadTime));
      const targetDir = leadPos.sub(bullet.position).normalize();
      bullet.velocity.lerp(targetDir.multiplyScalar(bulletSpeed), 0.05); // Stronger homing (10%) during active period
    }

    // Move bullet (homing or not)
    bullet.position.add(bullet.velocity.clone().multiplyScalar(0.1));
    if (bullet.trail) {
      bullet.trail.position.copy(bullet.position);
      bullet.trail.quaternion.copy(bullet.quaternion);
    }

    // Optional: Fade out glow when homing stops
    if (elapsed >= bullet.homingDuration && bullet.material.emissiveIntensity > 0.5) {
      bullet.material.emissiveIntensity = 0.5; // Dim glow after homing ends
    }

    // Remove bullets that go too far
    if (bullet.position.distanceTo(playerShip.position) > 1000) {
      scene.remove(bullet);
      if (bullet.trail) scene.remove(bullet.trail);
      bullets.splice(index, 1);
    }
  });
}

  function createBulletTrail() {
    const trailMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.7
    });
    const trailGeometry = new THREE.CylinderGeometry(0.03, 0.05, 1, 8);
    trailGeometry.rotateX(Math.PI / 2); // Align with forward direction
    const trail = new THREE.Mesh(trailGeometry, trailMaterial);
    trail.scale.z = 3; // Longer trail
    return trail;
  }

  function spawnEnemyBullet(x, y, z, dirX, dirY, dirZ, ownerId) {
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
    bullet.position.set(x, y, z);

    // Ensure the direction is properly normalized
    let direction = new THREE.Vector3(dirX, dirY, dirZ).normalize();

    bullet.velocity = direction.multiplyScalar(bulletSpeed);
    bullet.owner = ownerId;

    // Add bullet trail
    const trail = createBulletTrail();
    trail.position.copy(bullet.position);
    scene.add(trail);
    bullet.trail = trail;

    scene.add(bullet);
    bullets.push(bullet);
}


  // Improved AI ship behavior
  function spawnAIShip() {
    const aiShip = createAIShip();
    aiShip.health = 3;

    // Spawn AI within visible range but not too close
    const distanceFromPlayer = 100 + Math.random() * 150;
    const randomAngle = Math.random() * Math.PI * 2;

    aiShip.position.set(
      playerShip.position.x + distanceFromPlayer * Math.cos(randomAngle),
      playerShip.position.y + (Math.random() - 0.5) * 100,
      playerShip.position.z + distanceFromPlayer * Math.sin(randomAngle)
    );

    aiShip.rotation.set(0, Math.random() * Math.PI * 2, 0);
    aiShip.velocity = new THREE.Vector3(0, 0, 0);
    aiShip.target = null;
    aiShip.nextShotTime = performance.now() + 3000 + Math.random() * 1000; // Random initial delay
    aiShip.maneuverTime = performance.now() + 6000 + Math.random() * 6000; // Time until next maneuver
    aiShip.maneuverDir = new THREE.Vector3(
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5
    ).normalize();

    scene.add(aiShip);
    aiShips.push(aiShip);

    setTimeout(() => spawnAIShip(), 5000 + Math.random() * 3000); // Variable spawn rate
  }

  function updateAIShips(time, delta) {
    aiShips.forEach((ai, index) => {
      if (!ai.visible) {
        scene.remove(ai);
        aiShips.splice(index, 1);
        return;
      }

        // Choose target (player or other player, prioritize closest)
        let targets = [playerShip, ...Object.values(otherPlayers)].filter(t => t.visible && t.health > 0);

        if (targets.length > 0) {
            // Find closest target
            let closestDist = Infinity;
            let closestTarget = null;

            targets.forEach(target => {
                const dist = ai.position.distanceTo(target.position);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestTarget = target;
                }
            });

            ai.target = closestTarget;

            // If target is too far, find a new one or just orbit
            if (closestDist > 300) {
                ai.target = null;
            }
        }

        // AI movement speed adjustments
        const aiAcceleration = 0.04 * delta; // Down from 0.05
        const aiMaxSpeed = 0.7; // Down from 0.8
        const aiStrafeSpeed = 0.05 * delta; // Down from 0.06

        // Advanced AI behavior with targeting and evasion
        if (ai.target) {
            // Direct vector to target
            const toTarget = ai.target.position.clone().sub(ai.position);
            const distToTarget = toTarget.length();
            const dirToTarget = toTarget.normalize();

            // Calculate intercept point (lead the target)
            const targetVelocity = ai.target.velocity || new THREE.Vector3();
            const interceptPoint = ai.target.position.clone().add(
              ai.target.velocity.clone().multiplyScalar(distToTarget / bulletSpeed * 0.8) // Increased accuracy
          );
          const toIntercept = interceptPoint.clone().sub(ai.position).normalize();
            const dirToIntercept = toIntercept.normalize();

            // Calculate desired orientation
            const targetQuat = new THREE.Quaternion();
            targetQuat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dirToIntercept);

            // Smoothly rotate toward target
            ai.quaternion.slerp(targetQuat, 0.02); // Even slower rotation

            // Maintain optimal combat distance
            const optimalDistance = 60 + Math.random() * 50; // Increased engagement distance

            // If too close, back up slowly
            if (distToTarget < optimalDistance - 120) {
                ai.velocity.add(dirToTarget.clone().multiplyScalar(-aiAcceleration * 0.3));
            }
            // If too far, approach at a slower speed
            else if (distToTarget > optimalDistance + 10) {
                ai.velocity.add(dirToTarget.clone().multiplyScalar(aiAcceleration * 0.4));
            }
            // At good distance, strafe (orbit) but at a slower rate
            else {
                if (time > ai.maneuverTime) {
                    ai.maneuverTime = time + 4000 + Math.random() * 2000;

                    // Calculate strafe direction (perpendicular to target direction)
                    const strafeDir = new THREE.Vector3();
                    strafeDir.crossVectors(dirToTarget, new THREE.Vector3(0, 1, 0)).normalize();

                    // Randomize strafe direction
                    if (Math.random() > 0.5) strafeDir.negate();

                    // Add some up/down movement
                    strafeDir.y = (Math.random() - 0.5) * 0.3; // Less vertical movement

                    ai.maneuverDir = strafeDir;
                }

                // Apply the current maneuver but slower
                ai.velocity.add(ai.maneuverDir.clone().multiplyScalar(aiStrafeSpeed));
            }

            // Fire at player with slower reaction times
            if (time > ai.nextShotTime && distToTarget < 120) { // Wider range (was 100)
              ai.nextShotTime = time + 1200 + Math.random() * 2000; // Slower fire rate (was 800-2600)

                // Get AI ship forward direction
                const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(ai.quaternion);

                spawnEnemyBullet(
                    ai.position.x,
                    ai.position.y,
                    ai.position.z,
                    direction.x,
                    direction.y,
                    direction.z,
                    `ai_${index}`
                );
            }
        } else {
            // No target - patrol behavior
            if (time > ai.maneuverTime) {
                ai.maneuverTime = time + 6000 + Math.random() * 4000; // Slower patrol maneuvers

                // Set a random patrol direction, biased toward player's general area
                const toPlayer = playerShip.position.clone().sub(ai.position);
                const distToPlayer = toPlayer.length();

                // If very far from player, head back toward game area
                if (distToPlayer > 500) {
                    ai.maneuverDir = toPlayer.normalize();
                } else {
                    // Random patrol direction
                    ai.maneuverDir = new THREE.Vector3(
                        Math.random() - 0.5,
                        (Math.random() - 0.5) * 0.2, // Less vertical movement
                        Math.random() - 0.5
                    ).normalize();
                }

                // Calculate target orientation
                const targetQuat = new THREE.Quaternion();
                targetQuat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), ai.maneuverDir);
                ai.quaternion.slerp(targetQuat, 0.08); // Slower orientation change
            }

            // Move in current patrol direction but slower
            ai.velocity.add(ai.maneuverDir.clone().multiplyScalar(aiAcceleration * 0.4));
        }

        if (ai.velocity.length() > aiMaxSpeed) {
          ai.velocity.normalize().multiplyScalar(aiMaxSpeed);
        }
    
        ai.position.add(ai.velocity);
        ai.velocity.multiplyScalar(0.98); // Stronger damping (was 0.97)

        // Update health bar to face camera
        if (ai.healthBar) {
            ai.healthBar.lookAt(camera.position);

            // Update health fill
            const fill = ai.healthBar.children[1];
            fill.scale.x = ai.health / 3; // max health is 3
            fill.position.x = -0.75 * (1 - fill.scale.x); // Adjust position based on scale
        }
    });
}

function createDamageText(damage, position) {
  if (!damageFont) {
    console.log('Font not loaded yet');
    return;
  }

  const textGeo = new THREE.TextGeometry(`-${damage}`, {
    font: damageFont,
    size: 0.5,
    height: 0.1,
    curveSegments: 12,
  });
  const textMat = new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true });
  const textMesh = new THREE.Mesh(textGeo, textMat);
  textMesh.position.copy(position);
  textMesh.position.y += 1;
  scene.add(textMesh);

  const startTime = performance.now();
  function animateDamage() {
    const elapsed = (performance.now() - startTime) / 1000;
    if (elapsed < 1) {
      textMesh.position.y += 0.02;
      textMat.opacity = 1 - elapsed;
      requestAnimationFrame(animateDamage);
    } else {
      scene.remove(textMesh);
    }
  }
  animateDamage();
}

  // Improved explosion effect
  function explosion(position, size = 1.0) {
    // Create particle system for explosion
    const particleCount = 100;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    const color1 = new THREE.Color(0xff7700); // Orange
    const color2 = new THREE.Color(0xff0000); // Red

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      // Random position within sphere
      const radius = (0.1 + Math.random() * 0.9) * size;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i3] = position.x + radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = position.y + radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = position.z + radius * Math.cos(phi);

      // Colors: red to orange
      const colorMix = Math.random();
      const particleColor = color1.clone().lerp(color2, colorMix);
      colors[i3] = particleColor.r;
      colors[i3 + 1] = particleColor.g;
      colors[i3 + 2] = particleColor.b;

      // Random sizes
      sizes[i] = (0.3 + Math.random() * 0.7) * size;
    }

    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particles.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const particleMaterial = new THREE.PointsMaterial({
      size: 1.0,
      vertexColors: true,
      transparent: true,
      opacity: 0.8
    });

    const particleSystem = new THREE.Points(particles, particleMaterial);
    scene.add(particleSystem);

    // Add shock wave
    const shockwaveGeometry = new THREE.RingGeometry(0.1, 0.2, 32);
    const shockwaveMaterial = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });
    const shockwave = new THREE.Mesh(shockwaveGeometry, shockwaveMaterial);
    shockwave.position.copy(position);
    shockwave.lookAt(camera.position); // Always face camera
    scene.add(shockwave);

    // Play explosion sound
    explosionSound.volume = 0.4;
    explosionSound.playbackRate = 0.8 + Math.random() * 0.4;
    explosionSound.play();

    // Animate explosion
    const startTime = performance.now();
    const animateExplosion = () => {
      const elapsed = performance.now() - startTime;
      const duration = 1000; // 1 second

      if (elapsed < duration) {
        // Fade out particles
        particleMaterial.opacity = 0.8 * (1 - elapsed / duration);

        // Expand shockwave
        const scale = size * (0.5 + 4.5 * elapsed / duration);
        shockwave.scale.set(scale, scale, scale);
        shockwave.material.opacity = 0.7 * (1 - elapsed / duration);

        requestAnimationFrame(animateExplosion);
      } else {
        // Remove from scene when animation completes
        scene.remove(particleSystem);
        scene.remove(shockwave);
      }
    };

    animateExplosion();
  }

  // Improved asteroid generation
  function spawnAsteroids() {
    const count = 30; // More asteroids for interesting environment

    for (let i = 0; i < count; i++) {
      const size = 3 + Math.random() * 7; // Varying sizes
      const asteroid = createAsteroid(size);

      // Random position, far enough from player
      let position;
      do {
        position = new THREE.Vector3(
          (Math.random() - 0.5) * 1000,
          (Math.random() - 0.5) * 1000,
          (Math.random() - 0.5) * 1000
        );
      } while (position.distanceTo(playerShip.position) < 100);

      asteroid.position.copy(position);

      // Random rotation
      asteroid.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );

      // Random velocity
      asteroid.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.05,
        (Math.random() - 0.5) * 0.05,
        (Math.random() - 0.5) * 0.05
      );

      // Random rotation velocity
      asteroid.rotationVelocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.01,
        (Math.random() - 0.5) * 0.01,
        (Math.random() - 0.5) * 0.01
      );

      asteroid.health = Math.ceil(size); // Health based on size

      scene.add(asteroid);
      asteroids.push(asteroid);
    }
  }

  // Update asteroids
  function updateAsteroids() {
    asteroids.forEach((asteroid, index) => {
      // Apply velocity
      asteroid.position.add(asteroid.velocity);

      // Apply rotation
      asteroid.rotation.x += asteroid.rotationVelocity.x;
      asteroid.rotation.y += asteroid.rotationVelocity.y;
      asteroid.rotation.z += asteroid.rotationVelocity.z;

      // If asteroid goes too far from player, wrap around
      const distance = asteroid.position.distanceTo(playerShip.position);
      if (distance > 1000) {
        // Move to other side of player, keeping some distance
        const direction = asteroid.position.clone().sub(playerShip.position).normalize();
        asteroid.position.copy(playerShip.position).add(direction.multiplyScalar(500));
      }
    });
  }

  // Improved UI updates
  function updateUI() {
    // Update health bar
    const healthPercent = (playerShip.health / 5) * 100;
    healthFill.style.width = `${healthPercent}%`;

    // Update color based on health
    if (healthPercent > 60) {
      healthFill.style.backgroundColor = '#4CAF50'; // Green
    } else if (healthPercent > 30) {
      healthFill.style.backgroundColor = '#FF9800'; // Orange
    } else {
      healthFill.style.backgroundColor = '#F44336'; // Red
    }

    // Update ammo
    ammoText.textContent = `Shots: ${shotsFired}`;

    // Update kills
    killsText.textContent = `Kills: ${kills}`;

    // Update pilot name
    pilotNameText.textContent = myPlayerName;
  }

  // Draw minimap
  function updateMinimap() {
    minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    minimapCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    minimapCtx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);

    const mapRadius = minimapCanvas.width / 2;
    const centerX = minimapCanvas.width / 2;
    const centerY = minimapCanvas.height / 2;

    // Draw radar circle
    minimapCtx.beginPath();
    minimapCtx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
    minimapCtx.lineWidth = 1;
    minimapCtx.arc(centerX, centerY, mapRadius - 5, 0, Math.PI * 2);
    minimapCtx.stroke();

    // Draw range rings
    minimapCtx.beginPath();
    minimapCtx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
    minimapCtx.arc(centerX, centerY, mapRadius / 3, 0, Math.PI * 2);
    minimapCtx.stroke();

    minimapCtx.beginPath();
    minimapCtx.arc(centerX, centerY, mapRadius * 2 / 3, 0, Math.PI * 2);
    minimapCtx.stroke();

    // Draw player in center
    minimapCtx.fillStyle = '#00FFFF';
    minimapCtx.beginPath();
    minimapCtx.arc(centerX, centerY, 4, 0, Math.PI * 2);
    minimapCtx.fill();

    // Get player forward direction
    const playerDir = new THREE.Vector3(0, 0, -1).applyQuaternion(playerShip.quaternion);

    // Draw player direction indicator
    minimapCtx.beginPath();
    minimapCtx.moveTo(centerX, centerY);
    minimapCtx.lineTo(
      centerX + playerDir.x * 10,
      centerY + playerDir.z * 10
    );
    minimapCtx.strokeStyle = '#00FFFF';
    minimapCtx.lineWidth = 2;
    minimapCtx.stroke();

    // Scale factor for minimap
    const scale = mapRadius / 500; // 500 units of game space = full radar

    // Draw other players
    Object.values(otherPlayers).forEach(ship => {
      if (!ship.visible) return;

      // Calculate relative position
      const relPos = ship.position.clone().sub(playerShip.position);
      const x = centerX + relPos.x * scale;
      const y = centerY + relPos.z * scale;

      // Check if within minimap bounds
      if (x >= 0 && x <= minimapCanvas.width && y >= 0 && y <= minimapCanvas.height) {
        minimapCtx.fillStyle = '#FF0000';
        minimapCtx.beginPath();
        minimapCtx.arc(x, y, 3, 0, Math.PI * 2);
        minimapCtx.fill();
      }
    });

    // Draw AI ships
    aiShips.forEach(ship => {
      if (!ship.visible) return;

      // Calculate relative position
      const relPos = ship.position.clone().sub(playerShip.position);
      const x = centerX + relPos.x * scale;
      const y = centerY + relPos.z * scale;

      // Check if within minimap bounds
      if (x >= 0 && x <= minimapCanvas.width && y >= 0 && y <= minimapCanvas.height) {
        minimapCtx.fillStyle = '#FF6666';
        minimapCtx.beginPath();
        minimapCtx.arc(x, y, 2, 0, Math.PI * 2);
        minimapCtx.fill();
      }
    });

    // Draw asteroids
    asteroids.forEach(asteroid => {
      // Calculate relative position
      const relPos = asteroid.position.clone().sub(playerShip.position);
      const x = centerX + relPos.x * scale;
      const y = centerY + relPos.z * scale;

      // Check if within minimap bounds
      if (x >= 0 && x <= minimapCanvas.width && y >= 0 && y <= minimapCanvas.height) {
        minimapCtx.fillStyle = '#AAAAAA';
        minimapCtx.beginPath();
        minimapCtx.arc(x, y, 1 + asteroid.geometry.parameters.radius * scale / 10, 0, Math.PI * 2);
        minimapCtx.fill();
      }
    });
  }

  // Crosshair drawing
  function updateCrosshair() {
    crosshairCtx.clearRect(0, 0, crosshairCanvas.width, crosshairCanvas.height);
    const size = 20;
    crosshairCtx.strokeStyle = '#00FFFF';
    crosshairCtx.lineWidth = 2;
  
    crosshairCtx.beginPath();
    crosshairCtx.arc(crosshairX, crosshairY, size / 2, 0, Math.PI * 2);
    crosshairCtx.stroke();
  
    crosshairCtx.beginPath();
    crosshairCtx.moveTo(crosshairX, crosshairY - size);
    crosshairCtx.lineTo(crosshairX, crosshairY - size / 2);
    crosshairCtx.moveTo(crosshairX, crosshairY + size / 2);
    crosshairCtx.lineTo(crosshairX, crosshairY + size);
    crosshairCtx.moveTo(crosshairX - size, crosshairY);
    crosshairCtx.lineTo(crosshairX - size / 2, crosshairY);
    crosshairCtx.moveTo(crosshairX + size / 2, crosshairY);
    crosshairCtx.lineTo(crosshairX + size, crosshairY);
    crosshairCtx.stroke();
  
    // Target nearest AI
    let nearestAI = null;
    let minDist = Infinity;
    aiShips.forEach(ai => {
      if (!ai.visible) return;
      const screenPos = ai.position.clone().project(camera);
      const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;
      const dist = Math.sqrt((x - crosshairX) ** 2 + (y - crosshairY) ** 2);
      if (dist < minDist && dist < 200) { // Within 200px
        minDist = dist;
        nearestAI = { x, y };
      }
    });
  
    if (nearestAI) {
      crosshairCtx.strokeStyle = '#ff4444';
      crosshairCtx.lineWidth = 1;
      crosshairCtx.beginPath();
      crosshairCtx.arc(nearestAI.x, nearestAI.y, 30, 0, Math.PI * 2);
      crosshairCtx.stroke();
    }
  }

  // Add kill to killfeed
  function addKillfeed(killer, victim) {
    const item = document.createElement('div');
    item.classList.add('killfeed-item');
    item.textContent = `${killer} destroyed ${victim}`;
    killfeed.appendChild(item);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      item.style.opacity = '0';
      setTimeout(() => killfeed.removeChild(item), 1000);
    }, 5000);
  }

  // Show game over screen
  function showGameOver() {
    gameOver.style.display = 'flex';
  }

  // Freeze game on death
  function freezeGame() {
    // Disable controls
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mousedown', onMouseDown);
  }

  // Improved camera follow
  function updateCamera() {
    // Third-person camera positioning
    const cameraOffset = new THREE.Vector3(0, 3, 10); // Above and behind
    cameraOffset.applyQuaternion(playerShip.quaternion);
  
    const targetPos = playerShip.position.clone().add(cameraOffset);
    camera.position.lerp(targetPos, 0.1); // Smooth follow
  
    // Look at where the ship is pointing with slight lag
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(playerShip.quaternion);
    const lookAtPos = playerShip.position.clone().add(forward.multiplyScalar(10));
    const currentLookAt = new THREE.Vector3();
    camera.getWorldDirection(currentLookAt);
    const targetLookAt = lookAtPos.clone().sub(camera.position).normalize();
    currentLookAt.lerp(targetLookAt, 0.05); // Slower look-at for cinematic feel
    camera.lookAt(camera.position.clone().add(currentLookAt));
  }

  // First person camera
  function updateFirstPersonCamera() {
    // Position camera at cockpit
    const cockpitOffset = new THREE.Vector3(0, 0.4, -0.5);
    cockpitOffset.applyQuaternion(playerShip.quaternion);
    camera.position.copy(playerShip.position).add(cockpitOffset);

    // Look in direction of ship
    const forwardDir = new THREE.Vector3(0, 0, -100);
    forwardDir.applyQuaternion(playerShip.quaternion);
    camera.lookAt(playerShip.position.clone().add(forwardDir));
  }

  // Toggle camera view (first/third person)
  let firstPersonView = false;
  function toggleCameraView() {
    firstPersonView = !firstPersonView;

    // Hide crosshair in third person
    crosshairCanvas.style.display = firstPersonView ? 'block' : 'none';

    // Hide player ship in first person
    playerShip.children.forEach(child => {
      child.material.transparent = firstPersonView;
      child.material.opacity = firstPersonView ? 0 : 1;
    });
  }

  // Improved keyboard controls with multiple key support
  const keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
    rollLeft: false,
    rollRight: false,
    boost: false
  };

  function onKeyDown(e) {
    if (!gameStarted) return;
    switch (e.key.toLowerCase()) {
      case 'r':
        if (!playerShip.visible) {
          playerShip.visible = true;
          playerShip.health = 5;
          playerShip.position.set(0, 0, 0);
          playerShip.velocity.set(0, 0, 0);
          playerShip.quaternion.set(0, 0, 0, 1);
          gameOver.style.display = 'none';
          startGame(); // Reattach controls
          updateUI();
          }
          break;
      case 'w':
        keys.forward = true;
        break;
      case 's':
        keys.backward = true;
        break;
      case 'a':
        keys.left = true;
        break;
      case 'd':
        keys.right = true;
        break;
      case ' ':
        keys.up = true;
        break;
      case 'c':
        keys.down = true;
        break;
      case 'q':
        keys.rollLeft = true;
        break;
      case 'e':
        keys.rollRight = true;
        break;
      case 'shift':
        keys.boost = true;
        break;
      case 'v':
        toggleCameraView();
        break;
    }
  }

  function onKeyUp(e) {
    if (!gameStarted) return;
    switch (e.key.toLowerCase()) {
      case 'w':
        keys.forward = false;
        break;
      case 's':
        keys.backward = false;
        break;
      case 'a':
        keys.left = false;
        break;
      case 'd':
        keys.right = false;
        break;
      case ' ':
        keys.up = false;
        break;
      case 'c':
        keys.down = false;
        break;
      case 'q':
        keys.rollLeft = false;
        break;
      case 'e':
        keys.rollRight = false;
        break;
      case 'shift':
        keys.boost = false;
        break;
    }
  }
  
  let crosshairX = window.innerWidth / 2;  // Initial crosshair X position
  let crosshairY = window.innerHeight / 2; // Initial crosshair Y position
  const mouseSensitivity = 0.003; // Rotation sensitivity (matches ship and crosshair)
  const crosshairMaxDistance = Math.min(window.innerWidth, window.innerHeight) * 0.3; // Max distance from center (30% of smaller dimension)
  
  function onMouseMove(e) {
    if (!gameStarted || !document.pointerLockElement) return;
  
    // Get relative mouse movement
    const movementX = e.movementX || 0;
    const movementY = e.movementY || 0;
  
    // Get current ship orientation
    const currentEuler = new THREE.Euler().setFromQuaternion(playerShip.quaternion, 'YXZ');
  
    // Update ship rotation (unlimited yaw/pitch)
    const targetYaw = currentEuler.y - movementX * mouseSensitivity;
    const targetPitch = currentEuler.x + movementY * mouseSensitivity;
    const targetRoll = currentEuler.z; // Preserve manual roll
  
    // Apply new orientation with smoothing
    const targetEuler = new THREE.Euler(targetPitch, targetYaw, targetRoll, 'YXZ');
    const targetQuat = new THREE.Quaternion().setFromEuler(targetEuler);
    playerShip.quaternion.slerp(targetQuat, 0.25); // Keep damping
  
    // Update crosshair position with a mix of ship orientation and mouse input
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
  
    // Ship-based offset
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(playerShip.quaternion);
    const cameraForward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const offset = forward.clone().sub(cameraForward).multiplyScalar(1000);
    const screenOffset = offset.clone().project(camera);
  
    // Blend with direct mouse movement for responsiveness
    crosshairX += movementX * 0.1; // Small direct input boost
    crosshairY += movementY * 0.1;
    crosshairX = THREE.MathUtils.lerp(crosshairX, centerX + (screenOffset.x * centerX), 0.5); // Smooth blend
    crosshairY = THREE.MathUtils.lerp(crosshairY, centerY - (screenOffset.y * centerY), 0.5);
  
    // Constrain crosshair to circular boundary
    const dx = crosshairX - centerX;
    const dy = crosshairY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > crosshairMaxDistance) {
      const angle = Math.atan2(dy, dx);
      crosshairX = centerX + Math.cos(angle) * crosshairMaxDistance;
      crosshairY = centerY + Math.sin(angle) * crosshairMaxDistance;
    }
  
    // Update crosshair position
    crosshairCanvas.style.left = `${crosshairX}px`;
    crosshairCanvas.style.top = `${crosshairY}px`;
  }





  // Improved collision detection
  function checkCollisions() {
    // Check bullet collisions
    bullets.forEach((bullet, bulletIndex) => {
      // Remove bullets that have traveled too far
      if (bullet.position.distanceTo(playerShip.position) > 1000) {
        scene.remove(bullet);
        if (bullet.trail) scene.remove(bullet.trail);
        bullets.splice(bulletIndex, 1);
        return;
      }

      // Check collision with player
      if (bullet.owner !== peer.id && playerShip.visible &&
        bullet.position.distanceTo(playerShip.position) < 2) {
        playerShip.health--;

        if (playerShip.health <= 0) {
          playerShip.visible = false;
          explosion(playerShip.position, 2.0);
          showGameOver();
          freezeGame();

          // Notify killer
          if (bullet.owner.startsWith('ai_')) {
            addKillfeed('AI Ship', myPlayerName);
          } else {
            addKillfeed(bullet.owner, myPlayerName);
            connections.forEach(conn => {
              if (conn.peer === bullet.owner) {
                conn.send({
                  type: 'killed',
                  victim: myPlayerName
                });
              }
            });
          }

          deathSound.play();
        } else {
          hitSound.play();
        }

        updateUI();

        // Remove bullet
        scene.remove(bullet);
        if (bullet.trail) scene.remove(bullet.trail);
        bullets.splice(bulletIndex, 1);
        return;
      }

      // Check collision with other players
      Object.entries(otherPlayers).forEach(([peerId, ship]) => {
        if (ship.visible && bullet.owner === peer.id &&
          bullet.position.distanceTo(ship.position) < 2) {
          // Notify hit
          connections.forEach(conn => {
            if (conn.peer === peerId) {
              conn.send({
                type: 'hit',
                from: peer.id
              });
            }
          });

          // Show hit effect
          explosion(bullet.position, 0.5);

          // Remove bullet
          scene.remove(bullet);
          if (bullet.trail) scene.remove(bullet.trail);
          bullets.splice(bulletIndex, 1);
        }
      });

      // AI collision
      aiShips.forEach((ship, shipIndex) => {
        if (ship.visible && bullet.owner === peer.id && 
            bullet.position.distanceTo(ship.position) < 2) {
          ship.health--;

          if (ship.health <= 0) {
            ship.visible = false;
            explosion(ship.position, 1.5);
            createDamageText(3, ship.position); // Max health = 3
            setTimeout(() => {
              scene.remove(ship);
              aiShips.splice(shipIndex, 1);
            }, 1000);
            kills++;
            updateUI();
            addKillfeed(myPlayerName, 'AI Ship');
          } else {
            explosion(bullet.position, 0.5);
            createDamageText(1, bullet.position); // 1 damage per hit
          }

          scene.remove(bullet);
          if (bullet.trail) scene.remove(bullet.trail);
          bullets.splice(bulletIndex, 1);
          if (Math.random() < 0.1) { // 10% chance
            createPowerUp(ship.position);
        }
        }
      }); 

      // Check collision with asteroids
      asteroids.forEach((asteroid, asteroidIndex) => {
        const hitRadius = asteroid.geometry.parameters.radius;
        if (bullet.position.distanceTo(asteroid.position) < hitRadius) {
          asteroid.health--;

          if (asteroid.health <= 0) {
            // Break asteroid into smaller pieces if it was large
            if (hitRadius > 2) {
              for (let i = 0; i < 3; i++) {
                const smallAsteroid = createAsteroid(hitRadius / 2);
                smallAsteroid.position.copy(asteroid.position);

                // Add random offset
                smallAsteroid.position.add(new THREE.Vector3(
                  Math.random() * 2 - 1,
                  Math.random() * 2 - 1,
                  Math.random() * 2 - 1
                ));

                // Set velocities based on original asteroid plus random
                smallAsteroid.velocity = asteroid.velocity.clone().multiplyScalar(1.2);
                smallAsteroid.velocity.add(new THREE.Vector3(
                  Math.random() * 0.4 - 0.2,
                  Math.random() * 0.4 - 0.2,
                  Math.random() * 0.4 - 0.2
                ));

                smallAsteroid.rotationVelocity = new THREE.Vector3(
                  Math.random() * 0.02 - 0.01,
                  Math.random() * 0.02 - 0.01,
                  Math.random() * 0.02 - 0.01
                );

                smallAsteroid.health = Math.ceil(hitRadius / 2);

                scene.add(smallAsteroid);
                asteroids.push(smallAsteroid);
              }
            }

            // Explosion effect at asteroid position
            explosion(asteroid.position, hitRadius / 2);

            // Remove asteroid
            scene.remove(asteroid);
            asteroids.splice(asteroidIndex, 1);
          } else {
            // Just show hit effect
            explosion(bullet.position, 0.3);
          }

          // Remove bullet
          scene.remove(bullet);
          if (bullet.trail) scene.remove(bullet.trail);
          bullets.splice(bulletIndex, 1);
        }
      });
    });

    // Check player collision with asteroids
    if (playerShip.visible) {
      asteroids.forEach(asteroid => {
        const hitRadius = asteroid.geometry.parameters.radius;
        if (playerShip.position.distanceTo(asteroid.position) < hitRadius + 1) {
          // Collision response - bounce off
          const normal = playerShip.position.clone().sub(asteroid.position).normalize();
          playerShip.velocity.reflect(normal).multiplyScalar(0.8); // Reduce speed after bounce

          // Push player away
          playerShip.position.add(normal.multiplyScalar(0.5));

          // Damage player
          playerShip.health--;
          hitSound.play();

          if (playerShip.health <= 0) {
            playerShip.visible = false;
            explosion(playerShip.position, 2.0);
            showGameOver();
            freezeGame();
            addKillfeed('Asteroid', myPlayerName);
            deathSound.play();
          }

          updateUI();
        }
      });
    }
  }

  function createThruster() {
    const particles = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(50 * 3), 3)),
      new THREE.PointsMaterial({ color: 0x00ffff, size: 0.2, transparent: true })
    );
    scene.add(particles);
    return particles;
  }
  
  const thruster = createThruster();
  playerShip.add(thruster);
  
  // Add boost sound to your audio setup
  const boostSound = document.createElement('audio');
  boostSound.id = 'boost-sound';
  boostSound.src = 'https://cdn.pixabay.com/audio/2022/03/10/audio_4e4d2b2b-6f4d-4f4d-9f4d-2b2b6f4d9f4d.mp3'; // Replace with a thruster sound if you have one
  document.body.appendChild(boostSound);

  // Update thruster logic (assuming you added it from the last suggestion)
  function updateThruster() {
    if (keys.forward || keys.backward || keys.left || keys.right || keys.up || keys.down) {
      thruster.visible = true;
      const positions = thruster.geometry.attributes.position.array;
      const boostFactor = keys.boost ? 4 : 2; // Longer trail when boosting
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] = (Math.random() - 0.5) * 0.5;
        positions[i + 1] = (Math.random() - 0.5) * 0.5;
        positions[i + 2] = 1 + Math.random() * boostFactor;
      }
      thruster.geometry.attributes.position.needsUpdate = true;
      thruster.position.set(0, 0, 1.3);

      if (keys.boost && boostSound.paused) {
        boostSound.currentTime = 0;
        boostSound.loop = true;
        boostSound.play();
      } else if (!keys.boost && !boostSound.paused) {
        boostSound.pause();
      }
    } else {
      thruster.visible = false;
      if (!boostSound.paused) boostSound.pause();
    }
  }

let killStreak = 0;
let lastKillTime = 0;

  function addKillfeed(killer, victim) {
    const item = document.createElement('div');
    item.classList.add('killfeed-item');
    item.textContent = `${killer} destroyed ${victim}`;
    killfeed.appendChild(item);
  
    if (killer === myPlayerName) {
      const now = performance.now();
      if (now - lastKillTime < 3000) { // 3-second window
        killStreak++;
        if (killStreak > 1) {
          item.textContent += ` (${killStreak}x STREAK)`;
        }
      } else {
        killStreak = 1;
      }
      lastKillTime = now;
    }
  
    setTimeout(() => {
      item.style.opacity = '0';
      setTimeout(() => killfeed.removeChild(item), 1000);
    }, 5000);
  }

  function createNebula() {
    const geometry = new THREE.SphereGeometry(5000, 32, 32);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color1: { value: new THREE.Color(0x003366) },
        color2: { value: new THREE.Color(0x00ccff) },
      },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normal;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 color1;
        uniform vec3 color2;
        varying vec3 vNormal;
        void main() {
          float noise = sin(vNormal.x * 10.0 + time) * cos(vNormal.y * 10.0 + time) * 0.5 + 0.5;
          vec3 color = mix(color1, color2, noise);
          gl_FragColor = vec4(color, 0.2);
        }
      `,
      side: THREE.BackSide,
      transparent: true,
    });
    const nebula = new THREE.Mesh(geometry, material);
    scene.add(nebula);
    return nebula;
  }
  
  const nebula = createNebula();
  
  let lastTime = performance.now();
  
  function animate() {
    requestAnimationFrame(animate);
    const currentTime = performance.now();
    const delta = (currentTime - lastTime) / 16.67;
    lastTime = currentTime;
  
    if (delta > 5) return;
  
    if (playerShip.visible) {
      nebula.material.uniforms.time.value = currentTime * 0.001;
      nebula.position.copy(playerShip.position); // Keep centered on player
      updateThruster();
      updatePowerUps();
        // playerShip.rotation is now handled in onMouseMove

        // Apply keyboard controls
        const speedMultiplier = keys.boost ? 1.5 : 1.0; // Slightly reduced boost
        const acceleration = 0.05; // Reduced acceleration
        const maxSpeed = 1.2; // Reduced max speed
        const deceleration = 0.03; // Slightly increased deceleration for smoother stops

        if (keys.forward) {
            const forward = new THREE.Vector3(0, 0, -acceleration * speedMultiplier * delta);
            forward.applyQuaternion(playerShip.quaternion);
            playerShip.velocity.add(forward);
        }

        if (keys.backward) {
            const backward = new THREE.Vector3(0, 0, acceleration * 0.5 * speedMultiplier * delta);
            backward.applyQuaternion(playerShip.quaternion);
            playerShip.velocity.add(backward);
        }

        if (keys.left) {
            const left = new THREE.Vector3(-acceleration * 0.8 * speedMultiplier * delta, 0, 0);
            left.applyQuaternion(playerShip.quaternion);
            playerShip.velocity.add(left);
        }

        if (keys.right) {
            const right = new THREE.Vector3(acceleration * 0.8 * speedMultiplier * delta, 0, 0);
            right.applyQuaternion(playerShip.quaternion);
            playerShip.velocity.add(right);
        }

        if (keys.up) {
            const up = new THREE.Vector3(0, acceleration * 0.8 * speedMultiplier * delta, 0);
            up.applyQuaternion(playerShip.quaternion);
            playerShip.velocity.add(up);
        }

        if (keys.down) {
            const down = new THREE.Vector3(0, -acceleration * 0.8 * speedMultiplier * delta, 0);
            down.applyQuaternion(playerShip.quaternion);
            playerShip.velocity.add(down);
        }

        // Roll (banking)
        if (keys.rollLeft) {
            playerShip.rotation.z += rollSpeed * delta;
        }

        if (keys.rollRight) {
            playerShip.rotation.z -= rollSpeed * delta;
        }

        // Apply velocity with damping
        playerShip.position.add(playerShip.velocity);
        playerShip.velocity.multiplyScalar(1 - deceleration); // Smooth slowdown

        // Limit speed
        if (playerShip.velocity.length() > maxSpeed) {
            playerShip.velocity.normalize().multiplyScalar(maxSpeed);
        }

        // Update camera based on view mode
        if (firstPersonView) {
            updateFirstPersonCamera();
        } else {
            updateCamera();
        }

        // Update bullets
        updateBullets();

        // Update AI and other game elements
        updateAIShips(currentTime, delta);
        updateAsteroids();
        updateMinimap();
        updateCrosshair();
        checkCollisions();

        // Render the scene
        renderer.render(scene, camera);
    }
}

  // Show landing page initially
  document.getElementById('landing-page').style.display = 'block';
});

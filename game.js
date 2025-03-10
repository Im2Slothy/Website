window.onload = () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    let peer = null;
    let conn = null;
    let playerId = null;
    let players = {};
    let bullets = [];
    let powerUps = [];
    let particles = [];
    let mouseX = 0;
    let mouseY = 0;
    let mouseDown = false;
    const BASE_WIDTH = 800;
    const BASE_HEIGHT = 600;
    let scaleFactor = 1;
    const HOMING_DURATION = 5;
    const bgMusic = new Audio('audio/dk.mp3');
    bgMusic.loop = true;
    bgMusic.volume = 0.2;
    let musicPlaying = false;
    let lastUpdateTime = 0;
    const UPDATE_INTERVAL = 1 / 30;
    const timestamp = new Date().toLocaleString();

    // New state variables
    let gameState = 'waiting'; // 'waiting', 'playing', 'ended'
    let playerCount = 0;       // Host counts as 1 when opponent joins

    const obstacles = [
        { x: 0.25, y: 0.25, width: 0.125, height: 0.033 },
        { x: 0.625, y: 0.25, width: 0.125, height: 0.033 },
        { x: 0.4375, y: 0.5, width: 0.025, height: 0.25 },
        { x: 0.25, y: 0.75, width: 0.125, height: 0.033 },
        { x: 0.625, y: 0.75, width: 0.125, height: 0.033 }
    ];
    const PLAYER_SIZE = 20;
    const BULLET_SPEED = 600;
    const PLAYER_SPEED = 180;
    const AI_SPEED = 90;
    const SHOOT_COOLDOWN = 0.5;
    let aiActive = false;
    let gameRunning = false;
    let flashTimer = 0;
    let lastTime = performance.now();

    const keys = {};
    window.onkeydown = (e) => {
        keys[e.key] = true;
        console.log('Key down:', e.key, 'Shift:', e.shiftKey);
    };
    window.onkeyup = (e) => {
        keys[e.key] = false;
        if (e.key === 'Shift') {
            keys['ArrowUp'] = false;
            keys['ArrowDown'] = false;
            keys['ArrowLeft'] = false;
            keys['ArrowRight'] = false;
            keys['w'] = false;
            keys['s'] = false;
            keys['a'] = false;
            keys['d'] = false;
        }
        console.log('Key up:', e.key, 'Shift:', e.shiftKey);
    };

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

    function showEndGame(winner) {
        const endGameDiv = document.getElementById('end-game');
        const endMessage = document.getElementById('end-message');
        endMessage.textContent = winner === playerId ? 'You Win!' : aiActive ? 'AI Wins! Game Over' : 'You Lose!';
        endGameDiv.style.display = 'block';
        gameState = 'ended'; // Mark game as ended
    }

    document.getElementById('end-share-x-btn').onclick = () => {
        const tweetText = `I just ${players[playerId].lives > 0 ? 'won' : 'lost'} a game of 1v1 Shooter: Slothy & Grok Edition! Play here: https://im2slothy.com/game.html #1v1Shooter #GameDev`;
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
        window.open(url, '_blank');
        logToDiscord(`[${timestamp}] | Player ${playerId || 'Unknown'} shared end-game result on X`);
    };

    document.getElementById('end-refresh-btn').onclick = () => {
        location.reload();
    };

    function resizeCanvas() {
        const maxWidth = window.innerWidth - 20;
        const maxHeight = window.innerHeight - 100;
        const aspectRatio = BASE_WIDTH / BASE_HEIGHT;

        let newWidth = maxWidth;
        let newHeight = newWidth / aspectRatio;
        if (newHeight > maxHeight) {
            newHeight = maxHeight;
            newWidth = newHeight * aspectRatio;
        }

        canvas.width = newWidth;
        canvas.height = newHeight;
        scaleFactor = Math.min(newWidth / BASE_WIDTH, newHeight / BASE_HEIGHT);
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 0.1;
    gainNode.connect(audioCtx.destination);
    function playSound(freq, duration) {
        const osc = audioCtx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = freq;
        osc.connect(gainNode);
        osc.start();
        setTimeout(() => osc.stop(), duration);
    }

    function generateLobbyId() {
        return Math.floor(1000 + Math.random() * 9000).toString();
    }

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouseX = (e.clientX - rect.left) / scaleFactor;
        mouseY = (e.clientY - rect.top) / scaleFactor;
    });

    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            mouseDown = true;
        }
    });

    canvas.addEventListener('mouseup', (e) => {
        if (e.button === 0) {
            mouseDown = false;
        }
    });

    document.getElementById('host-btn').onclick = () => {
        if (!peer) {
            peer = new Peer(generateLobbyId());
            peer.on('open', (id) => {
                console.log('Host ID generated:', id);
                playerId = id;
                players[playerId] = { x: 100, y: 300, color: 'red', health: 100, speed: PLAYER_SPEED, shootCooldown: 0, lives: 3, angle: 0, shield: 0, homing: 0 };
                playerCount = 1; // Host counts as first player
                document.getElementById('peer-id').value = id;
                document.getElementById('peer-id').disabled = true;
                document.getElementById('status').textContent = 'Status: Hosting...';
                logToDiscord(`[${timestamp}] | Player ${playerId} created a game (ID: ${id})`);
            });
            peer.on('connection', (connection) => {
                if (playerCount >= 2 || gameState !== 'waiting') {
                    // Reject additional connections
                    connection.on('open', () => {
                        connection.send({ type: 'reject', message: 'Game is full or already started!' });
                        connection.close();
                    });
                    console.log('Rejected connection: Game full or not waiting');
                    return;
                }

                console.log('Opponent connected to host:', connection.peer);
                conn = connection;
                conn.on('open', () => {
                    console.log('Connection opened on host');
                    players[conn.peer] = { x: 700, y: 300, color: 'cyan', health: 100, speed: PLAYER_SPEED, shootCooldown: 0, lives: 3, angle: 0, shield: 0, homing: 0 };
                    playerCount = 2; // Now at max capacity
                    gameState = 'playing'; // Game starts
                    document.getElementById('status').textContent = 'Status: Opponent joined! Playing...';
                    conn.send({ type: 'init', players });
                    if (!gameRunning) startGame();
                });
                conn.on('data', handleData);
                conn.on('close', () => {
                    console.log('Opponent disconnected from host');
                    if (gameRunning) {
                        showEndGame(playerId);
                        gameRunning = false;
                        bgMusic.pause();
                        musicPlaying = false;
                    }
                });
                conn.on('error', (err) => console.error('Host connection error:', err));
            });
            peer.on('error', (err) => console.error('Host peer error:', err));
        }
    };

    document.getElementById('join-btn').onclick = () => {
        if (!peer) {
            const hostId = document.getElementById('peer-id').value.trim();
            if (!hostId) {
                document.getElementById('status').textContent = 'Status: Enter a valid Host ID!';
                return;
            }
            peer = new Peer(generateLobbyId());
            peer.on('open', (id) => {
                console.log('Joiner ID generated:', id);
                playerId = id;
                players[playerId] = { x: 700, y: 300, color: 'cyan', health: 100, speed: PLAYER_SPEED, shootCooldown: 0, lives: 3, angle: 0, shield: 0, homing: 0 };
                document.getElementById('peer-id').disabled = true;
                document.getElementById('status').textContent = 'Status: Connecting...';
                conn = peer.connect(hostId);
                conn.on('open', () => {
                    console.log('Connected to host:', hostId);
                    document.getElementById('status').textContent = 'Status: Connected! Playing...';
                    if (!gameRunning) startGame();
                    logToDiscord(`[${timestamp}] | Player ${playerId} joined game (Host ID: ${hostId})`);
                });
                conn.on('data', (data) => {
                    if (data.type === 'reject') {
                        document.getElementById('status').textContent = `Status: ${data.message}`;
                        conn.close();
                        return;
                    }
                    handleData(data);
                });
                conn.on('close', () => {
                    console.log('Disconnected from host');
                    if (gameRunning) {
                        showEndGame(playerId);
                        gameRunning = false;
                        bgMusic.pause();
                        musicPlaying = false;
                    }
                });
                conn.on('error', (err) => console.error('Joiner connection error:', err));
            });
            peer.on('error', (err) => console.error('Joiner peer error:', err));
        }
    };

    document.getElementById('ai-btn').onclick = () => {
        if (!playerId) {
            playerId = 'human';
            players[playerId] = { x: 100, y: 300, color: 'red', health: 100, speed: PLAYER_SPEED, shootCooldown: 0, lives: 3, angle: 0, shield: 0, homing: 0 };
        }
        if (!conn && !aiActive) {
            const aiId = 'ai';
            players[aiId] = { x: 700, y: 300, color: 'cyan', health: 100, speed: AI_SPEED, shootCooldown: 0, lives: 3, angle: 0, shield: 0, homing: 0 };
            aiActive = true;
            document.getElementById('status').textContent = 'Status: Playing against AI';
            if (!gameRunning) startGame();
            logToDiscord(`[${timestamp}] | Player ${playerId} started a game against AI`);
        }
    };

    document.getElementById('share-x-btn').onclick = () => {
        const tweetText = "Check out this awesome 1v1 Shooter game I’m playing! Join me at https://im2slothy.com/game.html #1v1Shooter #GameDev";
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
        window.open(url, '_blank');
        logToDiscord(`[${timestamp}] | Player ${playerId || 'Unknown'} shared the game on X`);
    };

    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    const controls = document.getElementById('controls');
    const joystick = controls.querySelector('.joystick');
    const shootBtn = document.getElementById('shoot-btn');
    const touchState = { moving: false, shooting: false, moveX: 0, moveY: 0 };

    if (isMobile) {
        controls.style.display = 'block';
        shootBtn.style.display = 'block';
    
        controls.addEventListener('touchstart', (e) => {
            e.preventDefault();
            touchState.moving = true;
        });
    
        controls.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            if (touchState.moving) {
                const rect = controls.getBoundingClientRect();
                const dx = touch.clientX - rect.left - 50;
                const dy = touch.clientY - rect.top - 50;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const maxDist = 25;
                if (dist > maxDist) {
                    const scale = maxDist / dist;
                    touchState.moveX = dx * scale;
                    touchState.moveY = dy * scale;
                } else {
                    touchState.moveX = dx;
                    touchState.moveY = dy;
                }
                joystick.style.left = (25 + touchState.moveX) + 'px';
                joystick.style.top = (25 + touchState.moveY) + 'px';
            }
        });
    
        controls.addEventListener('touchend', (e) => {
            e.preventDefault();
            touchState.moving = false;
            touchState.moveX = 0;
            touchState.moveY = 0;
            joystick.style.left = '25px';
            joystick.style.top = '25px';
        });
    
        shootBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            touchState.shooting = true;
        });
    
        shootBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            touchState.shooting = false;
        });
    }

    document.getElementById('chat-input').onkeydown = (e) => {
        if (e.key === 'Enter' && e.target.value) {
            const msg = `${playerId?.slice(0, 5) || 'You'}: ${e.target.value}`;
            document.getElementById('chat-box').innerHTML += `<p>${msg}</p>`;
            if (conn && conn.open) sendData({ type: 'chat', msg });
            const timestamp = new Date().toLocaleString();
            logToDiscord(`[${timestamp}] Chat: ${msg}`);
            e.target.value = '';
        }
    };

    function handleData(data) {
        if (data.type === 'init') {
            players = { ...players, ...data.players };
        } else if (data.type === 'move') {
            if (players[data.id]) {
                players[data.id] = { 
                    ...players[data.id], 
                    x: data.x, 
                    y: data.y, 
                    angle: data.angle,
                    health: data.health,
                    lives: data.lives,
                    shield: data.shield,
                    homing: data.homing
                };
            }
        } else if (data.type === 'bullet') {
            bullets.push(data.bullet);
        } else if (data.type === 'health') {
            if (players[data.id]) {
                players[data.id].health = data.health;
                players[data.id].lives = data.lives;
            }
        } else if (data.type === 'powerUp') {
            if (players[data.id]) {
                players[data.id].speed = data.speed || players[data.id].speed;
                players[data.id].shootCooldown = data.shootCooldown || players[data.id].shootCooldown;
                if (data.shield !== undefined) players[data.id].shield = data.shield;
                if (data.homing !== undefined) players[data.id].homing = data.homing;
            }
        } else if (data.type === 'chat') {
            document.getElementById('chat-box').innerHTML += `<p>${data.msg}</p>`;
        }
    }

    function sendData(data) {
        if (conn && conn.open) conn.send(data);
    }

    function spawnPowerUp() {
        if ((Object.keys(players).length === 2 || aiActive) && Math.random() < 0.002) {
            const types = ['speed', 'rapid', 'shield', 'multi', 'health', 'homing'];
            let x, y, valid = false;
            do {
                x = Math.random() * (BASE_WIDTH - 20);
                y = Math.random() * (BASE_HEIGHT - 20);
                valid = !obstacles.some(o => 
                    x + 10 > o.x * BASE_WIDTH && x - 10 < (o.x + o.width) * BASE_WIDTH &&
                    y + 10 > o.y * BASE_HEIGHT && y - 10 < (o.y + o.height) * BASE_HEIGHT
                );
            } while (!valid);
            powerUps.push({ x, y, type: types[Math.floor(Math.random() * types.length)] });
        }
    }

    function spawnHitParticles(x, y) {
        for (let i = 0; i < 5; i++) {
            particles.push({
                x: x,
                y: y,
                dx: (Math.random() - 0.5) * 200,
                dy: (Math.random() - 0.5) * 200,
                life: 0.3
            });
        }
    }

    function checkCollision(x1, y1, x2, y2, w1 = 0, h1 = 0, w2 = 0, h2 = 0) {
        if (w1 === 0 && h1 === 0) {
            const dx = x1 - x2;
            const dy = y1 - y2;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance < PLAYER_SIZE;
        } else {
            const circleX = x1 + PLAYER_SIZE / 2;
            const circleY = y1 + PLAYER_SIZE / 2;
            const rectLeft = x2;
            const rectRight = x2 + w2 * BASE_WIDTH;
            const rectTop = y2;
            const rectBottom = y2 + h2 * BASE_HEIGHT;

            const closestX = Math.max(rectLeft, Math.min(circleX, rectRight));
            const closestY = Math.max(rectTop, Math.min(circleY, rectBottom));
            const dx = circleX - closestX;
            const dy = circleY - closestY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance < PLAYER_SIZE / 2;
        }
    }

    function resolveCollision(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < PLAYER_SIZE) {
            const angle = Math.atan2(dy, dx);
            const overlap = PLAYER_SIZE - distance;
            const pushX = Math.cos(angle) * overlap / 2;
            const pushY = Math.sin(angle) * overlap / 2;
            p1.x -= pushX;
            p1.y -= pushY;
            p2.x += pushX;
            p2.y += pushY;

            p1.x = Math.max(0, Math.min(BASE_WIDTH - PLAYER_SIZE, p1.x));
            p1.y = Math.max(0, Math.min(BASE_HEIGHT - PLAYER_SIZE, p1.y));
            p2.x = Math.max(0, Math.min(BASE_WIDTH - PLAYER_SIZE, p2.x));
            p2.y = Math.max(0, Math.min(BASE_HEIGHT - PLAYER_SIZE, p2.y));
        }
    }

    function resolveObstacleCollision(entity, obstacle) {
        const circleX = entity.x + PLAYER_SIZE / 2;
        const circleY = entity.y + PLAYER_SIZE / 2;
        const rectLeft = obstacle.x * BASE_WIDTH;
        const rectRight = (obstacle.x + obstacle.width) * BASE_WIDTH;
        const rectTop = obstacle.y * BASE_HEIGHT;
        const rectBottom = (obstacle.y + obstacle.height) * BASE_HEIGHT;

        const closestX = Math.max(rectLeft, Math.min(circleX, rectRight));
        const closestY = Math.max(rectTop, Math.min(circleY, rectBottom));
        const dx = circleX - closestX;
        const dy = circleY - closestY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < PLAYER_SIZE / 2) {
            const angle = Math.atan2(dy, dx);
            const overlap = PLAYER_SIZE / 2 - distance;
            const pushX = Math.cos(angle) * overlap;
            const pushY = Math.sin(angle) * overlap;
            entity.x += pushX;
            entity.y += pushY;

            entity.x = Math.max(0, Math.min(BASE_WIDTH - PLAYER_SIZE, entity.x));
            entity.y = Math.max(0, Math.min(BASE_HEIGHT - PLAYER_SIZE, entity.y));
        }
    }

    function startGame() {
        console.log('Starting game');
        gameRunning = true;
        if (!musicPlaying) {
            bgMusic.play();
            musicPlaying = true;
        }
        requestAnimationFrame(gameLoop);
    }

    function gameLoop(currentTime) {
        const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1);
        lastTime = currentTime;

        ctx.save();
        ctx.scale(scaleFactor, scaleFactor);
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

        if (flashTimer > 0) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
            flashTimer -= deltaTime;
        }

        ctx.strokeStyle = '#333';
        for (let i = 0; i < BASE_WIDTH; i += 50) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, BASE_HEIGHT);
            ctx.stroke();
        }
        for (let i = 0; i < BASE_HEIGHT; i += 50) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(BASE_WIDTH, i);
            ctx.stroke();
        }

        ctx.fillStyle = 'gray';
        obstacles.forEach(o => {
            ctx.fillRect(o.x * BASE_WIDTH, o.y * BASE_HEIGHT, o.width * BASE_WIDTH, o.height * BASE_HEIGHT);
        });

        const opponentId = Object.keys(players).find(id => id !== playerId);

        ctx.fillStyle = 'white';
        ctx.font = `${16}px Arial`;
        ctx.fillText(`You: ${players[playerId]?.lives || 0} lives`, 10, 20);
        ctx.fillText(`Opponent: ${players[opponentId]?.lives || 0} lives`, BASE_WIDTH - 150, 20);

        let me = players[playerId];
        if (me) {
            if (me.health <= 0 && me.lives > 0) {
                me.lives--;
                me.health = 100;
                me.x = playerId === 'human' ? 100 : 700;
                me.y = 300;
                me.speed = PLAYER_SPEED;
                me.shootCooldown = 0;
                me.shield = 0;
                me.homing = 0;
                flashTimer = 0.2;
                playSound(100, 200);
                if (conn && conn.open) sendData({ type: 'health', id: playerId, health: me.health, lives: me.lives });
            }
            if (me.lives <= 0) {
                showEndGame(opponentId);
                gameRunning = false;
                bgMusic.pause();
                musicPlaying = false;
                ctx.restore();
                return;
            }

            let velX = 0;
            let velY = 0;
            const speed = me.speed * deltaTime;
            if (keys['ArrowLeft'] || keys['a']) velX -= speed;
            if (keys['ArrowRight'] || keys['d']) velX += speed;
            if (keys['ArrowUp'] || keys['w']) velY -= speed;
            if (keys['ArrowDown'] || keys['s']) velY += speed;
            if (touchState.moving) {
                velX += touchState.moveX * speed / 25;
                velY += touchState.moveY * speed / 25;
            }

            const newX = me.x + velX;
            const newY = me.y + velY;
            me.x = Math.max(0, Math.min(BASE_WIDTH - PLAYER_SIZE, newX));
            me.y = Math.max(0, Math.min(BASE_HEIGHT - PLAYER_SIZE, newY));

            obstacles.forEach(o => resolveObstacleCollision(me, o));

            for (let id in players) {
                if (id !== playerId && players[id].lives > 0) {
                    resolveCollision(me, players[id]);
                }
            }

            if (!isMobile) {
                const dx = mouseX - (me.x + PLAYER_SIZE / 2);
                const dy = mouseY - (me.y + PLAYER_SIZE / 2);
                me.angle = Math.atan2(dy, dx);
            } else if (touchState.moving) {
                me.angle = Math.atan2(touchState.moveY, touchState.moveX);
            }

            let isShooting = (isMobile && touchState.shooting) || (!isMobile && mouseDown);
            if (isShooting && me.shootCooldown <= 0) {
                const angle = me.angle || 0;
                let bulletsToSpawn = [];
                if (powerUps.some(p => p.type === 'multi' && Math.abs(p.x - me.x) < PLAYER_SIZE && Math.abs(p.y - me.y) < PLAYER_SIZE)) {
                    for (let offset = -0.26; offset <= 0.26; offset += 0.26) {
                        bulletsToSpawn.push({
                            x: me.x + PLAYER_SIZE / 2 + Math.cos(angle + offset) * PLAYER_SIZE,
                            y: me.y + PLAYER_SIZE / 2 + Math.sin(angle + offset) * PLAYER_SIZE,
                            owner: playerId,
                            dx: Math.cos(angle + offset) * BULLET_SPEED,
                            dy: Math.sin(angle + offset) * BULLET_SPEED,
                            homing: me.homing > 0
                        });
                    }
                } else {
                    bulletsToSpawn.push({
                        x: me.x + PLAYER_SIZE / 2 + Math.cos(angle) * PLAYER_SIZE,
                        y: me.y + PLAYER_SIZE / 2 + Math.sin(angle) * PLAYER_SIZE,
                        owner: playerId,
                        dx: Math.cos(angle) * BULLET_SPEED,
                        dy: Math.sin(angle) * BULLET_SPEED,
                        homing: me.homing > 0
                    });
                }
                bullets.push(...bulletsToSpawn);
                if (conn && conn.open) bulletsToSpawn.forEach(bullet => sendData({ type: 'bullet', bullet }));
                me.shootCooldown = SHOOT_COOLDOWN;
                playSound(400, 100);
            }
            if (me.shootCooldown > 0) me.shootCooldown -= deltaTime;
            if (me.shield > 0) me.shield -= deltaTime;
            if (me.homing > 0) me.homing -= deltaTime;

            if (conn && conn.open && currentTime - lastUpdateTime >= UPDATE_INTERVAL * 1000) {
                sendData({ 
                    type: 'move', 
                    id: playerId, 
                    x: me.x, 
                    y: me.y, 
                    angle: me.angle,
                    health: me.health,
                    lives: me.lives,
                    shield: me.shield,
                    homing: me.homing
                });
                lastUpdateTime = currentTime;
            }
        }

        if (opponentId && players[opponentId] && players[opponentId].lives <= 0 && !aiActive) {
            showEndGame(playerId);
            gameRunning = false;
            bgMusic.pause();
            musicPlaying = false;
            ctx.restore();
            return;
        }

        if (aiActive) {
            const ai = players['ai'];
            const human = players[playerId];
            if (ai.health <= 0 && ai.lives > 0) {
                ai.lives--;
                ai.health = 100;
                ai.x = 700;
                ai.y = 300;
                ai.speed = AI_SPEED;
                ai.shootCooldown = 0;
                ai.shield = 0;
                ai.homing = 0;
            }
            if (ai.lives <= 0) {
                showEndGame(playerId);
                gameRunning = false;
                bgMusic.pause();
                musicPlaying = false;
                ctx.restore();
                return;
            }
            let velX = 0;
            let velY = 0;
            bullets.forEach(b => {
                if (b.owner !== 'ai' && Math.abs(b.x - ai.x) < 50 && Math.abs(b.y - ai.y) < 50) {
                    if (b.y > ai.y) velY -= AI_SPEED * deltaTime;
                    else velY += AI_SPEED * deltaTime;
                }
            });
            if (human.x < ai.x) velX -= AI_SPEED * deltaTime;
            if (human.x > ai.x) velX += AI_SPEED * deltaTime;
            if (human.y < ai.y) velY -= AI_SPEED * deltaTime;
            if (human.y > ai.y) velY += AI_SPEED * deltaTime;

            const newX = ai.x + velX;
            const newY = ai.y + velY;
            ai.x = Math.max(0, Math.min(BASE_WIDTH - PLAYER_SIZE, newX));
            ai.y = Math.max(0, Math.min(BASE_HEIGHT - PLAYER_SIZE, newY));

            obstacles.forEach(o => resolveObstacleCollision(ai, o));

            const dx = human.x - ai.x;
            const dy = human.y - ai.y;
            ai.angle = Math.atan2(dy, dx);

            if (Math.random() < 0.05 && ai.shootCooldown <= 0) {
                const bullet = { 
                    x: ai.x + PLAYER_SIZE / 2 + Math.cos(ai.angle) * PLAYER_SIZE, 
                    y: ai.y + PLAYER_SIZE / 2 + Math.sin(ai.angle) * PLAYER_SIZE, 
                    owner: 'ai', 
                    dx: Math.cos(ai.angle) * BULLET_SPEED, 
                    dy: Math.sin(ai.angle) * BULLET_SPEED,
                    homing: ai.homing > 0
                };
                bullets.push(bullet);
                ai.shootCooldown = SHOOT_COOLDOWN;
                playSound(300, 100);
            }
            if (ai.shootCooldown > 0) ai.shootCooldown -= deltaTime;
            if (ai.shield > 0) ai.shield -= deltaTime;
            if (ai.homing > 0) ai.homing -= deltaTime;
        }

        spawnPowerUp();
        powerUps = powerUps.filter(p => {
            for (let id in players) {
                let pl = players[id];
                if (Math.abs(pl.x - p.x) < PLAYER_SIZE && Math.abs(p.y - me.y) < PLAYER_SIZE) {
                    if (p.type === 'speed') pl.speed = PLAYER_SPEED * 1.5;
                    else if (p.type === 'rapid') pl.shootCooldown = -0.2;
                    else if (p.type === 'shield') pl.shield = 5;
                    else if (p.type === 'multi') {}
                    else if (p.type === 'health') pl.health = Math.min(100, pl.health + 50);
                    else if (p.type === 'homing') pl.homing = HOMING_DURATION;
                    if (conn && conn.open) sendData({ type: 'powerUp', id: id, speed: pl.speed, shootCooldown: pl.shootCooldown, shield: pl.shield, homing: pl.homing });
                    playSound(p.type === 'homing' ? 700 : 600, 100);
                    return false;
                }
            }
            return true;
        });

        bullets.forEach(b => {
            if (b.homing) {
                let nearestEnemy = null;
                let minDist = Infinity;
                for (let id in players) {
                    if (id !== b.owner && players[id].lives > 0) {
                        const p = players[id];
                        const dist = Math.sqrt((p.x - b.x) ** 2 + (p.y - b.y) ** 2);
                        if (dist < minDist) {
                            minDist = dist;
                            nearestEnemy = p;
                        }
                    }
                }
                if (nearestEnemy) {
                    const targetAngle = Math.atan2(nearestEnemy.y - b.y, nearestEnemy.x - b.x);
                    const currentAngle = Math.atan2(b.dy, b.dx);
                    let angleDiff = targetAngle - currentAngle;
                    if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                    if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
                    const turnRate = 5 * deltaTime;
                    const newAngle = currentAngle + Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), turnRate);
                    b.dx = Math.cos(newAngle) * BULLET_SPEED;
                    b.dy = Math.sin(newAngle) * BULLET_SPEED;
                }
            }
            b.x += b.dx * deltaTime;
            b.y += b.dy * deltaTime;
        });
        bullets = bullets.filter(b => {
            if (b.x > BASE_WIDTH || b.x < 0 || b.y > BASE_HEIGHT || b.y < 0) return false;
            for (let o of obstacles) {
                if (b.x >= o.x * BASE_WIDTH && b.x <= (o.x + o.width) * BASE_WIDTH && 
                    b.y >= o.y * BASE_HEIGHT && b.y <= (o.y + o.height) * BASE_HEIGHT) {
                    return false;
                }
            }
            for (let id in players) {
                if (id !== b.owner) {
                    let p = players[id];
                    if (b.x >= p.x && b.x <= p.x + PLAYER_SIZE && b.y >= p.y && b.y <= p.y + PLAYER_SIZE) {
                        if (p.shield <= 0) {
                            p.health -= 20;
                            spawnHitParticles(b.x, b.y);
                            playSound(200, 150);
                        }
                        if (conn && conn.open) sendData({ type: 'health', id: id, health: p.health, lives: p.lives });
                        return false;
                    }
                }
            }
            return true;
        });

        particles = particles.filter(p => {
            p.x += p.dx * deltaTime;
            p.y += p.dy * deltaTime;
            p.life -= deltaTime;
            return p.life > 0;
        });

        powerUps.forEach(p => {
            ctx.fillStyle = p.type === 'speed' ? 'yellow' : 
                           p.type === 'rapid' ? 'green' : 
                           p.type === 'shield' ? 'blue' : 
                           p.type === 'multi' ? 'purple' : 
                           p.type === 'health' ? 'orange' : 
                           p.type === 'homing' ? 'pink' : 'white';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
            ctx.fill();
        });

        for (let id in players) {
            const p = players[id];
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x + PLAYER_SIZE / 2, p.y + PLAYER_SIZE / 2, PLAYER_SIZE / 2, 0, Math.PI * 2);
            ctx.fill();

            if (p.shield > 0) {
                ctx.strokeStyle = 'blue';
                ctx.lineWidth = 2 / scaleFactor;
                ctx.beginPath();
                ctx.arc(p.x + PLAYER_SIZE / 2, p.y + PLAYER_SIZE / 2, PLAYER_SIZE / 2 + 2 / scaleFactor, 0, Math.PI * 2);
                ctx.stroke();
            }

            ctx.fillStyle = 'white';
            ctx.font = `${12}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(id.slice(0, 5), p.x + PLAYER_SIZE / 2, p.y - 15);

            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.moveTo(p.x + PLAYER_SIZE / 2 + Math.cos(p.angle) * PLAYER_SIZE, p.y + PLAYER_SIZE / 2 + Math.sin(p.angle) * PLAYER_SIZE);
            ctx.lineTo(p.x + PLAYER_SIZE / 2 + Math.cos(p.angle + Math.PI / 6) * 10, p.y + PLAYER_SIZE / 2 + Math.sin(p.angle + Math.PI / 6) * 10);
            ctx.lineTo(p.x + PLAYER_SIZE / 2 + Math.cos(p.angle - Math.PI / 6) * 10, p.y + PLAYER_SIZE / 2 + Math.sin(p.angle - Math.PI / 6) * 10);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = 'lime';
            ctx.fillRect(p.x, p.y - 10, Math.max(0, Math.min(p.health / 100 * PLAYER_SIZE, PLAYER_SIZE)), 5);
            ctx.strokeStyle = 'white';
            ctx.strokeRect(p.x, p.y - 10, PLAYER_SIZE, 5);
        }

        ctx.fillStyle = 'white';
        bullets.forEach(b => {
            ctx.fillRect(b.x, b.y, 5, 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.fillRect(b.x - 5, b.y, 3, 2);
        });

        ctx.fillStyle = 'red';
        particles.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.restore();

        if (gameRunning) requestAnimationFrame(gameLoop);
    }
};
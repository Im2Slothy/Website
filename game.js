const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let peer = null;
let conn = null;
let playerId = null;
let players = {};
let bullets = [];
let powerUps = [];
const PLAYER_SIZE = 20;
const BULLET_SPEED = 10;
let aiActive = false;
let gameRunning = false;
let flashTimer = 0;

// Responsive canvas
function resizeCanvas() {
    const maxWidth = window.innerWidth - 20;
    const maxHeight = window.innerHeight - 200;
    const aspectRatio = 800 / 600;
    canvas.width = Math.min(maxWidth, maxHeight * aspectRatio);
    canvas.height = canvas.width / aspectRatio;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Audio setup
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

// Generate 4-digit lobby ID
function generateLobbyId() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// Host game
document.getElementById('host-btn').onclick = () => {
    if (!peer) {
        peer = new Peer(generateLobbyId());
        peer.on('open', (id) => {
            console.log('Host ID generated:', id);
            playerId = id;
            players[playerId] = { x: 100, y: 300, color: 'red', health: 100, speed: 3, shootCooldown: 0, lives: 3, angle: 0 };
            document.getElementById('peer-id').value = id;
            document.getElementById('peer-id').disabled = true;
            document.getElementById('status').textContent = 'Status: Hosting...';
        });
        peer.on('connection', (connection) => {
            console.log('Opponent connected to host:', connection.peer);
            conn = connection;
            conn.on('open', () => {
                console.log('Connection opened on host');
                players[conn.peer] = { x: 700, y: 300, color: 'cyan', health: 100, speed: 3, shootCooldown: 0, lives: 3, angle: 0 };
                document.getElementById('status').textContent = 'Status: Opponent joined! Playing...';
                // Send initial state to joiner
                conn.send({ type: 'init', players });
                if (!gameRunning) startGame();
            });
            conn.on('data', handleData);
            conn.on('close', () => {
                console.log('Opponent disconnected from host');
                if (gameRunning) {
                    document.getElementById('status').textContent = 'Status: Opponent disconnected. You win!';
                    setTimeout(() => location.reload(), 1000);
                }
            });
            conn.on('error', (err) => console.error('Host connection error:', err));
        });
        peer.on('error', (err) => console.error('Host peer error:', err));
    }
};

// Join game
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
            players[playerId] = { x: 700, y: 300, color: 'cyan', health: 100, speed: 3, shootCooldown: 0, lives: 3, angle: 0 };
            document.getElementById('peer-id').disabled = true;
            document.getElementById('status').textContent = 'Status: Connecting...';
            conn = peer.connect(hostId);
            conn.on('open', () => {
                console.log('Connected to host:', hostId);
                document.getElementById('status').textContent = 'Status: Connected! Playing...';
                if (!gameRunning) startGame();
            });
            conn.on('data', handleData);
            conn.on('close', () => {
                console.log('Disconnected from host');
                if (gameRunning) {
                    document.getElementById('status').textContent = 'Status: Opponent disconnected. You win!';
                    setTimeout(() => location.reload(), 1000);
                }
            });
            conn.on('error', (err) => console.error('Joiner connection error:', err));
        });
        peer.on('error', (err) => console.error('Joiner peer error:', err));
    }
};

// Play AI
document.getElementById('ai-btn').onclick = () => {
    if (!playerId) {
        playerId = 'human';
        players[playerId] = { x: 100, y: 300, color: 'red', health: 100, speed: 3, shootCooldown: 0, lives: 3, angle: 0 };
    }
    if (!conn && !aiActive) {
        const aiId = 'ai';
        players[aiId] = { x: 700, y: 300, color: 'cyan', health: 100, speed: 3, shootCooldown: 0, lives: 3, angle: 0 };
        aiActive = true;
        document.getElementById('status').textContent = 'Status: Playing against AI';
        if (!gameRunning) startGame();
    }
};

// Chat
document.getElementById('chat-input').onkeydown = (e) => {
    if (e.key === 'Enter' && e.target.value) {
        const msg = `${playerId?.slice(0, 5) || 'You'}: ${e.target.value}`;
        document.getElementById('chat-box').innerHTML += `<p>${msg}</p>`;
        if (conn && conn.open) sendData({ type: 'chat', msg });
        e.target.value = '';
    }
};

// Mouse and touch controls
const controls = document.getElementById('controls');
const joystick = document.getElementById('joystick');
const shootBtn = document.getElementById('shoot-btn');
let touchState = { moving: false, shooting: false, moveX: 0, moveY: 0 };
let mouseX = 0, mouseY = 0;
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

if (isMobile) {
    controls.style.display = 'block';
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

    // Shoot button for mobile
    shootBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        touchState.shooting = true;
    });
    shootBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        touchState.shooting = false;
    });
} else {
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
    });
    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) touchState.shooting = true;
    });
    canvas.addEventListener('mouseup', (e) => {
        if (e.button === 0) touchState.shooting = false;
    });
}

// Game logic
const keys = {};
window.onkeydown = (e) => keys[e.key] = true;
window.onkeyup = (e) => keys[e.key] = false;

function handleData(data) {
    if (data.type === 'init') {
        players = { ...players, ...data.players };
    } else if (data.type === 'move') {
        players[data.id] = { ...players[data.id], x: data.x, y: data.y, angle: data.angle };
    } else if (data.type === 'bullet') {
        bullets.push(data.bullet);
    } else if (data.type === 'health') {
        players[data.id].health = data.health;
        players[data.id].lives = data.lives;
    } else if (data.type === 'powerUp') {
        players[data.id].speed = data.speed;
        players[data.id].shootCooldown = data.shootCooldown;
    } else if (data.type === 'chat') {
        document.getElementById('chat-box').innerHTML += `<p>${data.msg}</p>`;
    }
}

function sendData(data) {
    if (conn && conn.open) conn.send(data);
}

function spawnPowerUp() {
    if ((Object.keys(players).length === 2 || aiActive) && Math.random() < 0.001) {
        powerUps.push({
            x: Math.random() * (canvas.width - 20),
            y: Math.random() * (canvas.height - 20),
            type: Math.random() < 0.5 ? 'speed' : 'rapid'
        });
    }
}

function checkCollision(x1, y1, x2, y2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < PLAYER_SIZE;
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

        // Ensure players stay within bounds after push
        p1.x = Math.max(0, Math.min(canvas.width - PLAYER_SIZE, p1.x));
        p1.y = Math.max(0, Math.min(canvas.height - PLAYER_SIZE, p1.y));
        p2.x = Math.max(0, Math.min(canvas.width - PLAYER_SIZE, p2.x));
        p2.y = Math.max(0, Math.min(canvas.height - PLAYER_SIZE, p2.y));
    }
}

function startGame() {
    console.log('Starting game');
    gameRunning = true;
    requestAnimationFrame(gameLoop);
}

function gameLoop() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (flashTimer > 0) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        flashTimer--;
    }

    ctx.strokeStyle = '#333';
    for (let i = 0; i < canvas.width; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 50) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
    }

    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.fillText(`You: ${players[playerId]?.lives || 0} lives`, 10, 20);
    const opponentId = Object.keys(players).find(id => id !== playerId);
    ctx.fillText(`Opponent: ${players[opponentId]?.lives || 0} lives`, canvas.width - 150, 20);

    let me = players[playerId];
    if (me) {
        if (me.health <= 0 && me.lives > 0) {
            me.lives--;
            me.health = 100;
            me.x = playerId === 'human' ? 100 : 700;
            me.y = 300;
            me.speed = 3;
            me.shootCooldown = 0;
            flashTimer = 10;
            playSound(100, 200);
            if (conn && conn.open) sendData({ type: 'health', id: playerId, health: me.health, lives: me.lives });
        }
        if (me.lives <= 0) {
            document.getElementById('status').textContent = aiActive ? 'Status: AI wins! Game Over' : 'Status: You lose!';
            gameRunning = false;
            setTimeout(() => location.reload(), 1000);
            return;
        }

        // Movement with collision
        const speed = me.speed;
        let newX = me.x;
        let newY = me.y;
        if (keys['ArrowLeft'] || keys['a']) newX -= speed;
        if (keys['ArrowRight'] || keys['d']) newX += speed;
        if (keys['ArrowUp'] || keys['w']) newY -= speed;
        if (keys['ArrowDown'] || keys['s']) newY += speed;
        if (touchState.moving) {
            newX += touchState.moveX * speed / 25;
            newY += touchState.moveY * speed / 25;
        }
        newX = Math.max(0, Math.min(canvas.width - PLAYER_SIZE, newX));
        newY = Math.max(0, Math.min(canvas.height - PLAYER_SIZE, newY));

        me.x = newX;
        me.y = newY;

        // Resolve collision with other players
        for (let id in players) {
            if (id !== playerId && players[id].lives > 0) {
                resolveCollision(me, players[id]);
            }
        }

        // Aiming with mouse
        if (!isMobile) {
            const dx = mouseX - (me.x + PLAYER_SIZE / 2);
            const dy = mouseY - (me.y + PLAYER_SIZE / 2);
            me.angle = Math.atan2(dy, dx);
        } else {
            // Default aiming right on mobile unless we add touch aiming
            me.angle = 0;
        }

        // Shooting with MB1 or Shoot button
        if (touchState.shooting && me.shootCooldown <= 0) {
            const angle = me.angle || 0; // Use mouse angle on desktop, default to right on mobile
            const bullet = { 
                x: me.x + PLAYER_SIZE / 2 + Math.cos(angle) * PLAYER_SIZE, 
                y: me.y + PLAYER_SIZE / 2 + Math.sin(angle) * PLAYER_SIZE, 
                owner: playerId, 
                dx: Math.cos(angle) * BULLET_SPEED, 
                dy: Math.sin(angle) * BULLET_SPEED 
            };
            bullets.push(bullet);
            if (conn && conn.open) sendData({ type: 'bullet', bullet });
            me.shootCooldown = 20;
            playSound(400, 100);
        }
        if (me.shootCooldown > 0) me.shootCooldown--;
        if (conn && conn.open) sendData({ type: 'move', id: playerId, x: me.x, y: me.y, angle: me.angle });
    }

    if (aiActive) {
        const ai = players['ai'];
        const human = players[playerId];
        if (ai.health <= 0 && ai.lives > 0) {
            ai.lives--;
            ai.health = 100;
            ai.x = 700;
            ai.y = 300;
            ai.speed = 3;
            ai.shootCooldown = 0;
        }
        if (ai.lives <= 0) {
            document.getElementById('status').textContent = 'Status: You win! AI defeated';
            gameRunning = false;
            setTimeout(() => location.reload(), 1000);
            return;
        }
        bullets.forEach(b => {
            if (b.owner !== 'ai' && Math.abs(b.x - ai.x) < 50 && Math.abs(b.y - ai.y) < 50) {
                if (b.y > ai.y) ai.y -= 2;
                else ai.y += 2;
            }
        });
        if (human.x < ai.x) ai.x -= 1.5;
        if (human.x > ai.x) ai.x += 1.5;
        if (human.y < ai.y) ai.y -= 1.5;
        if (human.y > ai.y) ai.y += 1.5;
        ai.x = Math.max(0, Math.min(canvas.width - PLAYER_SIZE, ai.x));
        ai.y = Math.max(0, Math.min(canvas.height - PLAYER_SIZE, ai.y));

        // AI aiming at human
        const dx = human.x - ai.x;
        const dy = human.y - ai.y;
        ai.angle = Math.atan2(dy, dx);

        if (Math.random() < 0.05 && ai.shootCooldown <= 0) {
            const bullet = { 
                x: ai.x + PLAYER_SIZE / 2 + Math.cos(ai.angle) * PLAYER_SIZE, 
                y: ai.y + PLAYER_SIZE / 2 + Math.sin(ai.angle) * PLAYER_SIZE, 
                owner: 'ai', 
                dx: Math.cos(ai.angle) * BULLET_SPEED, 
                dy: Math.sin(ai.angle) * BULLET_SPEED 
            };
            bullets.push(bullet);
            ai.shootCooldown = 20;
            playSound(300, 100);
        }
        ai.shootCooldown--;
    }

    spawnPowerUp();
    powerUps = powerUps.filter(p => {
        for (let id in players) {
            let pl = players[id];
            if (Math.abs(pl.x - p.x) < PLAYER_SIZE && Math.abs(pl.y - p.y) < PLAYER_SIZE) {
                if (p.type === 'speed') pl.speed = 5;
                else pl.shootCooldown = -10;
                if (conn && conn.open) sendData({ type: 'powerUp', id: id, speed: pl.speed, shootCooldown: pl.shootCooldown });
                return false;
            }
        }
        return true;
    });

    bullets = bullets.filter(b => {
        b.x += b.dx;
        b.y += b.dy;
        if (b.x > canvas.width || b.x < 0 || b.y > canvas.height || b.y < 0) return false;
        for (let id in players) {
            if (id !== b.owner) {
                let p = players[id];
                if (b.x >= p.x && b.x <= p.x + PLAYER_SIZE && b.y >= p.y && b.y <= p.y + PLAYER_SIZE) {
                    p.health -= 10;
                    if (conn && conn.open) sendData({ type: 'health', id: id, health: p.health, lives: p.lives });
                    playSound(200, 150);
                    return false;
                }
            }
        }
        return true;
    });

    powerUps.forEach(p => {
        ctx.fillStyle = p.type === 'speed' ? 'yellow' : 'green';
        ctx.beginPath();
        ctx.arc(p.x + 10, p.y + 10, 10, 0, Math.PI * 2);
        ctx.fill();
    });

    for (let id in players) {
        const p = players[id];
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x + PLAYER_SIZE / 2, p.y + PLAYER_SIZE / 2, PLAYER_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();

        // Draw aiming arrow
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.moveTo(p.x + PLAYER_SIZE / 2 + Math.cos(p.angle) * PLAYER_SIZE, p.y + PLAYER_SIZE / 2 + Math.sin(p.angle) * PLAYER_SIZE);
        ctx.lineTo(p.x + PLAYER_SIZE / 2 + Math.cos(p.angle + Math.PI / 6) * 10, p.y + PLAYER_SIZE / 2 + Math.sin(p.angle + Math.PI / 6) * 10);
        ctx.lineTo(p.x + PLAYER_SIZE / 2 + Math.cos(p.angle - Math.PI / 6) * 10, p.y + PLAYER_SIZE / 2 + Math.sin(p.angle - Math.PI / 6) * 10);
        ctx.closePath();
        ctx.fill();

        // Health bar (clamped to not overflow)
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

    if (gameRunning) requestAnimationFrame(gameLoop);
}
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

// Host game
document.getElementById('host-btn').onclick = () => {
    if (!peer) {
        peer = new Peer();
        peer.on('open', (id) => {
            console.log('Host ID generated:', id);
            playerId = id;
            players[playerId] = { x: 100, y: 300, color: 'red', health: 100, speed: 3, shootCooldown: 0, lives: 3 };
            document.getElementById('peer-id').value = id;
            document.getElementById('peer-id').disabled = true;
            document.getElementById('status').textContent = 'Status: Hosting...';
            if (!gameRunning) startGame();
        });
        peer.on('connection', (connection) => {
            console.log('Opponent connected to host:', connection.peer);
            conn = connection;
            players[conn.peer] = { x: 700, y: 300, color: 'cyan', health: 100, speed: 3, shootCooldown: 0, lives: 3 };
            document.getElementById('status').textContent = 'Status: Opponent joined! Playing...';
            conn.on('data', handleData);
            conn.on('close', () => {
                console.log('Opponent disconnected from host');
                if (gameRunning) {
                    document.getElementById('status').textContent = 'Status: Opponent disconnected. You win!';
                    gameRunning = false;
                    delete players[conn.peer];
                    document.getElementById('restart-btn').style.display = 'block';
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
        peer = new Peer();
        peer.on('open', (id) => {
            console.log('Joiner ID generated:', id);
            playerId = id;
            players[playerId] = { x: 700, y: 300, color: 'cyan', health: 100, speed: 3, shootCooldown: 0, lives: 3 };
            document.getElementById('peer-id').disabled = true;
            document.getElementById('status').textContent = 'Status: Connecting...';
            conn = peer.connect(hostId);
            conn.on('open', () => {
                console.log('Connected to host:', hostId);
                document.getElementById('status').textContent = 'Status: Connected! Playing...';
            });
            conn.on('data', handleData);
            conn.on('close', () => {
                console.log('Disconnected from host');
                if (gameRunning) {
                    document.getElementById('status').textContent = 'Status: Opponent disconnected. You win!';
                    gameRunning = false;
                    delete players[Object.keys(players).find(id => id !== playerId)];
                    document.getElementById('restart-btn').style.display = 'block';
                }
            });
            conn.on('error', (err) => console.error('Joiner connection error:', err));
            if (!gameRunning) startGame();
        });
        peer.on('error', (err) => console.error('Joiner peer error:', err));
    }
};

// Play AI
document.getElementById('ai-btn').onclick = () => {
    if (!playerId) {
        playerId = 'human';
        players[playerId] = { x: 100, y: 300, color: 'red', health: 100, speed: 3, shootCooldown: 0, lives: 3 };
    }
    if (!conn && !aiActive) {
        const aiId = 'ai';
        players[aiId] = { x: 700, y: 300, color: 'cyan', health: 100, speed: 3, shootCooldown: 0, lives: 3 };
        aiActive = true;
        document.getElementById('status').textContent = 'Status: Playing against AI';
        if (!gameRunning) startGame();
    }
};

// Restart game
document.getElementById('restart-btn').onclick = () => {
    players = {};
    bullets = [];
    powerUps = [];
    aiActive = false;
    gameRunning = false;
    playerId = null;
    peer = null;
    conn = null;
    document.getElementById('peer-id').value = '';
    document.getElementById('peer-id').disabled = false;
    document.getElementById('status').textContent = 'Status: Waiting...';
    document.getElementById('restart-btn').style.display = 'none';
    document.getElementById('chat-box').innerHTML = '';
    joystick.style.left = '25px';
    joystick.style.top = '25px';
    touchState = { moving: false, shooting: false };
};

// Chat
document.getElementById('chat-input').onkeydown = (e) => {
    if (e.key === 'Enter' && e.target.value) {
        const msg = `${playerId?.slice(0, 5) || 'You'}: ${e.target.value}`;
        document.getElementById('chat-box').innerHTML += `<p>${msg}</p>`;
        if (conn) sendData({ type: 'chat', msg });
        e.target.value = '';
    }
};

// Touch controls (only on mobile)
const controls = document.getElementById('controls');
const joystick = document.getElementById('joystick');
let touchState = { moving: false, shooting: false, moveX: 0, moveY: 0 };
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
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        if (touch.clientX > canvas.width / 2) {
            touchState.shooting = true;
        }
    });
    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (e.touches.length === 0 || e.touches[0].clientX <= canvas.width / 2) {
            touchState.shooting = false;
        }
    });
}

// Game logic
const keys = {};
window.onkeydown = (e) => keys[e.key] = true;
window.onkeyup = (e) => keys[e.key] = false;

function handleData(data) {
    if (data.type === 'move') {
        players[data.id] = { ...players[data.id], x: data.x, y: data.y };
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
    if (conn) conn.send(data);
}

function spawnPowerUp() {
    if (Math.random() < 0.005) {
        powerUps.push({
            x: Math.random() * (canvas.width - 20),
            y: Math.random() * (canvas.height - 20),
            type: Math.random() < 0.5 ? 'speed' : 'rapid'
        });
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
            if (conn) sendData({ type: 'health', id: playerId, health: me.health, lives: me.lives });
        }
        if (me.lives <= 0) {
            document.getElementById('status').textContent = aiActive ? 'Status: AI wins! Game Over' : 'Status: You lose!';
            gameRunning = false;
            document.getElementById('restart-btn').style.display = 'block';
            return;
        }
        const speed = me.speed;
        if (keys['ArrowLeft'] || keys['a']) me.x -= speed;
        if (keys['ArrowRight'] || keys['d']) me.x += speed;
        if (keys['ArrowUp'] || keys['w']) me.y -= speed;
        if (keys['ArrowDown'] || keys['s']) me.y += speed;
        if (touchState.moving) {
            me.x += touchState.moveX * speed / 25;
            me.y += touchState.moveY * speed / 25;
        }
        me.x = Math.max(0, Math.min(canvas.width - PLAYER_SIZE, me.x));
        me.y = Math.max(0, Math.min(canvas.height - PLAYER_SIZE, me.y));
        if (conn) sendData({ type: 'move', id: playerId, x: me.x, y: me.y });
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
            document.getElementById('restart-btn').style.display = 'block';
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
        if (Math.random() < 0.05 && ai.shootCooldown <= 0) {
            const bullet = { 
                x: ai.x, 
                y: ai.y + PLAYER_SIZE / 2, 
                owner: 'ai', 
                dx: human.x < ai.x ? -BULLET_SPEED : BULLET_SPEED 
            };
            bullets.push(bullet);
            ai.shootCooldown = 20;
            playSound(300, 100);
        }
        ai.shootCooldown--;
    }

    if ((keys[' '] || touchState.shooting) && me && me.shootCooldown <= 0) {
        if (!touchState.shooting || !keys['spacePressed']) {
            const bullet = { x: me.x + PLAYER_SIZE, y: me.y + PLAYER_SIZE / 2, owner: playerId, dx: BULLET_SPEED };
            bullets.push(bullet);
            if (conn) sendData({ type: 'bullet', bullet });
            keys['spacePressed'] = true;
            me.shootCooldown = 20;
            playSound(400, 100);
        }
    } else {
        keys['spacePressed'] = false;
    }
    if (me) me.shootCooldown--;

    spawnPowerUp();
    powerUps = powerUps.filter(p => {
        for (let id in players) {
            let pl = players[id];
            if (Math.abs(pl.x - p.x) < PLAYER_SIZE && Math.abs(pl.y - p.y) < PLAYER_SIZE) {
                if (p.type === 'speed') pl.speed = 5;
                else pl.shootCooldown = -10;
                if (conn) sendData({ type: 'powerUp', id: id, speed: pl.speed, shootCooldown: pl.shootCooldown });
                return false;
            }
        }
        return true;
    });

    bullets = bullets.filter(b => {
        b.x += b.dx || BULLET_SPEED;
        if (b.x > canvas.width || b.x < 0) return false;
        for (let id in players) {
            if (id !== b.owner) {
                let p = players[id];
                if (b.x >= p.x && b.x <= p.x + PLAYER_SIZE && b.y >= p.y && b.y <= p.y + PLAYER_SIZE) {
                    p.health -= 10;
                    if (conn) sendData({ type: 'health', id: id, health: p.health, lives: p.lives });
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
        ctx.fillStyle = 'lime';
        ctx.fillRect(p.x, p.y - 10, (p.health / 100) * PLAYER_SIZE, 5);
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
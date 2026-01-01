// Wait for DOM to be ready before initializing
let canvas, ctx;
let tileSize = 32;
let mazeWidth, mazeHeight;

let character = null;
let player = { x: 1, y: 1, targetX: 1, targetY: 1, animating: false };
let goal = { x: 13, y: 13 };
let gameStarted = false;
let gamePaused = false;
let maze = [];
let hazards = [];
let collectibles = [];
let score = 0;
let timeLeft = 60;
let timerInterval = null;
let hasInteracted = false;
let animationFrameId = null;
let particles = [];
let lastDrawTime = 0;
let staticMazeCache = null;

// Sound effects
const moveSound = new Audio('audio/move.m4a');
const destroySound = new Audio('audio/destroy.m4a');
const winSound = new Audio('audio/win.m4a');
const collectSound = new Audio('audio/collect.m4a');
const timeoutSound = new Audio('audio/timeout.m4a');

// Set default volume
[moveSound, destroySound, winSound, collectSound, timeoutSound].forEach(sound => {
    sound.preload = 'auto';
    sound.volume = 0.3;
    sound.onerror = () => {
        sound.src = '';
    };
});

function playSound(sound) {
    if (!hasInteracted || gamePaused) return;
    if (sound.paused || sound.ended) {
        sound.currentTime = 0;
        sound.play().catch(() => {});
    }
}

// Set interaction flag
document.addEventListener('click', () => {
    hasInteracted = true;
});

document.addEventListener('keydown', (e) => {
    if (!gameStarted) {
        hasInteracted = true;
    }
});

// Particle system
function createParticles(x, y, color, count = 5) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x * tileSize + tileSize / 2,
            y: y * tileSize + tileSize / 2,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            life: 1.0,
            color: color,
            size: Math.random() * 4 + 2
        });
    }
}

function updateParticles() {
    particles = particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05;
        p.vx *= 0.95;
        p.vy *= 0.95;
        return p.life > 0;
    });
}

function generateMaze() {
    // Recursive backtracking algorithm
    function carve(x, y, depth = 0, maxDepth = 3) {
        maze[y][x] = 0;

        const directions = [
            { dx: 0, dy: -2 },
            { dx: 0, dy: 2 },
            { dx: -2, dy: 0 },
            { dx: 2, dy: 0 }
        ].sort(() => Math.random() - 0.5);

        let carvedCount = 0;
        for (let dir of directions) {
            const newX = x + dir.dx;
            const newY = y + dir.dy;

            if (newX > 0 && newX < mazeWidth - 1 && newY > 0 && newY < mazeHeight - 1 && maze[newY][newX] === 1) {
                if (Math.random() < 0.95 || depth < maxDepth) {
                    maze[y + dir.dy / 2][x + dir.dx / 2] = 0;
                    carve(newX, newY, depth + 1, maxDepth);
                    carvedCount++;
                }
            }
        }

        if (Math.random() < 0.05 && carvedCount < 1) {
            const extraDir = directions[Math.floor(Math.random() * directions.length)];
            const extraX = x + extraDir.dx;
            const extraY = y + extraDir.dy;
            if (extraX > 0 && extraX < mazeWidth - 1 && extraY > 0 && extraY < mazeHeight - 1 && maze[extraY][extraX] === 1) {
                maze[y + extraDir.dy / 2][x + extraDir.dx / 2] = 0;
                maze[extraY][extraX] = 0;
            }
        }
    }

    function buildMaze() {
        // Initialize maze with all walls
        maze = Array(mazeHeight).fill().map(() => Array(mazeWidth).fill(1));
        
        const startX = 1 + Math.floor(Math.random() * 2);
        const startY = 1 + Math.floor(Math.random() * 2);
        carve(startX, startY);

        maze[1][1] = 0;
        maze[13][13] = 0;

        // Add outer walls
        for (let i = 0; i < mazeWidth; i++) {
            maze[0][i] = 1;
            maze[mazeHeight - 1][i] = 1;
        }
        for (let i = 0; i < mazeHeight; i++) {
            maze[i][0] = 1;
            maze[i][mazeWidth - 1] = 1;
        }
    }

    // Check if solvable
    function isSolvable() {
        const visited = Array(mazeHeight).fill().map(() => Array(mazeWidth).fill(false));
        function dfs(x, y) {
            if (x === goal.x && y === goal.y) return true;
            visited[y][x] = true;
            const directions = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
            for (let dir of directions) {
                const newX = x + dir.dx;
                const newY = y + dir.dy;
                if (newX >= 0 && newX < mazeWidth && newY >= 0 && newY < mazeHeight &&
                    !visited[newY][newX] && maze[newY][newX] === 0 && !isHazard(newX, newY)) {
                    if (dfs(newX, newY)) return true;
                }
            }
            return false;
        }
        return dfs(1, 1);
    }

    let attempts = 0;
    do {
        buildMaze();
        attempts++;
    } while (!isSolvable() && attempts < 5);

    // Generate hazards
    hazards = [];
    const numHazards = Math.floor(Math.random() * 3) + 3;
    for (let i = 0; i < numHazards; i++) {
        let hazardX, hazardY;
        do {
            hazardX = Math.floor(Math.random() * (mazeWidth - 2)) + 1;
            hazardY = Math.floor(Math.random() * (mazeHeight - 2)) + 1;
        } while (maze[hazardY][hazardX] !== 0 || (hazardX === 1 && hazardY === 1) || (hazardX === 13 && hazardY === 13));
        hazards.push({ x: hazardX, y: hazardY });
    }

    // Generate collectibles
    collectibles = [];
    const numCollectibles = Math.floor(Math.random() * 3) + 2;
    for (let i = 0; i < numCollectibles; i++) {
        let collectX, collectY;
        do {
            collectX = Math.floor(Math.random() * (mazeWidth - 2)) + 1;
            collectY = Math.floor(Math.random() * (mazeHeight - 2)) + 1;
        } while (maze[collectY][collectX] !== 0 || (collectX === 1 && collectY === 1) || (collectX === 13 && collectY === 13) ||
                 isHazard(collectX, collectY));
        collectibles.push({ x: collectX, y: collectY });
    }
    
    staticMazeCache = null;
}

function drawStaticMaze() {
    if (!maze || maze.length === 0) {
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return;
    }
    
    if (staticMazeCache) {
        ctx.drawImage(staticMazeCache, 0, 0);
        return;
    }
    
    const staticCanvas = document.createElement('canvas');
    staticCanvas.width = canvas.width;
    staticCanvas.height = canvas.height;
    const staticCtx = staticCanvas.getContext('2d');
    
    staticCtx.fillStyle = '#f5f5f5';
    staticCtx.fillRect(0, 0, staticCanvas.width, staticCanvas.height);
    
    for (let y = 0; y < mazeHeight; y++) {
        if (!maze[y]) continue;
        for (let x = 0; x < mazeWidth; x++) {
            if (maze[y][x] === 1) {
                staticCtx.fillStyle = '#333';
                staticCtx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
            }
        }
    }
    
    const goalGradient = staticCtx.createLinearGradient(
        goal.x * tileSize, goal.y * tileSize,
        (goal.x + 1) * tileSize, (goal.y + 1) * tileSize
    );
    goalGradient.addColorStop(0, '#4CAF50');
    goalGradient.addColorStop(1, '#2E7D32');
    staticCtx.fillStyle = goalGradient;
    staticCtx.fillRect(goal.x * tileSize, goal.y * tileSize, tileSize, tileSize);
    
    staticCtx.shadowBlur = 10;
    staticCtx.shadowColor = '#4CAF50';
    staticCtx.fillRect(goal.x * tileSize, goal.y * tileSize, tileSize, tileSize);
    staticCtx.shadowBlur = 0;
    
    staticMazeCache = staticCanvas;
    ctx.drawImage(staticMazeCache, 0, 0);
}

function draw() {
    if (!ctx || !gameStarted || !canvas) return;
    
    const currentTime = performance.now();
    if (lastDrawTime > 0 && currentTime - lastDrawTime < 16) return;
    lastDrawTime = currentTime;
    
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    drawStaticMaze();
    
    if (!maze || maze.length === 0) return;
    
    // Draw hazards
    const pulse = Math.sin(Date.now() / 300) * 0.2 + 0.8;
    hazards.forEach(hazard => {
        ctx.fillStyle = `rgba(255, 0, 0, ${pulse})`;
        ctx.fillRect(hazard.x * tileSize, hazard.y * tileSize, tileSize, tileSize);
        
        if (isAdjacentToHazard(hazard.x, hazard.y)) {
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
            ctx.lineWidth = 2;
            ctx.strokeRect(hazard.x * tileSize - 2, hazard.y * tileSize - 2, tileSize + 4, tileSize + 4);
        }
    });
    
    // Draw collectibles
    const collectiblePulse = Math.sin(Date.now() / 200) * 0.3 + 0.7;
    collectibles.forEach(collectible => {
        ctx.fillStyle = `rgba(255, 255, 0, ${collectiblePulse})`;
        ctx.fillRect(collectible.x * tileSize, collectible.y * tileSize, tileSize, tileSize);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        const sparkleX = collectible.x * tileSize + tileSize / 2;
        const sparkleY = collectible.y * tileSize + tileSize / 2;
        ctx.beginPath();
        ctx.arc(sparkleX, sparkleY, 3, 0, Math.PI * 2);
        ctx.fill();
    });
    
    // Draw particles
    particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1.0;
    
    // Update player animation
    if (player.animating) {
        const speed = 0.2;
        const dx = player.targetX - player.x;
        const dy = player.targetY - player.y;
        
        if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
            player.x = player.targetX;
            player.y = player.targetY;
            player.animating = false;
        } else {
            player.x += dx * speed;
            player.y += dy * speed;
        }
    }
    
    // Draw player
    if (character && character.complete) {
        ctx.drawImage(character, player.x * tileSize, player.y * tileSize, tileSize, tileSize);
    }
    
    // Update UI
    const scoreEl = document.getElementById('score');
    const timerEl = document.getElementById('timer');
    if (scoreEl) scoreEl.textContent = `Score: ${score}`;
    if (timerEl) {
        timerEl.textContent = `Time: ${Math.max(0, timeLeft)}`;
        timerEl.style.color = timeLeft <= 10 ? '#ff4444' : '#ffffff';
    }
    
    updateParticles();
}

function gameLoop() {
    if (!gamePaused && gameStarted) {
        draw();
    }
    animationFrameId = requestAnimationFrame(gameLoop);
}

function isHazard(x, y) {
    return hazards.some(h => h.x === x && h.y === y);
}

function isCollectible(x, y) {
    return collectibles.some(c => c.x === x && c.y === y);
}

function isAdjacentToHazard(x, y) {
    const adjacentPositions = [
        { x: x + 1, y: y },
        { x: x - 1, y: y },
        { x: x, y: y + 1 },
        { x: x, y: y - 1 }
    ];
    return hazards.some(h => 
        adjacentPositions.some(pos => 
            pos.x === h.x && pos.y === h.y && pos.x >= 0 && pos.x < mazeWidth && pos.y >= 0 && pos.y < mazeHeight
        )
    );
}

function movePlayer(dx, dy) {
    if (player.animating || gamePaused || !gameStarted) return;
    
    const newX = player.targetX + dx;
    const newY = player.targetY + dy;

    if (newX >= 0 && newX < mazeWidth && newY >= 0 && newY < mazeHeight &&
        maze[newY] && maze[newY][newX] === 0) {
        
        if (isHazard(newX, newY)) {
            return;
        }
        
        player.targetX = newX;
        player.targetY = newY;
        player.animating = true;

        const collectibleIndex = collectibles.findIndex(c => c.x === newX && c.y === newY);
        if (collectibleIndex !== -1) {
            collectibles.splice(collectibleIndex, 1);
            score += 10;
            createParticles(newX, newY, 'yellow', 8);
            playSound(collectSound);
        }

        if (player.targetX === goal.x && player.targetY === goal.y) {
            clearInterval(timerInterval);
            cancelAnimationFrame(animationFrameId);
            playSound(winSound);
            const finalScoreEl = document.getElementById('final-score');
            if (finalScoreEl) finalScoreEl.textContent = score;
            const gameOverEl = document.getElementById('game-over');
            if (gameOverEl) gameOverEl.style.display = 'flex';
            gameStarted = false;
        } else {
            playSound(moveSound);
        }
    }
}

function destroyHazard() {
    if (!gameStarted || gamePaused) return;

    let hazardIndex = hazards.findIndex(h => 
        h.x === player.targetX && h.y === player.targetY
    );

    if (hazardIndex !== -1) {
        const hazard = hazards[hazardIndex];
        hazards.splice(hazardIndex, 1);
        score += 5;
        createParticles(hazard.x, hazard.y, 'red', 10);
        playSound(destroySound);
        staticMazeCache = null;
        return;
    }

    const adjacentPositions = [
        { x: player.targetX + 1, y: player.targetY },
        { x: player.targetX - 1, y: player.targetY },
        { x: player.targetX, y: player.targetY + 1 },
        { x: player.targetX, y: player.targetY - 1 }
    ];

    for (let pos of adjacentPositions) {
        if (pos.x >= 0 && pos.x < mazeWidth && pos.y >= 0 && pos.y < mazeHeight) {
            hazardIndex = hazards.findIndex(h => h.x === pos.x && h.y === pos.y);
            if (hazardIndex !== -1) {
                const hazard = hazards[hazardIndex];
                hazards.splice(hazardIndex, 1);
                score += 5;
                createParticles(hazard.x, hazard.y, 'red', 10);
                playSound(destroySound);
                staticMazeCache = null;
                return;
            }
        }
    }
}

function togglePause() {
    if (!gameStarted) return;
    
    gamePaused = !gamePaused;
    const pauseOverlay = document.getElementById('pause-overlay');
    if (pauseOverlay) {
        pauseOverlay.style.display = gamePaused ? 'flex' : 'none';
    }
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        if (!gamePaused && gameStarted) {
            timeLeft--;
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                cancelAnimationFrame(animationFrameId);
                playSound(timeoutSound);
                const timeFinalScoreEl = document.getElementById('time-final-score');
                if (timeFinalScoreEl) timeFinalScoreEl.textContent = score;
                const timeOverEl = document.getElementById('time-over');
                if (timeOverEl) timeOverEl.style.display = 'flex';
                gameStarted = false;
            }
        }
    }, 1000);
}

function restartGame() {
    player = { x: 1, y: 1, targetX: 1, targetY: 1, animating: false };
    gameStarted = false;
    gamePaused = false;
    score = 0;
    timeLeft = 60;
    collectibles = [];
    particles = [];
    hazards = [];
    
    const gameOverEl = document.getElementById('game-over');
    const timeOverEl = document.getElementById('time-over');
    const pauseOverlayEl = document.getElementById('pause-overlay');
    const characterSelectionEl = document.getElementById('character-selection');
    
    if (gameOverEl) gameOverEl.style.display = 'none';
    if (timeOverEl) timeOverEl.style.display = 'none';
    if (pauseOverlayEl) pauseOverlayEl.style.display = 'none';
    if (characterSelectionEl) characterSelectionEl.style.display = 'flex';
    
    clearInterval(timerInterval);
    cancelAnimationFrame(animationFrameId);
    character = null;
    generateMaze();
    staticMazeCache = null;
}

function setVolume(volume) {
    const vol = Math.max(0, Math.min(1, volume));
    [moveSound, destroySound, winSound, collectSound, timeoutSound].forEach(sound => {
        sound.volume = vol;
    });
    const volumeDisplayEl = document.getElementById('volume-display');
    if (volumeDisplayEl) volumeDisplayEl.textContent = Math.round(vol * 100);
}

// Initialize when DOM is ready
function init() {
    canvas = document.getElementById('game-canvas');
    if (!canvas) {
        console.error('Canvas element not found!');
        return;
    }
    
    ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Could not get 2D context!');
        return;
    }
    
    mazeWidth = canvas.width / tileSize;
    mazeHeight = canvas.height / tileSize;
    
    // Set up character selection
    const characterImages = document.querySelectorAll('#characters img');
    characterImages.forEach(img => {
        img.addEventListener('click', () => {
            character = new Image();
            character.src = img.src;
            character.onload = () => {
                const characterSelectionEl = document.getElementById('character-selection');
                if (characterSelectionEl) characterSelectionEl.style.display = 'none';
                
                gameStarted = true;
                gamePaused = false;
                hasInteracted = true;
                player = { x: 1, y: 1, targetX: 1, targetY: 1, animating: false };
                score = 0;
                timeLeft = 60;
                particles = [];
                
                generateMaze();
                staticMazeCache = null;
                lastDrawTime = 0;
                
                startTimer();
                draw();
            };
            character.onerror = () => {
                console.error('Error loading character image');
            };
        });
        
        img.addEventListener('mouseenter', () => {
            img.style.transform = 'scale(1.2)';
            img.style.filter = 'brightness(1.2)';
        });
        
        img.addEventListener('mouseleave', () => {
            img.style.transform = 'scale(1)';
            img.style.filter = 'brightness(1)';
        });
    });
    
    // Set up keyboard controls
    document.addEventListener('keydown', (e) => {
        if (!gameStarted) {
            hasInteracted = true;
            return;
        }

        switch (e.key) {
            case 'ArrowUp':
            case 'w':
            case 'W':
                e.preventDefault();
                movePlayer(0, -1);
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                e.preventDefault();
                movePlayer(0, 1);
                break;
            case 'ArrowLeft':
            case 'a':
            case 'A':
                e.preventDefault();
                movePlayer(-1, 0);
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                e.preventDefault();
                movePlayer(1, 0);
                break;
            case ' ':
                e.preventDefault();
                destroyHazard();
                break;
            case 'p':
            case 'P':
            case 'Escape':
                e.preventDefault();
                togglePause();
                break;
        }
    });
    
    // Initialize game
    generateMaze();
    setVolume(0.3);
    gameLoop();
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

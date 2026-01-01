const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const tileSize = 32;
const mazeWidth = canvas.width / tileSize;
const mazeHeight = canvas.height / tileSize;

let character = null;
let player = { x: 1, y: 1, targetX: 1, targetY: 1, animating: false }; // Smooth movement
let goal = { x: 13, y: 13 }; // Goal position (bottom-right)
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
let particles = []; // Particle effects
let lastDrawTime = 0;
let staticMazeCache = null; // Cache for static maze elements

// Sound effects with preloading, error handling, and interaction check
const moveSound = new Audio('audio/move.m4a');
const destroySound = new Audio('audio/destroy.m4a');
const winSound = new Audio('audio/win.m4a');
// Optional sounds - will gracefully fail if files don't exist
const collectSound = new Audio('audio/collect.m4a');
const timeoutSound = new Audio('audio/timeout.m4a');

// Set default volume
[moveSound, destroySound, winSound, collectSound, timeoutSound].forEach(sound => {
    sound.preload = 'auto';
    sound.volume = 0.3;
    sound.onerror = () => {
        // Silently handle missing audio files
        sound.src = '';
    };
});

// Function to play sound with interaction check, error handling, and fallback
function playSound(sound) {
    if (!hasInteracted || gamePaused) return;
    
    if (sound.paused || sound.ended) {
        sound.currentTime = 0;
        sound.play().catch(() => {});
    }
}

// Set interaction flag on any user click or keypress
document.addEventListener('click', () => {
    hasInteracted = true;
});

document.addEventListener('keydown', (e) => {
    if (!gameStarted) {
        hasInteracted = true;
    }
});

// Particle system for visual effects
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
    // Initialize maze with all walls (1)
    maze = Array(mazeHeight).fill().map(() => Array(mazeWidth).fill(1));

    // Recursive backtracking with minimal dead ends and navigable paths
    function carve(x, y, depth = 0, maxDepth = 3) {
        maze[y][x] = 0; // Carve a path (0)

        // Use only cardinal directions to ensure simpler, navigable paths
        const directions = [
            { dx: 0, dy: -2 },  // Up
            { dx: 0, dy: 2 },   // Down
            { dx: -2, dy: 0 },  // Left
            { dx: 2, dy: 0 }    // Right
        ].sort(() => Math.random() - 0.5); // Shuffle directions

        let carvedCount = 0;
        for (let dir of directions) {
            const newX = x + dir.dx;
            const newY = y + dir.dy;

            if (newX > 0 && newX < mazeWidth - 1 && newY > 0 && newY < mazeHeight - 1 && maze[newY][newX] === 1) {
                if (Math.random() < 0.95 || depth < maxDepth) {
                    maze[y + dir.dy / 2][x + dir.dx / 2] = 0; // Carve wall between
                    carve(newX, newY, depth + 1, maxDepth);
                    carvedCount++;
                }
            }
        }

        // Rarely add very short dead ends for minor interest, but minimize them
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

    // Start carving from (1,1) with a small random offset
    const startX = 1 + Math.floor(Math.random() * 2);
    const startY = 1 + Math.floor(Math.random() * 2);
    carve(startX, startY);

    // Ensure start and goal positions are paths (0) and connected
    maze[1][1] = 0; // Player start (fixed for consistency)
    maze[13][13] = 0; // Goal (fixed for consistency)

    // Add outer walls
    for (let i = 0; i < mazeWidth; i++) {
        maze[0][i] = 1;  // Top
        maze[mazeHeight - 1][i] = 1;  // Bottom
    }
    for (let i = 0; i < mazeHeight; i++) {
        maze[i][0] = 1;  // Left
        maze[i][mazeWidth - 1] = 1;  // Right
    }

    // Ensure the maze is solvable
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

    // Regenerate if not solvable (retry up to 5 times)
    let attempts = 0;
    while (!isSolvable() && attempts < 5) {
        generateMaze();
        attempts++;
    }

    // Generate random hazards (3-5 hazards)
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

    // Generate random collectibles (2-4 collectibles)
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
    
    // Clear cache when maze regenerates
    staticMazeCache = null;
}

// Cache static maze elements for performance
function drawStaticMaze() {
    if (staticMazeCache) {
        ctx.drawImage(staticMazeCache, 0, 0);
        return;
    }
    
    // Create offscreen canvas for static elements
    const staticCanvas = document.createElement('canvas');
    staticCanvas.width = canvas.width;
    staticCanvas.height = canvas.height;
    const staticCtx = staticCanvas.getContext('2d');
    
    // Draw maze walls
    for (let y = 0; y < mazeHeight; y++) {
        for (let x = 0; x < mazeWidth; x++) {
            if (maze[y][x] === 1) {
                staticCtx.fillStyle = '#333';
                staticCtx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
            }
        }
    }
    
    // Draw goal with gradient
    const goalGradient = staticCtx.createLinearGradient(
        goal.x * tileSize, goal.y * tileSize,
        (goal.x + 1) * tileSize, (goal.y + 1) * tileSize
    );
    goalGradient.addColorStop(0, '#4CAF50');
    goalGradient.addColorStop(1, '#2E7D32');
    staticCtx.fillStyle = goalGradient;
    staticCtx.fillRect(goal.x * tileSize, goal.y * tileSize, tileSize, tileSize);
    
    // Add glow effect to goal
    staticCtx.shadowBlur = 10;
    staticCtx.shadowColor = '#4CAF50';
    staticCtx.fillRect(goal.x * tileSize, goal.y * tileSize, tileSize, tileSize);
    staticCtx.shadowBlur = 0;
    
    staticMazeCache = staticCanvas;
    ctx.drawImage(staticMazeCache, 0, 0);
}

function draw() {
    if (!ctx || !gameStarted) return;
    
    const currentTime = performance.now();
    if (currentTime - lastDrawTime < 16) return; // Throttle to ~60fps
    lastDrawTime = currentTime;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw static maze (cached)
    drawStaticMaze();
    
    // Draw hazards with pulsing effect
    const pulse = Math.sin(Date.now() / 300) * 0.2 + 0.8;
    hazards.forEach(hazard => {
        ctx.fillStyle = `rgba(255, 0, 0, ${pulse})`;
        ctx.fillRect(hazard.x * tileSize, hazard.y * tileSize, tileSize, tileSize);
        
        // Draw warning indicator if adjacent to player
        if (isAdjacentToHazard(hazard.x, hazard.y)) {
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
            ctx.lineWidth = 2;
            ctx.strokeRect(hazard.x * tileSize - 2, hazard.y * tileSize - 2, tileSize + 4, tileSize + 4);
        }
    });
    
    // Draw collectibles with animation
    const collectiblePulse = Math.sin(Date.now() / 200) * 0.3 + 0.7;
    collectibles.forEach(collectible => {
        ctx.fillStyle = `rgba(255, 255, 0, ${collectiblePulse})`;
        ctx.fillRect(collectible.x * tileSize, collectible.y * tileSize, tileSize, tileSize);
        
        // Add sparkle effect
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
    
    // Smooth player movement with interpolation
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
    
    // Draw player with smooth position
    if (character && gameStarted) {
        ctx.drawImage(character, player.x * tileSize, player.y * tileSize, tileSize, tileSize);
    }
    
    // Update score and timer display
    document.getElementById('score').textContent = `Score: ${score}`;
    const timerColor = timeLeft <= 10 ? '#ff4444' : '#ffffff';
    document.getElementById('timer').textContent = `Time: ${Math.max(0, timeLeft)}`;
    document.getElementById('timer').style.color = timerColor;
    
    // Update particles
    updateParticles();
}

// Animation loop using requestAnimationFrame
function gameLoop() {
    if (!gamePaused && gameStarted) {
        draw();
    }
    animationFrameId = requestAnimationFrame(gameLoop);
}

document.querySelectorAll('#characters img').forEach(img => {
    img.addEventListener('click', () => {
        character = new Image();
        character.src = img.src;
        character.onload = () => {
            document.getElementById('character-selection').style.display = 'none';
            gameStarted = true;
            gamePaused = false;
            hasInteracted = true;
            player = { x: 1, y: 1, targetX: 1, targetY: 1, animating: false };
            generateMaze();
            startTimer();
            gameLoop();
        };
        character.onerror = () => {};
    });
    
    // Add hover effect
    img.addEventListener('mouseenter', () => {
        img.style.transform = 'scale(1.2)';
        img.style.filter = 'brightness(1.2)';
    });
    
    img.addEventListener('mouseleave', () => {
        img.style.transform = 'scale(1)';
        img.style.filter = 'brightness(1)';
    });
});

function movePlayer(dx, dy) {
    if (player.animating || gamePaused) return;
    
    const newX = player.targetX + dx;
    const newY = player.targetY + dy;

    if (newX >= 0 && newX < mazeWidth && newY >= 0 && newY < mazeHeight &&
        maze[newY][newX] === 0) {
        
        // Check for hazards - block movement
        if (isHazard(newX, newY)) {
            return;
        }
        
        player.targetX = newX;
        player.targetY = newY;
        player.animating = true;

        // Check for collectibles
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
            document.getElementById('final-score').textContent = score;
            document.getElementById('game-over').style.display = 'flex';
            gameStarted = false;
        } else {
            playSound(moveSound);
        }
    }
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

function destroyHazard() {
    if (!gameStarted || gamePaused) return;

    // Check current position
    const hazardIndex = hazards.findIndex(h => 
        h.x === player.targetX && h.y === player.targetY
    );

    if (hazardIndex !== -1) {
        const hazard = hazards[hazardIndex];
        hazards.splice(hazardIndex, 1);
        score += 5;
        createParticles(hazard.x, hazard.y, 'red', 10);
        playSound(destroySound);
        staticMazeCache = null; // Invalidate cache
        return;
    }

    // Check adjacent positions
    const adjacentPositions = [
        { x: player.targetX + 1, y: player.targetY },
        { x: player.targetX - 1, y: player.targetY },
        { x: player.targetX, y: player.targetY + 1 },
        { x: player.targetX, y: player.targetY - 1 }
    ];

    for (let pos of adjacentPositions) {
        if (pos.x >= 0 && pos.x < mazeWidth && pos.y >= 0 && pos.y < mazeHeight) {
            const hazardIndex = hazards.findIndex(h => h.x === pos.x && h.y === pos.y);
            if (hazardIndex !== -1) {
                const hazard = hazards[hazardIndex];
                hazards.splice(hazardIndex, 1);
                score += 5;
                createParticles(hazard.x, hazard.y, 'red', 10);
                playSound(destroySound);
                staticMazeCache = null; // Invalidate cache
                return;
            }
        }
    }
}

function togglePause() {
    if (!gameStarted) return;
    
    gamePaused = !gamePaused;
    const pauseOverlay = document.getElementById('pause-overlay');
    
    if (gamePaused) {
        pauseOverlay.style.display = 'flex';
    } else {
        pauseOverlay.style.display = 'none';
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
                document.getElementById('time-final-score').textContent = score;
                document.getElementById('time-over').style.display = 'flex';
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
    document.getElementById('game-over').style.display = 'none';
    document.getElementById('time-over').style.display = 'none';
    document.getElementById('pause-overlay').style.display = 'none';
    document.getElementById('character-selection').style.display = 'flex';
    clearInterval(timerInterval);
    cancelAnimationFrame(animationFrameId);
    generateMaze();
    staticMazeCache = null;
}

// Volume control
function setVolume(volume) {
    const vol = Math.max(0, Math.min(1, volume));
    [moveSound, destroySound, winSound, collectSound, timeoutSound].forEach(sound => {
        sound.volume = vol;
    });
    document.getElementById('volume-display').textContent = Math.round(vol * 100);
}

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

// Initialize on page load
window.addEventListener('load', () => {
    generateMaze();
    gameLoop();
    setVolume(0.3);
});

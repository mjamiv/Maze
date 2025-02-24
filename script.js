const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const tileSize = 32;
const mazeWidth = canvas.width / tileSize;
const mazeHeight = canvas.height / tileSize;

let character = null;
let player = { x: 1, y: 1 }; // Start position (top-left)
let goal = { x: 13, y: 13 }; // Goal position (bottom-right)
let gameStarted = false;
let maze = [];
let hazards = [];
let collectibles = [];
let score = 0;
let timeLeft = 60; // 60-second timer
let timerInterval = null;
let hasInteracted = false; // Flag for user interaction to handle autoplay restrictions

// Sound effects with preloading, error handling, and interaction check
const moveSound = new Audio('audio/move.m4a');
const destroySound = new Audio('audio/destroy.m4a');
const winSound = new Audio('audio/win.m4a');
const collectSound = new Audio('audio/collect.m4a');
const timeoutSound = new Audio('audio/timeout.m4a');

[moveSound, destroySound, winSound, collectSound, timeoutSound].forEach(sound => {
    sound.preload = 'auto';
    sound.onerror = () => {
        console.error(`Error loading sound: Check file path (audio/${sound.src.split('/').pop()}) or format compatibility`);
        sound.src = ''; // Clear invalid source to prevent repeated errors
    };
});

// Function to play sound with interaction check, error handling, and fallback
function playSound(sound) {
    if (!hasInteracted) {
        console.warn('User interaction required before playing sound. Waiting for click...');
        return;
    }

    if (sound.paused || sound.ended) {
        sound.play().catch(e => {
            console.error('Error playing sound:', e);
            console.warn('Sound playback failed. Ensure .m4a files are supported in your browser.');
        });
    }
}

// Set interaction flag on any user click or keypress
document.addEventListener('click', () => {
    hasInteracted = true;
    console.log('User interacted (click), sounds can now play');
});

document.addEventListener('keydown', (e) => {
    if (!gameStarted) {
        hasInteracted = true;
        console.log('User interacted (keydown), sounds can now play');
    }
});

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
                if (Math.random() < 0.95 || depth < maxDepth) { // 95% chance to carve, very few dead ends
                    maze[y + dir.dy / 2][x + dir.dx / 2] = 0; // Carve wall between
                    carve(newX, newY, depth + 1, maxDepth);
                    carvedCount++;
                }
            }
        }

        // Rarely add very short dead ends for minor interest, but minimize them
        if (Math.random() < 0.05 && carvedCount < 1) { // 5% chance for a very short dead end, only if few paths carved
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

    // Ensure the maze is solvable (simple pathfinding check, now accounting for collectibles)
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
        generateMaze(); // Recursively regenerate
        attempts++;
    }

    // Generate random hazards (3-5 hazards, ensuring they don’t block start or goal)
    hazards = [];
    const numHazards = Math.floor(Math.random() * 3) + 3; // 3 to 5 hazards
    for (let i = 0; i < numHazards; i++) {
        let hazardX, hazardY;
        do {
            hazardX = Math.floor(Math.random() * (mazeWidth - 2)) + 1;
            hazardY = Math.floor(Math.random() * (mazeHeight - 2)) + 1;
        } while (maze[hazardY][hazardX] !== 0 || (hazardX === 1 && hazardY === 1) || (hazardX === 13 && hazardY === 13));

        hazards.push({ x: hazardX, y: hazardY });
    }

    // Generate random collectibles (2-4 collectibles, ensuring they don’t overlap with start, goal, or hazards)
    collectibles = [];
    const numCollectibles = Math.floor(Math.random() * 3) + 2; // 2 to 4 collectibles
    for (let i = 0; i < numCollectibles; i++) {
        let collectX, collectY;
        do {
            collectX = Math.floor(Math.random() * (mazeWidth - 2)) + 1;
            collectY = Math.floor(Math.random() * (mazeHeight - 2)) + 1;
        } while (maze[collectY][collectX] !== 0 || (collectX === 1 && collectY === 1) || (collectX === 13 && collectY === 13) ||
                 isHazard(collectX, collectY));

        collectibles.push({ x: collectX, y: collectY });
    }
}

document.querySelectorAll('#characters img').forEach(img => {
    img.addEventListener('click', () => {
        character = new Image();
        character.src = img.src;
        character.onload = () => { // Ensure image is loaded before drawing
            document.getElementById('character-selection').style.display = 'none';
            gameStarted = true;
            hasInteracted = true; // Set interaction flag on character selection
            generateMaze(); // Generate a new maze when a character is selected
            startTimer(); // Start the timer
            draw(); // Draw the maze immediately after selection
            console.log('Character selected, maze generated, and drawn');
        };
        character.onerror = () => console.error('Error loading character image');
    });
});

function draw() {
    if (!ctx) {
        console.error('Canvas context not available');
        return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw maze
    for (let y = 0; y < mazeHeight; y++) {
        for (let x = 0; x < mazeWidth; x++) {
            if (maze[y][x] === 1) {
                ctx.fillStyle = '#333';
                ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
            }
        }
    }

    // Draw hazards
    ctx.fillStyle = 'red';
    hazards.forEach(hazard => {
        ctx.fillRect(hazard.x * tileSize, hazard.y * tileSize, tileSize, tileSize);
    });

    // Draw collectibles (yellow)
    ctx.fillStyle = 'yellow';
    collectibles.forEach(collectible => {
        ctx.fillRect(collectible.x * tileSize, collectible.y * tileSize, tileSize, tileSize);
    });

    // Draw goal
    ctx.fillStyle = 'green';
    ctx.fillRect(goal.x * tileSize, goal.y * tileSize, tileSize, tileSize);

    // Draw player
    if (character && gameStarted) {
        ctx.drawImage(character, player.x * tileSize, player.y * tileSize, tileSize, tileSize);
    } else {
        console.log('Character or game not ready for drawing');
    }

    // Update score and timer display
    document.getElementById('score').textContent = `Score: ${score}`;
    document.getElementById('timer').textContent = `Time: ${Math.max(0, timeLeft)}`;
}

function movePlayer(dx, dy) {
    const newX = player.x + dx;
    const newY = player.y + dy;

    if (newX >= 0 && newX < mazeWidth && newY >= 0 && newY < mazeHeight &&
        maze[newY][newX] === 0) { // Simplified to check only maze paths, ignoring hazards/collectibles here
        player.x = newX;
        player.y = newY;

        // Check for hazards after movement (for collision, but allow movement)
        if (isHazard(newX, newY)) {
            console.warn('Player hit a hazard but can still move—consider adding damage or blocking.');
            return; // Optional: Block movement on hazards if desired
        }

        // Check for collectibles
        const collectibleIndex = collectibles.findIndex(c => c.x === newX && c.y === newY);
        if (collectibleIndex !== -1) {
            collectibles.splice(collectibleIndex, 1); // Remove collectible
            score += 10; // Add 10 points for collectible
            playSound(collectSound); // Play collect sound
        }

        if (player.x === goal.x && player.y === goal.y) {
            clearInterval(timerInterval); // Stop timer on win
            playSound(winSound); // Play win sound
            document.getElementById('final-score').textContent = score;
            document.getElementById('game-over').style.display = 'flex';
        } else {
            playSound(moveSound); // Play move sound
        }

        draw();
    } else {
        console.log(`Movement blocked at (${newX}, ${newY})`);
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
        { x: x, y: y }, // Current position
        { x: x + 1, y: y }, // Right
        { x: x - 1, y: y }, // Left
        { x: x, y: y + 1 }, // Down
        { x: x, y: y - 1 }  // Up
    ];

    return hazards.some(h => 
        adjacentPositions.some(pos => 
            pos.x === h.x && pos.y === h.y && pos.x >= 0 && pos.x < mazeWidth && pos.y >= 0 && pos.y < mazeHeight
        )
    );
}

function destroyHazard() {
    if (!gameStarted) return;

    const hazardIndex = hazards.findIndex(h => 
        h.x === player.x && h.y === player.y
    );

    if (hazardIndex !== -1) {
        hazards.splice(hazardIndex, 1); // Remove the hazard at player's position
        score += 5; // Add 5 points for destroying a hazard
        playSound(destroySound); // Play destroy sound
        draw(); // Redraw the maze without the removed hazard
        return;
    }

    // Check adjacent positions for hazards to destroy
    const adjacentPositions = [
        { x: player.x + 1, y: player.y }, // Right
        { x: player.x - 1, y: player.y }, // Left
        { x: player.x, y: player.y + 1 }, // Down
        { x: player.x, y: player.y - 1 }  // Up
    ];

    for (let pos of adjacentPositions) {
        if (pos.x >= 0 && pos.x < mazeWidth && pos.y >= 0 && pos.y < mazeHeight) {
            const hazardIndex = hazards.findIndex(h => h.x === pos.x && h.y === pos.y);
            if (hazardIndex !== -1) {
                hazards.splice(hazardIndex, 1); // Remove the hazard at adjacent position
                score += 5; // Add 5 points for destroying a hazard
                playSound(destroySound); // Play destroy sound
                draw(); // Redraw the maze without the removed hazard
                return;
            }
        }
    }
}

function startTimer() {
    timerInterval = setInterval(() => {
        timeLeft--;
        draw(); // Update timer display
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            playSound(timeoutSound); // Play timeout sound
            document.getElementById('time-final-score').textContent = score;
            document.getElementById('time-over').style.display = 'flex';
        }
    }, 1000); // Update every second
}

function restartGame() {
    player = { x: 1, y: 1 }; // Reset player position
    gameStarted = false; // Reset game state
    score = 0; // Reset score
    timeLeft = 60; // Reset timer
    collectibles = []; // Reset collectibles
    document.getElementById('game-over').style.display = 'none';
    document.getElementById('time-over').style.display = 'none';
    document.getElementById('character-selection').style.display = 'flex'; // Show character selection again
    clearInterval(timerInterval); // Clear any existing timer
    generateMaze(); // Generate a new maze for the next game
    draw(); // Redraw the initial maze (though hidden)
    console.log('Game reset, new maze generated, and drawn');
}

document.addEventListener('keydown', (e) => {
    if (!gameStarted) {
        hasInteracted = true;
        console.log('User interacted (keydown), sounds can now play');
    }

    if (!gameStarted) return;

    switch (e.key) {
        case 'ArrowUp': movePlayer(0, -1); break;
        case 'ArrowDown': movePlayer(0, 1); break;
        case 'ArrowLeft': movePlayer(-1, 0); break;
        case 'ArrowRight': movePlayer(1, 0); break;
        case ' ': destroyHazard(); break; // Space bar to destroy hazards
    }
});

// Reset game on page reload
window.addEventListener('load', () => {
    generateMaze(); // Generate initial maze (hidden until character is selected)
    draw(); // Draw the initial maze (though hidden)
    console.log('Page loaded, maze generated, and drawn');
});

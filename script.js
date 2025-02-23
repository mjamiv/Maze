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

function generateMaze() {
    // Initialize maze with all walls (1)
    maze = Array(mazeHeight).fill().map(() => Array(mazeWidth).fill(1));

    // Recursive backtracking maze generation
    function carve(x, y) {
        maze[y][x] = 0; // Carve a path (0)

        const directions = [
            { dx: 0, dy: -2 }, // Up
            { dx: 0, dy: 2 },  // Down
            { dx: -2, dy: 0 }, // Left
            { dx: 2, dy: 0 }   // Right
        ].sort(() => Math.random() - 0.5); // Shuffle directions

        for (let dir of directions) {
            const newX = x + dir.dx;
            const newY = y + dir.dy;

            if (newX > 0 && newX < mazeWidth - 1 && newY > 0 && newY < mazeHeight - 1 && maze[newY][newX] === 1) {
                maze[y + dir.dy / 2][x + dir.dx / 2] = 0; // Carve wall between
                carve(newX, newY);
            }
        }
    }

    // Start carving from (1,1)
    carve(1, 1);

    // Ensure start and goal positions are paths (0)
    maze[1][1] = 0; // Player start
    maze[13][13] = 0; // Goal

    // Add outer walls
    for (let i = 0; i < mazeWidth; i++) {
        maze[0][i] = 1;  // Top
        maze[mazeHeight - 1][i] = 1;  // Bottom
    }
    for (let i = 0; i < mazeHeight; i++) {
        maze[i][0] = 1;  // Left
        maze[i][mazeWidth - 1] = 1;  // Right
    }

    // Generate random hazards (5-7 hazards, ensuring they don’t block the start or goal)
    hazards = [];
    const numHazards = Math.floor(Math.random() * 3) + 5; // 5 to 7 hazards
    for (let i = 0; i < numHazards; i++) {
        let hazardX, hazardY;
        do {
            hazardX = Math.floor(Math.random() * (mazeWidth - 2)) + 1;
            hazardY = Math.floor(Math.random() * (mazeHeight - 2)) + 1;
        } while (maze[hazardY][hazardX] !== 0 || (hazardX === 1 && hazardY === 1) || (hazardX === 13 && hazardY === 13));

        hazards.push({ x: hazardX, y: hazardY });
    }
}

document.querySelectorAll('#characters img').forEach(img => {
    img.addEventListener('click', () => {
        character = new Image();
        character.src = img.src;
        document.getElementById('character-selection').style.display = 'none';
        gameStarted = true;
        generateMaze(); // Generate a new maze when a character is selected
        draw();
    });
});

function draw() {
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

    // Draw goal
    ctx.fillStyle = 'green';
    ctx.fillRect(goal.x * tileSize, goal.y * tileSize, tileSize, tileSize);

    // Draw player
    if (character && character.complete) {
        ctx.drawImage(character, player.x * tileSize, player.y * tileSize, tileSize, tileSize);
    }
}

function movePlayer(dx, dy) {
    const newX = player.x + dx;
    const newY = player.y + dy;

    if (newX >= 0 && newX < mazeWidth && newY >= 0 && newY < mazeHeight &&
        maze[newY][newX] === 0 && !isHazard(newX, newY)) {
        player.x = newX;
        player.y = newY;

        if (player.x === goal.x && player.y === goal.y) {
            document.getElementById('game-over').style.display = 'flex';
        }

        draw();
    }
}

function isHazard(x, y) {
    return hazards.some(h => h.x === x && h.y === y);
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
                draw(); // Redraw the maze without the removed hazard
                return;
            }
        }
    }
}

document.addEventListener('keydown', (e) => {
    if (!gameStarted) return;

    switch (e.key) {
        case 'ArrowUp': movePlayer(0, -1); break;
        case 'ArrowDown': movePlayer(0, 1); break;
        case 'ArrowLeft': movePlayer(-1, 0); break;
        case 'ArrowRight': movePlayer(1, 0); break;
        case ' ': destroyHazard(); break; // Space bar to destroy hazards
    }
});

// Reset game on page reload or when "Play Again" is clicked
window.addEventListener('load', () => {
    generateMaze(); // Generate initial maze (hidden until character is selected)
});

document.getElementById('game-over').querySelector('button').addEventListener('click', () => {
    player = { x: 1, y: 1 }; // Reset player position
    gameStarted = false; // Reset game state
    document.getElementById('game-over').style.display = 'none';
    document.getElementById('character-selection').style.display = 'flex'; // Show character selection again
    generateMaze(); // Generate a new maze for the next game
});

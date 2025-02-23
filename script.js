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

// Sound effects
const moveSound = new Audio('audio/move.wav');
const destroySound = new Audio('audio/destroy.wav');
const winSound = new Audio('audio/win.wav');

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

    // Ensure the maze is solvable (simple pathfinding check)
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
    const numHazards = Math.floor(Math.random() * 3) + 3; // 3 to 5 hazards (fewer to reduce complexity)
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
        character.onload = () => { // Ensure image is loaded before drawing
            document.getElementById('character-selection').style.display = 'none';
            gameStarted = true;
            generateMaze(); // Generate a new maze when a character is selected
            draw(); // Draw the maze immediately after selection
        };
    });
});

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw maze
    for (let y = 0; y < mazeHeight; y++) {
        for (let x = 0; x < mazeWidth; x++) {
            if (maze[y][x] === 1) {
                ctx.fillStyle = '#333';
                ctx.fillRect(x * tileSize

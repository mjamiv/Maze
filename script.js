const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const tileSize = 32;
const mazeWidth = canvas.width / tileSize;
const mazeHeight = canvas.height / tileSize;

let character = null;
let player = { x: 1, y: 1 };
let goal = { x: mazeWidth - 2, y: mazeHeight - 2 };
let gameStarted = false;

const maze = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1],
    [1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1],
    [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1],
    [1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1],
    [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1],
    [1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1],
    [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
];

const hazards = [
    { x: 3, y: 2 }, { x: 7, y: 4 }, { x: 11, y: 6 },
    { x: 5, y: 8 }, { x: 9, y: 10 }, { x: 13, y: 12 }
];

document.querySelectorAll('#characters img').forEach(img => {
    img.addEventListener('click', () => {
        character = new Image();
        character.src = img.src;
        document.getElementById('character-selection').style.display = 'none';
        gameStarted = true;
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

document.addEventListener('keydown', (e) => {
    if (!gameStarted) return;

    switch (e.key) {
        case 'ArrowUp': movePlayer(0, -1); break;
        case 'ArrowDown': movePlayer(0, 1); break;
        case 'ArrowLeft': movePlayer(-1, 0); break;
        case 'ArrowRight': movePlayer(1, 0); break;
    }
});

const canvas = document.getElementById('tetris-canvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30; // 300 / 10

// 사이버펑크 네온 색상 팔레트
const COLORS = [
    '#00ffff', // I - Cyan
    '#0055ff', // J - Blue
    '#ffaa00', // L - Orange
    '#ffff00', // O - Yellow
    '#00ff00', // S - Green
    '#ff00ff', // T - Magenta
    '#ff0055'  // Z - Pink
];

// 테트로미노 모양 정의
const SHAPES = [
    [], // null
    // I
    [[0,0,0,0],
     [1,1,1,1],
     [0,0,0,0],
     [0,0,0,0]],
    // J
    [[2,0,0],
     [2,2,2],
     [0,0,0]],
    // L
    [[0,0,3],
     [3,3,3],
     [0,0,0]],
    // O
    [[4,4],
     [4,4]],
    // S
    [[0,5,5],
     [5,5,0],
     [0,0,0]],
    // T
    [[0,6,0],
     [6,6,6],
     [0,0,0]],
    // Z
    [[7,7,0],
     [0,7,7],
     [0,0,0]]
];

let board = [];
let currentPiece = null;
let nextPieceIdx = 0;
let score = 0;
let lines = 0;
let level = 1;
let lastTime = 0;
let dropCounter = 0;
let dropInterval = 1000;
let gameMode = 'start'; // start, playing, paused, gameover
let reqId = null;

const scoreElement = document.getElementById('score');
const linesElement = document.getElementById('lines');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over');
const pausedScreen = document.getElementById('paused');
const finalScoreElement = document.getElementById('final-score');

function createMatrix(w, h) {
    const matrix = [];
    while (h--) {
        matrix.push(new Array(w).fill(0));
    }
    return matrix;
}

function getRandomPieceIdx() {
    return Math.floor(Math.random() * 7) + 1;
}

function createPiece(typeIdx) {
    return {
        matrix: JSON.parse(JSON.stringify(SHAPES[typeIdx])),
        pos: { x: Math.floor(COLS/2) - Math.floor(SHAPES[typeIdx][0].length/2), y: 0 },
        type: typeIdx
    };
}

function initGame() {
    board = createMatrix(COLS, ROWS);
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 1000;
    updateScore();
    nextPieceIdx = getRandomPieceIdx();
    resetPlayer();
}

function updateScore() {
    scoreElement.innerText = score;
    linesElement.innerText = lines;
}

function drawBlock(context, x, y, typeId, size = BLOCK_SIZE) {
    const color = COLORS[typeId - 1];
    
    // 네온 글로우 효과
    context.fillStyle = color;
    context.shadowBlur = 15;
    context.shadowColor = color;
    context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    
    // 외곽선 (선명함)
    context.shadowBlur = 0;
    context.strokeStyle = '#ffffff';
    context.lineWidth = 1;
    context.strokeRect(x * size + 2, y * size + 2, size - 4, size - 4);
    
    // 내부 반사광
    context.fillStyle = 'rgba(255, 255, 255, 0.4)';
    context.fillRect(x * size + 2, y * size + 2, size - 4, size / 4);
}

function drawNextBlock() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    const shape = SHAPES[nextPieceIdx];
    const size = 25; // 다음블록 캔버스는 작으므로 25px
    
    const offset_x = (nextCanvas.width - shape[0].length * size) / 2;
    const offset_y = (nextCanvas.height - shape.length * size) / 2;
    
    shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                const color = COLORS[value - 1];
                nextCtx.fillStyle = color;
                nextCtx.shadowBlur = 10;
                nextCtx.shadowColor = color;
                nextCtx.fillRect(offset_x + x * size + 1, offset_y + y * size + 1, size - 2, size - 2);
                
                nextCtx.shadowBlur = 0;
                nextCtx.strokeStyle = '#fff';
                nextCtx.lineWidth = 1;
                nextCtx.strokeRect(offset_x + x * size + 2, offset_y + y * size + 2, size - 4, size - 4);
            }
        });
    });
}

function draw() {
    // 배경 클리어
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 희미한 그리드 배경
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for(let i=0; i<COLS; i++){
        for(let j=0; j<ROWS; j++){
            ctx.strokeRect(i * BLOCK_SIZE, j * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        }
    }
    
    drawMatrix(board, {x:0, y:0});
    if(currentPiece) {
        drawMatrix(currentPiece.matrix, currentPiece.pos);
    }
}

function drawMatrix(matrix, offset) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                drawBlock(ctx, x + offset.x, y + offset.y, value);
            }
        });
    });
}

function merge(board, piece) {
    piece.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                board[y + piece.pos.y][x + piece.pos.x] = value;
            }
        });
    });
}

function collide(board, piece) {
    const m = piece.matrix;
    const o = piece.pos;
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 &&
               (board[y + o.y] && board[y + o.y][x + o.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function playerDrop() {
    currentPiece.pos.y++;
    if (collide(board, currentPiece)) {
        currentPiece.pos.y--;
        merge(board, currentPiece);
        resetPlayer();
        sweep();
    }
    dropCounter = 0;
}

function playerHardDrop() {
    while (!collide(board, currentPiece)) {
        currentPiece.pos.y++;
    }
    currentPiece.pos.y--;
    merge(board, currentPiece);
    resetPlayer();
    sweep();
    dropCounter = 0;
}

function playerMove(offset) {
    currentPiece.pos.x += offset;
    if (collide(board, currentPiece)) {
        currentPiece.pos.x -= offset;
    }
}

function playerRotate() {
    const pos = currentPiece.pos.x;
    let offset = 1;
    rotate(currentPiece.matrix);
    // Wall kick
    while (collide(board, currentPiece)) {
        currentPiece.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > currentPiece.matrix[0].length) {
            rotate(currentPiece.matrix, -1);
            currentPiece.pos.x = pos;
            return;
        }
    }
}

function rotate(matrix, dir = 1) {
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
        }
    }
    if (dir > 0) {
        matrix.forEach(row => row.reverse());
    } else {
        matrix.reverse();
    }
}

function resetPlayer() {
    currentPiece = createPiece(nextPieceIdx);
    nextPieceIdx = getRandomPieceIdx();
    drawNextBlock();
    if (collide(board, currentPiece)) {
        gameOver();
    }
}

function sweep() {
    let rowCount = 0;
    outer: for (let y = ROWS - 1; y >= 0; --y) {
        for (let x = 0; x < COLS; ++x) {
            if (board[y][x] === 0) {
                continue outer;
            }
        }
        const row = board.splice(y, 1)[0].fill(0);
        board.unshift(row);
        ++y; 
        rowCount++;
    }
    
    if (rowCount > 0) {
        lines += rowCount;
        let scoreInc = 0;
        if(rowCount===1) scoreInc = 100;
        if(rowCount===2) scoreInc = 300;
        if(rowCount===3) scoreInc = 500;
        if(rowCount===4) scoreInc = 800;
        score += scoreInc * level;
        
        if (lines >= level * 10) {
            level++;
            // 드롭 속도 증가
            dropInterval = Math.max(100, 1000 - (level - 1) * 100);
        }
        updateScore();
    }
}

function gameOver() {
    gameMode = 'gameover';
    finalScoreElement.innerText = score;
    gameOverScreen.classList.remove('hidden');
}

function update(time = 0) {
    if (gameMode !== 'playing') return;
    const deltaTime = time - lastTime;
    lastTime = time;
    
    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        playerDrop();
    }
    draw();
    reqId = requestAnimationFrame(update);
}

function startGame() {
    initGame();
    gameMode = 'playing';
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    pausedScreen.classList.add('hidden');
    drawNextBlock();
    lastTime = performance.now();
    if(reqId) cancelAnimationFrame(reqId);
    update(lastTime);
}

function togglePause() {
    if (gameMode === 'playing') {
        gameMode = 'paused';
        pausedScreen.classList.remove('hidden');
    } else if (gameMode === 'paused') {
        gameMode = 'playing';
        pausedScreen.classList.add('hidden');
        lastTime = performance.now();
        update(lastTime);
    }
}

document.addEventListener('keydown', event => {
    if (gameMode === 'playing') {
        if (event.key === 'ArrowLeft') {
            playerMove(-1);
        } else if (event.key === 'ArrowRight') {
            playerMove(1);
        } else if (event.key === 'ArrowDown') {
            playerDrop();
        } else if (event.key === 'ArrowUp') {
            playerRotate();
        } else if (event.code === 'Space') {
            event.preventDefault(); 
            playerHardDrop();
        } else if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') {
            togglePause();
        }
    } else if (gameMode === 'gameover') {
        if (event.code === 'Space' || event.code === 'Enter') {
            startGame();
        }
    } else if (gameMode === 'start') {
        if (event.code === 'Space' || event.code === 'Enter') {
            startGame();
        }
    } else if (gameMode === 'paused') {
        if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') {
            togglePause();
        }
    }
});

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);
document.getElementById('resume-btn').addEventListener('click', togglePause);

// 폰트가 로딩되기 전에 쓰레기 렌더링으로 캔버스를 초기화해둡니다.
draw();

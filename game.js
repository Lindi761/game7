// Game constants
const GRAVITY = 0.5;
const JUMP_FORCE = -12;
const MOVEMENT_SPEED = 5;
const PLATFORM_HEIGHT = 20;
const TRAIL_LENGTH = 10; // Number of trail segments
const PLATFORM_GAP = 100; // 平台之间的垂直间距
const VIEWPORT_PADDING = 200; // 视口边缘与玩家之间的距离
const RESET_DELAY = 2000; // 重置延迟时间（毫秒）
const FLOOR_HEIGHT = 40; // 地板高度
const SCORE_POPUP_DURATION = 1000; // 得分提示显示时间（毫秒）
const SCORE_HEIGHT = 50; // 每上升这么多像素得1分
const PLATFORMS_PER_BED = 20; // 每隔多少个平台生成一张床

// Game state
let gameRunning = false;
let animationFrameId;
let score = 0;
let highScore = 0;
let lastPlatformY = 0;
let cameraY = 0;
let isResetting = false;
let resetTimeout = null;
let scorePopups = []; // 存储得分动画
let platformCount = 0; // 用于跟踪平台数量

// Game elements
let canvas;
let ctx;
let player;
let platforms = [];
let trail = []; // Array to store trail positions
let keys = {
    left: false,
    right: false,
    up: false,
    down: false
};

// Initialize the game
function init() {
    // Create canvas
    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d');
    
    // Add canvas to game area
    const gameArea = document.getElementById('game-area');
    gameArea.appendChild(canvas);
    
    // Set canvas size to match parent
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Create player
    player = {
        x: canvas.width / 2 - 25,
        y: canvas.height / 2 - 25,
        width: 50,
        height: 50,
        velocityX: 0,
        velocityY: 0,
        isJumping: false,
        color: '#3498db',
        highestY: 0 // 记录玩家达到的最高位置
    };
    
    // Initialize trail
    for (let i = 0; i < TRAIL_LENGTH; i++) {
        trail.push({
            x: player.x,
            y: player.y,
            width: player.width,
            height: player.height
        });
    }
    
    // Create initial platforms
    createPlatforms();
    
    // Set up controls
    setupControls();
    
    // Load high score
    loadHighScore();
    
    // Start game loop
    gameRunning = true;
    gameLoop();
}

// Resize canvas to fit container
function resizeCanvas() {
    const gameArea = document.getElementById('game-area');
    canvas.width = gameArea.clientWidth;
    canvas.height = gameArea.clientHeight;
    
    // Recreate platforms when resizing
    if (platforms.length > 0) {
        platforms = [];
        createPlatforms();
    }
}

// Create platforms
function createPlatforms() {
    platforms = [];
    platformCount = 0; // 重置平台计数
    
    // 创建地板
    platforms.push({
        x: 0,
        y: canvas.height - FLOOR_HEIGHT,
        width: canvas.width,
        height: FLOOR_HEIGHT,
        color: '#8B4513', // 深棕色
        isFloor: true // 标记这是地板
    });
    
    // 创建初始平台
    let platformY = canvas.height - FLOOR_HEIGHT - PLATFORM_GAP;
    lastPlatformY = platformY;
    
    while (platformY > -VIEWPORT_PADDING) {
        const platformWidth = canvas.width * (0.2 + Math.random() * 0.3);
        const platformX = Math.random() * (canvas.width - platformWidth);
        
        platformCount++; // 增加平台计数
        const isBed = platformCount % PLATFORMS_PER_BED === 0; // 每隔20个平台生成一张床
        
        platforms.push({
            x: platformX,
            y: platformY,
            width: platformWidth,
            height: PLATFORM_HEIGHT,
            color: isBed ? '#FF69B4' : '#2ecc71', // 床使用粉色
            isBed: isBed,
            isFloor: false
        });
        
        platformY -= PLATFORM_GAP + Math.random() * 50;
    }
}

// Generate new platforms as player moves up
function generateNewPlatforms() {
    platforms = platforms.filter(platform => 
        platform.isFloor || platform.y < player.y + canvas.height + VIEWPORT_PADDING);
    
    while (lastPlatformY > player.y - VIEWPORT_PADDING) {
        const platformWidth = canvas.width * (0.2 + Math.random() * 0.3);
        const platformX = Math.random() * (canvas.width - platformWidth);
        
        platformCount++; // 增加平台计数
        const isBed = platformCount % PLATFORMS_PER_BED === 0; // 每隔20个平台生成一张床
        
        platforms.push({
            x: platformX,
            y: lastPlatformY,
            width: platformWidth,
            height: PLATFORM_HEIGHT,
            color: isBed ? '#FF69B4' : '#2ecc71', // 床使用粉色
            isBed: isBed,
            isFloor: false
        });
        
        lastPlatformY -= PLATFORM_GAP + Math.random() * 50;
    }
}

// Set up control buttons and keyboard events
function setupControls() {
    // Touch/click controls
    document.getElementById('left-btn').addEventListener('touchstart', () => keys.left = true);
    document.getElementById('left-btn').addEventListener('touchend', () => keys.left = false);
    document.getElementById('left-btn').addEventListener('mousedown', () => keys.left = true);
    document.getElementById('left-btn').addEventListener('mouseup', () => keys.left = false);
    
    document.getElementById('right-btn').addEventListener('touchstart', () => keys.right = true);
    document.getElementById('right-btn').addEventListener('touchend', () => keys.right = false);
    document.getElementById('right-btn').addEventListener('mousedown', () => keys.right = true);
    document.getElementById('right-btn').addEventListener('mouseup', () => keys.right = false);
    
    document.getElementById('up-btn').addEventListener('touchstart', () => keys.up = true);
    document.getElementById('up-btn').addEventListener('touchend', () => keys.up = false);
    document.getElementById('up-btn').addEventListener('mousedown', () => keys.up = true);
    document.getElementById('up-btn').addEventListener('mouseup', () => keys.up = false);
    
    document.getElementById('down-btn').addEventListener('touchstart', () => keys.down = true);
    document.getElementById('down-btn').addEventListener('touchend', () => keys.down = false);
    document.getElementById('down-btn').addEventListener('mousedown', () => keys.down = true);
    document.getElementById('down-btn').addEventListener('mouseup', () => keys.down = false);
    
    // Keyboard controls
    window.addEventListener('keydown', (e) => {
        // 如果游戏正在重置状态，任意按键都可以重新开始
        if (isResetting) {
            clearTimeout(resetTimeout);
            resetTimeout = null;
            resetGame();
            isResetting = false;
            return;
        }

        // 正常游戏控制
        switch(e.key) {
            case 'ArrowLeft':
                keys.left = true;
                break;
            case 'ArrowRight':
                keys.right = true;
                break;
            case 'ArrowUp':
                keys.up = true;
                break;
            case 'ArrowDown':
                keys.down = true;
                break;
        }
    });
    
    window.addEventListener('keyup', (e) => {
        switch(e.key) {
            case 'ArrowLeft':
                keys.left = false;
                break;
            case 'ArrowRight':
                keys.right = false;
                break;
            case 'ArrowUp':
                keys.up = false;
                break;
            case 'ArrowDown':
                keys.down = false;
                break;
        }
    });
    
    // Prevent default behavior for arrow keys
    window.addEventListener('keydown', (e) => {
        if(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
            e.preventDefault();
        }
    });

    // 添加点击重新开始的事件监听
    canvas.addEventListener('click', () => {
        if (isResetting) {
            clearTimeout(resetTimeout);
            resetTimeout = null;
            resetGame();
            isResetting = false;
        }
    });
}

// Check collision between player and platforms
function checkCollision(player, platform) {
    return player.x < platform.x + platform.width &&
           player.x + player.width > platform.x &&
           player.y < platform.y + platform.height &&
           player.y + player.height > platform.y;
}

// Update game state
function update() {
    if (isResetting) return;

    // Apply gravity
    player.velocityY += GRAVITY;
    
    // Handle left/right movement
    if (keys.left) {
        player.velocityX = -MOVEMENT_SPEED;
    } else if (keys.right) {
        player.velocityX = MOVEMENT_SPEED;
    } else {
        player.velocityX = 0;
    }
    
    // Handle jumping
    if (keys.up && !player.isJumping) {
        player.velocityY = JUMP_FORCE;
        player.isJumping = true;
    }
    
    // 记录更新前的位置
    const previousY = player.y;
    
    // Update player position
    player.x += player.velocityX;
    player.y += player.velocityY;
    
    // 计算上升的格子数并增加分数
    if (player.y < previousY) {
        const gridsClimbed = Math.floor((previousY - player.y) / PLATFORM_HEIGHT);
        if (gridsClimbed > 0) {
            score += gridsClimbed;
            updateScore();
            // 添加得分动画
            scorePopups.push({
                x: player.x + player.width / 2,
                y: player.y,
                age: 0,
                score: gridsClimbed
            });
        }
    }
    
    // 更新得分动画
    scorePopups = scorePopups.filter(popup => {
        popup.age += 16;
        popup.y -= 1;
        return popup.age < SCORE_POPUP_DURATION;
    });
    
    // 生成新平台
    generateNewPlatforms();
    
    // 更新相机位置，确保地板始终可见
    cameraY = Math.min(player.y - canvas.height / 3, canvas.height - FLOOR_HEIGHT);
    
    // Check for platform collisions
    player.isJumping = true;
    
    for (let platform of platforms) {
        if (player.velocityY > 0 &&
            player.x + player.width > platform.x &&
            player.x < platform.x + platform.width &&
            player.y + player.height >= platform.y &&
            player.y + player.height <= platform.y + player.velocityY + 5) {
            
            if (platform.isFloor) {
                // 如果碰到地板，立即重新开始游戏
                startResetProcess();
                return;
            } else {
                // 正常平台碰撞处理
                player.isJumping = false;
                player.velocityY = 0;
                player.y = platform.y - player.height;
            }
        }
    }
    
    // Keep player within horizontal bounds
    if (player.x < 0) {
        player.x = 0;
    } else if (player.x + player.width > canvas.width) {
        player.x = canvas.width - player.width;
    }
    
    // Update trail
    trail.pop();
    trail.unshift({
        x: player.x,
        y: player.y,
        width: player.width,
        height: player.height
    });
}

// Draw game elements
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 应用相机变换
    ctx.save();
    ctx.translate(0, -cameraY);
    
    // Draw platforms and floor
    for (let platform of platforms) {
        ctx.fillStyle = platform.color;
        if (platform.isFloor) {
            // 为地板添加纹理
            const gradient = ctx.createLinearGradient(0, platform.y, 0, platform.y + platform.height);
            gradient.addColorStop(0, '#8B4513');  // 深棕色
            gradient.addColorStop(0.5, '#A0522D'); // 中棕色
            gradient.addColorStop(1, '#8B4513');   // 深棕色
            ctx.fillStyle = gradient;
            
            // 绘制地板主体
            ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
            
            // 添加地板表面的线条纹理
            ctx.strokeStyle = '#6B3E26';
            ctx.lineWidth = 2;
            for (let x = 0; x < platform.width; x += 40) {
                ctx.beginPath();
                ctx.moveTo(x, platform.y);
                ctx.lineTo(x + 20, platform.y);
                ctx.stroke();
            }
        } else if (platform.isBed) {
            // 绘制床
            // 床垫
            ctx.fillStyle = '#FF69B4';
            ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
            
            // 床单纹理
            ctx.strokeStyle = '#FFB6C1';
            ctx.lineWidth = 2;
            for (let x = platform.x; x < platform.x + platform.width; x += 20) {
                ctx.beginPath();
                ctx.moveTo(x, platform.y);
                ctx.lineTo(x + 10, platform.y + platform.height);
                ctx.stroke();
            }
            
            // 枕头
            ctx.fillStyle = '#FFF';
            const pillowWidth = platform.width * 0.2;
            ctx.fillRect(platform.x + 5, platform.y - 5, pillowWidth, 10);

            // 添加"休息点"文字
            ctx.font = 'bold 16px Arial';
            ctx.fillStyle = '#FFF'; // 白色文字
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.strokeStyle = '#FF1493'; // 深粉色描边
            ctx.lineWidth = 3;
            const textX = platform.x + platform.width / 2;
            const textY = platform.y + platform.height / 2;
            ctx.strokeText('休息点', textX, textY);
            ctx.fillText('休息点', textX, textY);
        } else {
            ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
        }
    }
    
    // Draw trail
    for (let i = 0; i < trail.length; i++) {
        const alpha = (TRAIL_LENGTH - i) / TRAIL_LENGTH * 0.3;
        ctx.fillStyle = `rgba(52, 152, 219, ${alpha})`;
        ctx.fillRect(trail[i].x, trail[i].y, trail[i].width, trail[i].height);
    }
    
    // Draw player
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);
    
    // 绘制得分动画
    for (const popup of scorePopups) {
        const alpha = 1 - (popup.age / SCORE_POPUP_DURATION);
        ctx.font = 'bold 20px Arial';
        ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`; // 金色
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`+${popup.score}`, popup.x, popup.y);
    }
    
    ctx.restore();

    // 如果正在重置，显示提示文字
    if (isResetting) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const messages = [
            `游戏结束！`,
            `得分: ${score}`,
            score > 0 ? `最高分: ${highScore}` : '',
            '按任意键或点击屏幕重新开始',
            '或等待自动重新开始...'
        ];
        
        messages.forEach((msg, i) => {
            if (msg) {
                ctx.fillText(msg, canvas.width / 2, canvas.height / 2 - 48 + (i * 30));
            }
        });
        
        ctx.restore();
    }
}

// Update score display
function updateScore() {
    const scoreElement = document.getElementById('score');
    scoreElement.textContent = `分数: ${score}`;
    
    // 添加分数变化的动画效果
    scoreElement.style.transform = 'scale(1.2)';
    setTimeout(() => {
        scoreElement.style.transform = 'scale(1)';
    }, 200);

    if (score > highScore) {
        highScore = score;
        const highScoreElement = document.getElementById('high-score');
        highScoreElement.textContent = `最高分: ${highScore}`;
        highScoreElement.style.transform = 'scale(1.2)';
        setTimeout(() => {
            highScoreElement.style.transform = 'scale(1)';
        }, 200);
        saveHighScore();
    }
}

// Save high score to local storage
function saveHighScore() {
    localStorage.setItem('platformerHighScore', highScore.toString());
}

// Load high score from local storage
function loadHighScore() {
    const savedScore = localStorage.getItem('platformerHighScore');
    if (savedScore) {
        highScore = parseInt(savedScore);
        document.getElementById('high-score').textContent = `最高分: ${highScore}`;
    }
}

// Start the reset process
function startResetProcess() {
    if (isResetting) return;
    
    isResetting = true;
    player.velocityX = 0;
    player.velocityY = 0;
    
    // 清除之前的重置定时器（如果存在）
    if (resetTimeout) {
        clearTimeout(resetTimeout);
    }
    
    // 延迟重置游戏
    resetTimeout = setTimeout(() => {
        resetGame();
        isResetting = false;
        resetTimeout = null;
    }, RESET_DELAY);
}

// Reset game
function resetGame() {
    player.x = canvas.width / 2 - 25;
    player.y = canvas.height / 2 - 25;
    player.velocityX = 0;
    player.velocityY = 0;
    player.highestY = player.y;
    cameraY = 0;
    lastPlatformY = canvas.height - PLATFORM_HEIGHT;
    score = 0;
    updateScore();
    createPlatforms();
    
    // 重置拖尾效果
    trail = Array(TRAIL_LENGTH).fill().map(() => ({
        x: player.x,
        y: player.y,
        width: player.width,
        height: player.height
    }));
}

// Game loop
function gameLoop() {
    if (!gameRunning) return;
    
    update();
    draw();
    
    animationFrameId = requestAnimationFrame(gameLoop);
}

// Initialize the game when the page loads
window.addEventListener('load', init); 
window.addEventListener('load', init); 
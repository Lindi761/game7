// Game constants
const GRAVITY = 0.25;
const JUMP_FORCE = -8;
const SUPER_JUMP_MULTIPLIER = 3;  // 大跳倍率
const MOVEMENT_SPEED = 3.5;
const PLATFORM_HEIGHT = 20;
const TRAIL_LENGTH = 10; // Number of trail segments
const PLATFORM_GAP = 100; // 平台之间的垂直间距
const VIEWPORT_PADDING = 200; // 视口边缘与玩家之间的距离
const RESET_DELAY = 2000; // 重置延迟时间（毫秒）
const FLOOR_HEIGHT = 40; // 地板高度
const SCORE_POPUP_DURATION = 1000; // 得分提示显示时间（毫秒）
const SCORE_HEIGHT = 50; // 每上升这么多像素得1分
const PLATFORMS_PER_BED = 20; // 每隔多少个平台生成一张床

// 计算最大跳跃高度和距离
const MAX_JUMP_HEIGHT = Math.pow(JUMP_FORCE, 2) / (2 * GRAVITY); // 根据物理公式计算最大跳跃高度
const MAX_JUMP_DISTANCE = MOVEMENT_SPEED * (-2 * JUMP_FORCE / GRAVITY); // 最大水平跳跃距离

// 调整平台间距常量
const MIN_PLATFORM_GAP_Y = 60; // 最小垂直间距
const MAX_PLATFORM_GAP_Y = Math.min(120, MAX_JUMP_HEIGHT * 0.8); // 最大垂直间距，不超过最大跳跃高度的80%
const MIN_PLATFORM_GAP_X = 50; // 最小水平间距
const MAX_PLATFORM_GAP_X = Math.min(200, MAX_JUMP_DISTANCE * 0.7); // 最大水平间距，不超过最大跳跃距离的70%

const PLATFORM_TYPES = {
    NORMAL: 'normal',
    BED: 'bed',
    GOLDEN: 'golden',
    BONUS: 'bonus'
};

const PLATFORM_SCORES = {
    [PLATFORM_TYPES.NORMAL]: 1,    // 普通跳板1分
    [PLATFORM_TYPES.BED]: 5,       // 休息点5分
    [PLATFORM_TYPES.GOLDEN]: 3,    // 金色跳板3分
    [PLATFORM_TYPES.BONUS]: 2      // 奖励跳板2分
};

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
let visitedPlatforms = new Set();
let showingSavePrompt = false;

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
    down: false,
    shift: false  // 添加shift键状态
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
    platformCount = 0;
    visitedPlatforms.clear();
    
    // 创建地板
    platforms.push({
        x: 0,
        y: canvas.height - FLOOR_HEIGHT,
        width: canvas.width,
        height: FLOOR_HEIGHT,
        color: '#8B4513',
        isFloor: true,
        id: 'floor',
        type: 'floor'
    });
    
    // 创建初始平台
    let platformY = canvas.height - FLOOR_HEIGHT - MIN_PLATFORM_GAP_Y;
    let lastPlatformX = canvas.width / 2; // 记录上一个平台的X位置
    lastPlatformY = platformY;
    
    while (platformY > -VIEWPORT_PADDING) {
        platformCount++;
        
        // 决定平台类型
        let platformType;
        let platformColor;
        
        if (platformCount % PLATFORMS_PER_BED === 0) {
            platformType = PLATFORM_TYPES.BED;
            platformColor = '#FF69B4';
        } else if (platformCount % 10 === 0) {
            platformType = PLATFORM_TYPES.GOLDEN;
            platformColor = '#FFD700';
        } else if (Math.random() < 0.15) {
            platformType = PLATFORM_TYPES.BONUS;
            platformColor = '#87CEEB';
        } else {
            platformType = PLATFORM_TYPES.NORMAL;
            platformColor = '#2ecc71';
        }

        // 计算平台宽度（特殊平台稍宽一些）
        const isSpecialPlatform = platformType !== PLATFORM_TYPES.NORMAL;
        const minWidth = isSpecialPlatform ? 100 : 80;
        const maxWidth = isSpecialPlatform ? 150 : 120;
        const platformWidth = minWidth + Math.random() * (maxWidth - minWidth);
        
        // 计算平台水平位置，确保可达性
        let platformX;
        const maxHorizontalDistance = Math.min(MAX_JUMP_DISTANCE, canvas.width - platformWidth);
        const horizontalOffset = Math.random() * (maxHorizontalDistance - MIN_PLATFORM_GAP_X) + MIN_PLATFORM_GAP_X;
        
        // 根据上一个平台的位置，确定新平台的位置
        if (Math.random() < 0.5) {
            // 向右偏移
            platformX = Math.min(lastPlatformX + horizontalOffset, canvas.width - platformWidth);
        } else {
            // 向左偏移
            platformX = Math.max(lastPlatformX - horizontalOffset, 0);
        }
        
        // 确保平台不会太靠近屏幕边缘
        platformX = Math.max(MIN_PLATFORM_GAP_X, Math.min(platformX, canvas.width - platformWidth - MIN_PLATFORM_GAP_X));
        
        // 计算垂直间距，考虑水平距离对跳跃难度的影响
        const horizontalDistance = Math.abs(platformX - lastPlatformX);
        const maxVerticalGap = Math.max(
            MIN_PLATFORM_GAP_Y,
            MAX_PLATFORM_GAP_Y * (1 - horizontalDistance / MAX_JUMP_DISTANCE)
        );
        const verticalGap = MIN_PLATFORM_GAP_Y + Math.random() * (maxVerticalGap - MIN_PLATFORM_GAP_Y);
        
        platforms.push({
            x: platformX,
            y: platformY,
            width: platformWidth,
            height: PLATFORM_HEIGHT,
            color: platformColor,
            type: platformType,
            isBed: platformType === PLATFORM_TYPES.BED,
            isFloor: false,
            id: `platform_${platformCount}`
        });
        
        // 更新位置记录
        lastPlatformX = platformX;
        platformY -= verticalGap;
        lastPlatformY = platformY;
    }
}

// Generate new platforms
function generateNewPlatforms() {
    platforms = platforms.filter(platform => 
        platform.isFloor || platform.y < player.y + canvas.height + VIEWPORT_PADDING);
    
    let lastPlatformX = platforms[platforms.length - 1].x;
    
    while (lastPlatformY > player.y - VIEWPORT_PADDING) {
        platformCount++;
        
        // 决定平台类型
        let platformType;
        let platformColor;
        
        if (platformCount % PLATFORMS_PER_BED === 0) {
            platformType = PLATFORM_TYPES.BED;
            platformColor = '#FF69B4';
        } else if (platformCount % 10 === 0) {
            platformType = PLATFORM_TYPES.GOLDEN;
            platformColor = '#FFD700';
        } else if (Math.random() < 0.15) {
            platformType = PLATFORM_TYPES.BONUS;
            platformColor = '#87CEEB';
        } else {
            platformType = PLATFORM_TYPES.NORMAL;
            platformColor = '#2ecc71';
        }

        // 使用与createPlatforms相同的平台生成逻辑
        const isSpecialPlatform = platformType !== PLATFORM_TYPES.NORMAL;
        const minWidth = isSpecialPlatform ? 100 : 80;
        const maxWidth = isSpecialPlatform ? 150 : 120;
        const platformWidth = minWidth + Math.random() * (maxWidth - minWidth);
        
        let platformX;
        const maxHorizontalDistance = Math.min(MAX_JUMP_DISTANCE, canvas.width - platformWidth);
        const horizontalOffset = Math.random() * (maxHorizontalDistance - MIN_PLATFORM_GAP_X) + MIN_PLATFORM_GAP_X;
        
        if (Math.random() < 0.5) {
            platformX = Math.min(lastPlatformX + horizontalOffset, canvas.width - platformWidth);
        } else {
            platformX = Math.max(lastPlatformX - horizontalOffset, 0);
        }
        
        platformX = Math.max(MIN_PLATFORM_GAP_X, Math.min(platformX, canvas.width - platformWidth - MIN_PLATFORM_GAP_X));
        
        const horizontalDistance = Math.abs(platformX - lastPlatformX);
        const maxVerticalGap = Math.max(
            MIN_PLATFORM_GAP_Y,
            MAX_PLATFORM_GAP_Y * (1 - horizontalDistance / MAX_JUMP_DISTANCE)
        );
        const verticalGap = MIN_PLATFORM_GAP_Y + Math.random() * (maxVerticalGap - MIN_PLATFORM_GAP_Y);
        
        platforms.push({
            x: platformX,
            y: lastPlatformY,
            width: platformWidth,
            height: PLATFORM_HEIGHT,
            color: platformColor,
            type: platformType,
            isBed: platformType === PLATFORM_TYPES.BED,
            isFloor: false,
            id: `platform_${platformCount}`
        });
        
        lastPlatformX = platformX;
        lastPlatformY -= verticalGap;
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
            case 'Shift':
                keys.shift = true;
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
            case 'Shift':
                keys.shift = false;
                break;
        }
    });
    
    // Prevent default behavior for arrow keys and shift
    window.addEventListener('keydown', (e) => {
        if(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Shift', ' '].includes(e.key)) {
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
    
    // Handle jumping with super jump
    if (keys.up && !player.isJumping) {
        // 如果同时按下shift，触发大跳
        if (keys.shift) {
            player.velocityY = JUMP_FORCE * SUPER_JUMP_MULTIPLIER;
            // 添加大跳特效
            addSuperJumpEffect();
        } else {
            player.velocityY = JUMP_FORCE;
        }
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
                startResetProcess();
                return;
            } else {
                player.isJumping = false;
                player.velocityY = 0;
                player.y = platform.y - player.height;

                // 检查是否是新跳板，如果是则根据类型加分
                if (!visitedPlatforms.has(platform.id)) {
                    visitedPlatforms.add(platform.id);
                    const scoreToAdd = PLATFORM_SCORES[platform.type];
                    score += scoreToAdd;
                    updateScore();
                    
                    // 添加得分动画
                    scorePopups.push({
                        x: player.x + player.width / 2,
                        y: player.y,
                        age: 0,
                        score: scoreToAdd
                    });
                }

                if (platform.isBed && !showingSavePrompt) {
                    showSavePrompt(platform);
                }
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
        } else {
            // 绘制平台
            ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
            
            // 为不同类型的平台添加特效
            switch (platform.type) {
                case PLATFORM_TYPES.GOLDEN:
                    // 金色跳板添加闪光效果
                    const shimmerAlpha = (Math.sin(Date.now() / 200) + 1) / 2;
                    ctx.fillStyle = `rgba(255, 255, 0, ${shimmerAlpha * 0.3})`;
                    ctx.fillRect(platform.x, platform.y - 2, platform.width, platform.height + 4);
                    break;
                    
                case PLATFORM_TYPES.BONUS:
                    // 奖励跳板添加波纹效果
                    ctx.strokeStyle = 'rgba(135, 206, 235, 0.5)';
                    ctx.lineWidth = 2;
                    const waveOffset = Math.sin(Date.now() / 300) * 5;
                    ctx.beginPath();
                    ctx.moveTo(platform.x, platform.y + platform.height/2);
                    ctx.quadraticCurveTo(
                        platform.x + platform.width/2, 
                        platform.y + platform.height/2 + waveOffset,
                        platform.x + platform.width,
                        platform.y + platform.height/2
                    );
                    ctx.stroke();
                    break;
                    
                case PLATFORM_TYPES.BED:
                    // 休息点的绘制逻辑
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
                    
                    // 休息点文字
                    ctx.font = 'bold 16px Arial';
                    ctx.fillStyle = '#FFF';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.strokeStyle = '#FF1493';
                    ctx.lineWidth = 3;
                    const textX = platform.x + platform.width / 2;
                    const textY = platform.y + platform.height / 2;
                    ctx.strokeText('休息点', textX, textY);
                    ctx.fillText('休息点', textX, textY);
                    break;
            }
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

function showSavePrompt(platform) {
    // 实现显示保存提示的逻辑
    console.log("Saving prompt for platform:", platform);
}

// Add any other necessary functions here
// ... 

// 添加大跳特效函数
function addSuperJumpEffect() {
    // 在玩家周围添加圆形扩散效果
    const effect = {
        x: player.x + player.width / 2,
        y: player.y + player.height / 2,
        radius: 10,
        alpha: 1,
        maxRadius: 100
    };
    
    // 创建动画帧
    function animate() {
        if (effect.radius < effect.maxRadius) {
            effect.radius += 5;
            effect.alpha = 1 - (effect.radius / effect.maxRadius);
            
            ctx.save();
            ctx.translate(0, -cameraY);
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 215, 0, ${effect.alpha})`;
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.restore();
            
            requestAnimationFrame(animate);
        }
    }
    
    animate();
}

// ... 
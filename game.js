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
const SUPER_JUMP_COST = 50;  // 大跳消耗的金币数

// 宝物相关常量
const TREASURE_TYPES = {
    COIN: { 
        value: 1, 
        color: '#FFD700', 
        radius: 8, 
        probability: 0.5,
        symbol: '💰'
    },
    GEM: { 
        value: 5, 
        color: '#FF1493', 
        radius: 10, 
        probability: 0.3,
        symbol: '💎'
    },
    CROWN: { 
        value: 10, 
        color: '#9400D3', 
        radius: 12, 
        probability: 0.15,
        symbol: '👑'
    },
    CHEST: { 
        value: 20, 
        color: '#FF4500', 
        radius: 15, 
        probability: 0.05,
        symbol: '🎁'
    }
};

// 连击奖励系统
const COMBO_THRESHOLDS = {
    5: 1.5,   // 5连击：1.5倍金币
    10: 2,    // 10连击：2倍金币
    20: 3,    // 20连击：3倍金币
    50: 5     // 50连击：5倍金币
};

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

// 宝物生成相关常量
const TREASURE_SPAWN_INTERVAL = 5;  // 每5个平台生成一个宝物

// Game state
let gameRunning = false;
let animationFrameId;
let score = 0;
let highScore = 0;
let coins = 0;  // 添加金币计数
let combo = 0;              // 当前连击数
let comboTimer = 0;         // 连击计时器
let lastCollectTime = 0;    // 上次收集宝物的时间
const COMBO_TIMEOUT = 3000; // 连击超时时间（毫秒）
let lastPlatformY = 0;
let cameraY = 0;
let isResetting = false;
let resetTimeout = null;
let scorePopups = []; // 存储得分动画
let coinPopups = [];  // 添加金币收集动画
let platformCount = 0; // 用于跟踪平台数量
let visitedPlatforms = new Set();
let showingSavePrompt = false;
let treasures = [];  // 存储所有宝物

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

let lastTreasureSpawnCount = 0;  // 上次生成宝物时的平台计数
let lastTreasureType = null;     // 上次生成的宝物类型

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
    lastTreasureSpawnCount = 0;
    lastTreasureType = null;
    
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
    
    platforms.forEach(platform => {
        if (!platform.isFloor) {
            // 每5个平台随机选择一个生成宝物
            if (platformCount % TREASURE_SPAWN_INTERVAL === 0) {
                // 在这5个平台中随机选择一个位置生成宝物
                const randomOffset = Math.floor(Math.random() * TREASURE_SPAWN_INTERVAL);
                const targetPlatform = platforms[platforms.length - randomOffset - 1];
                if (targetPlatform && !targetPlatform.isFloor) {
                    generateTreasure(targetPlatform);
                    lastTreasureSpawnCount = platformCount;
                }
            }
        }
    });
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
        
        // 每5个平台随机选择一个生成宝物
        if (platformCount % TREASURE_SPAWN_INTERVAL === 0) {
            // 在最近生成的5个平台中随机选择一个位置生成宝物
            const recentPlatforms = platforms.slice(-TREASURE_SPAWN_INTERVAL);
            const randomPlatform = recentPlatforms[Math.floor(Math.random() * recentPlatforms.length)];
            if (randomPlatform && !randomPlatform.isFloor) {
                generateTreasure(randomPlatform);
                lastTreasureSpawnCount = platformCount;
            }
        }
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
        // 如果同时按下shift，尝试触发大跳
        if (keys.shift) {
            if (coins >= SUPER_JUMP_COST) {
                player.velocityY = JUMP_FORCE * SUPER_JUMP_MULTIPLIER;
                // 扣除金币
                coins -= SUPER_JUMP_COST;
                // 添加大跳特效
                addSuperJumpEffect();
                // 显示消耗提示
                showCostEffect();
                // 更新金币显示
                updateCoins();
            } else {
                // 金币不足时显示提示
                showInsufficientCoinsEffect();
                // 执行普通跳跃
                player.velocityY = JUMP_FORCE;
            }
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
    
    // 更新连击计时器
    if (combo > 0) {
        comboTimer = Date.now() - lastCollectTime;
        if (comboTimer > COMBO_TIMEOUT) {
            // 连击中断
            combo = 0;
            showComboBreak();
        }
    }
    
    // 更新宝物动画和检测碰撞
    treasures.forEach(treasure => {
        if (!treasure.collected) {
            // 使宝物上下浮动
            treasure.floatOffset = Math.sin(Date.now() / 500) * 5;
            
            // 检测玩家是否收集到宝物
            const dx = (player.x + player.width / 2) - treasure.x;
            const dy = (player.y + player.height / 2) - (treasure.y + treasure.floatOffset);
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < player.width / 2 + treasure.radius) {
                treasure.collected = true;
                
                // 更新连击
                const now = Date.now();
                if (now - lastCollectTime < COMBO_TIMEOUT) {
                    combo++;
                } else {
                    combo = 1;
                }
                lastCollectTime = now;
                
                // 计算连击加成
                let comboMultiplier = 1;
                for (const [threshold, multiplier] of Object.entries(COMBO_THRESHOLDS)) {
                    if (combo >= parseInt(threshold)) {
                        comboMultiplier = multiplier;
                    }
                }
                
                // 应用连击加成到金币值
                const baseValue = treasure.value;
                const finalValue = Math.round(baseValue * comboMultiplier);
                coins += finalValue;
                
                // 添加金币收集动画
                coinPopups.push({
                    x: treasure.x,
                    y: treasure.y,
                    value: finalValue,
                    age: 0,
                    color: treasure.color,
                    symbol: treasure.symbol,
                    combo: combo,
                    multiplier: comboMultiplier
                });
                
                // 播放收集特效
                showCollectEffect(treasure);
                
                // 更新UI
                updateCoins();
            }
        }
    });
    
    // 更新金币收集动画
    coinPopups = coinPopups.filter(popup => {
        popup.age += 16;
        popup.y -= 2;
        return popup.age < SCORE_POPUP_DURATION;
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
    
    // 绘制宝物
    treasures.forEach(treasure => {
        if (!treasure.collected) {
            // 绘制光晕效果
            const glowSize = 5 + Math.sin(Date.now() / 300) * 2;
            ctx.beginPath();
            ctx.arc(
                treasure.x,
                treasure.y + treasure.floatOffset,
                treasure.radius + glowSize,
                0,
                Math.PI * 2
            );
            ctx.fillStyle = `rgba(${hexToRgb(treasure.color)}, 0.3)`;
            ctx.fill();
            
            // 绘制宝物主体
            ctx.beginPath();
            ctx.arc(
                treasure.x,
                treasure.y + treasure.floatOffset,
                treasure.radius,
                0,
                Math.PI * 2
            );
            ctx.fillStyle = treasure.color;
            ctx.fill();
            
            // 绘制宝物符号
            ctx.font = `${treasure.radius * 1.5}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(
                treasure.symbol,
                treasure.x,
                treasure.y + treasure.floatOffset
            );
            
            // 添加闪光效果
            const shimmerAlpha = (Math.sin(Date.now() / 200) + 1) / 2;
            ctx.strokeStyle = `rgba(255, 255, 255, ${shimmerAlpha})`;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    });
    
    // 绘制金币收集动画
    coinPopups.forEach(popup => {
        const alpha = 1 - (popup.age / SCORE_POPUP_DURATION);
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 3;
        
        if (popup.type === 'warning') {
            // 绘制警告提示
            ctx.fillStyle = `rgba(255, 68, 68, ${alpha})`;
            ctx.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
            ctx.strokeText(popup.value, popup.x, popup.y);
            ctx.fillText(popup.value, popup.x, popup.y);
        } else if (popup.type === 'cost') {
            // 绘制消耗提示
            ctx.fillStyle = `rgba(255, 68, 68, ${alpha})`;
            ctx.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
            ctx.strokeText(`${popup.symbol} ${popup.value}`, popup.x, popup.y);
            ctx.fillText(`${popup.symbol} ${popup.value}`, popup.x, popup.y);
        } else if (popup.type === 'particle') {
            // 绘制粒子效果
            ctx.beginPath();
            ctx.arc(popup.x + popup.velocityX * popup.age/50, 
                   popup.y + popup.velocityY * popup.age/50, 
                   popup.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${hexToRgb(popup.color)}, ${alpha})`;
            ctx.fill();
        } else {
            // 原有的收集提示
            if (popup.combo > 1) {
                const comboText = `${popup.combo}连击!`;
                const multiplierText = `x${popup.multiplier}`;
                
                ctx.strokeText(comboText, popup.x, popup.y - 20);
                ctx.fillText(comboText, popup.x, popup.y - 20);
                
                ctx.strokeText(`${popup.symbol} +${popup.value}`, popup.x, popup.y);
                ctx.fillText(`${popup.symbol} +${popup.value}`, popup.x, popup.y);
                
                ctx.strokeText(multiplierText, popup.x, popup.y + 20);
                ctx.fillText(multiplierText, popup.x, popup.y + 20);
            } else {
                ctx.strokeText(`${popup.symbol} +${popup.value}`, popup.x, popup.y);
                ctx.fillText(`${popup.symbol} +${popup.value}`, popup.x, popup.y);
            }
        }
    });
    
    // 绘制当前连击数
    if (combo > 0) {
        const comboAlpha = Math.max(0, 1 - comboTimer / COMBO_TIMEOUT);
        ctx.font = 'bold 32px Arial';
        ctx.fillStyle = `rgba(255, 165, 0, ${comboAlpha})`;
        ctx.strokeStyle = `rgba(0, 0, 0, ${comboAlpha})`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.lineWidth = 3;
        ctx.strokeText(`${combo}连击!`, canvas.width - 20, 20);
        ctx.fillText(`${combo}连击!`, canvas.width - 20, 20);
    }
    
    ctx.restore();

    // 在画布上绘制金币数量（恢复正常坐标系后绘制，这样就不会随相机移动）
    let comboMultiplier = 1;
    for (const [threshold, multiplier] of Object.entries(COMBO_THRESHOLDS)) {
        if (combo >= parseInt(threshold)) {
            comboMultiplier = multiplier;
        }
    }
    
    // 绘制金币图标和数量
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.lineWidth = 3;
    
    // 绘制金币符号
    const coinSymbol = '💰';
    const padding = 20;
    const baseY = 20;
    
    // 绘制金币数量背景
    const coinText = `${coins}`;
    const comboText = combo >= 5 ? ` x${comboMultiplier}` : '';
    const textWidth = ctx.measureText(coinSymbol + ' ' + coinText + comboText).width + 20;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.roundRect(canvas.width - textWidth - padding, baseY - 5, textWidth + 10, 34, 10);
    ctx.fill();
    
    // 绘制文本
    ctx.fillStyle = '#FFD700';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    let x = canvas.width - padding;
    
    // 如果有连击加成，显示倍率
    if (combo >= 5) {
        ctx.fillStyle = '#FFA500';
        ctx.strokeText(comboText, x, baseY);
        ctx.fillText(comboText, x, baseY);
        x -= ctx.measureText(comboText).width + 5;
    }
    
    // 显示金币数量
    ctx.fillStyle = '#FFD700';
    ctx.strokeText(coinText, x, baseY);
    ctx.fillText(coinText, x, baseY);
    x -= ctx.measureText(coinText).width + 5;
    
    // 显示金币图标
    ctx.strokeText(coinSymbol, x, baseY);
    ctx.fillText(coinSymbol, x, baseY);

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
    
    treasures = [];
    coins = 0;
    coinPopups = [];
    updateCoins();
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

// 更新金币显示，移除DOM元素版本
function updateCoins() {
    // 移除旧的DOM元素（如果存在）
    const oldCoinsElement = document.getElementById('coins');
    if (oldCoinsElement) {
        oldCoinsElement.remove();
    }
}

// 生成宝物的函数
function generateTreasure(platform) {
    let availableTypes = Object.keys(TREASURE_TYPES).filter(type => type !== lastTreasureType);
    
    // 如果没有其他类型可选，重置过滤器
    if (availableTypes.length === 0) {
        availableTypes = Object.keys(TREASURE_TYPES);
    }
    
    // 根据高度增加更好宝物的概率
    const heightProgress = Math.min(1, Math.max(0, (platform.y - canvas.height) / (-canvas.height * 2)));
    
    // 根据高度调整不同宝物的权重
    const weights = {
        COIN: 1 - heightProgress * 0.5,     // 随高度略微降低概率
        GEM: 0.5 + heightProgress * 0.3,    // 随高度增加概率
        CROWN: 0.3 + heightProgress * 0.4,  // 随高度显著增加概率
        CHEST: 0.1 + heightProgress * 0.5   // 随高度大幅增加概率
    };
    
    // 计算总权重
    const totalWeight = availableTypes.reduce((sum, type) => sum + weights[type], 0);
    
    // 随机选择宝物类型
    let random = Math.random() * totalWeight;
    let selectedType = availableTypes[0];
    
    for (const type of availableTypes) {
        if (random <= weights[type]) {
            selectedType = type;
            break;
        }
        random -= weights[type];
    }
    
    lastTreasureType = selectedType;
    
    // 创建宝物对象
    const treasure = {
        x: platform.x + platform.width / 2,
        y: platform.y - 30,
        type: selectedType,
        ...TREASURE_TYPES[selectedType],
        collected: false,
        floatOffset: 0,
        platformId: platform.id
    };
    
    treasures.push(treasure);
}

// 辅助函数：显示连击中断效果
function showComboBreak() {
    if (combo >= 5) {  // 只有达到5连击以上才显示中断效果
        coinPopups.push({
            x: canvas.width - 100,
            y: 40,
            value: `${combo}连击结束`,
            age: 0,
            color: '#FF4444'
        });
    }
}

// 辅助函数：显示收集特效
function showCollectEffect(treasure) {
    // 创建粒子效果
    const particleCount = 8;
    const angleStep = (Math.PI * 2) / particleCount;
    
    for (let i = 0; i < particleCount; i++) {
        const angle = i * angleStep;
        const speed = 2 + Math.random() * 2;
        
        coinPopups.push({
            x: treasure.x + Math.cos(angle) * treasure.radius,
            y: treasure.y + Math.sin(angle) * treasure.radius,
            velocityX: Math.cos(angle) * speed,
            velocityY: Math.sin(angle) * speed,
            age: 0,
            radius: 3,
            color: treasure.color,
            type: 'particle'
        });
    }
}

// 辅助函数：将十六进制颜色转换为RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? 
        `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` 
        : '255, 255, 255';
}

// 添加金币不足提示效果
function showInsufficientCoinsEffect() {
    coinPopups.push({
        x: canvas.width - 150,
        y: 60,
        value: `金币不足！需要${SUPER_JUMP_COST}金币`,
        age: 0,
        color: '#FF4444',
        type: 'warning'
    });
}

// 添加消耗提示效果
function showCostEffect() {
    coinPopups.push({
        x: player.x + player.width / 2,
        y: player.y - 20,
        value: -SUPER_JUMP_COST,
        age: 0,
        color: '#FF4444',
        symbol: '💰',
        type: 'cost'
    });
}

// ... 
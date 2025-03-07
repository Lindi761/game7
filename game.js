// Game constants
const GRAVITY = 0.5;
const JUMP_FORCE = -12;
const MOVEMENT_SPEED = 5;
const PLATFORM_HEIGHT = 20;
const TRAIL_LENGTH = 10; // Number of trail segments

// Game state
let gameRunning = false;
let animationFrameId;

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
        color: '#3498db'
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
    // Ground platform
    platforms.push({
        x: 0,
        y: canvas.height - PLATFORM_HEIGHT,
        width: canvas.width,
        height: PLATFORM_HEIGHT,
        color: '#2ecc71'
    });
    
    // Add some floating platforms
    platforms.push({
        x: canvas.width * 0.1,
        y: canvas.height * 0.7,
        width: canvas.width * 0.2,
        height: PLATFORM_HEIGHT,
        color: '#2ecc71'
    });
    
    platforms.push({
        x: canvas.width * 0.5,
        y: canvas.height * 0.5,
        width: canvas.width * 0.3,
        height: PLATFORM_HEIGHT,
        color: '#2ecc71'
    });
    
    platforms.push({
        x: canvas.width * 0.2,
        y: canvas.height * 0.3,
        width: canvas.width * 0.2,
        height: PLATFORM_HEIGHT,
        color: '#2ecc71'
    });
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
    
    // Update trail positions
    if (Math.abs(player.velocityX) > 0 || Math.abs(player.velocityY) > 0) {
        // Only update trail when player is moving
        trail.pop(); // Remove the last trail segment
        trail.unshift({ // Add new segment at the beginning
            x: player.x,
            y: player.y,
            width: player.width,
            height: player.height
        });
    }
    
    // Update player position
    player.x += player.velocityX;
    player.y += player.velocityY;
    
    // Check for platform collisions
    player.isJumping = true; // Assume we're in the air unless proven otherwise
    
    for (let platform of platforms) {
        // Check if player is on top of a platform
        if (player.velocityY > 0 &&
            player.x + player.width > platform.x &&
            player.x < platform.x + platform.width &&
            player.y + player.height >= platform.y &&
            player.y + player.height <= platform.y + player.velocityY + 5) {
            
            player.isJumping = false;
            player.velocityY = 0;
            player.y = platform.y - player.height;
        }
    }
    
    // Keep player within bounds
    if (player.x < 0) {
        player.x = 0;
    }
    if (player.x + player.width > canvas.width) {
        player.x = canvas.width - player.width;
    }
    
    // If player falls off the bottom, reset position
    if (player.y > canvas.height) {
        player.x = canvas.width / 2 - 25;
        player.y = 0;
        player.velocityY = 0;
    }
}

// Draw game elements
function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw platforms
    for (let platform of platforms) {
        ctx.fillStyle = platform.color;
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
    }
    
    // Draw trail
    for (let i = 0; i < trail.length; i++) {
        const segment = trail[i];
        // Calculate opacity based on position in trail (newer segments are more opaque)
        const opacity = 0.7 * (1 - i / TRAIL_LENGTH);
        // Get player color without the opacity
        const baseColor = player.color;
        
        // Draw trail segment with opacity
        ctx.fillStyle = `${baseColor}${Math.floor(opacity * 255).toString(16).padStart(2, '0')}`;
        
        // Make trail segments slightly smaller than the player
        const shrinkFactor = 1 - (i * 0.05);
        const widthAdjustment = segment.width * (1 - shrinkFactor) / 2;
        const heightAdjustment = segment.height * (1 - shrinkFactor) / 2;
        
        ctx.fillRect(
            segment.x + widthAdjustment,
            segment.y + heightAdjustment,
            segment.width * shrinkFactor,
            segment.height * shrinkFactor
        );
    }
    
    // Draw player
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);
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
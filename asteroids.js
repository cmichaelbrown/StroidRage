// Input handling
const keys = {};
document.addEventListener('keydown', (e) => {
    if (!gameStarted && (e.code === 'Space' || e.code === 'Enter')) {
        audioContext.resume();
        stopTitleMusic();
        startGame();
    }
    if (gameOver && (e.code === 'Space' || e.code === 'Enter')) {
        init();
        gameOver = false;
    }
    keys[e.key] = true;
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

document.addEventListener('click', () => {
    if (!gameStarted) {
        audioContext.resume();
        stopTitleMusic();
        startGame();
    }
    if (gameOver) {
        init();
        gameOver = false;
    }
});

class GameObject {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.velocityX = 0;
        this.velocityY = 0;
        this.rotation = 0;
    }

    update() {
        // Apply velocity (zero-G momentum)
        this.x += this.velocityX;
        this.y += this.velocityY;

        // Screen wrapping
        if (this.x < 0) this.x = canvas.width;
        if (this.x > canvas.width) this.x = 0;
        if (this.y < 0) this.y = canvas.height;
        if (this.y > canvas.height) this.y = 0;
    }
}

class Ship extends GameObject {
    constructor(x, y) {
        super(x, y, 15);
        this.thrustPower = 0.3; // Reduced from 0.5 for better control
        this.rotationSpeed = 0.1;
        this.friction = 0.99; // Slight friction for better control
        this.isThrusting = false;
        this.lastShot = null;
        startEngineSound();
    }

    update() {
        if (this.isThrusting) {
            // Apply thrust in direction of rotation
            this.velocityX += Math.cos(this.rotation) * this.thrustPower;
            this.velocityY += Math.sin(this.rotation) * this.thrustPower;
            updateEngineSound({ x: this.velocityX, y: this.velocityY });
        } else {
            stopEngineSound();
        }

        // Apply slight friction
        this.velocityX *= this.friction;
        this.velocityY *= this.friction;

        super.update();
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Draw ship
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-10, -10);
        ctx.lineTo(20, 0);
        ctx.lineTo(-10, 10);
        ctx.lineTo(-10, -10);
        ctx.stroke();

        // Draw thrust
        if (this.isThrusting) {
            ctx.beginPath();
            ctx.moveTo(-10, 0);
            ctx.lineTo(-20, 0);
            ctx.strokeStyle = '#ff4400';
            ctx.stroke();
        }

        ctx.restore();
    }
}

class Asteroid extends GameObject {
    constructor(x, y, radius) {
        super(x, y, radius);
        this.vertices = [];
        this.generateVertices();
        
        // Random velocity
        const speed = 1 + Math.random() * 2;
        const angle = Math.random() * Math.PI * 2;
        this.velocityX = Math.cos(angle) * speed;
        this.velocityY = Math.sin(angle) * speed;
        this.rotationSpeed = (Math.random() - 0.5) * 0.02;
    }

    generateVertices() {
        const vertices = Math.floor(Math.random() * 4) + 8;
        for (let i = 0; i < vertices; i++) {
            const angle = (i / vertices) * Math.PI * 2;
            const variance = 0.4;
            const distance = this.radius * (1 + (Math.random() * variance - variance/2));
            this.vertices.push({
                x: Math.cos(angle) * distance,
                y: Math.sin(angle) * distance
            });
        }
    }

    update() {
        super.update();
        this.rotation += this.rotationSpeed;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
        
        for (let i = 1; i < this.vertices.length; i++) {
            ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
        }
        
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
    }
}

class Bullet extends GameObject {
    constructor(x, y, rotation) {
        super(x, y, 2);
        const speed = 7;
        this.velocityX = Math.cos(rotation) * speed;
        this.velocityY = Math.sin(rotation) * speed;
        this.lifespan = 100;
    }

    update() {
        super.update();
        this.lifespan--;
    }

    draw(ctx) {
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

class UFOBullet extends GameObject {
    constructor(x, y, targetX, targetY) {
        super(x, y, 2);
        const angle = Math.atan2(targetY - y, targetX - x);
        const speed = 5;
        this.velocityX = Math.cos(angle) * speed;
        this.velocityY = Math.sin(angle) * speed;
        this.lifespan = 140;
    }

    update() {
        super.update();
        this.lifespan--;
    }

    draw(ctx) {
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

class UFO extends GameObject {
    constructor(x, y) {
        super(x, y, 20);
        this.velocityX = (Math.random() - 0.5) * 3;
        this.velocityY = (Math.random() - 0.5) * 3;
        this.lastShot = Date.now();
        this.shotInterval = 2000 + Math.random() * 1000;
        this.hitPoints = 2;
    }

    update(ship) {
        super.update();
        
        // Check if it's time to shoot
        if (Date.now() - this.lastShot > this.shotInterval) {
            // Create a new UFO bullet aimed at the ship
            const bullet = new UFOBullet(this.x, this.y, ship.x, ship.y);
            ufoBullets.push(bullet);
            this.lastShot = Date.now();
            this.shotInterval = 2000 + Math.random() * 1000;
            createUFOShootSound();
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Draw UFO body
        ctx.strokeStyle = this.hitPoints > 1 ? '#00ff00' : '#ff6600'; // Changes color when damaged
        ctx.lineWidth = 2;
        
        // Draw dome
        ctx.beginPath();
        ctx.ellipse(0, -5, 10, 6, 0, Math.PI, 0);
        ctx.stroke();
        
        // Draw saucer body
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 8, 0, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.restore();
    }
}

class BlackHole extends GameObject {
    constructor(x, y) {
        super(x, y, 25); // Slightly larger core
        this.velocityX = (Math.random() - 0.5) * 0.5;
        this.velocityY = (Math.random() - 0.5) * 0.5;
        this.innerRadius = 15;
        this.outerRadius = 250; // Increased gravitational field
        this.rotationAngle = 0;
        this.accretionDiskRadius = 35; // Radius for the accretion disk
    }

    update() {
        super.update();
        this.rotationAngle += 0.02;
        
        if (this.x < 0) this.x = canvas.width;
        if (this.x > canvas.width) this.x = 0;
        if (this.y < 0) this.y = canvas.height;
        if (this.y > canvas.height) this.y = 0;
    }

    applyGravity(object) {
        const dx = this.x - object.x;
        const dy = this.y - object.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < this.outerRadius) {
            let gravityStrength;
            if (distance < this.innerRadius * 2) {
                gravityStrength = 0.8; // Stronger pull when very close
            } else {
                gravityStrength = 0.3 * (1 - distance / this.outerRadius); // Increased base pull
            }
            
            const angle = Math.atan2(dy, dx);
            object.velocityX += Math.cos(angle) * gravityStrength;
            object.velocityY += Math.sin(angle) * gravityStrength;
            
            if (distance < this.innerRadius) {
                return true;
            }
        }
        return false;
    }

    draw(ctx) {
        ctx.save();
        
        // Draw outer gravitational field (more subtle)
        const gradient = ctx.createRadialGradient(
            this.x, this.y, this.innerRadius,
            this.x, this.y, this.outerRadius
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.8)');
        gradient.addColorStop(0.2, 'rgba(0, 0, 0, 0.4)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.outerRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw accretion disk
        const diskGradient = ctx.createRadialGradient(
            this.x, this.y, this.innerRadius,
            this.x, this.y, this.accretionDiskRadius
        );
        diskGradient.addColorStop(0, 'rgba(255, 150, 0, 0.8)');
        diskGradient.addColorStop(0.5, 'rgba(255, 50, 0, 0.4)');
        diskGradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
        
        ctx.fillStyle = diskGradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.accretionDiskRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw the black hole core
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.innerRadius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
}

class Comet extends GameObject {
    constructor(startSide) {
        let x, y;
        const speed = 10;
        
        switch(startSide) {
            case 'left':
                x = -50;
                y = Math.random() * canvas.height;
                break;
            case 'right':
                x = canvas.width + 50;
                y = Math.random() * canvas.height;
                break;
            case 'top':
                x = Math.random() * canvas.width;
                y = -50;
                break;
            case 'bottom':
                x = Math.random() * canvas.width;
                y = canvas.height + 50;
                break;
        }
        
        super(x, y, 20);
        
        // Target the player's current position
        const angle = Math.atan2(ship.y - y, ship.x - x);
        this.velocityX = Math.cos(angle) * speed;
        this.velocityY = Math.sin(angle) * speed;
        
        this.trail = [];
        this.maxTrailLength = 20;
        this.active = true;
        this.rotation = angle;
        
        // Star points
        this.starPoints = 5;
        this.starOuterRadius = this.radius * 1.2;
        this.starInnerRadius = this.radius * 0.5;
        
        // Trailing points
        this.trailingPoints = [
            { length: this.radius * 2.5, width: this.radius * 0.8 },
            { length: this.radius * 2.0, width: this.radius * 0.6 },
            { length: this.radius * 1.5, width: this.radius * 0.4 }
        ];
        
        // Particles for the trail effect
        this.particles = [];
        this.maxParticles = 40;
    }

    drawStar(ctx, cx, cy, outerRadius, innerRadius, points) {
        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i * Math.PI) / points - Math.PI / 2 + this.rotation;
            const x = cx + Math.cos(angle) * radius;
            const y = cy + Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
    }

    update() {
        this.x += this.velocityX;
        this.y += this.velocityY;

        // Generate particles
        if (Math.random() < 0.3) {
            const angle = Math.PI + this.rotation + (Math.random() - 0.5) * 0.5;
            const distance = Math.random() * this.radius * 2;
            this.particles.push({
                x: this.x - Math.cos(this.rotation) * distance,
                y: this.y - Math.sin(this.rotation) * distance,
                size: Math.random() * 3 + 2,
                life: 1,
                vx: (Math.random() - 0.5) - this.velocityX * 0.1,
                vy: (Math.random() - 0.5) - this.velocityY * 0.1
            });
        }

        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life -= 0.02;
            if (particle.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        if (this.particles.length > this.maxParticles) {
            this.particles.splice(0, this.particles.length - this.maxParticles);
        }

        if (this.x < -100 || this.x > canvas.width + 100 || 
            this.y < -100 || this.y > canvas.height + 100) {
            this.active = false;
        }
    }

    draw(ctx) {
        // Draw particles
        this.particles.forEach(particle => {
            const gradient = ctx.createRadialGradient(
                particle.x, particle.y, 0,
                particle.x, particle.y, particle.size
            );
            gradient.addColorStop(0, `rgba(255, 200, 100, ${particle.life * 0.7})`);
            gradient.addColorStop(1, 'rgba(255, 150, 50, 0)');
            
            ctx.beginPath();
            ctx.fillStyle = gradient;
            ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            ctx.fill();
        });

        // Draw trailing points (tail)
        this.trailingPoints.forEach((point, index) => {
            ctx.beginPath();
            const tailAngle = Math.PI + this.rotation;
            const x2 = this.x + Math.cos(tailAngle) * point.length;
            const y2 = this.y + Math.sin(tailAngle) * point.length;
            
            // Create a triangular shape for each trailing point
            const spread = point.width;
            const perpAngle = tailAngle + Math.PI/2;
            const x3 = x2 + Math.cos(perpAngle) * spread;
            const x4 = x2 - Math.cos(perpAngle) * spread;
            const y3 = y2 + Math.sin(perpAngle) * spread;
            const y4 = y2 - Math.sin(perpAngle) * spread;
            
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(x3, y3);
            ctx.lineTo(x4, y4);
            ctx.closePath();
            
            ctx.fillStyle = `rgba(255, 140, 0, ${0.8 - index * 0.2})`;
            ctx.fill();
        });

        // Draw star head
        this.drawStar(ctx, this.x, this.y, this.starOuterRadius, this.starInnerRadius, this.starPoints);
        ctx.fillStyle = '#FFE135'; // Bright yellow
        ctx.fill();
        
        // Add star glow
        const glow = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, this.radius * 2
        );
        glow.addColorStop(0, 'rgba(255, 255, 100, 0.3)');
        glow.addColorStop(1, 'rgba(255, 200, 0, 0)');
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 2, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
    }
}

class Star {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2;
        this.brightness = Math.random();
        this.twinkleSpeed = 0.03 + Math.random() * 0.05;
        this.twinklePhase = Math.random() * Math.PI * 2;
    }

    update() {
        // Update twinkle phase
        this.twinklePhase += this.twinkleSpeed;
        if (this.twinklePhase > Math.PI * 2) {
            this.twinklePhase -= Math.PI * 2;
        }
    }

    draw(ctx) {
        // Calculate current brightness with twinkling effect
        const twinkleFactor = (Math.sin(this.twinklePhase) + 1) * 0.3;
        const currentBrightness = Math.min(1, this.brightness + twinkleFactor);
        
        // Draw star with gradient for more realistic glow
        const gradient = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, this.size * 2
        );
        
        gradient.addColorStop(0, `rgba(255, 255, 255, ${currentBrightness})`);
        gradient.addColorStop(0.5, `rgba(255, 255, 255, ${currentBrightness * 0.5})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.beginPath();
        ctx.fillStyle = gradient;
        ctx.arc(this.x, this.y, this.size * 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Game setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Mobile controls
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');
const thrustBtn = document.getElementById('thrustBtn');
const shootBtn = document.getElementById('shootBtn');

// Responsive canvas sizing
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// Initial resize
resizeCanvas();

// Handle window resize
window.addEventListener('resize', () => {
    resizeCanvas();
});

// Audio Context setup
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Engine sound setup
let engineOscillator = null;
let engineGain = null;

function startEngineSound() {
    if (engineOscillator === null) {
        engineOscillator = audioContext.createOscillator();
        engineGain = audioContext.createGain();
        
        // Create a second oscillator for a subtle harmonic
        const secondOscillator = audioContext.createOscillator();
        const secondGain = audioContext.createGain();
        
        // Main oscillator (very low frequency)
        engineOscillator.type = 'square';
        engineOscillator.frequency.setValueAtTime(30, audioContext.currentTime);
        
        // Second oscillator (slight harmonic)
        secondOscillator.type = 'square';
        secondOscillator.frequency.setValueAtTime(45, audioContext.currentTime);
        secondGain.gain.setValueAtTime(0.1, audioContext.currentTime); // Very quiet harmonic
        
        engineGain.gain.setValueAtTime(0, audioContext.currentTime);
        
        // Connect oscillators
        engineOscillator.connect(engineGain);
        secondOscillator.connect(secondGain);
        secondGain.connect(engineGain);
        engineGain.connect(audioContext.destination);
        
        engineOscillator.start();
        secondOscillator.start();
        
        // Store second oscillator for cleanup
        engineOscillator.secondOscillator = secondOscillator;
        engineOscillator.secondGain = secondGain;
    }
}

function updateEngineSound(velocity) {
    if (engineOscillator && engineGain) {
        const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
        
        // Stepped frequency changes (much lower range)
        const baseFreq = Math.floor(speed * 10) * 2 + 30; // Steps of 2Hz, starting at 30Hz
        const secondFreq = baseFreq * 1.5;
        
        // Much lower volume
        const volume = Math.min(0.03, Math.floor(speed * 5) / 5 * 0.03);
        
        // Quick transitions for chunky changes
        engineOscillator.frequency.setTargetAtTime(baseFreq, audioContext.currentTime, 0.05);
        engineOscillator.secondOscillator.frequency.setTargetAtTime(secondFreq, audioContext.currentTime, 0.05);
        engineGain.gain.setTargetAtTime(volume, audioContext.currentTime, 0.05);
    }
}

function stopEngineSound() {
    if (engineGain) {
        engineGain.gain.setTargetAtTime(0, audioContext.currentTime, 0.05);
    }
}

function createShootSound() {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    const delay = audioContext.createDelay();
    delay.delayTime.value = 0.05;
    const delayGain = audioContext.createGain();
    delayGain.gain.value = 0.2;
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    gainNode.connect(delay);
    delay.connect(delayGain);
    delayGain.connect(audioContext.destination);
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.15);
}

function createUFOShootSound() {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
}

function createExplosionSound() {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.2, audioContext.sampleRate);
    const noise = noiseBuffer.getChannelData(0);
    
    for (let i = 0; i < noiseBuffer.length; i++) {
        noise[i] = Math.random() * 2 - 1;
    }
    
    const noiseSource = audioContext.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    
    const noiseGain = audioContext.createGain();
    noiseGain.gain.setValueAtTime(1, audioContext.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    
    noiseSource.connect(noiseGain);
    noiseGain.connect(audioContext.destination);
    
    noiseSource.start();
}

function createCrashSound() {
    // Create audio nodes
    const noiseLength = 0.5;
    const bufferSize = audioContext.sampleRate * noiseLength;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Generate noise with decreasing amplitude
    for (let i = 0; i < bufferSize; i++) {
        const progress = i / bufferSize;
        data[i] = (Math.random() * 2 - 1) * (1 - progress * 0.95);
    }
    
    // Noise source
    const noiseSource = audioContext.createBufferSource();
    noiseSource.buffer = buffer;
    
    // Main explosion oscillator
    const explosionOsc = audioContext.createOscillator();
    explosionOsc.type = 'sawtooth';
    explosionOsc.frequency.setValueAtTime(200, audioContext.currentTime);
    explosionOsc.frequency.exponentialRampToValueAtTime(40, audioContext.currentTime + 0.4);
    
    // Secondary oscillator for metallic effect
    const metallicOsc = audioContext.createOscillator();
    metallicOsc.type = 'square';
    metallicOsc.frequency.setValueAtTime(300, audioContext.currentTime);
    metallicOsc.frequency.linearRampToValueAtTime(100, audioContext.currentTime + 0.3);
    
    // Gain nodes
    const noiseGain = audioContext.createGain();
    const explosionGain = audioContext.createGain();
    const metallicGain = audioContext.createGain();
    const masterGain = audioContext.createGain();
    
    // Set volumes
    noiseGain.gain.setValueAtTime(0.5, audioContext.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
    
    explosionGain.gain.setValueAtTime(0.5, audioContext.currentTime);
    explosionGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
    
    metallicGain.gain.setValueAtTime(0.3, audioContext.currentTime);
    metallicGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    masterGain.gain.setValueAtTime(0.7, audioContext.currentTime);
    
    // Connect nodes
    noiseSource.connect(noiseGain);
    explosionOsc.connect(explosionGain);
    metallicOsc.connect(metallicGain);
    
    noiseGain.connect(masterGain);
    explosionGain.connect(masterGain);
    metallicGain.connect(masterGain);
    
    masterGain.connect(audioContext.destination);
    
    // Start sounds
    noiseSource.start();
    explosionOsc.start();
    metallicOsc.start();
    
    // Stop after duration
    noiseSource.stop(audioContext.currentTime + 0.5);
    explosionOsc.stop(audioContext.currentTime + 0.5);
    metallicOsc.stop(audioContext.currentTime + 0.5);
}

// Title screen music
let titleMusic = {
    oscillators: [],
    gainNodes: []
};

function playTitleMusic() {
    const notes = [
        // Opening fanfare
        { freq: 196.00, time: 0.0, duration: 0.3 },   // G3
        { freq: 246.94, time: 0.3, duration: 0.3 },   // B3
        { freq: 293.66, time: 0.6, duration: 0.4 },   // D4
        
        // Descending arpeggio
        { freq: 392.00, time: 1.2, duration: 0.2 },   // G4
        { freq: 329.63, time: 1.4, duration: 0.2 },   // E4
        { freq: 293.66, time: 1.6, duration: 0.2 },   // D4
        { freq: 246.94, time: 1.8, duration: 0.2 },   // B3
        
        // Final notes
        { freq: 196.00, time: 2.2, duration: 0.4 },   // G3
        { freq: 293.66, time: 2.6, duration: 0.6 }    // D4
    ];

    const startTime = audioContext.currentTime;
    
    notes.forEach(note => {
        // Main oscillator (square wave for melody)
        const osc = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(note.freq, startTime + note.time);
        
        gainNode.gain.setValueAtTime(0, startTime + note.time);
        gainNode.gain.linearRampToValueAtTime(0.2, startTime + note.time + 0.05);
        gainNode.gain.linearRampToValueAtTime(0, startTime + note.time + note.duration);
        
        osc.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Add a subtle sub-oscillator for depth
        const subOsc = audioContext.createOscillator();
        const subGain = audioContext.createGain();
        
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(note.freq / 2, startTime + note.time);
        
        subGain.gain.setValueAtTime(0, startTime + note.time);
        subGain.gain.linearRampToValueAtTime(0.1, startTime + note.time + 0.05);
        subGain.gain.linearRampToValueAtTime(0, startTime + note.time + note.duration);
        
        subOsc.connect(subGain);
        subGain.connect(audioContext.destination);
        
        osc.start(startTime + note.time);
        osc.stop(startTime + note.time + note.duration);
        subOsc.start(startTime + note.time);
        subOsc.stop(startTime + note.time + note.duration);
        
        titleMusic.oscillators.push(osc, subOsc);
        titleMusic.gainNodes.push(gainNode, subGain);
    });
}

function stopTitleMusic() {
    titleMusic.oscillators.forEach(osc => {
        try {
            osc.stop();
            osc.disconnect();
        } catch (e) {
            // Oscillator might already be stopped
        }
    });
    titleMusic.gainNodes.forEach(gain => gain.disconnect());
    titleMusic.oscillators = [];
    titleMusic.gainNodes = [];
}

// Initialize game when clicking start or pressing keys
document.addEventListener('keydown', (e) => {
    if (!gameStarted && (e.code === 'Space' || e.code === 'Enter')) {
        audioContext.resume();
        stopTitleMusic();
        startGame();
    }
    if (gameOver && (e.code === 'Space' || e.code === 'Enter')) {
        init();
        gameOver = false;
    }
    keys[e.key] = true;
});

document.addEventListener('click', () => {
    if (!gameStarted) {
        audioContext.resume();
        stopTitleMusic();
        startGame();
    }
    if (gameOver) {
        init();
        gameOver = false;
    }
});

// Play title music when page loads
window.addEventListener('load', () => {
    audioContext.resume().then(() => {
        playTitleMusic();
    });
});

// Mobile control state
const mobileControls = {
    left: false,
    right: false,
    thrust: false,
    shoot: false
};

// Touch event handlers
function handleTouchStart(element, control) {
    element.addEventListener('touchstart', (e) => {
        e.preventDefault();
        mobileControls[control] = true;
    });
}

function handleTouchEnd(element, control) {
    element.addEventListener('touchend', (e) => {
        e.preventDefault();
        mobileControls[control] = false;
    });
}

// Setup mobile controls
handleTouchStart(leftBtn, 'left');
handleTouchEnd(leftBtn, 'left');
handleTouchStart(rightBtn, 'right');
handleTouchEnd(rightBtn, 'right');
handleTouchStart(thrustBtn, 'thrust');
handleTouchEnd(thrustBtn, 'thrust');
handleTouchStart(shootBtn, 'shoot');
handleTouchEnd(shootBtn, 'shoot');

// Game state
let ship;
let asteroids = [];
let bullets = [];
let ufoBullets = [];
let score = 0;
let ufoKills = 0;
let lives = 3;
let gameOver = false;
let ufo = null;
let blackHole = null;
let comet = null;
let lastUFOSpawn = 0;
let ufoSpawnInterval = 15000 + Math.random() * 10000;
let lastCometSpawn = Date.now();
let cometSpawnInterval = 15000; // Reduced to 15 seconds
let gameStarted = false;
let stars = [];
const NUM_STARS = 150;

function startGame() {
    const titleScreen = document.getElementById('titleScreen');
    titleScreen.classList.add('hidden');
    gameStarted = true;
    init();
    gameLoop();
}

// Initialize game when clicking start
document.querySelector('.start-prompt').addEventListener('click', () => {
    if (!gameStarted) {
        audioContext.resume();
        stopTitleMusic();
        startGame();
    }
});

function init() {
    // Remove game over screen if it exists
    const gameOverScreen = document.querySelector('.game-over');
    if (gameOverScreen) {
        gameOverScreen.remove();
    }

    // Stop any existing engine sound
    stopEngineSound();
    if (engineOscillator) {
        engineOscillator.secondOscillator.stop();
        engineOscillator.stop();
        engineOscillator = null;
        engineGain = null;
    }

    ship = new Ship(canvas.width / 2, canvas.height / 2);
    asteroids = [];
    bullets = [];
    ufoBullets = [];
    score = 0;
    ufoKills = 0;
    lives = 3;
    gameOver = false;
    ufo = null;
    blackHole = null;
    comet = null;
    lastUFOSpawn = Date.now();
    ufoSpawnInterval = 15000 + Math.random() * 10000;
    lastCometSpawn = Date.now();

    for (let i = 0; i < 5; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        asteroids.push(new Asteroid(x, y, 30 + Math.random() * 20));
    }

    // Initialize stars
    stars = Array(NUM_STARS).fill().map(() => new Star());
}

function checkCollisions() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        if (ufo) {
            const dx = bullets[i].x - ufo.x;
            const dy = bullets[i].y - ufo.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < ufo.radius + bullets[i].radius) {
                ufo.hitPoints--;
                bullets.splice(i, 1);
                createExplosionSound();
                
                if (ufo.hitPoints <= 0) {
                    score += 500;
                    ufoKills++;
                    ufo = null;
                }
                continue;
            }
        }

        for (let j = asteroids.length - 1; j >= 0; j--) {
            const dx = bullets[i].x - asteroids[j].x;
            const dy = bullets[i].y - asteroids[j].y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < asteroids[j].radius + bullets[i].radius) {
                if (asteroids[j].radius > 20) {
                    for (let k = 0; k < 2; k++) {
                        asteroids.push(new Asteroid(
                            asteroids[j].x,
                            asteroids[j].y,
                            asteroids[j].radius / 2
                        ));
                    }
                }
                
                asteroids.splice(j, 1);
                bullets.splice(i, 1);
                score += 100;
                createExplosionSound();
                break;
            }
        }
    }

    if (!gameOver) {
        for (let asteroid of asteroids) {
            const dx = ship.x - asteroid.x;
            const dy = ship.y - asteroid.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < asteroid.radius + ship.radius) {
                createCrashSound();
                lives--;
                if (lives <= 0) {
                    gameOver = true;
                } else {
                    ship.x = canvas.width / 2;
                    ship.y = canvas.height / 2;
                    ship.velocityX = 0;
                    ship.velocityY = 0;
                }
                break;
            }
        }
    }

    if (!gameOver && ufo) {
        const dx = ship.x - ufo.x;
        const dy = ship.y - ufo.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < ufo.radius + ship.radius) {
            createCrashSound();
            lives--;
            if (lives <= 0) {
                gameOver = true;
            } else {
                ship.x = canvas.width / 2;
                ship.y = canvas.height / 2;
                ship.velocityX = 0;
                ship.velocityY = 0;
            }
            ufo = null;
        }
    }

    for (let i = ufoBullets.length - 1; i >= 0; i--) {
        const dx = ship.x - ufoBullets[i].x;
        const dy = ship.y - ufoBullets[i].y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < ship.radius + ufoBullets[i].radius) {
            createCrashSound();
            lives--;
            ufoBullets.splice(i, 1);
            
            if (lives <= 0) {
                gameOver = true;
            } else {
                ship.x = canvas.width / 2;
                ship.y = canvas.height / 2;
                ship.velocityX = 0;
                ship.velocityY = 0;
            }
            break;
        }
    }

    if (!gameOver && comet) {
        if (comet.active) {
            const dx = ship.x - comet.x;
            const dy = ship.y - comet.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < comet.radius + ship.radius) {
                createCrashSound();
                lives--;
                comet.active = false; // Deactivate the comet after collision
                
                if (lives <= 0) {
                    gameOver = true;
                } else {
                    ship.x = canvas.width / 2;
                    ship.y = canvas.height / 2;
                    ship.velocityX = 0;
                    ship.velocityY = 0;
                }
            }
        }
    }
}

function update() {
    if (!gameStarted) return;
    
    if (!ufo && Date.now() - lastUFOSpawn > ufoSpawnInterval) {
        let x, y;
        if (Math.random() < 0.5) {
            x = Math.random() < 0.5 ? -20 : canvas.width + 20;
            y = Math.random() * canvas.height;
        } else {
            x = Math.random() * canvas.width;
            y = Math.random() < 0.5 ? -20 : canvas.height + 20;
        }
        ufo = new UFO(x, y);
        lastUFOSpawn = Date.now();
        ufoSpawnInterval = 15000 + Math.random() * 10000;
    }

    if (ufo) {
        ufo.update(ship);
    }

    ship.isThrusting = keys['ArrowUp'] || mobileControls.thrust;
    if (keys['ArrowLeft'] || mobileControls.left) ship.rotation -= ship.rotationSpeed;
    if (keys['ArrowRight'] || mobileControls.right) ship.rotation += ship.rotationSpeed;
    if (keys[' '] || mobileControls.shoot) {
        if (!ship.lastShot || Date.now() - ship.lastShot > 250) {
            bullets.push(new Bullet(ship.x, ship.y, ship.rotation));
            ship.lastShot = Date.now();
            createShootSound();
        }
    }
    ship.update();

    asteroids.forEach(asteroid => asteroid.update());
    bullets = bullets.filter(bullet => {
        bullet.update();
        return bullet.lifespan > 0;
    });
    ufoBullets = ufoBullets.filter(bullet => {
        bullet.update();
        return bullet.lifespan > 0;
    });

    checkCollisions();

    if (asteroids.length < 5 && Math.random() < 0.01) {
        const side = Math.floor(Math.random() * 4);
        let x, y;
        switch(side) {
            case 0: x = 0; y = Math.random() * canvas.height; break;
            case 1: x = canvas.width; y = Math.random() * canvas.height; break;
            case 2: x = Math.random() * canvas.width; y = 0; break;
            case 3: x = Math.random() * canvas.width; y = canvas.height; break;
        }
        asteroids.push(new Asteroid(x, y, 30 + Math.random() * 20));
    }

    // Spawn black hole after score reaches 1000
    if (score >= 1000 && !blackHole && Math.random() < 0.001) {
        // Spawn away from the player
        let x, y;
        do {
            x = Math.random() * canvas.width;
            y = Math.random() * canvas.height;
        } while (Math.abs(x - ship.x) < 200 && Math.abs(y - ship.y) < 200);
        
        blackHole = new BlackHole(x, y);
    }

    if (blackHole) {
        blackHole.update();
        
        // Apply gravity to ship
        if (ship && blackHole.applyGravity(ship)) {
            createCrashSound();
            lives--;
            if (lives <= 0) {
                gameOver = true;
            } else {
                ship = new Ship(canvas.width / 2, canvas.height / 2);
            }
        }
        
        // Apply gravity to asteroids
        asteroids.forEach(asteroid => {
            if (blackHole.applyGravity(asteroid)) {
                const index = asteroids.indexOf(asteroid);
                if (index > -1) {
                    asteroids.splice(index, 1);
                }
            }
        });
        
        // Apply gravity to bullets
        bullets.forEach((bullet, index) => {
            if (blackHole.applyGravity(bullet)) {
                bullets.splice(index, 1);
            }
        });
        
        // Apply gravity to UFO and its bullets
        if (ufo && blackHole.applyGravity(ufo)) {
            score += 200;
            ufoKills++;
            createExplosionSound();
            ufo = null;
        }
        
        ufoBullets.forEach((bullet, index) => {
            if (blackHole.applyGravity(bullet)) {
                ufoBullets.splice(index, 1);
            }
        });
    }

    // Comet spawning
    if (!comet && Date.now() - lastCometSpawn > cometSpawnInterval) {
        const sides = ['left', 'right', 'top', 'bottom'];
        const startSide = sides[Math.floor(Math.random() * sides.length)];
        comet = new Comet(startSide);
        lastCometSpawn = Date.now();
    }

    // Update comet
    if (comet) {
        comet.update();
        
        // Apply black hole gravity if present
        if (blackHole) {
            blackHole.applyGravity(comet);
        }
        
        if (!comet.active) {
            comet = null;
        }
    }

    // Update stars
    stars.forEach(star => star.update());
}

function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw stars first (behind everything else)
    stars.forEach(star => star.draw(ctx));
    
    if (!gameStarted) {
        return;
    }

    if (blackHole) {
        blackHole.draw(ctx);
    }
    if (ship) ship.draw(ctx);
    if (ufo) ufo.draw(ctx);
    asteroids.forEach(asteroid => asteroid.draw(ctx));
    bullets.forEach(bullet => bullet.draw(ctx));
    ufoBullets.forEach(bullet => bullet.draw(ctx));
    if (comet) comet.draw(ctx);

    // Update score and lives display
    document.getElementById('score').textContent = `Score: ${score}`;
    document.getElementById('ufoKills').textContent = `UFOs: ${ufoKills}`;
    document.getElementById('lives').textContent = `Lives: ${lives}`;
    
    if (gameOver) {
        // Remove any existing game over screen first
        const existingGameOver = document.querySelector('.game-over');
        if (existingGameOver) {
            existingGameOver.remove();
        }

        // Draw game over screen
        const gameOverScreen = document.createElement('div');
        gameOverScreen.className = 'game-over';
        gameOverScreen.innerHTML = `
            <div class="game-over-title">GAME OVER</div>
            <div class="final-score">FINAL SCORE: ${score}</div>
            <div class="final-score">UFOs DESTROYED: ${ufoKills}</div>
            <div class="start-prompt">PRESS SPACE OR CLICK TO RESTART</div>
        `;
        
        document.body.appendChild(gameOverScreen);
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Handle game over restart
document.addEventListener('click', (e) => {
    if (gameOver && gameStarted && e.target.classList.contains('start-prompt')) {
        init();
        gameOver = false;
    }
});

/**
 * PokeVR - WebVR Catching Game Logic
 * Built with A-Frame 1.6.0
 */

// Global Game State
const gameManager = {
  thrownCount: 0,
  caughtCount: 0,
  gameState: 'idle', // 'idle', 'catching', 'caught', 'escaped'
  pokemonPos: new THREE.Vector3(0, 0.8, -3), // Original pokemon position
  
  incrementThrown() {
    this.thrownCount++;
    document.getElementById('thrown-count').innerText = this.thrownCount;
  },
  
  incrementCaught() {
    this.caughtCount++;
    document.getElementById('caught-count').innerText = this.caughtCount;
  },
  
  setStatus(text, color) {
    const statusText = document.getElementById('status-text');
    statusText.innerText = text;
    if (color) statusText.style.color = color;
  }
};

// ==========================================
// 1. RETRO AUDIO SYNTHESISER (Web Audio API)
// ==========================================
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// Sound: Throwing a Pokéball (rising sine wave sweep)
function playThrowSound() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(180, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(750, audioCtx.currentTime + 0.25);
  
  gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.25);
}

// Sound: Pokéball impact or bounce (short burst + low thud)
function playHitSound(volume = 0.2) {
  if (!audioCtx) return;
  // Bass thud
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(150, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.15);
  
  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.15);
  
  // Noise burst for impact texture
  const bufferSize = audioCtx.sampleRate * 0.05; // 50ms
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  
  const noiseFilter = audioCtx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = 1000;
  
  const noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(volume * 0.4, audioCtx.currentTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
  
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(audioCtx.destination);
  noise.start();
  noise.stop(audioCtx.currentTime + 0.05);
}

// Sound: Pokemon getting sucked into the ball (whirling noise)
function playSuckInSound() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(800, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.6);
  
  // Create a filter sweep for extra sci-fi feel
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2000, audioCtx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.6);
  
  gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
  
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.start();
  osc.stop(audioCtx.currentTime + 0.6);
}

// Sound: Pokéball wobble on the ground (double click)
function playWobbleSound() {
  if (!audioCtx) return;
  
  const playClick = (delay) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, audioCtx.currentTime + delay);
    osc.frequency.setValueAtTime(250, audioCtx.currentTime + delay + 0.02);
    
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + 0.05);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(audioCtx.currentTime + delay);
    osc.stop(audioCtx.currentTime + delay + 0.05);
  };
  
  playClick(0);
  playClick(0.08);
}

// Sound: Pokemon escapes from Pokéball (downward buzzer sound)
function playEscapeSound() {
  if (!audioCtx) return;
  const osc1 = audioCtx.createOscillator();
  const osc2 = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc1.type = 'sawtooth';
  osc2.type = 'triangle';
  
  osc1.frequency.setValueAtTime(220, audioCtx.currentTime);
  osc1.frequency.linearRampToValueAtTime(80, audioCtx.currentTime + 0.4);
  
  osc2.frequency.setValueAtTime(223, audioCtx.currentTime); // slightly detuned
  osc2.frequency.linearRampToValueAtTime(81, audioCtx.currentTime + 0.4);
  
  gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
  
  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc1.start();
  osc2.start();
  osc1.stop(audioCtx.currentTime + 0.4);
  osc2.stop(audioCtx.currentTime + 0.4);
}

// Sound: Pokemon caught successfully (victory fanfare!)
function playSuccessSound() {
  if (!audioCtx) return;
  
  const notes = [
    { freq: 523.25, time: 0 },    // C5
    { freq: 659.25, time: 0.08 }, // E5
    { freq: 783.99, time: 0.16 }, // G5
    { freq: 1046.50, time: 0.24 },// C6
    { freq: 1046.50, time: 0.40 } // C6 (long note)
  ];
  
  notes.forEach((note, index) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(note.freq, audioCtx.currentTime + note.time);
    
    gain.gain.setValueAtTime(0, audioCtx.currentTime + note.time);
    gain.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + note.time + 0.02);
    
    const duration = index === notes.length - 1 ? 0.5 : 0.08;
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime + note.time + duration);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + note.time + duration + 0.05);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(audioCtx.currentTime + note.time);
    osc.stop(audioCtx.currentTime + note.time + duration + 0.05);
  });
}


// ==========================================
// 2. PROCEDURAL ASSETS GENERATOR
// ==========================================

// Generate Floor Grid Texture dynamically to avoid loading static files
function generateGrid() {
  const canvas = document.getElementById('grid-canvas');
  const ctx = canvas.getContext('2d');
  
  // Background dark blue-gray
  ctx.fillStyle = '#0a0c10';
  ctx.fillRect(0, 0, 128, 128);
  
  // Radial glow gradient center
  ctx.strokeStyle = '#1e2436';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, 128, 128);
  
  // Glowing dots at intersections
  ctx.fillStyle = '#ff3e3e';
  ctx.fillRect(0, 0, 2, 2);
  ctx.fillRect(126, 0, 2, 2);
  ctx.fillRect(0, 126, 2, 2);
  ctx.fillRect(126, 126, 2, 2);
  
  // Set as src on the floor plane
  const floor = document.getElementById('floor');
  floor.setAttribute('src', '#' + canvas.id);
}

// Function to dynamically build the 3D PokeBall model
function buildPokeballVisuals(parentElement) {
  // 1. Red Top Half Sphere
  const top = document.createElement('a-sphere');
  top.setAttribute('color', '#ff3e3e');
  top.setAttribute('radius', '0.12');
  top.setAttribute('theta-length', '90');
  top.setAttribute('position', '0 0 0');
  
  // 2. White Bottom Half Sphere
  const bottom = document.createElement('a-sphere');
  bottom.setAttribute('color', '#ffffff');
  bottom.setAttribute('radius', '0.12');
  bottom.setAttribute('theta-start', '90');
  bottom.setAttribute('theta-length', '90');
  bottom.setAttribute('position', '0 0 0');
  
  // 3. Black Middle Ring
  const band = document.createElement('a-cylinder');
  band.setAttribute('color', '#222222');
  band.setAttribute('radius', '0.121');
  band.setAttribute('height', '0.012');
  band.setAttribute('position', '0 0 0');
  
  // 4. Outer Black Button Cylinder (protruding forward)
  const buttonBorder = document.createElement('a-cylinder');
  buttonBorder.setAttribute('color', '#222222');
  buttonBorder.setAttribute('radius', '0.026');
  buttonBorder.setAttribute('height', '0.015');
  buttonBorder.setAttribute('rotation', '90 0 0');
  buttonBorder.setAttribute('position', '0 0 0.115');
  
  // 5. Inner White Button Cylinder (protrudes slightly more)
  const buttonInner = document.createElement('a-cylinder');
  buttonInner.setAttribute('color', '#ffffff');
  buttonInner.setAttribute('radius', '0.014');
  buttonInner.setAttribute('height', '0.018');
  buttonInner.setAttribute('rotation', '90 0 0');
  buttonInner.setAttribute('position', '0 0 0.117');
  
  // Append all parts to container
  parentElement.appendChild(top);
  parentElement.appendChild(bottom);
  parentElement.appendChild(band);
  parentElement.appendChild(buttonBorder);
  parentElement.appendChild(buttonInner);
}


// ==========================================
// 3. A-FRAME COMPONENTS
// ==========================================

/**
 * Component attached to VR Controllers to handle aiming/throwing.
 * Computes velocity vector from controller trajectory on release.
 */
AFRAME.registerComponent('throw-spawner', {
  init: function () {
    this.history = [];
    this.isHolding = false;
    this.aimBall = null;
    
    // Bind hand trigger event listeners
    this.el.addEventListener('triggerdown', this.onTriggerDown.bind(this));
    this.el.addEventListener('triggerup', this.onTriggerUp.bind(this));
  },
  
  onTriggerDown: function () {
    if (gameManager.gameState !== 'idle') return;
    initAudio();
    
    this.isHolding = true;
    this.history = [];
    
    // Spawn static visual Pokéball held in hand
    this.aimBall = document.createElement('a-entity');
    buildPokeballVisuals(this.aimBall);
    this.el.appendChild(this.aimBall);
  },
  
  onTriggerUp: function () {
    if (!this.isHolding) return;
    this.isHolding = false;
    
    // Remove ball from hand
    if (this.aimBall) {
      this.el.removeChild(this.aimBall);
      this.aimBall = null;
    }
    
    // Compute throw vector from velocity history
    let throwVelocity = new THREE.Vector3();
    
    if (this.history.length >= 3) {
      // Average velocity over tracked frames
      const oldest = this.history[0];
      const newest = this.history[this.history.length - 1];
      const dt = (newest.time - oldest.time) / 1000; // seconds
      
      if (dt > 0.05) {
        throwVelocity.subVectors(newest.pos, oldest.pos).divideScalar(dt);
        // Add comfort multiplier (VR speeds feel faster than model spaces)
        throwVelocity.multiplyScalar(1.2);
        
        // Cap maximum velocity for gameplay comfort
        const maxSpeed = 16;
        if (throwVelocity.length() > maxSpeed) {
          throwVelocity.normalize().multiplyScalar(maxSpeed);
        }
      }
    }
    
    // Fallback: If swing velocity is too small (e.g., stationary click), throw forward
    if (throwVelocity.length() < 1.0) {
      const direction = new THREE.Vector3(0, 0, -1);
      // Get hand rotation
      direction.applyQuaternion(this.el.object3D.quaternion);
      throwVelocity.copy(direction).multiplyScalar(7.5); // base speed of 7.5 m/s
    }
    
    // Get spawning point (world position of hand)
    const spawnPos = new THREE.Vector3();
    this.el.object3D.getWorldPosition(spawnPos);
    
    // Spawn active flying Pokéball
    spawnFlyingBall(spawnPos, throwVelocity);
    
    this.history = [];
  },
  
  tick: function () {
    if (!this.isHolding) return;
    
    // Record controller hand world position
    const handPos = new THREE.Vector3();
    this.el.object3D.getWorldPosition(handPos);
    
    this.history.push({
      pos: handPos,
      time: performance.now()
    });
    
    // Limit queue size to capture only the last 6 frames (~100ms)
    if (this.history.length > 6) {
      this.history.shift();
    }
  }
});

/**
 * Component attached to the flying Pokéball entity.
 * Handles custom gravity, bounce physics, collision checking, and the catch sequence.
 */
AFRAME.registerComponent('thrown-ball', {
  schema: {
    vx: { type: 'number', default: 0 },
    vy: { type: 'number', default: 0 },
    vz: { type: 'number', default: 0 }
  },
  
  init: function () {
    this.velocity = new THREE.Vector3(this.data.vx, this.data.vy, this.data.vz);
    this.state = 'flying'; // 'flying', 'collided', 'dropping', 'shaking', 'settled'
    this.radius = 0.12;
    this.gravity = 9.8;
    this.restitution = 0.45; // bounce bounce
    
    // Build procedural graphics inside this container
    buildPokeballVisuals(this.el);
  },
  
  tick: function (time, timeDelta) {
    const dt = timeDelta / 1000; // seconds
    if (dt <= 0 || dt > 0.1) return; // ignore massive frames hiccups
    
    const pos = this.el.getAttribute('position');
    
    if (this.state === 'flying') {
      // 1. Apply Gravity
      this.velocity.y -= this.gravity * dt;
      
      // 2. Update position
      pos.x += this.velocity.x * dt;
      pos.y += this.velocity.y * dt;
      pos.z += this.velocity.z * dt;
      this.el.setAttribute('position', pos);
      
      // 3. Spin the ball in flight
      this.el.object3D.rotateX(3.5 * dt);
      this.el.object3D.rotateY(2.0 * dt);
      
      // 4. Ground Collision
      if (pos.y <= this.radius) {
        pos.y = this.radius;
        this.el.setAttribute('position', pos);
        
        // Bounce reflection with loss of velocity
        this.velocity.y = -this.velocity.y * this.restitution;
        this.velocity.x *= 0.75;
        this.velocity.z *= 0.75;
        
        playHitSound(0.08); // quiet ground bounce thud
        
        // If speed drops below threshold, settle
        if (Math.abs(this.velocity.y) < 0.25 && Math.abs(this.velocity.x) < 0.25 && Math.abs(this.velocity.z) < 0.25) {
          this.settleOnGround();
        }
      }
      
      // 5. Target collision check (Pokemon)
      this.checkTargetCollision();
    } 
    else if (this.state === 'dropping') {
      // Apply gravity to fall underneath pokemon
      this.velocity.y -= this.gravity * dt;
      pos.y += this.velocity.y * dt;
      this.el.setAttribute('position', pos);
      
      if (pos.y <= this.radius) {
        pos.y = this.radius;
        this.el.setAttribute('position', pos);
        
        this.velocity.y = -this.velocity.y * this.restitution;
        playHitSound(0.12);
        
        if (Math.abs(this.velocity.y) < 0.2) {
          this.state = 'shaking';
          this.velocity.set(0, 0, 0);
          this.startShakingSequence();
        }
      }
    }
  },
  
  checkTargetCollision: function () {
    if (gameManager.gameState !== 'idle') return;
    
    const pokemon = document.getElementById('pokemon');
    if (!pokemon) return;
    
    // Calculate the precise 3D bounding box of the Pokemon
    const box = new THREE.Box3().setFromObject(pokemon.object3D);
    const center = new THREE.Vector3();
    box.getCenter(center);
    
    // Determine the collision radius dynamically from the bounding box dimensions
    const size = new THREE.Vector3();
    box.getSize(size);
    const pokemonRadius = Math.max(size.x, size.y, size.z) / 2;
    const collisionThreshold = pokemonRadius + 0.12; // Pokemon visual radius + ball radius (0.12m)
    
    const ballWorldPos = new THREE.Vector3();
    this.el.object3D.getWorldPosition(ballWorldPos);
    
    const dist = ballWorldPos.distanceTo(center);
    
    if (dist < collisionThreshold) {
      this.triggerCatchSequence(pokemon, center);
    }
  },
  
  triggerCatchSequence: function (pokemon, pokemonPos) {
    gameManager.gameState = 'catching';
    gameManager.setStatus('Catching...', '#ffde00');
    
    this.state = 'collided';
    this.velocity.set(0, 0, 0);
    
    // Snap ball to pokemon location but slightly forward
    const ballPos = new THREE.Vector3(pokemonPos.x, pokemonPos.y + 0.1, pokemonPos.z + 0.2);
    this.el.setAttribute('position', ballPos);
    
    // Rotate ball to face center/normal orientation
    this.el.object3D.rotation.set(0, 0, 0);
    
    playHitSound(0.4);
    playSuckInSound();
    
    // Capture original scale if not already captured
    if (!gameManager.originalPokemonScale) {
      const currentScale = pokemon.getAttribute('scale') || {x: 1, y: 1, z: 1};
      gameManager.originalPokemonScale = {
        x: currentScale.x ?? 1,
        y: currentScale.y ?? 1,
        z: currentScale.z ?? 1
      };
    }
    const origScale = gameManager.originalPokemonScale;
    
    // Suck-in animation: shrink Pokemon scale to 0 and shift toward Pokéball
    const suckDuration = 600; // ms
    const startTime = performance.now();
    const pokemonContainer = document.getElementById('pokemon-container');
    
    const animateSuckIn = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / suckDuration, 1);
      
      // Interpolate scale down to 0 relative to original scale
      const scaleVal = 1 - progress;
      pokemon.setAttribute('scale', {
        x: origScale.x * scaleVal,
        y: origScale.y * scaleVal,
        z: origScale.z * scaleVal
      });
      
      // Slightly shift Y/Z position towards ball center during shrink
      if (progress < 1) {
        requestAnimationFrame(animateSuckIn);
      } else {
        // Suction finished
        pokemonContainer.setAttribute('visible', 'false');
        
        // Move Pokéball to drop straight down to ground
        this.el.setAttribute('position', { x: pokemonPos.x, y: pokemonPos.y, z: pokemonPos.z });
        this.state = 'dropping';
        this.velocity.set(0, 0, 0);
      }
    };
    
    requestAnimationFrame(animateSuckIn);
  },
  
  startShakingSequence: function () {
    const ballEntity = this.el;
    let shakeCount = 0;
    const maxShakes = 3;
    
    // Determine catch outcome beforehand (50% catch rate)
    const isSuccess = Math.random() < 0.50;
    
    const triggerNextShake = () => {
      if (shakeCount < maxShakes) {
        shakeCount++;
        gameManager.setStatus(`Shake ${shakeCount}...`, '#ffde00');
        
        // 1. Play wiggle animation (Roll Z left, right, then home)
        playWobbleSound();
        
        const shakeStartTime = performance.now();
        const duration = 600; // ms
        
        const animateShake = (now) => {
          const elapsed = now - shakeStartTime;
          const progress = elapsed / duration;
          
          if (progress < 1) {
            // Wobble rotation formula using sine wave
            // Left roll, then right roll, back to center
            const angle = Math.sin(progress * Math.PI * 2.5) * 0.35; // radians (about 20 deg)
            ballEntity.object3D.rotation.z = angle;
            
            requestAnimationFrame(animateShake);
          } else {
            // Reset rotation
            ballEntity.object3D.rotation.z = 0;
            
            // Random chance to break free mid-shake (1st, 2nd, or 3rd shake)
            // If it's a failure run, we escape on a random shake
            const shouldEscapeNow = !isSuccess && (shakeCount === maxShakes || Math.random() < 0.4);
            
            if (shouldEscapeNow) {
              this.triggerEscapeSequence();
            } else {
              // Schedule next shake after 500ms pause
              setTimeout(triggerNextShake, 500);
            }
          }
        };
        
        requestAnimationFrame(animateShake);
      } else {
        // Survived all shakes! Success
        this.triggerSuccessSequence();
      }
    };
    
    // Start shaking loop after a brief landing delay
    setTimeout(triggerNextShake, 400);
  },
  
  triggerEscapeSequence: function () {
    gameManager.gameState = 'escaped';
    gameManager.setStatus('Escaped!', '#ff3e3e');
    
    playEscapeSound();
    
    // Escape animation
    // Spawn Pokemon back at original scale, popping out of Pokéball
    const pokemon = document.getElementById('pokemon');
    const pokemonContainer = document.getElementById('pokemon-container');
    const origScale = gameManager.originalPokemonScale || {x: 1, y: 1, z: 1};
    
    pokemonContainer.setAttribute('visible', 'true');
    pokemon.setAttribute('scale', {
      x: origScale.x * 0.01,
      y: origScale.y * 0.01,
      z: origScale.z * 0.01
    });
    
    const popDuration = 400; // ms
    const startTime = performance.now();
    
    const animatePop = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / popDuration, 1);
      
      // Scale back up relative to original scale
      pokemon.setAttribute('scale', {
        x: origScale.x * progress,
        y: origScale.y * progress,
        z: origScale.z * progress
      });
      
      if (progress < 1) {
        requestAnimationFrame(animatePop);
      } else {
        // Reset game status
        gameManager.gameState = 'idle';
        gameManager.setStatus('Ready', '#8f92a1');
        
        // Dissolve/delete Pokéball
        if (this.el.parentNode) {
          this.el.parentNode.removeChild(this.el);
        }
      }
    };
    
    requestAnimationFrame(animatePop);
  },
  
  triggerSuccessSequence: function () {
    gameManager.gameState = 'caught';
    gameManager.setStatus('CAUGHT!', '#52b788');
    gameManager.incrementCaught();
    
    playSuccessSound();
    
    // Spawn procedural particle burst (yellow stars/diamonds)
    const particleContainer = document.createElement('a-entity');
    particleContainer.setAttribute('position', this.el.getAttribute('position'));
    this.el.parentNode.appendChild(particleContainer);
    
    const numParticles = 12;
    const particles = [];
    
    for (let i = 0; i < numParticles; i++) {
      const p = document.createElement('a-cone');
      p.setAttribute('color', '#ffde00');
      p.setAttribute('radius-bottom', '0.02');
      p.setAttribute('radius-top', '0.001');
      p.setAttribute('height', '0.05');
      p.setAttribute('position', '0 0.1 0');
      particleContainer.appendChild(p);
      
      // Random direction vectors
      const angle = (i / numParticles) * Math.PI * 2 + Math.random() * 0.2;
      const speed = 1.0 + Math.random() * 1.5;
      const vy = 1.5 + Math.random() * 2.0;
      
      particles.push({
        el: p,
        vx: Math.cos(angle) * speed,
        vy: vy,
        vz: Math.sin(angle) * speed,
        y: 0.1
      });
    }
    
    // Animate star particles
    const particleStartTime = performance.now();
    const duration = 1500; // ms
    
    const animateParticles = (now) => {
      const elapsed = now - particleStartTime;
      const dt = 16 / 1000; // approximation
      
      particles.forEach(p => {
        p.vy -= 9.8 * dt; // gravity
        
        const pos = p.el.getAttribute('position') || {x: 0, y: 0, z:0};
        pos.x += p.vx * dt;
        pos.y += p.vy * dt;
        pos.z += p.vz * dt;
        p.el.setAttribute('position', pos);
        p.el.object3D.rotateX(0.1);
      });
      
      if (elapsed < duration) {
        requestAnimationFrame(animateParticles);
      } else {
        if (particleContainer.parentNode) {
          particleContainer.parentNode.removeChild(particleContainer);
        }
      }
    };
    requestAnimationFrame(animateParticles);
    
    // Respawn the Pokemon at a new random location after 4 seconds
    setTimeout(() => {
      // Clean up Pokéball
      if (this.el.parentNode) {
        this.el.parentNode.removeChild(this.el);
      }
      
      // Respawn Pokemon
      respawnPokemon();
    }, 3500);
  },
  
  settleOnGround: function () {
    this.state = 'settled';
    this.velocity.set(0, 0, 0);
    
    // Auto-remove missed balls after 4 seconds
    setTimeout(() => {
      if (this.state === 'settled' && this.el.parentNode) {
        this.el.parentNode.removeChild(this.el);
      }
    }, 4000);
  }
});

// Helper to spawn a flying Pokéball at a position with a velocity vector
function spawnFlyingBall(position, velocity) {
  const container = document.getElementById('balls-container');
  const ball = document.createElement('a-entity');
  
  ball.setAttribute('position', `${position.x} ${position.y} ${position.z}`);
  ball.setAttribute('thrown-ball', {
    vx: velocity.x,
    vy: velocity.y,
    vz: velocity.z
  });
  
  container.appendChild(ball);
  gameManager.incrementThrown();
}

// Function to respawn the Pokémon with a pop animation
function respawnPokemon() {
  const container = document.getElementById('pokemon-container');
  const pokemon = document.getElementById('pokemon');
  
  // Random position within VR viewport:
  // X: -1.2 to 1.2 meters
  // Y: 0.6 to 1.2 meters height
  // Z: -2.0 to -3.5 meters away
  const rx = (Math.random() - 0.5) * 2.4;
  const ry = 0.6 + Math.random() * 0.6;
  const rz = -2.0 - Math.random() * 1.5;
  
  container.setAttribute('position', `${rx} ${ry} ${rz}`);
  const origScale = gameManager.originalPokemonScale || {x: 1, y: 1, z: 1};
  pokemon.setAttribute('scale', {
    x: origScale.x * 0.01,
    y: origScale.y * 0.01,
    z: origScale.z * 0.01
  });
  container.setAttribute('visible', 'true');
  
  // Pop animation scale up
  const duration = 500;
  const startTime = performance.now();
  
  const animateSpawn = (now) => {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Elastic ease-out pop scale
    // f(x) = sin(x*pi/2)
    const scaleVal = Math.sin(progress * Math.PI / 2);
    pokemon.setAttribute('scale', {
      x: origScale.x * scaleVal,
      y: origScale.y * scaleVal,
      z: origScale.z * scaleVal
    });
    
    if (progress < 1) {
      requestAnimationFrame(animateSpawn);
    } else {
      gameManager.gameState = 'idle';
      gameManager.setStatus('Ready', '#8f92a1');
    }
  };
  
  requestAnimationFrame(animateSpawn);
}


// ==========================================
// 4. MOUSE/DESKTOP FALLBACK THROWING
// ==========================================
window.addEventListener('mousedown', function (e) {
  // If overlay is visible, ignore clicks
  const overlay = document.getElementById('ui-overlay');
  if (!overlay.classList.contains('hidden')) return;
  
  // Ignore clicks on HUD or VR entrance buttons
  if (e.target.closest('#hud-overlay') || e.target.closest('.a-enter-vr') || e.target.closest('.a-enter-vr-button')) {
    return;
  }
  
  // Check if WebXR VR session is currently running
  const sceneEl = document.querySelector('a-scene');
  if (sceneEl.is('vr-mode')) return; // Handled by throw-spawner VR component
  
  if (gameManager.gameState !== 'idle') return;
  initAudio();
  
  // Get camera components
  const cameraEl = document.getElementById('camera');
  const camera = cameraEl.components.camera.camera;
  if (!camera) return;
  
  // Get normalized mouse coordinates (-1 to 1)
  const mouse = new THREE.Vector2();
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  
  // Set raycaster from camera through mouse click coordinate
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  const direction = raycaster.ray.direction.clone().normalize();
  
  // Get camera world position for spawning
  const spawnPos = new THREE.Vector3();
  cameraEl.object3D.getWorldPosition(spawnPos);
  
  // Offset spawn position slightly forward in the click direction so it doesn't clip
  spawnPos.addScaledVector(direction, 0.45);
  
  // Set launch velocity in the click direction (slightly fast to counter gravity arc)
  const launchVelocity = direction.multiplyScalar(11.5); // 11.5 m/s desktop speed
  
  spawnFlyingBall(spawnPos, launchVelocity);
  playThrowSound();
});


// ==========================================
// 5. INITIALIZATION & UI
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  generateGrid();
  
  // Capture original scale of the pokemon at startup
  const pokemon = document.getElementById('pokemon');
  if (pokemon) {
    const currentScale = pokemon.getAttribute('scale') || {x: 1, y: 1, z: 1};
    gameManager.originalPokemonScale = {
      x: currentScale.x ?? 1,
      y: currentScale.y ?? 1,
      z: currentScale.z ?? 1
    };
  }
  
  // UI Button Click Handler to enter game
  const startBtn = document.getElementById('start-btn');
  const overlay = document.getElementById('ui-overlay');
  
  startBtn.addEventListener('click', () => {
    overlay.classList.add('hidden');
    initAudio();
    playSuccessSound(); // chime to verify audio works
    
    // Add a simple animation to the Pokemon tail to make it feel alive (if it exists)
    const tail = document.getElementById('pokemon-tail');
    if (tail) {
      let angle = 0;
      const animateIdle = () => {
        if (gameManager.gameState === 'idle' && tail.object3D) {
          angle += 0.05;
          // Tail wag
          tail.object3D.rotation.y = Math.PI + Math.sin(angle) * 0.15;
        }
        requestAnimationFrame(animateIdle);
      };
      animateIdle();
    }
  });
});

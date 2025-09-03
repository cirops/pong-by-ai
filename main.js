(() => {
  "use strict";

  // DOM references
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const startBtn = document.getElementById("startBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const resetBtn = document.getElementById("resetBtn");
  const playerScoreEl = document.getElementById("playerScore");
  const aiScoreEl = document.getElementById("aiScore");
  const difficultyRadios = Array.from(
    document.querySelectorAll('input[name="difficulty"]')
  );
  const tauntBar = document.getElementById("tauntBar");

  // Colorblind-safe palette (Okabe-Ito inspired)
  const PALETTE = {
    background: "#0b0e22",
    net: "#C8CCD9",
    ballFill: "#FFFFFF",
    ballStroke: "rgba(0,0,0,0.9)",
    playerPaddle: "#009E73", // bluish green
    aiEasy: "#E69F00", // orange
    aiMedium: "#0072B2", // blue
    aiHard: "#D55E00", // vermillion
  };

  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return { r: 255, g: 255, b: 255 };
    return {
      r: parseInt(m[1], 16),
      g: parseInt(m[2], 16),
      b: parseInt(m[3], 16),
    };
  }

  function pickReadableTextColor(bgHex) {
    const { r, g, b } = hexToRgb(bgHex);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 186 ? "#0b0e22" : "#ffffff";
  }

  function rgbaFromHex(hex, alpha) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function darkenHexToRgbString(hex, percent = 0.15) {
    const { r, g, b } = hexToRgb(hex);
    const k = Math.max(0, Math.min(1, 1 - percent));
    const dr = Math.round(r * k);
    const dg = Math.round(g * k);
    const db = Math.round(b * k);
    return `rgb(${dr},${dg},${db})`;
  }

  function setTauntBarPersonaColor(level) {
    if (!tauntBar) return;
    const bgColor =
      level === "easy"
        ? PALETTE.aiEasy
        : level === "medium"
        ? PALETTE.aiMedium
        : PALETTE.aiHard;
    // Glassy, transparent look: translucent gradient + backdrop blur
    const glassTop = "rgba(255,255,255,0.08)";
    const glassBottom = rgbaFromHex(bgColor, 0.18);
    tauntBar.style.background = `linear-gradient(180deg, ${glassTop}, ${glassBottom})`;
    tauntBar.style.backdropFilter = "blur(8px) saturate(120%)";
    tauntBar.style.webkitBackdropFilter = "blur(8px) saturate(120%)";
    tauntBar.style.color = pickReadableTextColor(bgColor);
    // Slightly larger left border using a darker shade of the same color
    const darker = darkenHexToRgbString(bgColor, 0.2);
    tauntBar.style.borderLeft = `6px solid ${darker}`;
    // Subtle colored shadow to enhance glass depth
    tauntBar.style.boxShadow = `inset 0 1px 0 rgba(255,255,255,0.25), 0 8px 20px ${rgbaFromHex(
      bgColor,
      0.22
    )}`;
  }

  // Virtual game dimensions (logical units)
  const GAME_WIDTH = 800;
  const GAME_HEIGHT = 450;

  // Device pixel ratio handling
  function resizeCanvas() {
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    const displayWidth = canvas.clientWidth;
    const displayHeight = Math.round(displayWidth * (GAME_HEIGHT / GAME_WIDTH));
    canvas.style.height = displayHeight + "px";

    const desiredWidth = Math.round(displayWidth * dpr);
    const desiredHeight = Math.round(displayHeight * dpr);

    if (canvas.width !== desiredWidth || canvas.height !== desiredHeight) {
      canvas.width = desiredWidth;
      canvas.height = desiredHeight;
    }

    ctx.setTransform(
      canvas.width / GAME_WIDTH,
      0,
      0,
      canvas.height / GAME_HEIGHT,
      0,
      0
    );
  }

  // Game objects
  const paddle = {
    width: 12,
    height: 90,
    speed: 520, // px/s
  };

  const ballDefaults = {
    size: 12,
    // speeds are configured per difficulty
  };

  let player = {
    x: 24,
    y: GAME_HEIGHT / 2 - paddle.height / 2,
    vy: 0,
    score: 0,
  };
  let ai = {
    x: GAME_WIDTH - 24 - paddle.width,
    y: GAME_HEIGHT / 2 - paddle.height / 2,
    vy: 0,
    score: 0,
  };
  let ball = {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT / 2,
    vx: 0,
    vy: 0,
    speed: ballDefaults.speed,
  };
  // AI thinking state for reaction-timed decisions
  let aiBrain = {
    targetCenterY: GAME_HEIGHT / 2,
    nextThinkAt: 0,
  };
  function resetAIThinking() {
    aiBrain.targetCenterY = GAME_HEIGHT / 2;
    aiBrain.nextThinkAt = 0;
  }

  // Difficulty-configurable parameters (defaults = medium)
  const DIFFICULTY_PRESETS = {
    easy: {
      aiMaxSpeed: 200,
      aiReaction: 0.28,
      aiError: 0.55,
      ballSpeed: 320,
      ballMaxSpeed: 680,
    },
    medium: {
      aiMaxSpeed: 220,
      aiReaction: 0.06,
      aiError: 0.12,
      ballSpeed: 360,
      ballMaxSpeed: 850,
    },
    hard: {
      aiMaxSpeed: 240,
      aiReaction: 0.015,
      aiError: 0.02,
      ballSpeed: 420,
      ballMaxSpeed: 1000,
    },
  };

  let currentDifficulty = "medium";
  let aiMaxSpeed = DIFFICULTY_PRESETS.medium.aiMaxSpeed;
  let aiReactionDelay = DIFFICULTY_PRESETS.medium.aiReaction;
  let aiError = DIFFICULTY_PRESETS.medium.aiError;
  let ballStartSpeed = DIFFICULTY_PRESETS.medium.ballSpeed;
  let ballMaxSpeed = DIFFICULTY_PRESETS.medium.ballMaxSpeed;
  let isHard = false;
  let tauntCooldownMs = 5000; // unified base

  // Adaptive difficulty: gradual parameter offsets layered on top of presets
  let adaptive = {
    aiMaxSpeedOffset: 0,
    aiReactionOffset: 0,
    aiErrorOffset: 0,
    ballStartSpeedOffset: 0,
    ballMaxSpeedOffset: 0,
  };

  function applyAdaptiveOffsets() {
    const preset = DIFFICULTY_PRESETS[currentDifficulty];
    aiMaxSpeed = clamp(preset.aiMaxSpeed + adaptive.aiMaxSpeedOffset, 160, 300);
    aiReactionDelay = clamp(
      preset.aiReaction + adaptive.aiReactionOffset,
      0.01,
      0.6
    );
    aiError = clamp(preset.aiError + adaptive.aiErrorOffset, 0.01, 1.0);
    ballStartSpeed = clamp(
      preset.ballSpeed + adaptive.ballStartSpeedOffset,
      260,
      520
    );
    ballMaxSpeed = clamp(
      preset.ballMaxSpeed + adaptive.ballMaxSpeedOffset,
      700,
      1200
    );
  }

  // Taunt personas and phrases (expanded)
  const TAUNTS = {
    easy: {
      pointFor: [
        "Haha! Beginner's luck?",
        "Told you I'd get it!",
        "Let’s gooo!",
        "You blinked, I scored!",
        "Weee! That was fun!",
        "Ka-chow!",
        "Did you see that?!",
        "Gotcha!",
        "Boom! Another one!",
        "I'm on fire!",
        "Scorey McScoreface!",
        "Too easy!",
        "I'm unstoppable! (probably)",
        "Sweet point!",
        "Whoops for you!",
      ],
      pointAgainst: [
        "Nooo! That slipped!",
        "Ouch! That hurt...",
        "How did I miss that?!",
        "Wait, redo?",
        "I swear my paddle lagged!",
        "That was rude!",
        "I blinked!",
        "Lag! Definitely lag.",
        "Okay, okay, nice one.",
        "I meant to do that. Totally.",
        "What sorcery was that?",
        "Ow, my pride!",
        "One more chance!",
        "I wasn't ready!",
        "Ugh, fine!",
      ],
      aiHit: [
        "Boop!",
        "Smack!",
        "Right back at ya!",
        "Woo!",
        "Bonk!",
        "Bap!",
        "Pow!",
        "Tink!",
      ],
      playerHit: [
        "Nice hit!",
        "Careful now!",
        "You sure about that?",
        "Hey!",
        "Clean swipe!",
        "Spicy!",
        "You called bank?",
        "Good swing!",
      ],
      sharp: [
        "Whoa spicy angle!",
        "Zoom zoom!",
        "It's speeding up!",
        "Laser shot!",
        "Slice-n-dice!",
        "Angles for days!",
        "Fasthouse!",
        "That cut deep!",
      ],
      random: [
        "I’m totally winning this.",
        "Watch this move!",
        "I like squares. And circles.",
        "Can we make it pink?",
        "I brought snacks!",
        "Do paddles dream?",
        "What's a spin move?",
        "Pew pew!",
        "I live for rallies!",
        "Best game ever!",
      ],
    },
    medium: {
      pointFor: [
        "Point claimed.",
        "Precision prevails.",
        "A measured strike.",
        "I bow to the moment.",
        "The blade finds its mark.",
        "Calm. Precise. Certain.",
        "Honor in the point.",
        "Your guard was open.",
        "Flow like water.",
        "Discipline rewarded.",
        "Timing is everything.",
        "The line was true.",
      ],
      pointAgainst: [
        "Well struck.",
        "I acknowledge your skill.",
        "Balance shifts for now.",
        "Sharpen your resolve; I shall as well.",
        "A worthy strike.",
        "Lesson received.",
        "I adapt.",
        "Respect.",
        "You cut the wind.",
        "I will answer.",
        "The duel deepens.",
        "Steel meets steel.",
      ],
      aiHit: [
        "Return accepted.",
        "On guard.",
        "Focus.",
        "Stand firm.",
        "Hold stance.",
        "Centered.",
        "Measured return.",
        "Stillness in motion.",
      ],
      playerHit: [
        "Your form improves.",
        "Impressive control.",
        "A worthy exchange.",
        "Good discipline.",
        "Clean strike.",
        "Balanced.",
        "Your rhythm is true.",
        "You read the line.",
      ],
      sharp: [
        "Angle honored.",
        "Speed intensifies.",
        "Edge cuts deeper.",
        "A keen line.",
        "Knife-edge return.",
        "The arc is sharp.",
        "Velocity rises.",
        "A decisive cut.",
      ],
      random: [
        "Steel the mind.",
        "Breath steady, paddle ready.",
        "The duel continues.",
        "Endure.",
        "Patience is strength.",
        "Clarity in motion.",
        "Focus trims excess.",
        "Honor the rally.",
        "Read the flow.",
        "Hold your center.",
      ],
    },
    hard: {
      pointFor: [
        "Unit scored: success=1.",
        "Dominance pattern confirmed.",
        "Throughput optimal.",
        "Objective advanced.",
        "Margin increasing.",
        "Lead stabilized.",
        "Superior path computed.",
        "Efficiency acceptable.",
        "Opposition contained.",
        "Win-state trending.",
        "Trajectory favorable.",
        "Checksum: victory.",
      ],
      pointAgainst: [
        "Anomaly detected.",
        "Variance tolerated.",
        "Adjusting parameters.",
        "Deviation noted.",
        "Noise injected.",
        "Retraining.",
        "Heuristic update queued.",
        "Compensating.",
        "Non-fatal exception.",
        "Outlier logged.",
        "Drift observed.",
        "Recalibrating.",
      ],
      aiHit: [
        "Ping.",
        "Return=TRUE.",
        "Trajectory locked.",
        "Paddle sync.",
        "Signal clear.",
        "Impact nominal.",
        "Loop stable.",
        "Packet returned.",
      ],
      playerHit: [
        "Input acknowledged.",
        "Countermeasure noted.",
        "Latency acceptable.",
        "Force vector read.",
        "Contact mapped.",
        "Opponent active.",
        "Feedback stored.",
        "Telemetry valid.",
      ],
      sharp: [
        "Velocity spike.",
        "Edge-case encountered.",
        "Amplifying response.",
        "Angle escalation.",
        "Energy uptick.",
        "Gradient steepened.",
        "Response tightening.",
        "Bandwidth raised.",
      ],
      random: [
        "01101000 01101001.",
        "Processing...",
        "Emotion module: disabled.",
        "Banter protocol: v1.0",
        "Idle loop engaged.",
        "Thermal nominal.",
        "Hashing quips...",
        "Cache warmed.",
        "Jitter minimal.",
        "Clock synced.",
      ],
    },
  };

  function randomChance(p) {
    return Math.random() < p;
  }
  function pick(arr) {
    return arr[(Math.random() * arr.length) | 0];
  }

  let lastTauntTime = 0;
  function showTaunt(text) {
    if (!tauntBar) return;
    tauntBar.textContent = text;
    tauntBar.classList.remove("hide");
    tauntBar.classList.add("show");
    // remove show class after animation for re-trigger
    setTimeout(() => tauntBar.classList.remove("show"), 300);
  }

  function maybeTaunt(category, probability, { bypassCooldown = false } = {}) {
    const now = Date.now();
    const jitter = Math.random() * 1200 - 600; // +/- 600ms jitter
    if (!bypassCooldown && now - lastTauntTime < tauntCooldownMs + jitter)
      return;
    const persona = TAUNTS[currentDifficulty] || TAUNTS.medium;
    if (!persona[category]) return;
    if (randomChance(probability)) {
      showTaunt(pick(persona[category]));
      lastTauntTime = now;
    }
  }

  // --- Layered feedback: Audio SFX ---
  let audioCtx = null;
  let masterGain = null;
  function ensureAudio() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioCtx = new Ctx();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.4;
      masterGain.connect(audioCtx.destination);
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  }

  function playTone({
    frequency = 440,
    duration = 0.08,
    type = "sine",
    gain = 0.25,
    attack = 0.005,
    decay = 0.06,
    detune = 0,
  } = {}) {
    if (!audioCtx || !masterGain) return;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    osc.detune.value = detune;
    osc.connect(g);
    g.connect(masterGain);
    const now = audioCtx.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(gain, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);
    osc.start(now);
    osc.stop(now + duration);
  }

  function playNoise({
    duration = 0.04,
    gain = 0.22,
    freq = 1400,
    q = 6,
  } = {}) {
    if (!audioCtx || !masterGain) return;
    const frames = Math.max(1, Math.floor(audioCtx.sampleRate * duration));
    const buffer = audioCtx.createBuffer(1, frames, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = audioCtx.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(masterGain);
    src.start();
    src.stop(audioCtx.currentTime + duration);
  }

  function sfxPaddle(strength = 0.5) {
    ensureAudio();
    if (!audioCtx) return;
    const base = 280 + strength * 220;
    playTone({
      frequency: base,
      duration: 0.07,
      type: "square",
      gain: 0.18 + strength * 0.18,
    });
    playTone({
      frequency: base * 2,
      duration: 0.05,
      type: "sine",
      gain: 0.08 + strength * 0.1,
      detune: 6,
    });
  }

  function sfxWall(strength = 0.4) {
    ensureAudio();
    if (!audioCtx) return;
    playNoise({
      duration: 0.03 + strength * 0.02,
      gain: 0.12 + strength * 0.12,
      freq: 1200 + strength * 1200,
      q: 7,
    });
  }

  function sfxScore(win) {
    ensureAudio();
    if (!audioCtx) return;
    const base = win ? 440 : 300;
    playTone({ frequency: base, duration: 0.12, type: "triangle", gain: 0.25 });
    setTimeout(() => {
      playTone({
        frequency: win ? base * 1.26 : base * 0.84,
        duration: 0.14,
        type: "triangle",
        gain: 0.22,
      });
    }, 24);
  }

  // --- Layered feedback: Screen shake ---
  let shakeEndAt = 0;
  let shakeDurationMs = 0;
  let shakeIntensityPx = 0;
  function addScreenShake(intensityPx, durationMs) {
    const now = performance.now();
    const end = now + durationMs;
    shakeEndAt = Math.max(shakeEndAt, end);
    shakeDurationMs = Math.max(shakeDurationMs, durationMs);
    shakeIntensityPx = Math.max(shakeIntensityPx, intensityPx);
  }
  function getShakeOffset() {
    const now = performance.now();
    if (now >= shakeEndAt || shakeDurationMs <= 0 || shakeIntensityPx <= 0)
      return [0, 0];
    const t = (shakeEndAt - now) / shakeDurationMs;
    const amp = shakeIntensityPx * t * t; // ease-out
    const ox = (Math.random() * 2 - 1) * amp;
    const oy = (Math.random() * 2 - 1) * amp;
    if (t <= 0) {
      shakeDurationMs = 0;
      shakeIntensityPx = 0;
    }
    return [ox, oy];
  }

  // --- Layered feedback: Particles (hit sparks) ---
  const particles = [];
  function spawnSparks(x, y, normalX, normalY, strength = 0.6) {
    const count = Math.round(8 + strength * 6);
    const baseAngle = Math.atan2(normalY, normalX);
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * (Math.PI / 2);
      const angle = baseAngle + spread;
      const speed = 180 + Math.random() * 220 * strength;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const life = 0.25 + Math.random() * 0.25;
      const size = 2 + Math.random() * 2;
      particles.push({ x, y, vx, vy, life, ttl: life, size });
    }
  }
  function updateEffects(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }
  function drawParticles() {
    ctx.save();
    for (const p of particles) {
      const alpha = Math.max(0, p.life / p.ttl);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#ffd166";
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.restore();
  }

  // --- Layered feedback: Ball trail ---
  const TRAIL_MAX_MS = 220; // ~13 frames at 60fps
  const TRAIL_MAX_POINTS = 48;
  const ballTrail = [];
  function addTrailPoint() {
    const now = performance.now();
    ballTrail.push({ x: ball.x, y: ball.y, t: now });
    // Remove points older than time window
    while (ballTrail.length && now - ballTrail[0].t > TRAIL_MAX_MS)
      ballTrail.shift();
    // Hard cap to avoid unbounded growth at very high frame rates
    if (ballTrail.length > TRAIL_MAX_POINTS) ballTrail.shift();
  }
  function clearTrail() {
    ballTrail.length = 0;
  }
  function drawBallTrail() {
    if (ballTrail.length === 0) return;
    ctx.save();
    const r = ballDefaults.size / 2;
    const now = performance.now();
    for (let i = 0; i < ballTrail.length; i++) {
      const age = now - ballTrail[i].t;
      const alpha = Math.max(0, 1 - age / TRAIL_MAX_MS) * 0.6;
      if (alpha <= 0.01) continue;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(ballTrail[i].x, ballTrail[i].y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Input handling
  const input = {
    up: false,
    down: false,
    pointerActive: false,
    pointerY: 0,
  };

  function serveBall(direction = Math.random() < 0.5 ? -1 : 1) {
    // Spawn the ball on the server's half and ensure it travels away from the server
    const servingSide = direction === 1 ? "player" : "ai"; // +1 means player serves to the right
    const spawnY = GAME_HEIGHT / 2;

    if (servingSide === "player") {
      ball.x = player.x + paddle.width + ballDefaults.size;
    } else {
      ball.x = ai.x - ballDefaults.size;
    }
    ball.y = spawnY;

    ball.speed = ballStartSpeed;

    // Fault prevention: constrain serve angle so the ball cannot hit top/bottom
    // before crossing the center line. Compute the maximum allowable slope so
    // that |vy/vx| does not exceed (vertical room) / (distance to mid).
    const distanceToCenter = Math.max(1, Math.abs(GAME_WIDTH / 2 - ball.x));
    const verticalMargin = ballDefaults.size * 1.5;
    const maxRise = Math.max(1, GAME_HEIGHT / 2 - verticalMargin);
    const maxSlope = Math.min(3, maxRise / distanceToCenter);
    const maxAngle = Math.atan(maxSlope); // radians

    // Random angle within [-maxAngle, +maxAngle]
    const angle = (Math.random() * 2 - 1) * maxAngle;

    ball.vx = Math.cos(angle) * ball.speed * direction;
    ball.vy = Math.sin(angle) * ball.speed;
    clearTrail();
  }

  const State = {
    MENU: "menu",
    PLAYING: "playing",
    PAUSED: "paused",
    COUNTDOWN: "countdown",
    MATCH_OVER: "match_over",
  };
  let state = State.MENU;

  // Match configuration and state
  const POINTS_TO_WIN = 7;
  let server = "player"; // alternates each point; set at match start
  let matchWinner = null; // "player" | "ai" | null

  // Countdown state
  let countdownEndAt = 0; // performance.now() timestamp when countdown ends
  let nextServeDirection = 1; // +1 means ball goes to AI (right), -1 goes to player (left)

  // Simple stats
  let currentRallyHits = 0;
  let longestRally = 0;
  let totalRallies = 0;
  let playerAces = 0;
  let aiAces = 0;

  // Rendering helpers
  function drawRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function drawNet() {
    ctx.save();
    ctx.globalAlpha = 0.35;
    const segmentHeight = 12;
    const gap = 10;
    const netWidth = 4;
    const x = GAME_WIDTH / 2 - netWidth / 2;
    for (let y = 0; y < GAME_HEIGHT; y += segmentHeight + gap) {
      drawRect(x, y, netWidth, segmentHeight, PALETTE.net);
    }
    ctx.restore();
  }

  function draw() {
    // Background
    const [sx, sy] = getShakeOffset();
    ctx.save();
    ctx.translate(sx, sy);
    drawRect(0, 0, GAME_WIDTH, GAME_HEIGHT, PALETTE.background);

    drawNet();

    // Motion trail (under objects)
    drawBallTrail();

    // Paddles
    drawRect(
      player.x,
      player.y,
      paddle.width,
      paddle.height,
      PALETTE.playerPaddle
    );
    // AI paddle color depends on persona/difficulty
    const aiColor =
      currentDifficulty === "easy"
        ? PALETTE.aiEasy
        : currentDifficulty === "medium"
        ? PALETTE.aiMedium
        : PALETTE.aiHard;
    drawRect(ai.x, ai.y, paddle.width, paddle.height, aiColor);

    // Ball (circle)
    ctx.fillStyle = PALETTE.ballFill;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ballDefaults.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = PALETTE.ballStroke;
    ctx.stroke();

    // Particles (over ball)
    drawParticles();

    ctx.restore();

    // If not playing, overlay UI for menu/pause/countdown/match over
    if (state !== State.PLAYING) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      ctx.fillStyle = "rgba(233,236,255,0.95)";
      ctx.textAlign = "center";

      const centerX = GAME_WIDTH / 2;
      const centerY = GAME_HEIGHT / 2;

      if (state === State.MENU) {
        ctx.font =
          "24px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial";
        ctx.fillText("Press Start to Play", centerX, centerY);
      } else if (state === State.PAUSED) {
        ctx.font =
          "24px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial";
        ctx.fillText("Paused", centerX, centerY);
      } else if (state === State.COUNTDOWN) {
        const remainingMs = Math.max(0, countdownEndAt - performance.now());
        const seconds = Math.ceil(remainingMs / 1000);
        ctx.font =
          "64px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial";
        ctx.fillText(String(Math.max(1, seconds)), centerX, centerY);
        ctx.font =
          "18px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial";
        const servingWho =
          nextServeDirection === 1 ? "Player serves" : "AI serves";
        ctx.fillText(servingWho, centerX, centerY + 36);
      } else if (state === State.MATCH_OVER) {
        const winnerText = matchWinner === "player" ? "You Win!" : "AI Wins!";
        ctx.font =
          "36px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial";
        ctx.fillText(winnerText, centerX, centerY - 40);

        ctx.font =
          "16px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial";
        const lines = [
          `Final Score: ${player.score} : ${ai.score}`,
          `Longest rally: ${longestRally}`,
          `Aces — You: ${playerAces}  AI: ${aiAces}`,
          `Rallies: ${totalRallies}`,
          `Press Start for Rematch or Reset to return to Menu`,
        ];
        let y = centerY;
        for (const line of lines) {
          ctx.fillText(line, centerX, y);
          y += 22;
        }
      }
      ctx.restore();
    }
  }

  // Physics and game updates
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
  // Predict ball Y at a given X, with wall reflections
  function reflectYAcrossWalls(rawY) {
    const doubleHeight = GAME_HEIGHT * 2;
    let m = rawY % doubleHeight;
    if (m < 0) m += doubleHeight;
    return m <= GAME_HEIGHT ? m : doubleHeight - m;
  }
  function predictBallYAtX(targetX) {
    if (ball.vx <= 0) return GAME_HEIGHT / 2;
    const margin = paddle.width / 2 + ballDefaults.size / 2;
    const dx = targetX - ball.x - margin;
    const t = dx / Math.max(1e-6, ball.vx);
    if (t <= 0) return ball.y;
    const projectedY = ball.y + ball.vy * t;
    return reflectYAcrossWalls(projectedY);
  }
  const MAX_BOUNCE_ANGLE = Math.PI / 3; // 60° max deflection
  const PADDLE_SPIN = 0.16; // coupling of paddle vertical motion into ball spin/angle

  function updatePlayer(dt) {
    let dy = 0;
    if (input.up) dy -= paddle.speed * dt;
    if (input.down) dy += paddle.speed * dt;

    if (input.pointerActive) {
      const targetY = input.pointerY - paddle.height / 2;
      const diff = targetY - player.y;
      dy = clamp(diff, -paddle.speed * dt * 1.2, paddle.speed * dt * 1.2);
    }
    const oldY = player.y;
    player.y += dy;
    player.y = clamp(player.y, 0, GAME_HEIGHT - paddle.height);
    player.vy = (player.y - oldY) / Math.max(1e-6, dt);
  }

  function updateAI(dt) {
    const now = performance.now();
    const aiCenterY = ai.y + paddle.height / 2;

    // Think only at reaction-timed intervals for more human-like behavior
    if (now >= aiBrain.nextThinkAt) {
      let desiredCenterY = GAME_HEIGHT / 2;
      if (ball.vx > 0 || isHard) {
        const predictedY = predictBallYAtX(ai.x);
        const speedFactor = clamp(
          (ball.speed - ballStartSpeed) /
            (ballMaxSpeed - ballStartSpeed + 1e-6),
          0,
          1
        );
        // Error scales slightly with speed to allow human-like misses
        const baseJitter = aiError * 160;
        const speedJitter = aiError * 180 * speedFactor;
        const noise = (Math.random() - 0.5) * (baseJitter + speedJitter);
        desiredCenterY = clamp(
          predictedY + noise,
          paddle.height / 2,
          GAME_HEIGHT - paddle.height / 2
        );
      }
      aiBrain.targetCenterY = desiredCenterY;

      const baseMs = Math.max(0.01, aiReactionDelay) * 1000;
      const jitterMs = baseMs * 0.4 * (Math.random() * 2 - 1); // +/-40%
      aiBrain.nextThinkAt = now + baseMs + jitterMs;
    }

    const diff = aiBrain.targetCenterY - aiCenterY;
    const maxStep = aiMaxSpeed * dt;
    let step = clamp(diff, -maxStep, maxStep);

    // Only chase when ball moving towards AI to make it fair
    let allowChase =
      isHard || ball.vx > 0 || Math.abs(diff) > paddle.height * 0.25;
    if (!isHard) {
      if (currentDifficulty === "easy") {
        // Track later and hesitate sometimes
        if (ball.x < GAME_WIDTH * 0.55) allowChase = false;
        if (randomChance(0.5 * dt)) allowChase = false; // brief hesitation
        step *= 0.85; // slightly lazier tracking
      } else if (currentDifficulty === "medium") {
        // Medium: similar paddle speed, earlier positioning and fewer hesitations
        if (ball.x < GAME_WIDTH * 0.5) allowChase = false;
        if (randomChance(0.1 * dt)) allowChase = false; // occasional hesitation
        step *= 0.92;
      }
    }
    if (allowChase) {
      ai.y += step;
    }
    const oldY = ai.y;
    ai.y = clamp(ai.y, 0, GAME_HEIGHT - paddle.height);
    ai.vy = (ai.y - oldY) / Math.max(1e-6, dt);
  }

  function resetPositions() {
    player.y = GAME_HEIGHT / 2 - paddle.height / 2;
    ai.y = GAME_HEIGHT / 2 - paddle.height / 2;
  }

  function onScore(scorer) {
    if (scorer === "player") player.score += 1;
    if (scorer === "ai") ai.score += 1;

    // Stats update
    longestRally = Math.max(longestRally, currentRallyHits);
    if (currentRallyHits === 0) {
      if (scorer === "player") playerAces += 1;
      else aiAces += 1;
    }
    totalRallies += 1;
    currentRallyHits = 0;

    // Taunts on scoring events (higher chance on Easy for fun, lower on Hard)
    if (scorer === "ai") {
      maybeTaunt(
        "pointFor",
        currentDifficulty === "easy"
          ? 0.7
          : currentDifficulty === "medium"
          ? 0.5
          : 0.35,
        { bypassCooldown: true }
      );
    } else {
      maybeTaunt(
        "pointAgainst",
        currentDifficulty === "easy"
          ? 0.6
          : currentDifficulty === "medium"
          ? 0.45
          : 0.3,
        { bypassCooldown: true }
      );
    }

    updateScoreUI();

    // Match win check
    if (player.score >= POINTS_TO_WIN || ai.score >= POINTS_TO_WIN) {
      matchWinner = player.score > ai.score ? "player" : "ai";
      // Adaptive difficulty adjustment based on margin of victory
      try {
        const margin = Math.abs(player.score - ai.score);
        const playerWon = matchWinner === "player";
        // Larger margins → stronger adjustment. Small margins → subtle.
        // Sign: if player won, make AI tougher; if AI won, make it easier.
        const sign = playerWon ? 1 : -1;
        const step = margin >= 5 ? 1.0 : margin >= 3 ? 0.6 : 0.3;
        // Apply to reaction (lower is harder), speed (higher is harder), and error (lower is harder)
        adaptive.aiReactionOffset += -sign * 0.01 * step; // 10ms per small step
        adaptive.aiMaxSpeedOffset += sign * 6 * step; // px/s
        adaptive.aiErrorOffset += -sign * 0.02 * step;
        // Keep ball speeds slightly influenced for pacing
        adaptive.ballStartSpeedOffset += sign * 6 * step;
        adaptive.ballMaxSpeedOffset += sign * 10 * step;
        applyAdaptiveOffsets();
        resetAIThinking();
      } catch {}

      state = State.MATCH_OVER;
      startBtn.textContent = "Rematch";
      resetPositions();
      ball.vx = 0;
      ball.vy = 0;
      sfxScore(matchWinner === "player");
      addScreenShake(8, 260);
      return;
    }

    // Next point: alternate server and start countdown
    server = scorer === "player" ? "ai" : "player";
    resetPositions();
    resetAIThinking();
    sfxScore(scorer === "player");
    addScreenShake(6, 220);
    startCountdown(server === "player" ? 1 : -1);
  }

  function updateScoreUI() {
    playerScoreEl.textContent = String(player.score);
    aiScoreEl.textContent = String(ai.score);
  }

  function updateBall(dt) {
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Wall collisions (top/bottom)
    if (ball.y - ballDefaults.size / 2 <= 0) {
      ball.y = ballDefaults.size / 2;
      ball.vy = Math.abs(ball.vy);
      sfxWall(Math.min(1, Math.abs(ball.vy) / ballMaxSpeed));
      spawnSparks(ball.x, ball.y, 0, 1, 0.6);
      addScreenShake(2.5, 120);
    }
    if (ball.y + ballDefaults.size / 2 >= GAME_HEIGHT) {
      ball.y = GAME_HEIGHT - ballDefaults.size / 2;
      ball.vy = -Math.abs(ball.vy);
      sfxWall(Math.min(1, Math.abs(ball.vy) / ballMaxSpeed));
      spawnSparks(ball.x, ball.y, 0, -1, 0.6);
      addScreenShake(2.5, 120);
    }

    // Paddle collisions
    const left = ball.x - ballDefaults.size / 2;
    const right = ball.x + ballDefaults.size / 2;
    const top = ball.y - ballDefaults.size / 2;
    const bottom = ball.y + ballDefaults.size / 2;

    // Player paddle
    if (
      right >= player.x &&
      left <= player.x + paddle.width &&
      bottom >= player.y &&
      top <= player.y + paddle.height &&
      ball.vx < 0
    ) {
      currentRallyHits += 1;
      const hitPos =
        (ball.y - (player.y + paddle.height / 2)) / (paddle.height / 2);
      const baseAngle = hitPos * MAX_BOUNCE_ANGLE;
      ball.speed = clamp(ball.speed * 1.05, ballStartSpeed, ballMaxSpeed);
      let nextVx = Math.cos(baseAngle) * ball.speed;
      let nextVy = Math.sin(baseAngle) * ball.speed;
      nextVy += player.vy * PADDLE_SPIN;
      const rawAngle = Math.atan2(nextVy, Math.abs(nextVx));
      const clampedAngle = clamp(rawAngle, -MAX_BOUNCE_ANGLE, MAX_BOUNCE_ANGLE);
      ball.vx = Math.cos(clampedAngle) * ball.speed;
      ball.vy = Math.sin(clampedAngle) * ball.speed;
      ball.x = player.x + paddle.width + ballDefaults.size / 2 + 0.5;
      {
        const strength =
          clamp(
            (ball.speed - ballStartSpeed) /
              (ballMaxSpeed - ballStartSpeed + 1e-6),
            0,
            1
          ) *
          (0.6 + 0.4 * Math.min(1, Math.abs(hitPos)));
        sfxPaddle(strength);
        spawnSparks(left, ball.y, -1, 0, 0.6 + strength * 0.6);
        if (ball.speed > ballStartSpeed * 1.2) addScreenShake(4, 140);
      }
      maybeTaunt(
        "playerHit",
        currentDifficulty === "easy"
          ? 0.18
          : currentDifficulty === "medium"
          ? 0.12
          : 0.07
      );

      // Sharp angle/speed taunt when speed increases significantly and angle is steep
      if (Math.abs(hitPos) > 0.6 && ball.speed > ballStartSpeed * 1.2) {
        maybeTaunt(
          "sharp",
          currentDifficulty === "easy"
            ? 0.25
            : currentDifficulty === "medium"
            ? 0.18
            : 0.12
        );
      }
    }

    // AI paddle
    if (
      right >= ai.x &&
      left <= ai.x + paddle.width &&
      bottom >= ai.y &&
      top <= ai.y + paddle.height &&
      ball.vx > 0
    ) {
      currentRallyHits += 1;
      const hitPos =
        (ball.y - (ai.y + paddle.height / 2)) / (paddle.height / 2);
      const baseAngle = hitPos * MAX_BOUNCE_ANGLE;
      ball.speed = clamp(ball.speed * 1.05, ballStartSpeed, ballMaxSpeed);
      let nextVx = Math.cos(baseAngle) * ball.speed;
      let nextVy = Math.sin(baseAngle) * ball.speed;
      nextVy += ai.vy * PADDLE_SPIN;
      const rawAngle = Math.atan2(nextVy, Math.abs(nextVx));
      const clampedAngle = clamp(rawAngle, -MAX_BOUNCE_ANGLE, MAX_BOUNCE_ANGLE);
      ball.vx = -Math.cos(clampedAngle) * ball.speed;
      ball.vy = Math.sin(clampedAngle) * ball.speed;
      ball.x = ai.x - ballDefaults.size / 2 - 0.5;
      {
        const strength =
          clamp(
            (ball.speed - ballStartSpeed) /
              (ballMaxSpeed - ballStartSpeed + 1e-6),
            0,
            1
          ) *
          (0.6 + 0.4 * Math.min(1, Math.abs(hitPos)));
        sfxPaddle(strength);
        spawnSparks(right, ball.y, 1, 0, 0.6 + strength * 0.6);
        if (ball.speed > ballStartSpeed * 1.2) addScreenShake(4, 140);
      }
      maybeTaunt(
        "aiHit",
        currentDifficulty === "easy"
          ? 0.22
          : currentDifficulty === "medium"
          ? 0.16
          : 0.1
      );

      if (Math.abs(hitPos) > 0.6 && ball.speed > ballStartSpeed * 1.2) {
        maybeTaunt(
          "sharp",
          currentDifficulty === "easy"
            ? 0.28
            : currentDifficulty === "medium"
            ? 0.2
            : 0.14
        );
      }
    }

    // Scoring
    if (ball.x < -ballDefaults.size) {
      onScore("ai");
    }
    if (ball.x > GAME_WIDTH + ballDefaults.size) {
      onScore("player");
    }

    addTrailPoint();
  }

  let lastTime = 0;
  function loop(ts) {
    if (lastTime === 0) lastTime = ts;
    const dt = Math.min(0.033, (ts - lastTime) / 1000);
    lastTime = ts;

    if (state === State.COUNTDOWN) {
      if (performance.now() >= countdownEndAt) {
        serveBall(nextServeDirection);
        setState(State.PLAYING);
      }
    } else if (state === State.PLAYING) {
      updatePlayer(dt);
      updateAI(dt);
      updateBall(dt);
      updateEffects(dt);
      // Occasional random taunts while playing
      if (
        randomChance(
          currentDifficulty === "easy"
            ? 0.004
            : currentDifficulty === "medium"
            ? 0.0025
            : 0.0015
        )
      ) {
        maybeTaunt("random", 1.0);
      }
    }

    draw();
    requestAnimationFrame(loop);
  }

  // Controls
  function setState(next) {
    state = next;
    if (state === State.PLAYING && ball.vx === 0 && ball.vy === 0) {
      serveBall();
    }
  }

  function applyDifficulty(level) {
    currentDifficulty = level;
    const preset = DIFFICULTY_PRESETS[level];
    // Base from preset, then layer adaptive offsets
    aiMaxSpeed = preset.aiMaxSpeed;
    aiReactionDelay = preset.aiReaction;
    aiError = preset.aiError;
    ballStartSpeed = preset.ballSpeed;
    ballMaxSpeed = preset.ballMaxSpeed;
    applyAdaptiveOffsets();
    isHard = level === "hard";
    // Unified base cooldown; difficulty no longer changes it
    tauntCooldownMs = 5000;
    if (tauntBar) {
      tauntBar.classList.remove(
        "persona-easy",
        "persona-medium",
        "persona-hard"
      );
      tauntBar.classList.add(
        level === "easy"
          ? "persona-easy"
          : level === "medium"
          ? "persona-medium"
          : "persona-hard"
      );
      setTauntBarPersonaColor(level);
    }
    resetAIThinking();
  }

  // Initialize difficulty from selected radio (default medium)
  const checked = difficultyRadios.find((r) => r.checked);
  if (checked) applyDifficulty(checked.value);
  difficultyRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      if (state === State.PLAYING) return; // do not change mid-play
      applyDifficulty(radio.value);
    });
  });

  function startCountdown(direction) {
    nextServeDirection = direction;
    countdownEndAt = performance.now() + 3000; // 3 seconds
    state = State.COUNTDOWN;
  }

  function startMatch() {
    // Reset scores and stats
    player.score = 0;
    ai.score = 0;
    updateScoreUI();
    longestRally = 0;
    totalRallies = 0;
    playerAces = 0;
    aiAces = 0;
    currentRallyHits = 0;
    matchWinner = null;
    // Randomize initial server and begin countdown
    server = Math.random() < 0.5 ? "player" : "ai";
    resetPositions();
    resetAIThinking();
    startBtn.textContent = "Start";
    startCountdown(server === "player" ? 1 : -1);
  }

  startBtn.addEventListener("click", () => {
    ensureAudio();
    if (state === State.MENU || state === State.MATCH_OVER) {
      startMatch();
    } else if (state === State.PAUSED) {
      setState(State.PLAYING);
    }
  });

  pauseBtn.addEventListener("click", () => {
    setState(state === State.PAUSED ? State.PLAYING : State.PAUSED);
  });

  resetBtn.addEventListener("click", () => {
    player.score = 0;
    ai.score = 0;
    updateScoreUI();
    resetPositions();
    resetAIThinking();
    ball.vx = 0;
    ball.vy = 0;
    startBtn.textContent = "Start";
    setState(State.MENU);
  });

  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
      }
      if (e.key === "ArrowUp" || e.key.toLowerCase() === "w") input.up = true;
      if (e.key === "ArrowDown" || e.key.toLowerCase() === "s")
        input.down = true;
      if (e.key === " ") {
        if (state === State.MENU || state === State.MATCH_OVER) startMatch();
        else if (state === State.PAUSED) setState(State.PLAYING);
      }
    },
    { passive: false }
  );
  window.addEventListener(
    "keyup",
    (e) => {
      if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
      }
      if (e.key === "ArrowUp" || e.key.toLowerCase() === "w") input.up = false;
      if (e.key === "ArrowDown" || e.key.toLowerCase() === "s")
        input.down = false;
    },
    { passive: false }
  );

  // Pointer controls
  function canvasToGameY(clientY) {
    const rect = canvas.getBoundingClientRect();
    const y = clientY - rect.top;
    const scaleY = GAME_HEIGHT / rect.height;
    return y * scaleY;
  }

  canvas.addEventListener("pointerdown", (e) => {
    ensureAudio();
    input.pointerActive = true;
    input.pointerY = canvasToGameY(e.clientY);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!input.pointerActive) return;
    input.pointerY = canvasToGameY(e.clientY);
  });
  window.addEventListener("pointerup", () => {
    input.pointerActive = false;
  });

  // Init
  function init() {
    updateScoreUI();
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    requestAnimationFrame(loop);
  }

  init();
})();

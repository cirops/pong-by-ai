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

  let player = { x: 24, y: GAME_HEIGHT / 2 - paddle.height / 2, score: 0 };
  let ai = {
    x: GAME_WIDTH - 24 - paddle.width,
    y: GAME_HEIGHT / 2 - paddle.height / 2,
    score: 0,
  };
  let ball = {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT / 2,
    vx: 0,
    vy: 0,
    speed: ballDefaults.speed,
  };

  // Difficulty-configurable parameters (defaults = medium)
  const DIFFICULTY_PRESETS = {
    easy: {
      aiMaxSpeed: 260,
      aiReaction: 0.15,
      aiError: 0.25,
      ballSpeed: 330,
      ballMaxSpeed: 700,
    },
    medium: {
      aiMaxSpeed: 470,
      aiReaction: 0.045,
      aiError: 0.08,
      ballSpeed: 360,
      ballMaxSpeed: 850,
    },
    hard: {
      aiMaxSpeed: 1400,
      aiReaction: 0.0,
      aiError: 0.0,
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
      drawRect(x, y, netWidth, segmentHeight, "#6c8cff");
    }
    ctx.restore();
  }

  function draw() {
    // Background
    drawRect(0, 0, GAME_WIDTH, GAME_HEIGHT, "#0b0e22");

    drawNet();

    // Paddles
    drawRect(player.x, player.y, paddle.width, paddle.height, "#73e0a9");
    // AI paddle color depends on persona/difficulty
    const aiColor =
      currentDifficulty === "easy"
        ? "#4da3ff"
        : currentDifficulty === "medium"
        ? "#a06cff"
        : "#ff5c6b";
    drawRect(ai.x, ai.y, paddle.width, paddle.height, aiColor);

    // Ball (circle)
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ballDefaults.size / 2, 0, Math.PI * 2);
    ctx.fill();

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

  function updatePlayer(dt) {
    let dy = 0;
    if (input.up) dy -= paddle.speed * dt;
    if (input.down) dy += paddle.speed * dt;

    if (input.pointerActive) {
      const targetY = input.pointerY - paddle.height / 2;
      const diff = targetY - player.y;
      dy = clamp(diff, -paddle.speed * dt * 1.2, paddle.speed * dt * 1.2);
    }

    player.y += dy;
    player.y = clamp(player.y, 0, GAME_HEIGHT - paddle.height);
  }

  function updateAI(dt) {
    // Predictive but limited speed
    const aiCenter = ai.y + paddle.height / 2;
    const noise = (Math.random() - 0.5) * aiError * 200;
    const target = ball.y + ball.vy * aiReactionDelay + noise;
    const diff = target - aiCenter;
    const maxStep = aiMaxSpeed * dt;
    const step = clamp(diff, -maxStep, maxStep);

    // Only chase when ball moving towards AI to make it fair
    if (isHard || ball.vx > 0 || Math.abs(diff) > paddle.height * 0.25) {
      ai.y += step;
    }
    ai.y = clamp(ai.y, 0, GAME_HEIGHT - paddle.height);
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
      state = State.MATCH_OVER;
      startBtn.textContent = "Rematch";
      resetPositions();
      ball.vx = 0;
      ball.vy = 0;
      return;
    }

    // Next point: alternate server and start countdown
    server = scorer === "player" ? "ai" : "player";
    resetPositions();
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
    }
    if (ball.y + ballDefaults.size / 2 >= GAME_HEIGHT) {
      ball.y = GAME_HEIGHT - ballDefaults.size / 2;
      ball.vy = -Math.abs(ball.vy);
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
      const angle = hitPos * (Math.PI / 3); // up to 60°
      ball.speed = clamp(ball.speed * 1.05, ballStartSpeed, ballMaxSpeed);
      ball.vx = Math.cos(angle) * ball.speed;
      ball.vy = Math.sin(angle) * ball.speed;
      ball.x = player.x + paddle.width + ballDefaults.size / 2 + 0.5;
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
      const angle = hitPos * (Math.PI / 3);
      ball.speed = clamp(ball.speed * 1.05, ballStartSpeed, ballMaxSpeed);
      ball.vx = -Math.cos(angle) * ball.speed;
      ball.vy = Math.sin(angle) * ball.speed;
      ball.x = ai.x - ballDefaults.size / 2 - 0.5;
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
    aiMaxSpeed = preset.aiMaxSpeed;
    aiReactionDelay = preset.aiReaction;
    aiError = preset.aiError;
    ballStartSpeed = preset.ballSpeed;
    ballMaxSpeed = preset.ballMaxSpeed;
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
    }
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
    startBtn.textContent = "Start";
    startCountdown(server === "player" ? 1 : -1);
  }

  startBtn.addEventListener("click", () => {
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

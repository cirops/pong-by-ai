# A pragmatic, prioritized game design roadmap

## 1. Core play loop (must-have)

- [x] Define best-of match structure with explicit Serve → Rally → Point → Match transitions and clear win conditions
- [x] Implement pause, restart, and quit flows; add post-match summary with key stats (rallies, aces, shot accuracy)
- [x] Codify service rules: alternating serves, visible countdown, and fault prevention

## 2. Game feel and readability (must-have)

- [x] Layered feedback: SFX for hits/walls/score; subtle screen shake on high-impact hits; hit sparks and trails
- [x] Ball/paddle response: contact-point-driven angles with optional spin; enforce speed cap with gradual ramp-up
- [x] Readability first: high-contrast ball, motion trails tuned for 60fps, colorblind-safe palette

## 3. Difficulty and progression

- [x] Calibrated AI: human-like misses, tiered reaction delays; avoids “perfect tracking”
- [x] Adaptive difficulty: adjust AI after each set based on margin of victory
- [x] Modes: Classic: The default game mode, choose the difficulty and play
- [x] Target Practice: enemy paddle becomes a fixed target on every bounce, hitting will spawn another one and the score will go up
- [ ] Arcade: The arcade mode, 3 wins per tier → next tier; subtier ramp, game over screen with stats

## 4. UX and structure

- [ ] Flow: Title → Mode Select → Difficulty → Match; quick rematch; on-screen key prompts
- [ ] First-time 30s tutorial (move, hit, spin) with skippable tips
- [ ] Settings: audio sliders, difficulty, controls, visual toggles

## 5. Retention and stakes

- [ ] Local leaderboards and personal bests; shareable score card
- [ ] Light cosmetic unlocks: paddle skins/taunts via milestones (win streaks, long rallies)
- [ ] Daily challenge seed so everyone plays the same layout/speeds each day

## 6. Social and multiplayer (next tier)

- [ ] Local 2P (same keyboard/controller split)
- [ ] Potential online versus later: rollback or delay-based sync; quickplay + friend invite

## 7. Production polish

- [ ] Performance budget for low-end devices; 60fps target; resize/fullscreen handling
- [ ] Basic privacy-respecting analytics (session length, mode played, difficulty chosen, quits)
- [ ] Save system for settings, unlocks, and leaderboards

## Success criteria

- New players complete a match without confusion.
- Average session length >5 minutes; at least one rematch per player on average.
- Stable 60fps on laptop and mobile; inputs feel tight; no menu dead-ends.

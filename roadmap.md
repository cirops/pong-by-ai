# A pragmatic, prioritized game design roadmap

## 1. Core play loop (must-have)

- [x] Define best-of match structure with explicit Serve → Rally → Point → Match transitions and clear win conditions
- [x] Implement pause, restart, and quit flows; add post-match summary with key stats (rallies, aces, shot accuracy)
- [x] Codify service rules: alternating serves, visible countdown, and fault prevention

## 2. Game feel and readability (must-have)

- [x] Layered feedback: SFX for hits/walls/score; subtle screen shake on high-impact hits; hit sparks and trails
- [ ] Ball/paddle response: contact-point-driven angles with optional spin; enforce speed cap with gradual ramp-up
- [ ] Readability first: high-contrast ball, motion trails tuned for 60fps, colorblind-safe palette

## 3. Inputs and accessibility (must-have)

- [ ] Rebindable inputs; controller support; touch controls on mobile with assist aim
- [ ] Input buffering to mask latency; frame-rate-independent paddle speed
- [ ] Accessibility options: colorblind presets, reduced-motion toggle, adjustable difficulty

## 4. Difficulty and progression

- [ ] Calibrated AI: human-like misses, tiered reaction delays; avoids “perfect tracking”
- [ ] Adaptive difficulty: adjust AI after each set based on margin of victory
- [ ] Modes: Arcade (ramping AI), Time Attack (score within time), Practice (ball launcher)

## 5. UX and structure

- [ ] Flow: Title → Mode Select → Difficulty → Match; quick rematch; on-screen key prompts
- [ ] First-time 30s tutorial (move, hit, spin) with skippable tips
- [ ] Settings: audio sliders, difficulty, controls, visual toggles

## 6. Retention and stakes

- [ ] Local leaderboards and personal bests; shareable score card
- [ ] Light cosmetic unlocks: paddle skins/taunts via milestones (win streaks, long rallies)
- [ ] Daily challenge seed so everyone plays the same layout/speeds each day

## 7. Social and multiplayer (next tier)

- [ ] Local 2P (same keyboard/controller split)
- [ ] Potential online versus later: rollback or delay-based sync; quickplay + friend invite

## 8. Production polish

- [ ] Performance budget for low-end devices; 60fps target; resize/fullscreen handling
- [ ] Basic privacy-respecting analytics (session length, mode played, difficulty chosen, quits)
- [ ] Save system for settings, unlocks, and leaderboards

## Success criteria

- New players complete a match without confusion.
- Average session length >5 minutes; at least one rematch per player on average.
- Stable 60fps on laptop and mobile; inputs feel tight; no menu dead-ends.

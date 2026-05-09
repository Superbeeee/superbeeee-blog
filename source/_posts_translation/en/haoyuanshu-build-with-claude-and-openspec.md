---
title: "SDD in Practice: Building HaoYuanShu, a Buddhist Recitation App (iOS) with Claude Design, openspec & Claude Code"
date: 2026-05-08 14:30:00
lang: en
translation_key: haoyuanshu-build-with-claude-and-openspec
description: Building HaoYuanShu, a Buddhist recitation iOS app, in two weekends with Claude Design + openspec + Claude Code. SDD workflow notes on what AI output is usable, what needs human review.
categories:
  - 技術
tags:
  - AI
  - Claude Code
  - Claude Design
  - openspec
  - React Native
  - Expo
---

I grew up watching my grandmother turn prayer beads while reciting sutras, using a small counter to track each chant. Years later I picked up the practice myself, and existing recitation apps either drowned the experience in flashy UI or forced the wrong mental model onto the act of chanting. Across two weekends I built my own — ideating screens with Claude Design, locking the spec down with openspec, shipping the React Native + Expo build with Claude Code, and finally running it on my own iPhone.

The other motivation was to put **SDD (Spec-Driven Development)** to a real test: write the spec first, then let AI implement strictly against it, and see whether it actually beats vibe coding on stability and traceability. HaoYuanShu was a self-assigned exercise.

This post is a record of the whole process — and the rough edges and trade-offs of working alongside AI.

<!-- more -->

## Why HaoYuanShu

Let me start with what this app actually solves.

There's no shortage of recitation apps on the market, but most have two problems. First, the UI is "ornate" — gilded buttons, jumpy counters, ad-heavy layouts — the visual opposite of the stillness recitation is supposed to bring. Second, the counting model is wrong: what reciters actually care about is *who*, *for what purpose*, *how many vows pledged*, *to whom dedicated* — not just a number ticking up.

What if we had an "electronic merit ledger"?

- **Two modes**: some prefer structured vows (108 chants per day for 49 days), some prefer freeform daily logging — both should be supported.
- **Immersive recitation**: tapping the wooden fish makes a sound and ripples, but **the wooden fish doesn't count chants**. The count is bumped manually with ±1 buttons. Misspeaking, restarting, skipping a line — that's normal in practice. Auto-counting only creates anxiety.
- **Merit archive**: completed vows should be archived with a sense of ritual, not silently flushed.
- **Local-first**: no signup, no upload, all data stays on the device (cloud sync may come later).

The final stack was React Native + Expo SDK 54, TypeScript, Zustand, AsyncStorage, expo-av, expo-notifications. But this post isn't about stack choice — the focus is **how AI participated in the whole process**.

## A three-stage AI workflow

I split the project into three stages, each paired with one tool:

| Stage | Tool | Output |
|---|---|---|
| Ideation (UI/UX) | Claude Design | 10 HTML prototype screens |
| Specification | openspec | proposal / design / tasks documents |
| Implementation | Claude Code | Running Expo + RN code |

Plus a fourth stage: **on-device acceptance on the iPhone** — and that one I couldn't hand off to AI.

The mental anchor: **each stage gives AI one job, and no stage runs fully on autopilot**. I had to keep both hands on the wheel the whole time.

## Stage 1: Claude Design turns abstract aesthetics into HTML

My first prompt was:

> I want to build a recitation app with a quiet, Zen aesthetic: rice-paper white background, ink black, cinnabar red accents, Source Han Serif typography. Please design 10 screens: onboarding, home, create plan, today's recitation, immersive mode, completion ritual, merit archive, settings, daily mode, sutra drawer. Render each screen as an HTML prototype.

Claude Design produced 10 HTML mockups. The colors and typography were broadly on point. The visualization of the overall design language was surprisingly good — the combination of red seal stamp + black hairline rule + rice-paper texture background suggests Claude has done its homework on the genre.

![Mode-selection screen](/post/2026/05/haoyuanshu-build-with-claude-and-openspec/01-onboarding.png)

Claude Design did have rough edges:

1. **HTML is static, interactions are limited**. Wooden-fish ripple animations and bottom-sheet drag could only be hinted at as static states.
2. **Design tokens don't carry forward automatically**. The "cinnabar red #B7332B" I emphasized on screen 3 became "vermilion #C04A3D" by screen 7. At prototype stage that's harmless, but when handing off to Claude Code it becomes a landmine — you have to manually reconcile.

My fix was to "translate" the prototypes into a single design token table:

```ts
// Tokens distilled from the 10 HTML prototypes;
// every RN component reads from this single source.
export const lightTokens = {
  bg: '#F5EFE3',           // rice-paper background
  ink: '#1F1A14',          // ink black
  cinnabar: '#B7332B',     // cinnabar (seal / accent)
  goldLeaf: '#C8A75A',     // gold leaf (secondary accent)
  moss: '#5C7757',         // moss green (success)
  hairline: '#1F1A1422',   // semi-transparent black (rules)
  paper: '#EFE6D2',        // card paper tone
  fontSerif: 'NotoSerifTC_400Regular',
};
```

This token table later became Claude Code's single source of visual truth — the prototype screenshots were only ever "indicative", but for any color, spacing, or font size, the code referenced this file. **That small upfront discipline saved a lot of visual review time later.**

## Stage 2: openspec is version control for the spec

The biggest problem with vibe coding: you say "build me X", AI returns a chunk of code, you skim it, looks fine, you merge. Three days later you want Y, AI re-reads the context — and its understanding doesn't match your memory.

openspec's answer is to write each "what we're changing" into files:

```
openspec/changes/haoyuanshu-expo-app/
├── proposal.md   # Why + What changes (for humans)
├── design.md     # technical decisions, data model, interactions
└── tasks.md      # checkbox-style task list (for AI to execute)
```

A real `proposal.md` looked like:

```markdown
## Why
HaoYuanShu is an iOS Zen-aesthetic app centered on Heart Sutra
recitation. We currently have only HTML prototypes (10 screens);
we need to convert them into a native Expo + React Native +
TypeScript implementation.

## What Changes
- Set up a fresh Expo (SDK 52+) + React Native + TypeScript project
- Wooden-fish tap plays real audio but **does not increment the count**;
  count is controlled by ±1 buttons
- Plan data is stored locally via AsyncStorage
- **Out of scope for now**: cloud sync, accounts

## Capabilities
- woodfish-counter: wooden-fish component + counting logic
- plan-management: vow-plan CRUD + 90-day heatmap
- ...
```

Writing the proposal + tasks took meaningful time — basically replaying the entire app in my head. That up-front cost was worth it for three reasons:

1. **AI reads spec more accurately than screenshots.** The fine print on a screen — where this button leads, what the empty state looks like, what happens when permission is denied — is hard to absorb visually. Spec pins it down so AI can't drift.
2. **tasks.md becomes a progress bar.** Every Claude Code session, I'd say "run the next unchecked task". It runs, ticks the box, I review, git commit. Traceable, reversible.
3. **When spec and code disagree, spec is the source of truth.** This rule alone caught several bugs where Claude tried to reinterpret instructions later in the project.

Honestly, the value of openspec isn't in the magic of those three markdown formats. It's that the format forces you to **think the problem through before writing a line of code**.

## Stage 3: Claude Code + tasks.md as a duo

Implementation rhythm looked like this:

```
Me:           Run the 5.X series in tasks.md (wooden-fish component).
Claude Code:  [edits Woodfish.tsx, useWoodfishAudio hook, ...]
Me:           git diff → run in simulator → check the box, or push back.
```

The most satisfying moment was the Zustand store. After I described "rehydrate from AsyncStorage on launch, persist on every update", AI generated a structure almost identical to the one in my head:

```ts
// src/store/index.ts (excerpt)
const persist = (key: string, value: unknown) => {
  AsyncStorage.setItem(key, JSON.stringify(value)).catch((e) => {
    console.warn(`[store] write to ${key} failed:`, e);
  });
};

export const useStore = create<AppState>((set, get) => ({
  plans: [],
  hydrated: false,

  hydrate: async () => {
    const [plansStr, logsStr, settingsStr] = await Promise.all([
      AsyncStorage.getItem(KEYS.plans),
      AsyncStorage.getItem(KEYS.dailyLogs),
      AsyncStorage.getItem(KEYS.settings),
    ]);
    set({ plans: plansStr ? JSON.parse(plansStr) : [], /* ... */ hydrated: true });
  },

  addPlan: (plan) => {
    const plans = [...get().plans, plan];
    set({ plans });
    persist(KEYS.plans, plans);  // every write syncs back to storage
  },
}));
```

But more often, AI **hallucinates**.

The most memorable case: tasks.md item #7 was "Onboarding writes the chosen mode into the store and navigates to the home screen". Claude reported "done". `git diff` showed it had indeed edited `OnboardingScreen.tsx` — but **it had never actually called `updateSettings({ appMode })`**. It just `console.log`-ed a line. In simulator, picking a mode and relaunching threw you back to onboarding.

After that, I made a personal rule: **`git diff` is the ground truth. AI saying "done" doesn't count.** Every task ends with me reading the diff. No diff review, no checkbox.

![Create-plan screen](/post/2026/05/haoyuanshu-build-with-claude-and-openspec/03-create-plan.png)

### Design trade-offs under AI collaboration

Two places where I had to push back on AI's defaults and stick to my own judgment:

**1. The wooden fish doesn't count**

Claude Code's first pass: tapping the wooden fish plays the sound **and auto-increments the count**. Technically reasonable, ritually wrong — real reciters misspeak, restart, skip lines. Auto-count creates pressure rather than focus. I put back the spec's rule: "wooden fish only emits sound; counting is independent". AI accepted on rerun, but if I hadn't pushed back, the default would have stuck.

**2. Immersive mode hides everything**

AI defaulted to adding a toolbar, font-size controls, a bottom tab bar — "for usability". But the entire point of immersive mode is *fewer interruptions*. I cut 80% of those elements, leaving only the wooden fish, the count, and pause. I baked this into design.md — "immersive mode hides everything except: wooden fish, count, pause" — and AI stopped re-adding things in subsequent sessions.

![Immersive recitation mode](/post/2026/05/haoyuanshu-build-with-claude-and-openspec/05-immersive.png)

## Stage 4: Three iPhone-on-device pitfalls

The simulator was lying. The device was the truth.

**Pitfall 1: Apple ID signing**
First `npx expo run:ios --device` finished, installed to my iPhone, and the app **crashed immediately on launch**. Reason: my Apple ID dev certificate wasn't trusted by the device — you have to manually trust it under "Settings → General → VPN & Device Management". Every tutorial mentions this, but as someone who hadn't built native apps before I still got stuck.

**Pitfall 2: expo-av first-play latency**
Tapping the wooden fish in simulator: instant sound. On device: **about 200ms of latency**. Cause: `Audio.Sound.createAsync()` does codec decoding on first play, noticeable on hardware. The fix: cache the sound object in a ref and pre-load on app start:

```tsx
const soundRef = useRef<Audio.Sound | null>(null);

const loadAndPlay = useCallback(async () => {
  if (muted) return;
  if (!soundRef.current) {
    const { sound } = await Audio.Sound.createAsync(woodfishWav);
    soundRef.current = sound;
  }
  await soundRef.current.setPositionAsync(0);
  await soundRef.current.playAsync();
}, [muted]);
```

The first AI pass didn't cache (because it wasn't perceptible in the simulator). I only caught it on the device.

**Pitfall 3: expo-notifications permissions**
`Notifications.scheduleNotificationAsync()` succeeds silently in simulator. On a real device it requires `requestPermissionsAsync()` first, and iOS won't re-prompt — once a user declines, they have to manually enable it in Settings. AI's first version handled none of the permission flow; I only noticed when "Enable reminders" did nothing on my iPhone.

The shared pattern: **the simulator can't reproduce these bugs, and AI can't see the simulator either**. Hardware testing is the part AI can't help with.

![Completion-ritual screen](/post/2026/05/haoyuanshu-build-with-claude-and-openspec/06-complete.png)

## Reflection: what AI can and can't be handed

After two weekends, here's the rough split:

| Hand to AI | Don't hand to AI |
|---|---|
| Boilerplate (component scaffolds, type definitions) | *Why* the app should exist |
| Implementation of well-specified details | Writing the spec itself (only you know what users want) |
| Refactoring, naming, TypeScript types | Final design system / token decisions |
| Small bug fixes, adding `console.log` for debugging | Definition of "done" (only `git diff` decides) |
| Unit tests with clear inputs/outputs | On-device acceptance (AI can't see hardware) |

The single most important takeaway: **spec beats prompt**. A clearly written proposal + tasks list keeps AI on the same trajectory across N conversations. Re-explaining context in each new prompt invites AI to "re-understand" each time, and you'll get a different answer each time.

openspec isn't a magical framework. Its real benefit is forcing you to **think the problem through before writing a line of code**. That part AI cannot do for you.

![Merit archive](/post/2026/05/haoyuanshu-build-with-claude-and-openspec/07-archive.png)

## Closing

Two weekends, one app running on my own iPhone. Three years ago this would have been unimaginable. Day to day I write Vue front-end. React Native I'd barely touched. Expo I'd never opened. Yet with Claude Design handling UI ideation, openspec pinning the spec down, and Claude Code wrangling the RN + TypeScript details, all I had to do was **hold the direction, read git diffs, and test on hardware**.

I won't say "AI replaced me writing code" — the wooden-fish counting trade-off, the signing fix, the 200ms latency optimization, none of those came from AI.

But AI absolutely shrunk the path from "want to build" → "can build" → "got it built". **The biggest bottleneck now isn't "can you write it?" but "do you want to, and do you know what to build?"**

I now use HaoYuanShu daily on my iPhone to log my Heart Sutra practice — the original itch is scratched. Next up might be cloud backup, or sharing merit dedications with family — but those are stories for the next openspec change.

---

> Source code lives on GitHub: [haoyuanshu](https://github.com/superbeeee) (under cleanup). If you'd like to try this Claude Design + openspec + Claude Code workflow yourself, feel free to reach out.

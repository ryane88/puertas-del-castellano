# AGENTS.md — Puertas del Castellano

## Project Overview

Puertas del Castellano is a mobile-friendly, interactive Spanish-learning castle built using Twine, SugarCube 2.37.3, Twee, Tweego, JavaScript, CSS, and Supabase.

The project is hosted on GitHub Pages, with Supabase providing dynamic content.

The castle combines vocabulary exploration, grammar practice, creative writing, and interactive storytelling.

## Architecture

### Main files

- `src/passages/castle.twee` — SugarCube passages and embedded story logic.
- `src/story.js` — Shared JavaScript and Supabase helpers.
- `src/story.css` — Shared styles and animations.
- `images/` — Castle paintings, room backgrounds, and other images.
- `audio/` — Ambient sounds and effects.
- `tools/tweego/` — Local Tweego compiler.
- `index.html` — Generated playable story; not the primary source file.
- `.vscode/tasks.json` — VS Code build tasks.

### Build

The existing development command is:

```bash
./tools/tweego/tweego -w -o index.html src
```

Use the existing Tweego compiler and project configuration. For a one-time compilation, omit `-w`.

Do not introduce a new build system without permission.

## The Three Doors

### PDD — Palabra del Día

Vocabulary exploration through interconnected castle rooms.

Important features:

- Vocabulary data loaded from Supabase.
- Reusable room passage `TestMystRoom`.
- Chronological and semantic room connections.
- Left/right door rotation and room entry.
- Paintings, room descriptions, and navigation.
- Vocabulary quizzes and journaling.
- Direct links using `?pdd=123` or `?pdd=today`.

Preserve existing navigation behavior and room history.

### PDC — Poemas de la Conjugación

Daily Spanish poems for practicing verb conjugations and grammar.

Important features:

- Poems stored in Supabase.
- Daily poem selection.
- Associated background images.
- Grammar and conjugation practice.
- Future plans for a dedicated poem diary.

Do not change the poem-selection algorithm without explicit instructions.

### PDB — Solo en el Castillo

A solo journaling and storytelling adventure.

Important features:

- Prompts loaded from Supabase.
- Player-written journal entries.
- Three recent memories retained during an adventure.
- Random prompt selection.
- Save and continue controls.
- New adventure/reset functionality.

The player must remain responsible for writing their own story. Do not automatically generate journal responses.

## Supabase

The project uses Supabase REST API requests through native JavaScript `fetch()`.

Known tables include:

- `rooms`
- `room_connections`
- `chapters`
- `solo_prompts`
- `poemas`

The Supabase project URL and browser publishable key are configured in existing JavaScript.

Rules:

- Preserve existing API conventions.
- Do not expose private credentials or service-role keys.
- Do not modify database schemas, policies, or data without explicit permission.
- Do not assume unpublished rooms are publicly accessible.
- Avoid unnecessary or duplicate API requests.
- Preserve compatibility with existing published content.

## Coding Rules

1. Make small, focused, reversible changes.
2. Read the relevant existing code before editing.
3. Preserve working features unless a change is explicitly requested.
4. Reuse existing functions and styles where practical.
5. Avoid duplicate event handlers, global variables, and API requests.
6. Prefer editing source files rather than generated `index.html`.
7. Keep interfaces usable on desktop and iPhone.
8. Preserve SugarCube passage navigation and state handling.
9. Do not introduce frameworks or dependencies without permission.
10. Do not refactor unrelated code while implementing a feature.

## Testing

After a code change:

1. Run a one-time Tweego compilation.
2. Report any compilation errors.
3. Test affected functionality where testing tools are available.
4. Identify any tests that could not be performed.
5. Summarize which files changed.

A successful compilation does not prove that browser behavior or Supabase integration works.

## Git and Deployment

- Do not automatically deploy to GitHub Pages.
- Do not push commits without explicit permission.
- Do not overwrite working source files unnecessarily.
- Prefer reviewing changes before committing.
- Treat generated `index.html` as a build artifact.

## Visual Design

The castle uses a medieval-fantasy visual identity.

Preserve:

- Gothic stone architecture.
- Warm torchlight and atmospheric shadows.
- Painterly, cinematic imagery.
- Responsive layouts.
- Readable text and accessible navigation.
- Use dark text on a light background for room form fields and native pickers. Keep labels, placeholder text, and selected values readable in their default, focus, and disabled states, including when the browser uses dark mode. Keep keyboard focus and disabled controls visually distinguishable.
- Existing door, painting, and room styling.

Avoid introducing unrelated visual styles.

## Planned Features

These are ideas for future development, not authorization to implement them.

- Entire doorway image clickable.
- Swipe left/right navigation on mobile.
- Espejo del Infinito for randomized room travel.
- Locked-door vocabulary quizzes.
- Seven-day vocabulary hallway.
- Chapter manuscript reader with vocabulary links.
- Dedicated poem diary.
- Expanded solo adventure prompts and revisit mechanics.

## Working Style

The project owner prefers incremental development.

For each task:

1. Explain the proposed approach briefly.
2. Identify which files need modification.
3. Implement only the requested change.
4. Compile and test where possible.
5. Summarize the result in plain English.

When requirements are ambiguous or a change could affect working functionality, ask before making major architectural decisions.

**Primary principle: Protect the functioning castle while improving it one feature at a time.**
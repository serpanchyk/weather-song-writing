# Define Shared Contracts And Constants

## Type

AFK

## Context

- [Vision Input Controls](../../VISION.md#input-controls)
- [Vision Final Ranking](../../VISION.md#final-ranking)
- [Glossary](../../../CONTEXT.md)

## What To Build

Define shared TypeScript contracts for user inputs, model catalog entries,
candidate outputs, judge scores, ranking results, run summaries, and controlled
option values.

## Acceptance Criteria

- [ ] Shared contracts include location, date/time, genre, language, lyrics
      structure, mood, candidate model IDs, and optional judge model ID.
- [ ] Constants cover initial genre, language, lyrics structure, and mood options.
- [ ] Validation rules enforce two to six candidate models and no duplicate
      candidate model selections.
- [ ] Scoring helpers implement the documented quality, cost, speed, and overall
      value formula.
- [ ] Unit tests cover validation and scoring edge cases.

## Blocked By

- [Create TypeScript workspace foundation](0001-typescript-workspace-foundation.md)

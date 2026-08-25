# Create Frontend Input Flow

## Type

AFK

## Context

- [Vision User Experience](../../VISION.md#user-experience)
- [Vision Input Controls](../../VISION.md#input-controls)
- [System Frontend Responsibility](../../system/README.md#frontend-responsibility)

## What To Build

Create the static frontend input experience for selecting weather, creative
controls, candidate models, and the judge model.

## Acceptance Criteria

- [ ] UI supports city input and coordinate input.
- [ ] UI supports local date/time selection.
- [ ] Genre, language, lyrics structure, and mood are dropdown controls.
- [ ] Candidate model selector uses the Worker model catalog and allows two to
      six unique selections.
- [ ] Judge model selector uses the same catalog, has a recommended default, and
      allows override.
- [ ] UI warns when judge model is also selected as a candidate model.
- [ ] UI shows pricing metadata and warnings for missing or expensive pricing
      when available.
- [ ] Form validation prevents invalid generation requests.
- [ ] Frontend tests cover validation and selector behavior.

## Blocked By

- [Expose OpenRouter model catalog](0005-openrouter-model-catalog.md)
- [Run candidate generation and scoring](0008-generation-scoring-pipeline.md)

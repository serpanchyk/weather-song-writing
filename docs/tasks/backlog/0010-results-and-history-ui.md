# Show Ranked Results And Run History

## Type

AFK

## Context

- [Vision Run History](../../VISION.md#run-history)
- [Vision Final Ranking](../../VISION.md#final-ranking)
- [System Frontend Responsibility](../../system/README.md#frontend-responsibility)

## What To Build

Create the frontend result view and global run history browser.

## Acceptance Criteria

- [ ] Result view shows ranked lyrics, model names after evaluation, quality
      scores, cost estimates, response times, overall value, and top-rated output.
- [ ] The visible formula explains how overall value is calculated.
- [ ] Candidate outputs are not shown with model names until evaluation is
      complete.
- [ ] Failed or timed-out candidates appear with error status.
- [ ] Global history lists previous runs newest-first.
- [ ] Users can reopen a saved run from history.
- [ ] Frontend tests cover result rendering, formula display, failure rows, and
      history navigation.

## Blocked By

- [Create frontend input flow](0009-frontend-input-flow.md)

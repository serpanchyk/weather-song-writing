# Expose OpenRouter Model Catalog

## Type

AFK

## Context

- [Vision Input Controls](../../VISION.md#input-controls)
- [System Worker Responsibility](../../system/README.md#worker-responsibility)

## What To Build

Implement the shared OpenRouter model catalog interface used by candidate model
selection and judge model selection.

## Acceptance Criteria

- [ ] Worker fetches available models from OpenRouter server-side.
- [ ] Catalog entries expose ID, display name, provider if available, context
      length if available, supported modality, and pricing metadata when
      available.
- [ ] Default response filters to chat/text-capable models.
- [ ] API supports search/filter parameters for frontend selectors.
- [ ] Missing pricing and expensive models are identifiable by the frontend.
- [ ] Tests cover filtering, missing pricing, and adapter error handling.

## Blocked By

- [Create Worker API skeleton](0003-worker-api-skeleton.md)

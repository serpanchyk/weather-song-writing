# Create Worker API Skeleton

## Type

AFK

## Context

- [System Overview](../../system/README.md#worker-responsibility)
- [README Planned Request Flow](../../../README.md#planned-request-flow)

## What To Build

Create the Cloudflare Worker API surface with typed routes, structured error
responses, CORS for the static frontend, and environment bindings for OpenRouter
and D1.

## Acceptance Criteria

- [ ] Worker exposes health/status route for smoke testing.
- [ ] Worker exposes typed route placeholders for model catalog, run creation,
      run listing, and run detail.
- [ ] OpenRouter API key is read only from Worker environment/secrets.
- [ ] D1 binding is declared but not yet required for non-storage routes.
- [ ] Smoke tests cover route availability and validation error shape.

## Blocked By

- [Define shared contracts and constants](0002-shared-contracts-and-constants.md)

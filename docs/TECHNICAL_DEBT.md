# Technical Debt Registry

Tracked items from the TODO/FIXME/HACK audit (Task 0.2.4).

> Last audited: 2026-03-03

## Active Items

### P2: Broken Imports
- **File**: `src/__tests__/imports.test.js:68`
- **Comment**: `// TODO (P2): Fix these broken imports then change back to toEqual([]).`
- **Context**: Some dynamic imports in the test suite have known failures that are currently tolerated
- **Action**: Fix the underlying broken imports, then tighten the assertion

## Resolved / Not Found

- **FIXME**: None found in `src/` (excluding `node_modules`)
- **HACK**: None found in `src/`
- **XXX**: 1 occurrence in `cryptoParsers.test.js` — this is test data (`'Account': 'XXX-123456'`), not a code comment

## Notes

The codebase is remarkably clean for its size (~570 source files). The `DataPipelineLogger` already provides structured error budget monitoring. Global error handling is centralized in `globalErrorHandler.js` with Sentry integration ready via `VITE_SENTRY_DSN`.

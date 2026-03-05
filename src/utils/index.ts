// ═══════════════════════════════════════════════════════════════════
// charEdge — Utils Barrel Export
//
// Phase 2 Task 2.3.6: Module APIs via barrel exports.
// ═══════════════════════════════════════════════════════════════════

export {
    AppError,
    DataError,
    RenderError,
    NetworkError,
    ValidationError,
    StorageError,
    classifyError,
    ERROR_CODES,
} from './errors.js';
export type { ErrorSeverity, ErrorCategory } from './errors.js';

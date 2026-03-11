import { logger } from './logger';

// ═══════════════════════════════════════════════════════════════════
// charEdge — Long Task Observer (TypeScript)
//
// Phase 5 Task 5.2.8: Detect main-thread tasks > 50ms using
// PerformanceObserver. Phase 2: Converted to TypeScript.
// ═══════════════════════════════════════════════════════════════════

interface LongTaskData {
    duration: number;
    startTime: number;
    name: string;
    entryType: string;
    attribution?: Array<{
        name: string;
        containerType: string;
        containerSrc: string;
    }>;
}

interface LongTaskObserverOptions {
    threshold?: number;
    maxLogPerMinute?: number;
    onLongTask?: (data: LongTaskData) => void;
}

interface TaskAttributionEntry {
    name: string;
    containerType: string;
    containerSrc: string;
}

/**
 * Start observing long tasks on the main thread.
 */
export function startLongTaskObserver({
    threshold = 50,
    maxLogPerMinute = 10,
    onLongTask,
}: LongTaskObserverOptions = {}): () => void {
    if (typeof PerformanceObserver === 'undefined') {
        logger.ui.info('[LongTask] PerformanceObserver not available');
        return () => { };
    }

    // Check if longtask entry type is supported
    try {
        if (!PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
            logger.ui.info('[LongTask] longtask entry type not supported');
            return () => { };
        }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
        return () => { };
    }

    let reportCount = 0;
    let windowStart = Date.now();

    const observer = new PerformanceObserver((list) => {
        const now = Date.now();

        // Reset counter every minute
        if (now - windowStart > 60_000) {
            reportCount = 0;
            windowStart = now;
        }

        for (const entry of list.getEntries()) {
            if (entry.duration < threshold) continue;
            if (reportCount >= maxLogPerMinute) continue;

            reportCount++;

            const data: LongTaskData = {
                duration: Math.round(entry.duration),
                startTime: Math.round(entry.startTime),
                name: entry.name,
                entryType: entry.entryType,
                attribution: (entry as PerformanceEntry & { attribution?: TaskAttributionEntry[] }).attribution?.map((a: TaskAttributionEntry) => ({
                    name: a.name,
                    containerType: a.containerType,
                    containerSrc: a.containerSrc,
                })),
            };

            if (onLongTask) {
                onLongTask(data);
            } else {
                logger.ui.warn(`[LongTask] ${data.duration}ms task detected`, data);
            }
        }
    });

    try {
        observer.observe({ type: 'longtask', buffered: true });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
        logger.ui.info('[LongTask] Could not observe longtask entries');
        return () => { };
    }

    return () => observer.disconnect();
}

export default { startLongTaskObserver };

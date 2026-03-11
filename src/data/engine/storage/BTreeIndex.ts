// ═══════════════════════════════════════════════════════════════════
// charEdge — B-Tree Block Index
//
// Sprint 9 #71: Extracted from TimeSeriesStore.ts.
// Lightweight sorted-array index over block metadata.
// Blocks are sorted by minT — binary search for range queries.
// ═══════════════════════════════════════════════════════════════════

import { type BlockMeta } from './types.ts';

export class BTreeIndex {
    private _blocks: BlockMeta[] = [];

    /** Replace the entire index from serialized data */
    load(blocks: BlockMeta[]): void {
        this._blocks = blocks.sort((a, b) => a.minT - b.minT);
    }

    /** Insert or update a block's metadata */
    upsert(meta: BlockMeta): void {
        const idx = this._blocks.findIndex(b => b.blockIdx === meta.blockIdx);
        if (idx >= 0) {
            this._blocks[idx] = meta;
        } else {
            this._blocks.push(meta);
        }
        this._blocks.sort((a, b) => a.minT - b.minT);
    }

    /** Remove a block from the index */
    remove(blockIdx: number): void {
        this._blocks = this._blocks.filter(b => b.blockIdx !== blockIdx);
    }

    /**
     * Find all block indices that overlap [startT, endT].
     * Uses binary search for the start position, then scans forward.
     */
    findOverlapping(startT: number, endT: number): BlockMeta[] {
        if (this._blocks.length === 0) return [];

        // Binary search: find first block where maxT >= startT
        let lo = 0;
        let hi = this._blocks.length - 1;
        while (lo < hi) {
            const mid = (lo + hi) >>> 1;
            const midBlock = this._blocks[mid];
            if (midBlock && midBlock.maxT < startT) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }

        // Scan forward to collect all overlapping blocks
        const result: BlockMeta[] = [];
        for (let i = lo; i < this._blocks.length; i++) {
            const block = this._blocks[i];
            if (!block) continue;
            if (block.minT > endT) break;
            if (block.maxT >= startT && block.minT <= endT) {
                result.push(block);
            }
        }
        return result;
    }

    /** Get all block metadata for serialization */
    getAll(): BlockMeta[] {
        return [...this._blocks];
    }

    /** Get total bars across all blocks */
    get totalBars(): number {
        return this._blocks.reduce((sum, b) => sum + b.barCount, 0);
    }

    /** Get total storage size */
    get totalBytes(): number {
        return this._blocks.reduce((sum, b) => sum + b.sizeBytes, 0);
    }

    /** Get the next available block index */
    get nextBlockIdx(): number {
        if (this._blocks.length === 0) return 0;
        return Math.max(...this._blocks.map(b => b.blockIdx)) + 1;
    }

    /** Get block count */
    get blockCount(): number {
        return this._blocks.length;
    }

    /** Find the least-recently-accessed block for eviction */
    getLRUBlock(): BlockMeta | null {
        if (this._blocks.length === 0) return null;
        return this._blocks.reduce((oldest, b) =>
            b.lastAccess < oldest.lastAccess ? b : oldest
        );
    }
}

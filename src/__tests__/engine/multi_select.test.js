// Sprint 18 — Multi-Select & Drawing Groups (Source Verification)
// Functions live across DrawingEngine.js (facade) + DrawingCRUD.js (sub-module).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
const ROOT = resolve(__dirname, '..', '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf-8');

describe('Sprint 18 · DrawingEngine — Multi-Select & Groups', () => {
  const facade = read('charting_library/tools/tools/DrawingEngine.js');
  const crud = read('charting_library/tools/engines/DrawingCRUD.js');
  const combined = facade + '\n' + crud;

  it('has boxSelect method', () => {
    expect(combined).toContain('boxSelect');
  });

  it('boxSelect tests anchor inside lasso region', () => {
    expect(crud).toContain('px.x >= left && px.x <= right && px.y >= top && px.y <= bottom');
  });

  it('has copySelected method', () => {
    expect(combined).toContain('copySelected');
    expect(combined).toContain('clipboard');
  });

  it('has pasteFromClipboard method', () => {
    expect(combined).toContain('pasteFromClipboard');
    expect(combined).toContain('generateId()');
  });

  it('has groupSelected method', () => {
    expect(combined).toContain('groupSelected');
    expect(combined).toContain('_groupId');
  });

  it('has ungroupDrawings method', () => {
    expect(combined).toContain('ungroupDrawings');
    expect(crud).toContain('delete d._groupId');
  });

  it('has selectGroup method', () => {
    expect(combined).toContain('selectGroup');
  });

  it('has bulkMove method', () => {
    expect(combined).toContain('bulkMove');
  });
});

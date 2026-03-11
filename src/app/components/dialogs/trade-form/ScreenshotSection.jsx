// ═══════════════════════════════════════════════════════════════════
// ScreenshotSection — Screenshot grid, upload, and drag overlay
// Extracted from TradeFormModal.jsx for single-responsibility.
// ═══════════════════════════════════════════════════════════════════

import { C } from '../../../../constants.js';
import { inputStyle } from '../../ui/UIKit.jsx';
import Field from './Field.jsx';
import { processScreenshot, MAX_SCREENSHOTS } from './ScreenshotProcessor.js';

/**
 * @param {{ form: object, set: (field: string, value: any) => void }} props
 */
export default function ScreenshotSection({ form, set }) {
    return (
        <Field label={`Screenshots (${form.screenshots?.length || 0}/${MAX_SCREENSHOTS})`} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                {(form.screenshots || []).map((shot, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                        <img
                            src={shot.data}
                            alt={shot.name || `Screenshot ${i + 1}`}
                            style={{
                                width: 80,
                                height: 56,
                                objectFit: 'cover',
                                borderRadius: 4,
                                border: `1px solid ${C.bd}`,
                            }}
                        />
                        <button
                            className="tf-btn"
                            type="button"
                            onClick={() => {
                                const next = [...form.screenshots];
                                next.splice(i, 1);
                                set('screenshots', next);
                            }}
                            style={{
                                position: 'absolute',
                                top: -6,
                                right: -6,
                                width: 18,
                                height: 18,
                                borderRadius: '50%',
                                background: C.r,
                                color: '#fff',
                                border: 'none',
                                fontSize: 10,
                                cursor: 'pointer',
                                lineHeight: '18px',
                                textAlign: 'center',
                                padding: 0,
                            }}
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>
            {(form.screenshots?.length || 0) < MAX_SCREENSHOTS && (
                <div style={{ display: 'flex', gap: 8 }}>
                    <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        id="screenshot-upload"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            processScreenshot(file, form, set);
                            e.target.value = '';
                        }}
                    />
                    <label
                        htmlFor="screenshot-upload"
                        style={{
                            ...inputStyle,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            cursor: 'pointer',
                            fontSize: 11,
                            padding: '6px 12px',
                            color: C.t2,
                            textAlign: 'center',
                        }}
                    >
                        📎 Upload
                    </label>
                    <div
                        style={{
                            ...inputStyle,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 11,
                            padding: '6px 12px',
                            color: C.t3,
                        }}
                    >
                        or Ctrl+V to paste
                    </div>
                </div>
            )}
        </Field>
    );
}

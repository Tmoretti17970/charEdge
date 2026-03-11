// ═══════════════════════════════════════════════════════════════════
// Screenshot Processor — Resize & compress trade screenshots
// ═══════════════════════════════════════════════════════════════════

export const MAX_SCREENSHOTS = 3;
const MAX_DIM = 1200;
const JPEG_QUALITY = 0.75;

/**
 * Process a screenshot file: resize if needed, compress to JPEG, and
 * append to the form's screenshots array via the `set` callback.
 *
 * @param {File} file
 * @param {{ screenshots: Array }} form
 * @param {(field: string, value: any) => void} set
 */
export function processScreenshot(file, form, set) {
    if ((form.screenshots?.length || 0) >= MAX_SCREENSHOTS) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
            // Resize if needed
            let { width, height } = img;
            if (width > MAX_DIM || height > MAX_DIM) {
                const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const data = canvas.toDataURL('image/jpeg', JPEG_QUALITY);

            set('screenshots', [...(form.screenshots || []), { name: file.name, data }]);
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
}

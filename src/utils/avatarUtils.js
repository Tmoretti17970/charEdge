// ═══════════════════════════════════════════════════════════════════
// charEdge — Avatar Utilities (Sprint 3)
//
// Shared helpers for avatar rendering & image processing.
//   - cropToSquare()    — canvas crop + resize → base64
//   - generateInitials() — extract 1-2 letters from display name
//   - getAvatarDisplay() — return render info for any avatar type
// ═══════════════════════════════════════════════════════════════════

const OUTPUT_SIZE = 200;   // px, square
const JPEG_QUALITY = 0.8;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

/**
 * Crop an image file to a centered square and resize to OUTPUT_SIZE.
 * @param {File} file - Image file from input[type=file]
 * @returns {Promise<string>} base64 data URL (JPEG)
 */
export function cropToSquare(file) {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_FILE_SIZE) {
      reject(new Error('Image must be under 2 MB'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = OUTPUT_SIZE;
        canvas.height = OUTPUT_SIZE;
        const ctx = canvas.getContext('2d');

        // Center-crop to square
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;

        ctx.drawImage(img, sx, sy, min, min, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Generate 1-2 letter initials from a display name.
 * @param {string} name
 * @returns {string}
 */
export function generateInitials(name) {
  if (!name) return '?';
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }
  return words[0].slice(0, 2).toUpperCase();
}

/**
 * Get display properties for an avatar.
 * @param {Object} profile - Profile object from store
 * @param {number} size - Render size in px
 * @returns {{ type: string, content: string, style: Object }}
 */
export function getAvatarDisplay(profile, size = 64) {
  const p = profile || {};
  const type = p.avatarType || 'emoji';
  const borderRadius = size >= 48 ? 16 : size >= 32 ? 10 : 8;

  const baseStyle = {
    width: size,
    height: size,
    borderRadius,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  };

  if (type === 'image' && p.avatarImage) {
    return {
      type: 'image',
      content: p.avatarImage,
      style: {
        ...baseStyle,
        backgroundImage: `url(${p.avatarImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      },
    };
  }

  if (type === 'initials') {
    return {
      type: 'initials',
      content: generateInitials(p.displayName),
      style: {
        ...baseStyle,
        background: p.avatarColor || '#E8590C',
        color: '#fff',
        fontSize: Math.round(size * 0.4),
        fontWeight: 700,
        letterSpacing: 1,
      },
    };
  }

  // Default: emoji
  return {
    type: 'emoji',
    content: p.avatar || '🔥',
    style: {
      ...baseStyle,
      fontSize: Math.round(size * 0.5),
    },
  };
}

export { OUTPUT_SIZE, MAX_FILE_SIZE };

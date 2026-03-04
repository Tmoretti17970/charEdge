// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — Avatar Component
//
// Circular avatar with image or initial fallback.
// Supports size variants (sm, md, lg) and status indicator.
//
// Usage:
//   <Avatar name="John Doe" size="md" />
//   <Avatar src="/avatar.jpg" name="J" size="lg" status="online" />
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react';
import s from '../../../styles/Avatar.module.css';

const SIZE_MAP = { sm: 'sm', md: 'md', lg: 'lg' };

/**
 * Deterministic color based on name string.
 * @param {string} name
 * @returns {string} HSL color string
 */
function nameToColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

/**
 * Get initials from a name (up to 2 characters).
 * @param {string} name
 * @returns {string}
 */
function getInitials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Circular avatar with image or initial fallback.
 * @param {Object} props
 * @param {string} [props.src] - Image URL
 * @param {string} props.name - Display name (used for initials fallback + color)
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Size variant
 * @param {'online'|'offline'|'away'|'busy'} [props.status] - Optional status indicator
 * @param {string} [props.className] - Additional CSS class
 */
export default function Avatar({ src, name = '?', size = 'md', status, className = '' }) {
  const [imgError, setImgError] = useState(false);
  const showImage = src && !imgError;
  const sizeClass = SIZE_MAP[size] || 'md';

  return (
    <div
      className={`${s.avatar} ${s[sizeClass]} ${className}`}
      style={showImage ? undefined : { '--avatar-bg': nameToColor(name) }}
      title={name}
    >
      {showImage ? (
        <img
          className={s.image}
          src={src}
          alt={name}
          onError={() => setImgError(true)}
        />
      ) : (
        getInitials(name)
      )}

      {status && (
        <span
          className={`${s.status} ${s[`status${sizeClass.charAt(0).toUpperCase() + sizeClass.slice(1)}`]} ${s[status]}`}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// charEdge — DrawingTemplates
// Persist and recall drawing style templates per tool type.
// Storage: localStorage key "charEdge:drawingTemplates:{toolType}"
// ═══════════════════════════════════════════════════════════════════

const KEY_PREFIX = 'charEdge:drawingTemplates:';

/**
 * Save a named template for a tool type.
 * @param {string} toolType
 * @param {string} name
 * @param {object} style
 */
export function saveTemplate(toolType, name, style) {
  const templates = loadTemplates(toolType);
  // Replace if same name exists
  const idx = templates.findIndex(t => t.name === name);
  if (idx >= 0) {
    templates[idx].style = { ...style };
  } else {
    templates.push({ name, style: { ...style } });
  }
  localStorage.setItem(KEY_PREFIX + toolType, JSON.stringify(templates));
}

/**
 * Load all templates for a tool type.
 * @param {string} toolType
 * @returns {Array<{ name: string, style: object }>}
 */
export function loadTemplates(toolType) {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + toolType);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Delete a named template.
 * @param {string} toolType
 * @param {string} name
 */
export function deleteTemplate(toolType, name) {
  const templates = loadTemplates(toolType).filter(t => t.name !== name);
  localStorage.setItem(KEY_PREFIX + toolType, JSON.stringify(templates));
}

/**
 * Get the first (default) template for a tool type, or null.
 * @param {string} toolType
 * @returns {{ name: string, style: object } | null}
 */
export function getDefaultTemplate(toolType) {
  const templates = loadTemplates(toolType);
  return templates.length > 0 ? templates[0] : null;
}

// ═══════════════════════════════════════════════════════════════════
// PnL Calculator — Pure function for auto-calculating P&L
// ═══════════════════════════════════════════════════════════════════

/**
 * Auto-calculate P&L from entry/exit/qty/side.
 * A4.1: Subtracts fees to prevent inflated P&L display.
 *
 * @param {{ qty: string|number, entry: string|number, exit: string|number, side: string, fees: string|number }} form
 * @returns {number|null} Calculated PnL, or null if insufficient data.
 */
export function calculatePnL(form) {
    const qty = Number(form.qty);
    const entry = Number(form.entry);
    const exit = Number(form.exit);
    if (!qty || !entry || !exit) return null;
    const diff = form.side === 'long' ? exit - entry : entry - exit;
    const fees = Number(form.fees) || 0;
    return Math.round((diff * qty - fees) * 100) / 100;
}

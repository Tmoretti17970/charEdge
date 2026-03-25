// Re-export from merged useOpenPositions (Phase 5)
// Call with no arguments to get all open positions.
import { useOpenPositions } from './useOpenPositions';
export function useAllOpenPositions() {
  return useOpenPositions();
}
export default useAllOpenPositions;

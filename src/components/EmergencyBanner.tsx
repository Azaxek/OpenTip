/**
 * Safety floor, not a branding element: always shown above the tip form, cannot be dismissed, and takes no
 * props that could reword or hide it. `strong` only makes it louder (used when the tipster flags "urgent").
 */
export const EMERGENCY_TEXT = 'If this is an emergency or someone is in immediate danger, call 911 now. This form is not monitored in real time.';

export function EmergencyBanner({ strong = false }: { strong?: boolean }) {
  return (
    <aside
      aria-label="Emergency notice"
      data-testid="emergency-banner"
      className={
        strong
          ? 'rounded-lg border-2 border-red-800 bg-red-700 p-4 text-base font-bold text-white'
          : 'rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-900'
      }
    >
      {EMERGENCY_TEXT}
    </aside>
  );
}

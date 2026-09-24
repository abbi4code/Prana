// Gym check-in thresholds (decision D30, .claude/gym-checkin.md). Starting defaults chosen by the owner's
// spec, NOT sourced constants: tune them here. Shared by the device and the API routes.

/** Gym radius, metres: default and the range the user may pick. */
export const RADIUS_DEFAULT_M = 150;
export const RADIUS_MIN_M = 100;
export const RADIUS_MAX_M = 300;
/** A location reading fuzzier than this can't judge anything (phase 2). */
export const ACCURACY_MAX_M = 200;
/** A visit still open after this long is closed automatically (phase 4). */
export const AUTO_CLOSE_HOURS = 3;
/** Shorter visits don't count toward the counter / workout day (phase 4). */
export const MIN_VISIT_MINUTES = 20;
/** Per-user limits on check-in / check-out calls. */
export const RATE_PER_MINUTE = 12;
export const RATE_PER_DAY = 120;

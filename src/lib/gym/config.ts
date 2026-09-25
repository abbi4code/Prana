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
/** A forgotten visit with no logged exercise ends this long after it started (owner's default). */
export const FORGOTTEN_DEFAULT_MINUTES = 90;
/** Nearby banner: don't show again for the same gym for this long after it's dismissed or used. */
export const NEARBY_SNOOZE_HOURS = 4;
/** Nearby banner: a location this recent is good enough (cheap reading, spares battery). */
export const NEARBY_MAX_AGE_MS = 5 * 60_000;
/** Nearby banner: not right after a visit ended (you're probably walking out). */
export const NEARBY_AFTER_VISIT_MINUTES = 60;

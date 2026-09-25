// Request/response shapes for /api/gym/* (D30), validated on both sides.
import { z } from "zod";

const Iso = z.iso.datetime({ offset: true });
const VerificationEnum = z.enum(["verified", "outside_radius", "low_accuracy", "permission_denied", "unavailable", "not_checked"]);

/** One browser reading. Used for the distance check, then thrown away: never stored (only distance + accuracy). */
const Reading = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), accuracy: z.number().min(0).max(1_000_000) });
/** ok = a reading is attached; off = the user's location setting is off (or the gym has no location). */
export const LocationStatus = z.enum(["ok", "off", "permission_denied", "unavailable"]);

export const CheckInBody = z.object({
  gymId: z.string().min(1).max(64).nullable(),
  location: Reading.optional(),
  locationStatus: LocationStatus.default("off"),
  /** after an outside_radius / low_accuracy answer: "Check in anyway" */
  force: z.boolean().default(false),
  /** saved on the device while offline (or as a guest); uploaded later with the phone's clock */
  offline: z.object({ id: z.uuid(), startedAt: Iso, endedAt: Iso.nullable() }).optional(),
});
export type CheckInBody = z.input<typeof CheckInBody>; // what the device sends (defaults filled on the server)

export const CheckOutBody = z.object({
  location: Reading.optional(),
  locationStatus: LocationStatus.default("off"),
  offline: z.object({ endedAt: Iso }).optional(),
});
export type CheckOutBody = z.input<typeof CheckOutBody>;

const Visit = z.object({
  id: z.string(),
  gymId: z.string().nullable(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  status: z.enum(["active", "completed", "auto_closed"]),
  startVerification: VerificationEnum,
  endVerification: VerificationEnum.nullable(),
  source: z.enum(["web_manual", "web_offline", "native_geofence"]),
});

/** Every gym route answers with the visit (or null) and the server's clock, for timer skew. */
export const Verdict = z.object({
  verification: VerificationEnum,
  distanceM: z.number().nullable(),
  accuracyM: z.number().nullable(),
  radiusM: z.number().nullable(),
});
export type Verdict = z.infer<typeof Verdict>;
/** No visit + a verdict = the check-in waits for the user ("Try again" / "Check in anyway"). */
export const GymResponse = z.object({
  visit: Visit.nullable(),
  serverNow: z.number(),
  created: z.boolean().optional(),
  verdict: Verdict.optional(),
  /** a forgotten visit this call closed (phase 4), so the device can say so and offer to fix the end */
  autoClosed: Visit.optional(),
});

/** Fix the guessed end of an auto-closed visit. */
export const SetEndBody = z.object({ id: z.uuid(), endedAt: Iso });
export type SetEndBody = z.infer<typeof SetEndBody>;
export type GymResponse = z.infer<typeof GymResponse>;

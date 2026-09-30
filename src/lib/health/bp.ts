// Blood-pressure reading for HOME readings (D55). PURE, node-runnable.
// Home average ≥ 135 and/or ≥ 85 mmHg indicates hypertension: ISH 2020 (Table 2, Table 5), Indian Guidelines on
// Hypertension-IV 2019 (Table 4), Indian Society of Hypertension 2025 (equivalence table). Averaging: morning and
// evening over 3–7 days, first day discarded (all three). Urgent: ≥ 180 and/or ≥ 120 mmHg (ICMR Standard Treatment
// Workflow, Hypertension in Adults, 2026): see a doctor within a week; with symptoms, emergency care now.
// The clinic grades (140/90 etc.) are for readings taken at a clinic, so they aren't applied to home readings here.
import type { Tone } from "./tone.ts";

export const HOME_HIGH = { sys: 135, dia: 85 };
export const URGENT = { sys: 180, dia: 120 };
/** Fewer days than this: "keep measuring" instead of a verdict (guidelines average 3–7 days). */
export const MIN_DAYS = 3;

export function bpCategory(sys: number, dia: number, days = MIN_DAYS, last?: { sys: number; dia: number }): { label: string; tone: Tone; advice?: string } {
  const urgent = (r: { sys: number; dia: number }) => r.sys >= URGENT.sys || r.dia >= URGENT.dia;
  if (urgent({ sys, dia }) || (last && urgent(last)))
    return {
      label: "Very high",
      tone: "chilli",
      advice:
        "180/120 or more: see a doctor within a week. With chest pain, breathlessness, confusion, a bad headache, sudden weakness, or trouble seeing or speaking, get emergency care now.",
    };
  if (days < MIN_DAYS) return { label: "Keep measuring", tone: "muted", advice: `Guidelines judge home BP on 3–7 days of readings (morning and evening). ${days} so far.` };
  if (sys >= HOME_HIGH.sys || dia >= HOME_HIGH.dia)
    return { label: "High at home", tone: "saffron", advice: "A home average of 135/85 or more points to high blood pressure. Show these readings to a doctor to confirm." };
  return { label: "In range at home", tone: "leaf" };
}

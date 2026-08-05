import type { DetectorCategory } from '@/lib/api/types';

/* The one place a detector/event category becomes a colour or a label.
 *
 * This replaced eight scattered `category === 'safety' ? … : …` checks across
 * the events feed, detector list, detector editor, camera form and the alert
 * toast. With two categories a ternary was survivable; with four it is eight
 * places to forget, and a fifth would mean finding them all again.
 *
 * Hexes live in globals.css and match the iOS asset catalog exactly, so a
 * category looks the same on a phone and on the dashboard.
 *
 * Pairing rule: colour NEVER carries the category alone. Four muted hues at
 * chip size is past what colour can reliably distinguish, and this audience
 * skews 50+. Every surface pairs the hue with an icon or a text label, so
 * colour is reinforcement rather than information. */

type Tone = {
  /** Foreground: icon tint, emphasised text, rules. */
  accent: string;
  /** Background wash: chips, card tints, tile fills. */
  soft: string;
  /** Text that must hold contrast on `soft`. */
  deep: string;
  label: string;
};

const TONES: Record<DetectorCategory, Tone> = {
  safety:    { accent: 'text-terra', soft: 'bg-terra-soft', deep: 'text-terra-deep', label: 'Safety' },
  routine:   { accent: 'text-sky',   soft: 'bg-sky-soft',   deep: 'text-sky',        label: 'Routine' },
  behaviour: { accent: 'text-plum',  soft: 'bg-plum-soft',  deep: 'text-plum',       label: 'Behaviour' },
  care:      { accent: 'text-sage',  soft: 'bg-sage-soft',  deep: 'text-sage',       label: 'Care' },
};

/* A category this build predates. Neutral ink rather than a guessed hue:
 * rendering it in some other category's colour would be an outright lie about
 * what happened. The server can add categories before the dashboard is
 * redeployed, so this is a real path, not a defensive nicety. */
const UNKNOWN: Tone = {
  accent: 'text-ink3', soft: 'bg-card-alt', deep: 'text-ink2', label: 'Other',
};

export function categoryTone(category: string | null | undefined): Tone {
  if (!category) return UNKNOWN;
  return TONES[category as DetectorCategory] ?? UNKNOWN;
}

/** Whether this category escalates a patient card to the attention treatment.
 *
 * Only safety does, deliberately: a red card that fires for everything trains
 * people to ignore it. Named rather than `=== 'safety'` at the call site so it
 * states the intent (does this shout?) instead of the mechanism. */
export function escalates(category: string | null | undefined): boolean {
  return category === 'safety';
}

/** The categories a caregiver may choose, in the order they are offered. */
export const SELECTABLE_CATEGORIES: DetectorCategory[] = [
  'safety', 'routine', 'behaviour', 'care',
];

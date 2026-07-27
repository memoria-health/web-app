// Detector icons + human labels. The catalog / compiler emit SF Symbol
// names (iOS renders them natively via Image(systemName:)); the web maps
// them to lucide-react components so a caregiver sees a real glyph instead
// of a raw string like "figure.fall". Keep the allowed set in sync with
// the backend `_ALLOWED_ICONS` (src/services/detector_compiler.py); preset
// icons outside that set fall back to a neutral glyph.

import {
  Activity,
  AlertTriangle,
  BedDouble,
  Bell,
  Car,
  Clock,
  Coffee,
  DoorOpen,
  Droplet,
  Eye,
  Flame,
  Footprints,
  Heart,
  Moon,
  PersonStanding,
  Pill,
  ShowerHead,
  Sun,
  Tv,
  User,
  Utensils,
  type LucideIcon,
} from 'lucide-react';

// The picker set — matches backend `_ALLOWED_ICONS` order.
export const DETECTOR_ICON_NAMES = [
  'eye',
  'figure.fall',
  'figure.walk.motion',
  'door.left.hand.open',
  'pills',
  'fork.knife',
  'bed.double',
  'shower',
  'tv',
  'drop',
  'flame',
  'exclamationmark.triangle',
  'heart',
  'person',
  'cup.and.saucer',
  'moon',
  'sun.max',
  'clock',
  'bell',
  'car',
] as const;

export type DetectorIconName = (typeof DETECTOR_ICON_NAMES)[number];

const ICON_BY_NAME: Record<string, LucideIcon> = {
  'eye': Eye,
  'figure.fall': PersonStanding,
  'figure.walk.motion': Footprints,
  'door.left.hand.open': DoorOpen,
  'pills': Pill,
  'fork.knife': Utensils,
  'bed.double': BedDouble,
  'shower': ShowerHead,
  'tv': Tv,
  'drop': Droplet,
  'flame': Flame,
  'exclamationmark.triangle': AlertTriangle,
  'heart': Heart,
  'person': User,
  'cup.and.saucer': Coffee,
  'moon': Moon,
  'sun.max': Sun,
  'clock': Clock,
  'bell': Bell,
  'car': Car,
  // Common preset icons outside the custom-detector allowed set.
  'lungs': Activity,
  'figure.walk': Footprints,
  'flame.fill': Flame,
  'heart.fill': Heart,
};

// Caregiver-facing label for the icon picker (glyph + word), so the option
// reads "Falling" rather than "figure.fall". Mirrors iOS `iconLabels`.
export const DETECTOR_ICON_LABEL: Record<DetectorIconName, string> = {
  'eye': 'General',
  'figure.fall': 'Falling',
  'figure.walk.motion': 'Walking',
  'door.left.hand.open': 'Door',
  'pills': 'Medication',
  'fork.knife': 'Eating',
  'bed.double': 'Bed',
  'shower': 'Shower',
  'tv': 'TV',
  'drop': 'Water',
  'flame': 'Fire / stove',
  'exclamationmark.triangle': 'Warning',
  'heart': 'Health',
  'person': 'Person',
  'cup.and.saucer': 'Drink',
  'moon': 'Night',
  'sun.max': 'Day',
  'clock': 'Time',
  'bell': 'Alert',
  'car': 'Car',
};

const FALLBACK: LucideIcon = Eye;

export function DetectorIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = ICON_BY_NAME[name] ?? FALLBACK;
  return <Icon className={className} aria-hidden="true" />;
}

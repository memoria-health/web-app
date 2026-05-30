// Camera/room icons. The catalog values are SF Symbol names (iOS picks
// the same set), and the web maps them to lucide-react components so
// both surfaces stay in sync on what a caregiver sees.

import {
  Bath,
  BedDouble,
  DoorOpen,
  Home,
  Tv,
  Utensils,
  type LucideIcon,
} from 'lucide-react';

export const CAMERA_ICON_NAMES = [
  'tv',
  'fork.knife',
  'bed.double',
  'bathtub',
  'door.left.hand.open',
  'house',
] as const;

export type CameraIconName = (typeof CAMERA_ICON_NAMES)[number];

const ICON_BY_NAME: Record<CameraIconName, LucideIcon> = {
  'tv': Tv,
  'fork.knife': Utensils,
  'bed.double': BedDouble,
  'bathtub': Bath,
  'door.left.hand.open': DoorOpen,
  'house': Home,
};

const FALLBACK: LucideIcon = Home;

export function CameraIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = (ICON_BY_NAME as Record<string, LucideIcon | undefined>)[name] ?? FALLBACK;
  return <Icon className={className} aria-hidden="true" />;
}

// Caregiver-facing labels for detector fields. The API/runtime speak in
// enums (`alert_trigger`, `is_sustained`) and a scalar `where_scope`; a
// non-technical caregiver should never see those. One source of truth so the
// list row, detail editor, and create flow all read the same.

import type { AlertTrigger } from '../api/types';

// Full label for the detail editor / create review — a plain sentence.
export const TRIGGER_LABEL: Record<AlertTrigger, string> = {
  leading: 'Alerts the moment it happens',
  trailing: "Alerts when the activity's finished",
  duration: "Alerts once it's gone on too long",
  absence: "Alerts if it doesn't happen in your time window",
};

// One-line "why" under the label.
export const TRIGGER_SUB: Record<AlertTrigger, string> = {
  leading: "Fires as soon as it's seen.",
  trailing: 'A single alert once the whole activity is over.',
  duration: 'Fires only after it has continued past your time limit.',
  absence: "Fires when the thing you're expecting is missing by your deadline.",
};

// Compact form for dense list captions where space is tight.
export const TRIGGER_LABEL_SHORT: Record<AlertTrigger, string> = {
  leading: 'When it happens',
  trailing: 'When it ends',
  duration: 'If it lasts too long',
  absence: "If it doesn't happen",
};

export function triggerLabel(trigger: AlertTrigger): string {
  return TRIGGER_LABEL[trigger] ?? trigger;
}

export function triggerLabelShort(trigger: AlertTrigger): string {
  return TRIGGER_LABEL_SHORT[trigger] ?? trigger;
}

// The "ALL ROOMS" sentinel means every room; anything else is a real name.
const ALL_ROOMS = 'ALL ROOMS';

export function roomsMeanAll(rooms: string[] | null | undefined): boolean {
  if (!rooms || rooms.length === 0) return true;
  return rooms.some((r) => r.trim().toUpperCase() === ALL_ROOMS);
}

// Human label for a detector's room scope, preferring the multi-room list
// and falling back to the legacy scalar where_scope.
export function roomsLabel(
  whereRooms: string[] | null | undefined,
  whereScope: string,
): string {
  if (whereRooms && whereRooms.length > 0) {
    if (roomsMeanAll(whereRooms)) return 'All rooms';
    return whereRooms.join(', ');
  }
  return whereScope.trim().toUpperCase() === ALL_ROOMS ? 'All rooms' : whereScope;
}

// Mirrors nemara-backend's pydantic response schemas. snake_case on the wire.

export type PatientState = 'calm' | 'critical' | 'offline';
export type Relation =
  | 'parent'
  | 'spouse'
  | 'grandparent'
  | 'sibling'
  | 'client'
  | 'other';
export type DetectorCategory = 'safety' | 'routine';
export type DetectorSource = 'preset' | 'custom';
export type DetectorShape = 'point_in_time' | 'state';
export type DetectorSensitivity = 'low' | 'standard' | 'high' | 'off';
export type ReviewChoice = 'correct' | 'wrong' | 'unsure';
export type EventFilter = 'all' | 'unreviewed' | 'reviewed';
export type LiveKitRole = 'camera' | 'viewer' | 'broadcaster';

export interface Caregiver {
  id: string;
  display_name: string;
  email: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Patient {
  id: string;
  caregiver_id: string;
  full_name: string;
  preferred_name: string;
  date_of_birth: string | null;
  gender: string | null;
  relation: Relation;
  home_address: string | null;
  state: PatientState;
  status_line: string;
  last_event_at: string | null;
  battery_percent: number | null;
  cameras_paused: boolean;
  photo_storage_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface Camera {
  id: string;
  patient_id: string;
  display_id: number;
  room: string;
  icon_name: string;
  online: boolean;
  // User-facing "off" toggle. When true, the backend tick skips
  // the LLM call (writes synthetic skipped row), and the web hides
  // this camera from the live grid + analyses feed. LiveKit
  // connection stays alive in case the user re-enables.
  disabled: boolean;
  // LLM-only pause. When true, the backend tick skips the Gemini
  // call (synthetic skipped row with skipped_reason='ai_paused') but
  // the tile stays visible in the live grid and video keeps
  // streaming. Lighter than `disabled`.
  ai_paused: boolean;
  // Stronger than `disabled`. When 'disconnected', the wall phone
  // leaves the LiveKit room entirely. Reconnect takes ~1-2s after
  // the caregiver flips this back to 'connected' via the dashboard
  // 3-dot menu (which calls PATCH /v1/cameras/{id} with
  // desired_state).
  desired_state: 'connected' | 'disconnected';
  livekit_identity: string | null;
  last_seen_at: string | null;
  created_at: string;
}

export interface Detector {
  id: string;
  patient_id: string;
  name: string;
  icon_name: string;
  description: string;
  category: DetectorCategory;
  source: DetectorSource;
  shape: DetectorShape;
  where_scope: string;
  when_scope: string;
  sensitivity: DetectorSensitivity;
  is_on: boolean;
  custom_prompt: string | null;
  // Runtime-contract fields. For preset detectors `identifier` is one
  // of {fall, wandering, agitation, medication}. For custom detectors
  // it's `custom_<8hex>` and may be null while the backend is still
  // compiling the prompt fragment (see /detectors/new flow).
  identifier: string | null;
  created_at: string;
  updated_at: string;
}

export interface DetectionEvent {
  id: string;
  patient_id: string;
  detector_id: string | null;
  camera_id: string | null;
  category: DetectorCategory;
  source: DetectorSource;
  icon_name: string;
  title: string;
  location: string;
  occurred_at: string;
  has_clip: boolean;
  narrative: string;
  opened: boolean;
  reviewed: boolean;
  review_choice: ReviewChoice | null;
  review_notes: string | null;
  reviewed_at: string | null;
  clip_storage_key: string | null;
  created_at: string;
}

// Per-tick LLM output. Not exposed via REST — only consumed via
// Supabase Realtime subscription on the `analyses` table. Mirrors
// nemara-backend's analyses table row shape (snake_case on the wire).
export interface Analysis {
  id: string;
  caregiver_id: string;
  patient_id: string;
  camera_id: string;
  provider: 'gemini' | 'openai' | 'skipped';
  description: string;
  // JSONB blob; shape depends on which detectors were enabled at tick time.
  // Common keys: people_present, people_count, fall_detected, fall_confidence,
  // fall_reasoning, wandering_detected, wandering_confidence, wandering_reasoning,
  // agitation_detected, agitation_confidence, agitation_reasoning,
  // medication_taken, medication_confidence, medication_reasoning,
  // speech_heard, speech_transcript, skipped_reason (when provider=skipped).
  detector_fields: Record<string, unknown>;
  people_present: boolean;
  motion_in_clip: boolean;
  state_after: 'open' | 'closed';
  captured_at: string;
  created_at: string;
}

export interface EventListResponse {
  items: DetectionEvent[];
  next_cursor: string | null;
}

export interface PairingCodeResponse {
  pairing_code: string;
  expires_at: string;
  camera_id: string;
}

export interface LiveKitTokenResponse {
  token: string;
  url: string;
  expires_at: string;
}

// Request bodies

export interface CreateCaregiverRequest {
  display_name: string;
  phone?: string;
}

export interface CreatePatientRequest {
  full_name: string;
  preferred_name: string;
  relation: Relation;
  date_of_birth?: string;
  gender?: string;
  home_address?: string;
}

export interface UpdatePatientRequest {
  full_name?: string;
  preferred_name?: string;
  relation?: Relation;
  date_of_birth?: string;
  gender?: string;
  home_address?: string;
  // Patient-wide monitoring off toggle. When true, ALL cameras for
  // this patient skip their LLM tick (and the web hides them from
  // the live grid + analyses feed). Per-camera disable lives on
  // the Camera row instead.
  cameras_paused?: boolean;
}

export interface UpdateCameraRequest {
  // User-facing fields exposed by PATCH /v1/cameras/{id}. Backend
  // uses extra='forbid'; any other field will 422.
  disabled?: boolean;
  ai_paused?: boolean;
  desired_state?: 'connected' | 'disconnected';
}

export interface CameraDetectorsResponse {
  // Detector IDs currently assigned to this camera. Cross-reference
  // against the patient's full detector list to render per-camera
  // on/off toggles.
  detector_ids: string[];
}

export interface SetCameraDetectorsRequest {
  // The complete new assignment set — backend replaces the camera's
  // assignments to exactly these IDs. Empty array is valid (camera
  // runs no per-tick detectors; people_present is still always on).
  detector_ids: string[];
}

export interface CreatePairingCodeRequest {
  room: string;
  icon_name?: string;
}

export interface CreateDetectorRequest {
  name: string;
  icon_name: string;
  description: string;
  category: DetectorCategory;
  shape: DetectorShape;
  where_scope: string;
  when_scope: string;
  custom_prompt: string;
  sensitivity?: DetectorSensitivity;
}

export interface UpdateDetectorRequest {
  name?: string;
  icon_name?: string;
  description?: string;
  category?: DetectorCategory;
  shape?: DetectorShape;
  where_scope?: string;
  when_scope?: string;
  sensitivity?: DetectorSensitivity;
  is_on?: boolean;
  custom_prompt?: string;
}

export interface MintTokenRequest {
  room: string;
  identity: string;
  role: LiveKitRole;
}

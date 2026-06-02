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
// 'state' is legacy (agitation preset) — no longer offered in the UI.
// 'scheduled' = absence detector that fires if a signal is missing
// from a recurring time window.
export type DetectorShape = 'point_in_time' | 'state' | 'scheduled';
export type DetectorSensitivity = 'low' | 'standard' | 'high';
export type ScheduleCadence = 'daily' | 'weekly';

// Evaluation window for a `scheduled` detector. Fields are nullable so
// the LLM can return a partial inference (blanks the user fills in).
// Times are local "HH:MM" 24h; days_of_week is 0=Mon..6=Sun (weekly).
export interface ScheduleConfig {
  cadence: ScheduleCadence | null;
  days_of_week: number[] | null;
  window_start: string | null;
  window_end: string | null;
  deadline: string | null;
}
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
  // Web onboarding walkthrough flag. False until the user finishes or
  // skips the dashboard modal; the client PATCHes it true via
  // markWebOnboarded(). Per-surface — iOS tracks its own flag.
  onboarded_web: boolean;
  // IANA timezone scheduled detectors evaluate in. Auto-set from the
  // browser on app load (TimezoneSync).
  timezone: string;
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
  // Per-patient email alerts. enabled = master switch; recipients =
  // ADDITIONAL addresses beyond the owning caregiver's account email
  // (which always receives this patient's alerts when enabled).
  email_alerts_enabled: boolean;
  email_alert_recipients: string[];
}

// Which physical device class a camera row represents. Backend
// returns both shapes from the same /cameras endpoint. The two
// classes are both branded "Memoria Sensor"; in the Add Camera flow
// they map to the "Phone" and "Native" device-type tabs.
export type CameraSourceType = 'phone' | 'sensor';

// The wire format keeps the historical strings 'iphone' / 'pi' so
// existing rows do not need a backfill; we normalize at the
// API-client boundary.
export type CameraSourceTypeWire = 'iphone' | 'pi';

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
  // Discriminator. 'phone' = NemaraCam wall phone (existing path).
  // 'sensor' = Nemara Sensor Camera (the Pi-based path; backend
  // stores 'pi'). Defaults to 'phone' if the field is absent (older
  // backend or pre-migration row).
  source_type: CameraSourceType;
  livekit_identity: string | null;
  created_at: string;
  // True once the wall phone has completed the /v1/cameras/pair
  // handshake. False = row exists with an open pairing code but no
  // phone has claimed it yet. Drives the "PAIRING" badge in the
  // cameras list, the "Show pairing code" button on the detail page,
  // and the LiveKit tile bypass on the Live grid (no track yet).
  paired: boolean;
}

// Canonical "this camera is currently producing a live feed the
// caregiver should see" predicate. Both the Live grid (which
// cameras to subscribe to, what to count in the "N online" header)
// and the per-camera status pill in the cameras list must derive
// from this; any view that reimplements the rule inline will
// silently disagree the first time only one of them re-renders.
// We hit that on 2026-05-28 when the bedroom Pi stopped pushing
// frames: the per-camera pill went OFFLINE but the grid kept the
// tile because its filter ignored `online`.
//
// True iff: paired (has a livekit_identity), not user-hidden, the
// caregiver intent is connected, AND the backend's liveness flag
// agrees the participant is streaming. Mirror of the iOS
// `Camera.isLiveStreaming` computed property; keep the two in sync.
export function isLiveStreaming(c: Camera): boolean {
  return (
    c.livekit_identity !== null
    && !c.disabled
    && c.desired_state === 'connected'
    && c.online
  );
}

// Top-level shape of `GET /v1/cameras/discovered`. Each entry is a
// Sensor Camera that has phoned home but has not yet been paired to
// a patient. Surfaces in the "Sensor Camera" tab of the Add Camera
// flow.
export interface DiscoveredCamera {
  discovery_id: string;
  hardware_id: string;
  device_label: string;
  current_url: string;
  current_audio_url: string | null;
  first_seen_at: string;
  last_seen_at: string;
}

export interface DiscoveredCamerasResponse {
  pis: DiscoveredCamera[];
}

// Body for `POST /v1/patients/{id}/cameras/pi-provision` in the
// discovery-id mode (the only mode the web app uses; the direct-URL
// mode is for ops scripting via curl).
export interface ProvisionSensorCameraRequest {
  room: string;
  icon_name?: string;
  discovery_id: string;
}

export interface ProvisionSensorCameraResponse {
  camera_id: string;
  patient_id: string;
  pi_stream_url: string;
  pi_audio_url: string | null;
  livekit_identity: string;
  livekit_room: string;
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
  // Null for reactive detectors; the evaluation window for `scheduled`.
  schedule_config: ScheduleConfig | null;
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
  custom_prompt: string;
  // All optional — backend defaults them. Normally sent from the
  // inferred + reviewed values on the create flow.
  description?: string;
  category?: DetectorCategory;
  shape?: DetectorShape;
  icon_name?: string;
  where_scope?: string;
  when_scope?: string;
  sensitivity?: DetectorSensitivity;
  schedule_config?: ScheduleConfig | null;
}

export interface InferDetectorRequest {
  name?: string;
  prompt: string;
}

export interface InferDetectorResponse {
  shape: DetectorShape;
  category: DetectorCategory;
  icon_name: string;
  sensitivity: DetectorSensitivity;
  schedule_config: ScheduleConfig | null;
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

// ── Re-ID face enrollment ───────────────────────────────────────────

export type FaceEmbeddingSource = 'selfie' | 'harvested';
export type FaceEmbeddingStatus = 'processing' | 'ready' | 'failed';

export interface FaceEmbedding {
  id: string;
  patient_id: string;
  source: FaceEmbeddingSource;
  status: FaceEmbeddingStatus;
  det_score: number;
  failure_reason: string | null;
  created_at: string;
}

// Status-card data shared between the web dashboard's
// PatientIdentityStatus and the iOS PatientSettings card. Numbers
// and copy stay identical across both surfaces.
export interface FaceEnrollmentSummary {
  selfie_count: number;
  harvested_count: number;
  processing_count: number;
  failed_count: number;
  last_update: string | null;
}

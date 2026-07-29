// Mirrors nemara-backend's pydantic response schemas. snake_case on the wire.

export type PatientState = 'calm' | 'critical' | 'offline';
export type Relation =
  | 'parent'
  | 'spouse'
  | 'grandparent'
  | 'sibling'
  | 'client'
  | 'other';
// Data-residency region for a patient's data — the residency contract, only
// two homes today. DERIVED server-side from the picked `country`. Immutable.
export type Region = 'US' | 'IN';
// ISO 3166-1 alpha-2 country picked at onboarding/signup (e.g. 'US', 'IN',
// 'GB'). Recorded verbatim; the residency `region` is derived from it. Any
// valid ISO code — the picker offers the full country list.
export type Country = string;
export type DetectorCategory = 'safety' | 'routine';
export type DetectorSource = 'preset' | 'custom';
// 'state' = continuous/ongoing activity (e.g. watching TV) — collapses a
// whole session into one event via rising-edge episodes.
// Alert trigger — which moment fires the alert (mirrors backend AlertTrigger):
//   leading   = the moment it starts / happens
//   trailing  = when a sustained activity ends
//   duration  = once it's persisted >= duration_seconds
//   absence   = NOT detected within its active window (when_scope)
// `is_sustained` (instant vs sustained) is internal; `duration_seconds` is the
// "too long" threshold for the duration trigger.
export type AlertTrigger =
  | 'leading'
  | 'trailing'
  | 'duration'
  | 'absence'
  | 'record_only'; // never alerts — feeds daily summaries (sleep/activity)
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
  // Per-account visibility of the "Live analyses" feed. Default true;
  // flipped false to hide it for specific accounts (e.g. demo logins).
  // The page gates the section on this AND the global SHOW_LIVE_ANALYSES.
  show_live_analyses: boolean;
  // Terms of Service + Privacy Notice acceptance. `tos_accepted_at` is null
  // until the caregiver accepts; the (app) layout hard-gates the dashboard
  // while it's null or `tos_version` is stale. Mirror of the backend
  // caregivers columns; the timestamp is server-stamped, never client-set.
  tos_accepted_at: string | null;
  tos_version: string | null;
  // Country picked at signup (ISO alpha-2) + the residency `region` derived
  // from it. Both set once at signup, immutable after. Mirror of the backend.
  country: Country;
  region: Region;
}

/// A caregiver's membership on a patient (patient sharing). `role` is present
/// for future per-patient permission levels; in the MVP every member has full
/// access and only 'owner' is meaningful (can share/remove, can't be removed).
export interface PatientMember {
  caregiver_id: string;
  email: string;
  role: string;
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
  // Country this home is in (ISO alpha-2), picked at onboarding.
  country: Country;
  // Data-residency region ('US' | 'IN'), derived from `country`.
  region: Region;
  state: PatientState;
  status_line: string;
  last_event_at: string | null;
  battery_percent: number | null;
  cameras_paused: boolean;
  /** Facilities audio kill: false = no audio track is ever published. */
  audio_capture_enabled: boolean;
  photo_storage_key: string | null;
  created_at: string;
  updated_at: string;
  // Per-patient email alerts. enabled = master switch; recipients =
  // ADDITIONAL addresses beyond the owning caregiver's account email
  // (which always receives this patient's alerts when enabled).
  email_alerts_enabled: boolean;
  email_alert_recipients: string[];
  // Per-patient data-collection consent. `enabled` = the actual on/off
  // (master switch for storing short video/audio clips to improve the
  // AI). `decided_at` is stamped server-side whenever the caregiver
  // sets `data_collection_enabled` (both true AND false record a
  // decision). decided_at === null ⇒ caregiver never asked ⇒ show the
  // first-open consent banner; non-null ⇒ never auto-show again.
  data_collection_enabled: boolean;
  data_collection_decided_at: string | null;
  // LEGACY patient-wide privacy mode. Superseded by per-camera
  // `Camera.privacy_enabled` (room-derived); no web UI reads or writes
  // this anymore except the LiveRoomProvider reconnect wiring. Kept on
  // the type because the backend still returns it during the transition.
  privacy_mode_enabled: boolean;
}

// AI room classification for a camera. Bathroom/bedroom rooms are
// treated as private (privacy_enabled locks on, no user toggle);
// everything else is 'other'. Null = not yet classified.
export type RoomClass = 'bathroom' | 'bedroom' | 'other';

// Which physical device class a camera row represents. Backend
// returns both shapes from the same /cameras endpoint. The two
// classes are both branded "Memoria Sensor"; in the Add Camera flow
// they map to the "Phone" and "Native" device-type tabs.
export type CameraSourceType = 'phone' | 'sensor';

// The wire format keeps the historical strings 'iphone' / 'pi' so
// existing rows do not need a backfill; we normalize at the
// API-client boundary.
export type CameraSourceTypeWire = 'iphone' | 'pi' | 'gateway';

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
  // True while the Memoria Sensor app is RUNNING on this camera's
  // iPhone (it polls the backend every 1s when open). false = app
  // closed / phone off → the grid shows "Sensor app closed, open
  // Memoria Sensor" instead of a reconnectable "Disconnected", since
  // Reconnect can't help while the phone isn't polling. Only ever
  // false for iPhone sensors; Pi cameras have no app to close and stay
  // true. Optional/defaulted true on older backends — undefined is
  // treated as present (never falsely shows "app closed").
  app_present?: boolean;
  // AI room classification (server-side, from camera frames). Optional on
  // the wire so older backends that omit the fields don't break the type —
  // treat absent as null / not classified.
  room_class?: RoomClass | null;
  // Classifier confidence in [0,1] for `room_class`; null until classified.
  room_class_confidence?: number | null;
  // ISO timestamp of the last classification pass; null until classified.
  room_classified_at?: string | null;
  // Per-camera privacy, DERIVED from room_class (bathroom/bedroom → true).
  // Locked server-side — there is no user toggle. When true: no live
  // video/audio for this camera (placard tile, talk n/a on web); events
  // and clips still exist, with sensitive clips server-censored
  // (see DetectionEvent.clip_censored). Optional on the wire; treat
  // absent (older backend) as false.
  privacy_enabled?: boolean;
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
  // Alerting spine — the trigger + internal temporal nature + duration bar.
  alert_trigger: AlertTrigger;
  is_sustained: boolean;
  duration_seconds: number | null;
  where_scope: string;
  // Rooms the detector is scoped to (multi-select). Null/absent → every
  // room (back-compat with rows created before multi-room). where_scope is
  // the synced scalar fallback. Mirrors backend Detector.where_rooms.
  where_rooms?: string[] | null;
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
  // Null unless shape === 'state'; the rising-edge episode gap (seconds).
  episode_gap_seconds: number | null;
  // Caregiver-facing summary of the compiled prompt (plain lines:
  // "Counts: …" / "Doesn't count: …" / "Caution: …"). Regenerated on every
  // compile; null while compiling. Custom detectors only. Optional on the
  // wire so older backends (which omit it) don't break the type.
  user_criteria?: string[] | null;
  // Plain-words change requests accumulated via /refine, oldest first.
  refinements?: string[] | null;
  // True for fine-detail detectors (small motion like seizure/choking, small
  // objects like medication/stove) whose accuracy varies with camera distance
  // and lighting. Server-computed; optional on the wire (older backends omit
  // it) — treat absent as false. Mirrors iOS Detector.accuracyCaveat.
  accuracy_caveat?: boolean;
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
  // True when the clip was suppressed by privacy mode (vs still
  // processing). The web events feed is text-only so this isn't rendered
  // yet, but it's kept in sync with the backend EventResponse.
  clip_suppressed: boolean;
  // True when the clip was server-censored for privacy (blurred, audio
  // stripped) because it contains a sensitive moment — e.g. it came from
  // a private-room camera. The clip still exists and plays; it is never
  // raw. Optional on the wire; treat absent (older backend) as false.
  clip_censored?: boolean;
  // Which sensitivity categories the censor matched (server-defined
  // strings). Null/absent when the clip isn't censored.
  sensitivity_categories?: string[] | null;
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
  provider: 'gemini' | 'openai' | 'openrouter' | 'skipped';
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
  // Country the caregiver signed up from (ISO alpha-2). Optional on the wire
  // (backend defaults 'US'); the residency region is derived from it server-side.
  country?: Country;
  // Document version the caregiver accepted at signup. The backend stamps
  // tos_accepted_at server-side when present, so consent captured at signup
  // isn't re-prompted by the (app) gate. Mirrors backend CreateCaregiverRequest.
  tos_version?: string | null;
}

export interface CreatePatientRequest {
  full_name: string;
  preferred_name: string;
  relation: Relation;
  date_of_birth?: string;
  gender?: string;
  home_address?: string;
  // Country this home is in (ISO alpha-2). Optional on the wire (backend
  // defaults 'US'); the onboarding form always sends it. The residency region
  // is derived from it server-side — the client never sends region directly.
  country?: Country;
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
  audio_capture_enabled?: boolean;
  // Per-patient data-collection consent. When present in the PATCH
  // body, the backend stamps `data_collection_decided_at` server-side
  // (so both true and false record a decision). Never send
  // `data_collection_decided_at` from the client.
  data_collection_enabled?: boolean;
  // NOTE: the legacy `privacy_mode_enabled` toggle was removed — privacy
  // is now per-camera (`Camera.privacy_enabled`), derived from room_class
  // server-side and not client-settable.
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
  alert_trigger?: AlertTrigger;
  is_sustained?: boolean;
  duration_seconds?: number | null;
  icon_name?: string;
  where_scope?: string;
  // Rooms the caregiver picked (multi-select). Null/["ALL ROOMS"] = every
  // room. Drives camera auto-assignment; where_scope is kept in sync.
  where_rooms?: string[] | null;
  when_scope?: string;
  sensitivity?: DetectorSensitivity;
  schedule_config?: ScheduleConfig | null;
  // Set only when is_sustained; the rising-edge episode gap (seconds).
  episode_gap_seconds?: number | null;
  // Create-as-draft: create the detector OFF so the caregiver reviews the
  // compiled criteria on the detail editor, then turns it on. Omit/true to
  // create it enabled immediately.
  is_on?: boolean;
}

export interface InferDetectorRequest {
  name?: string;
  prompt: string;
}

// Compiled-behavior preview surfaced on the create review screen so the
// detector's actual configured behavior is visible (and correctable) BEFORE
// it exists. Mirrors backend DetectorPlan (Aryaman 2026-07-18: customs
// visibility).
export interface DetectorPlan {
  watches: string; // who: "Only the person you care for" / "Anyone in view" / a room
  fires: string; // the fire rule as a sentence
  checks: string; // look cadence as a sentence
  listens: boolean; // whether audio evidence is used
}

export interface InferDetectorResponse {
  alert_trigger: AlertTrigger;
  is_sustained: boolean;
  duration_seconds: number | null;
  category: DetectorCategory;
  icon_name: string;
  sensitivity: DetectorSensitivity;
  schedule_config: ScheduleConfig | null;
  // Set when the activity is sustained; null otherwise.
  episode_gap_seconds: number | null;
  // Plain-English preview of the compiled behavior. Null (or absent on
  // older backends) when composition failed — the review screen then hides
  // the card rather than blocking creation.
  plan?: DetectorPlan | null;
}

export interface UpdateDetectorRequest {
  name?: string;
  icon_name?: string;
  description?: string;
  category?: DetectorCategory;
  alert_trigger?: AlertTrigger;
  is_sustained?: boolean;
  duration_seconds?: number | null;
  where_scope?: string;
  // Re-scope the detector's rooms; the backend replaces its camera
  // assignments to match. ["ALL ROOMS"] = every room.
  where_rooms?: string[] | null;
  when_scope?: string;
  sensitivity?: DetectorSensitivity;
  is_on?: boolean;
  custom_prompt?: string;
}

// Body of POST /v1/detectors/{id}/refine — one plain-words change request
// ("don't count eating as choking"). The compiler receives the FULL
// accumulated list on every recompile, so refinements never weaken the
// safety bias. Mirrors backend RefineDetectorRequest.
export interface RefineDetectorRequest {
  feedback: string;
  // Dry-run: compile WITH this feedback and return the resulting criteria,
  // but persist nothing (no refinement stored, detector keeps running its
  // current instructions). Backs the "Re-generate" preview; a real submit
  // on Save omits this (or sends false) to commit. Mirrors backend.
  preview?: boolean;
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

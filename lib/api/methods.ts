import { NemaraAPI } from './core';
import type {
  Caregiver,
  Camera,
  CameraDetectorsResponse,
  CreateCaregiverRequest,
  CreateDetectorRequest,
  CreatePairingCodeRequest,
  CreatePatientRequest,
  Detector,
  DetectionEvent,
  DiscoveredCamerasResponse,
  EventFilter,
  EventListResponse,
  FaceEmbedding,
  FaceEnrollmentSummary,
  InferDetectorRequest,
  InferDetectorResponse,
  LiveKitTokenResponse,
  MintTokenRequest,
  PairingCodeResponse,
  Patient,
  ProvisionSensorCameraRequest,
  ProvisionSensorCameraResponse,
  SetCameraDetectorsRequest,
  UpdateCameraRequest,
  UpdateDetectorRequest,
  UpdatePatientRequest,
} from './types';

// Backend wire sends camera `source_type` as 'iphone' | 'pi', but the UI
// type (and all consumers, e.g. the pairing-code gate on the camera detail
// page) use 'phone' | 'sensor'. Nothing previously mapped it, so an iPhone
// camera arrived as 'iphone' and `=== 'phone'` checks silently failed
// (hiding the "Awaiting pairing" / Show-pairing-code section). Normalize on
// the way in so the runtime value matches the declared type.
function normalizeCamera(c: Camera): Camera {
  const wire = c.source_type as unknown as string;
  const source_type = wire === 'pi' || wire === 'sensor' ? 'sensor' : 'phone';
  return { ...c, source_type };
}

// Thin convenience wrapper. Methods mirror nemara-backend routers 1:1.
export class NemaraClient {
  constructor(private readonly api: NemaraAPI) {}

  // Caregiver
  getMe = () => this.api.request<Caregiver>('/v1/me');
  createMe = (body: CreateCaregiverRequest) =>
    this.api.request<Caregiver>('/v1/me', { method: 'POST', body });
  markWebOnboarded = () =>
    this.api.request<Caregiver>('/v1/me', {
      method: 'PATCH',
      body: { onboarded_web: true },
    });
  updateTimezone = (timezone: string) =>
    this.api.request<Caregiver>('/v1/me', {
      method: 'PATCH',
      body: { timezone },
    });
  // Per-patient email alerts (PATCH the patient row).
  updatePatientEmailAlerts = (
    patientId: string,
    body: {
      email_alerts_enabled?: boolean;
      email_alert_recipients?: string[];
    },
  ) => this.api.request<Patient>(`/v1/patients/${patientId}`, {
    method: 'PATCH',
    body,
  });
  sendPatientTestEmail = (patientId: string) =>
    this.api.request<{ status: string }>(
      `/v1/patients/${patientId}/test-email`,
      { method: 'POST' },
    );

  // Patients
  listPatients = () => this.api.request<Patient[]>('/v1/patients');
  createPatient = (body: CreatePatientRequest) =>
    this.api.request<Patient>('/v1/patients', { method: 'POST', body });
  updatePatient = (id: string, body: UpdatePatientRequest) =>
    this.api.request<Patient>(`/v1/patients/${id}`, {
      method: 'PATCH',
      body,
    });
  deletePatient = (id: string) =>
    this.api.request<void>(`/v1/patients/${id}`, { method: 'DELETE' });

  // Cameras
  listCameras = (patientId: string) =>
    this.api
      .request<Camera[]>(`/v1/patients/${patientId}/cameras`)
      .then((cams) => cams.map(normalizeCamera));
  createPairingCode = (patientId: string, body: CreatePairingCodeRequest) =>
    this.api.request<PairingCodeResponse>(
      `/v1/patients/${patientId}/cameras/pairing-code`,
      { method: 'POST', body },
    );
  updateCamera = (id: string, body: UpdateCameraRequest) =>
    this.api
      .request<Camera>(`/v1/cameras/${id}`, { method: 'PATCH', body })
      .then(normalizeCamera);
  deleteCamera = (id: string) =>
    this.api.request<void>(`/v1/cameras/${id}`, { method: 'DELETE' });
  // Re-mint a pairing code for an unpaired camera. Caregivers hit
  // this from the camera detail page's "Show pairing code" button
  // when they dismissed the original sheet without entering the
  // code on a wall phone. Backend returns 409 if the camera is
  // already paired.
  regeneratePairingCode = (id: string) =>
    this.api.request<PairingCodeResponse>(
      `/v1/cameras/${id}/pairing-code`,
      { method: 'POST' },
    );

  // Sensor camera discovery + provisioning. Pi devices announce
  // themselves to the backend every 60 s; the "Sensor Camera" tab of
  // the Add Camera flow lists unclaimed announcements and POSTs the
  // chosen discovery_id back to provision the camera.
  listDiscoveredCameras = () =>
    this.api.request<DiscoveredCamerasResponse>('/v1/cameras/discovered');
  provisionSensorCamera = (
    patientId: string,
    body: ProvisionSensorCameraRequest,
  ) =>
    this.api.request<ProvisionSensorCameraResponse>(
      `/v1/patients/${patientId}/cameras/pi-provision`,
      { method: 'POST', body },
    );

  // Per-camera detector assignment.
  getCameraDetectors = (id: string) =>
    this.api.request<CameraDetectorsResponse>(`/v1/cameras/${id}/detectors`);
  setCameraDetectors = (id: string, body: SetCameraDetectorsRequest) =>
    this.api.request<CameraDetectorsResponse>(`/v1/cameras/${id}/detectors`, {
      method: 'PUT',
      body,
    });

  // Detectors
  listDetectors = (patientId: string) =>
    this.api.request<Detector[]>(`/v1/patients/${patientId}/detectors`);
  // LLM-classify a plain-English detector request for the create review
  // screen. Returns shape/category/icon/sensitivity + schedule (nulls
  // where the model was unsure).
  inferDetector = (body: InferDetectorRequest) =>
    this.api.request<InferDetectorResponse>('/v1/detectors/infer', {
      method: 'POST',
      body,
    });
  createDetector = (patientId: string, body: CreateDetectorRequest) =>
    this.api.request<Detector>(`/v1/patients/${patientId}/detectors`, {
      method: 'POST',
      body,
    });
  updateDetector = (id: string, body: UpdateDetectorRequest) =>
    this.api.request<Detector>(`/v1/detectors/${id}`, {
      method: 'PATCH',
      body,
    });
  deleteDetector = (id: string) =>
    this.api.request<void>(`/v1/detectors/${id}`, { method: 'DELETE' });

  // Events
  listEvents = (
    patientId: string,
    opts: { filter?: EventFilter; cursor?: string; limit?: number } = {},
  ) =>
    this.api.request<EventListResponse>(
      `/v1/patients/${patientId}/events`,
      { query: opts },
    );
  getEvent = (id: string) =>
    this.api.request<DetectionEvent>(`/v1/events/${id}`);

  // LiveKit
  mintLiveKitToken = (body: MintTokenRequest) =>
    this.api.request<LiveKitTokenResponse>('/v1/livekit/token', {
      method: 'POST',
      body,
    });

  // ── Re-ID face enrollment (read-only on web) ────────────────────
  // The web app is a read-only status surface. The iOS caregiver app
  // owns the capture flow (live front-camera). Web just displays
  // counts + dates and exposes a delete affordance.
  listFaceEmbeddings = (patientId: string) =>
    this.api.request<FaceEmbedding[]>(
      `/v1/patients/${patientId}/face-embeddings`,
    );
  getFaceEnrollmentSummary = (patientId: string) =>
    this.api.request<FaceEnrollmentSummary>(
      `/v1/patients/${patientId}/face-embeddings/summary`,
    );
  deleteFaceEmbedding = (embeddingId: string) =>
    this.api.request<void>(
      `/v1/face-embeddings/${embeddingId}`,
      { method: 'DELETE' },
    );
}

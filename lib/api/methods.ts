import { NemaraAPI } from './core';
import type {
  Caregiver,
  Camera,
  CreateCaregiverRequest,
  CreateDetectorRequest,
  CreatePairingCodeRequest,
  CreatePatientRequest,
  Detector,
  DetectionEvent,
  EventFilter,
  EventListResponse,
  LiveKitTokenResponse,
  MintTokenRequest,
  PairingCodeResponse,
  Patient,
  UpdateCameraRequest,
  UpdateDetectorRequest,
  UpdatePatientRequest,
} from './types';

// Thin convenience wrapper. Methods mirror nemara-backend routers 1:1.
export class NemaraClient {
  constructor(private readonly api: NemaraAPI) {}

  // Caregiver
  getMe = () => this.api.request<Caregiver>('/v1/me');
  createMe = (body: CreateCaregiverRequest) =>
    this.api.request<Caregiver>('/v1/me', { method: 'POST', body });

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
    this.api.request<Camera[]>(`/v1/patients/${patientId}/cameras`);
  createPairingCode = (patientId: string, body: CreatePairingCodeRequest) =>
    this.api.request<PairingCodeResponse>(
      `/v1/patients/${patientId}/cameras/pairing-code`,
      { method: 'POST', body },
    );
  updateCamera = (id: string, body: UpdateCameraRequest) =>
    this.api.request<Camera>(`/v1/cameras/${id}`, {
      method: 'PATCH',
      body,
    });
  deleteCamera = (id: string) =>
    this.api.request<void>(`/v1/cameras/${id}`, { method: 'DELETE' });

  // Detectors
  listDetectors = (patientId: string) =>
    this.api.request<Detector[]>(`/v1/patients/${patientId}/detectors`);
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
}

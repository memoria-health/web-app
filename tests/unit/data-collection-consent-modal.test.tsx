import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

// env.ts (pulled in transitively via the api client) requires NEXT_PUBLIC_*.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54341';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb_test';
process.env.NEXT_PUBLIC_NEMARA_BACKEND_URL = 'http://127.0.0.1:8002';
process.env.NEXT_PUBLIC_LIVEKIT_URL = 'wss://test.livekit.cloud';

// Mock the browser API client so we can assert what the modal PATCHes
// without any network. updatePatient resolves so onDecide fires.
const updatePatient = vi.fn().mockResolvedValue({});
vi.mock('@/lib/api/client', () => ({
  getBrowserNemara: () => ({ updatePatient }),
}));

const { DataCollectionConsentModal } = await import(
  '@/app/_components/DataCollectionConsentModal'
);
const React = await import('react');

// React 19 act() flags an environment as test-capable via this global.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe('DataCollectionConsentModal', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    updatePatient.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function render(onDecide = vi.fn()) {
    act(() => {
      root.render(
        React.createElement(DataCollectionConsentModal, {
          patientId: 'patient-123',
          patientName: 'Maggie',
          onDecide,
        }),
      );
    });
    return onDecide;
  }

  function clickButton(label: string) {
    const btn = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === label,
    );
    if (!btn) throw new Error(`button "${label}" not found`);
    act(() => {
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  }

  it('renders the consent copy with the patient name', () => {
    render();
    expect(container.textContent).toContain('Help improve care for everyone.');
    expect(container.textContent).toContain('Maggie');
  });

  it('"Share recordings" PATCHes data_collection_enabled: true', async () => {
    const onDecide = render();
    clickButton('Share recordings');
    // flush the awaited updatePatient + onDecide microtasks
    await act(async () => {});
    expect(updatePatient).toHaveBeenCalledTimes(1);
    expect(updatePatient).toHaveBeenCalledWith('patient-123', {
      data_collection_enabled: true,
    });
    expect(onDecide).toHaveBeenCalledWith(true);
  });

  it('"Not now" PATCHes data_collection_enabled: false', async () => {
    const onDecide = render();
    clickButton('Not now');
    await act(async () => {});
    expect(updatePatient).toHaveBeenCalledTimes(1);
    expect(updatePatient).toHaveBeenCalledWith('patient-123', {
      data_collection_enabled: false,
    });
    expect(onDecide).toHaveBeenCalledWith(false);
  });
});

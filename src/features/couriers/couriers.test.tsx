import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useCouriers } from './presentation/hooks/useCouriers.js';
import type { CourierUseCases } from './application/courierUseCases.js';
import { OTHER_UUID, VALID_UUID } from '../../test/fakeHttpClient.js';

function useCases(): CourierUseCases {
  return {
    getCouriers: { execute: vi.fn(() => Promise.resolve({ items: [], total: 0, page: 1, pageSize: 20 } as never)) },
    updateAvailability: { execute: vi.fn() },
    assignRoute: {
      execute: vi.fn(() => Promise.resolve({ routeId: VALID_UUID, courierId: OTHER_UUID, status: 'asignada' } as never)),
    },
    getActiveRoute: { execute: vi.fn(() => Promise.resolve(null)) },
  };
}

describe('useCouriers', () => {
  it('el aviso de asignación muestra códigos cortos y no los UUID completos', async () => {
    const cases = useCases();
    const { result } = renderHook(() => useCouriers(cases));
    await waitFor(() => expect(result.current.isLoadingCouriers).toBe(false));

    await act(async () => {
      await result.current.assignRoute(VALID_UUID, OTHER_UUID);
    });

    const message = result.current.successMessage ?? '';
    expect(message).toMatch(/Ruta #RUT-[0-9A-Z]{4} asignada al repartidor #REP-[0-9A-Z]{4}/);
    expect(message).not.toContain(VALID_UUID);
    expect(message).not.toContain(OTHER_UUID);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { toErrorMessage, usePaginatedList } from './usePaginatedList.js';

describe('toErrorMessage', () => {
  it('devuelve el mensaje del Error cuando no está vacío y el fallback en otro caso', () => {
    expect(toErrorMessage(new Error('Fallo de red'), 'Fallback')).toBe('Fallo de red');
    expect(toErrorMessage(new Error('   '), 'Fallback')).toBe('Fallback');
    expect(toErrorMessage('cadena', 'Fallback')).toBe('Fallback');
  });
});

describe('usePaginatedList', () => {
  it('carga la página inicial, soporta recarga con offset y maneja errores', async () => {
    const fetchPage = vi
      .fn<
        (params: { q?: string; limit: number; offset: number }) => Promise<{
          items: readonly string[];
          total: number;
          offset: number;
        }>
      >()
      .mockResolvedValueOnce({ items: ['uno', 'dos'], total: 5, offset: 0 })
      .mockResolvedValueOnce({ items: ['tres'], total: 5, offset: 2 })
      .mockRejectedValueOnce(new Error('Error 500'));

    const initialFilters = { q: 'abc' };
    const { result } = renderHook(() =>
      usePaginatedList<string, { q?: string; offset?: number }>({
        appliedFilters: initialFilters,
        pageSize: 2,
        errorFallback: 'Error genérico',
        fetchPage,
      }),
    );

    await waitFor(() => expect(result.current.items).toEqual(['uno', 'dos']));
    expect(result.current.total).toBe(5);
    expect(result.current.offset).toBe(0);
    expect(fetchPage).toHaveBeenCalledWith({ q: 'abc', limit: 2, offset: 0 });

    await act(async () => {
      await result.current.loadPage({ q: 'abc', offset: 2 });
    });
    expect(result.current.items).toEqual(['tres']);
    expect(result.current.offset).toBe(2);

    await act(async () => {
      await result.current.loadPage({ q: 'abc', offset: 4 });
    });
    expect(result.current.requestError).toBe('Error 500');
  });
});

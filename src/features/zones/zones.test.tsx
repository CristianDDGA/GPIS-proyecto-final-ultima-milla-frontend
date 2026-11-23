import { describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpZoneRepository } from './infrastructure/http/httpZoneRepository.js';
import { ZoneForm } from './presentation/components/ZoneForm.js';
import { useZones } from './presentation/hooks/useZones.js';
import type { Zone, ZoneRepository } from './domain/index.js';
import { HttpError } from '../../shared/infrastructure/http/httpClient.js';
import { createFakeHttpClient, VALID_UUID } from '../../test/fakeHttpClient.js';

const ZONE: Zone = {
  id: VALID_UUID,
  name: 'Centro',
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
};

describe('HttpZoneRepository', () => {
  it('acepta listados planos o envueltos', async () => {
    await expect(new HttpZoneRepository(createFakeHttpClient([ZONE])).getAll()).resolves.toEqual([ZONE]);
    await expect(new HttpZoneRepository(createFakeHttpClient({ items: [ZONE] })).getAll()).resolves.toEqual([ZONE]);
  });

  it('rechaza zonas que no cumplen el contrato', async () => {
    await expect(new HttpZoneRepository(createFakeHttpClient([{ id: 'x' }])).getAll()).rejects.toThrow(/contrato/);
  });

  it('404 equivale a lista vacía o zona inexistente', async () => {
    const http = createFakeHttpClient();
    http.get.mockRejectedValue(new HttpError(404, 'Not Found'));
    const repository = new HttpZoneRepository(http);
    await expect(repository.getAll()).resolves.toEqual([]);
    await expect(repository.getById(VALID_UUID)).resolves.toBeNull();
  });

  it('crea zonas con respuesta { data }', async () => {
    const http = createFakeHttpClient({ data: ZONE });
    await expect(new HttpZoneRepository(http).create({ name: 'Centro' })).resolves.toEqual(ZONE);
    expect(http.post).toHaveBeenCalledWith('/zones', { name: 'Centro' });
  });
});

describe('ZoneForm (React Testing Library)', () => {
  it('muestra el error y no envía si el nombre está vacío', async () => {
    const onSubmit = vi.fn(() => Promise.resolve(true));
    render(<ZoneForm onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('button', { name: 'Crear Zona' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/no puede estar vacío/);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('envía el nombre y limpia el campo al guardar', async () => {
    const onSubmit = vi.fn(() => Promise.resolve(true));
    render(<ZoneForm onSubmit={onSubmit} />);
    const input = screen.getByLabelText(/Nombre de la Zona/);

    await userEvent.type(input, 'Norte');
    await userEvent.click(screen.getByRole('button', { name: 'Crear Zona' }));

    expect(onSubmit).toHaveBeenCalledWith('Norte');
    await waitFor(() => expect(input).toHaveValue(''));
  });

  it('deshabilita el formulario mientras guarda', () => {
    render(<ZoneForm onSubmit={() => Promise.resolve(true)} isSubmitting />);
    expect(screen.getByRole('button', { name: /Guardando/ })).toBeDisabled();
    expect(screen.getByLabelText(/Nombre de la Zona/)).toBeDisabled();
  });
});

describe('useZones', () => {
  function repository(overrides: Partial<ZoneRepository> = {}): ZoneRepository {
    return {
      getAll: vi.fn(() => Promise.resolve([ZONE])),
      getById: vi.fn(() => Promise.resolve(ZONE)),
      create: vi.fn((input: { name: string }) => Promise.resolve({ ...ZONE, id: 'nueva', name: input.name })),
      ...overrides,
    };
  }

  it('carga las zonas al montar', async () => {
    const { result } = renderHook(() => useZones(repository()));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.zones).toEqual([ZONE]);
  });

  it('agrega la zona creada al inicio y muestra el mensaje', async () => {
    const repo = repository();
    const { result } = renderHook(() => useZones(repo));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let created = false;
    await act(async () => {
      created = await result.current.createZone('Sur');
    });

    expect(created).toBe(true);
    await waitFor(() => expect(result.current.zones[0]?.name).toBe('Sur'));
    expect(result.current.successMessage).toMatch(/Sur/);
  });

  it('expone el error de carga', async () => {
    const { result } = renderHook(() =>
      useZones(repository({ getAll: vi.fn(() => Promise.reject(new Error('API caída'))) })),
    );
    await waitFor(() => expect(result.current.error).toBe('API caída'));
  });
});

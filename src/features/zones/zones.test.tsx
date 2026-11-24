import { describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpZoneRepository } from './infrastructure/http/httpZoneRepository.js';
import { ZoneForm } from './presentation/components/ZoneForm.js';
import { useZones } from './presentation/hooks/useZones.js';
import { SetZoneCoverageUseCase } from './application/index.js';
import { describeCoverage, validateCoverage } from './domain/index.js';
import type { Zone, ZoneCoverage, ZoneRepository } from './domain/index.js';
import { HttpError } from '../../shared/infrastructure/http/httpClient.js';
import { createFakeHttpClient, OTHER_UUID, VALID_UUID } from '../../test/fakeHttpClient.js';

// El mapa real usa teselas y búsqueda en línea: aquí se sustituye por un botón que marca un punto.
vi.mock('../store/presentation/components/EcuadorMapPicker.js', () => ({
  EcuadorMapPicker: ({ onChange }: { onChange: (c: { latitude: number; longitude: number }) => void }) => (
    <button type="button" onClick={() => onChange({ latitude: -1.2491, longitude: -78.6167 })}>
      Marcar punto de prueba
    </button>
  ),
}));

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

    // Sin centro en el mapa no se envía.
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/centro de la zona/);

    await userEvent.click(screen.getByRole('button', { name: 'Marcar punto de prueba' }));
    await userEvent.click(screen.getByRole('button', { name: 'Crear Zona' }));

    expect(onSubmit).toHaveBeenCalledWith('Norte', { latitude: -1.2491, longitude: -78.6167, radiusKm: 3 });
    await waitFor(() => expect(input).toHaveValue(''));
  });

  it('acepta el radio con coma decimal y rechaza uno fuera de rango', async () => {
    const onSubmit = vi.fn(() => Promise.resolve(true));
    render(<ZoneForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/Nombre de la Zona/), 'Norte');
    await userEvent.click(screen.getByRole('button', { name: 'Marcar punto de prueba' }));
    const radius = screen.getByLabelText(/Radio de cobertura en km/);

    await userEvent.clear(radius);
    await userEvent.type(radius, '80');
    await userEvent.click(screen.getByRole('button', { name: 'Crear Zona' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/radio/);

    await userEvent.clear(radius);
    await userEvent.type(radius, '2,5');
    await userEvent.click(screen.getByRole('button', { name: 'Crear Zona' }));
    expect(onSubmit).toHaveBeenCalledWith('Norte', expect.objectContaining({ radiusKm: 2.5 }));
  });

  it('rechaza nombres que el servidor también rechaza (muy corto o sin letras)', async () => {
    const onSubmit = vi.fn(() => Promise.resolve(true));
    render(<ZoneForm onSubmit={onSubmit} />);
    const input = screen.getByLabelText(/Nombre de la Zona/);
    await userEvent.type(input, 'ab');
    await userEvent.click(screen.getByRole('button', { name: 'Crear Zona' }));
    expect(screen.getByText(/entre 3 y 40/)).toBeInTheDocument();
    await userEvent.clear(input);
    await userEvent.type(input, '1 2 a b');
    await userEvent.click(screen.getByRole('button', { name: 'Crear Zona' }));
    expect(screen.getByText(/al menos 3 letras/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
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
      setCoverage: vi.fn((id: string, coverage: ZoneCoverage | null) => Promise.resolve({ ...ZONE, id, coverage })),
      ...overrides,
    };
  }

  it('carga las zonas al montar', async () => {
    const { result } = renderHook(() => useZones(repository()));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.zones).toEqual([ZONE]);
  });

  it('agrega la zona creada al inicio y muestra el mensaje', async () => {
    const repo = repository({
      create: vi.fn((input: { name: string }) => Promise.resolve({ ...ZONE, id: OTHER_UUID, name: input.name })),
      setCoverage: vi.fn((id: string, coverage: ZoneCoverage | null) => Promise.resolve({ ...ZONE, id, name: 'Sur', coverage })),
    });
    const { result } = renderHook(() => useZones(repo));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let created = false;
    await act(async () => {
      created = await result.current.createZone('Sur', { latitude: -1.25, longitude: -78.61, radiusKm: 3 });
    });

    expect(created).toBe(true);
    await waitFor(() => expect(result.current.zones[0]?.name).toBe('Sur'));
    expect(result.current.zones[0]?.coverage).toEqual({ latitude: -1.25, longitude: -78.61, radiusKm: 3 });
    expect(result.current.successMessage).toMatch(/Sur/);
  });

  it('si falla la cobertura, la zona queda en la lista y se avisa cómo completarla', async () => {
    const repo = repository({
      create: vi.fn((input: { name: string }) => Promise.resolve({ ...ZONE, id: OTHER_UUID, name: input.name })),
      setCoverage: vi.fn(() => Promise.reject(new Error('sin red'))),
    });
    const { result } = renderHook(() => useZones(repo));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.createZone('Sur', { latitude: -1.25, longitude: -78.61, radiusKm: 3 });
    });

    expect(result.current.zones[0]?.name).toBe('Sur');
    expect(result.current.error).toMatch(/no se pudo guardar su cobertura.*Cobertura/);
  });

  it('si falla la creación (p. ej. nombre repetido) no toca la lista ni intenta la cobertura', async () => {
    const setCoverage = vi.fn();
    const repo = repository({ create: vi.fn(() => Promise.reject(new Error('Ya existe una zona con ese nombre'))), setCoverage });
    const { result } = renderHook(() => useZones(repo));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let created = true;
    await act(async () => {
      created = await result.current.createZone('Centro', { latitude: -1.25, longitude: -78.61, radiusKm: 3 });
    });

    expect(created).toBe(false);
    expect(result.current.error).toMatch(/Ya existe/);
    expect(setCoverage).not.toHaveBeenCalled();
  });

  it('expone el error de carga', async () => {
    const { result } = renderHook(() =>
      useZones(repository({ getAll: vi.fn(() => Promise.reject(new Error('API caída'))) })),
    );
    await waitFor(() => expect(result.current.error).toBe('API caída'));
  });
});

const COVERAGE: ZoneCoverage = { latitude: -1.2491, longitude: -78.6167, radiusKm: 3 };

describe('cobertura de zonas', () => {
  it('valida centro dentro de Ecuador y radio entre 0,1 y 50 km', () => {
    expect(validateCoverage(COVERAGE).isValid).toBe(true);
    expect(validateCoverage({ ...COVERAGE, latitude: 40 }).error).toMatch(/Ecuador/);
    expect(validateCoverage({ ...COVERAGE, longitude: Number.NaN }).error).toMatch(/centro/);
    expect(validateCoverage({ ...COVERAGE, radiusKm: 0.05 }).error).toMatch(/radio/);
    expect(validateCoverage({ ...COVERAGE, radiusKm: 51 }).isValid).toBe(false);
  });

  it('describe la cobertura para el listado', () => {
    expect(describeCoverage(null)).toBe('Sin cobertura');
    expect(describeCoverage(undefined)).toBe('Sin cobertura');
    expect(describeCoverage(COVERAGE)).toBe('3 km');
    expect(describeCoverage({ ...COVERAGE, radiusKm: 2.5 })).toBe('2,5 km');
  });

  it('el repositorio envía PUT /zones/:id/coverage y lee la zona devuelta', async () => {
    const zone = { ...ZONE, coverage: COVERAGE };
    const http = createFakeHttpClient(zone);
    const repository = new HttpZoneRepository(http);
    await expect(repository.setCoverage(VALID_UUID, COVERAGE)).resolves.toEqual(zone);
    expect(http.put).toHaveBeenCalledWith(`/zones/${VALID_UUID}/coverage`, { coverage: COVERAGE });
    await repository.setCoverage(VALID_UUID, null);
    expect(http.put).toHaveBeenLastCalledWith(`/zones/${VALID_UUID}/coverage`, { coverage: null });
  });

  it('el repositorio rechaza una cobertura con forma inválida', async () => {
    const http = createFakeHttpClient({ ...ZONE, coverage: { latitude: 'x' } });
    await expect(new HttpZoneRepository(http).setCoverage(VALID_UUID, COVERAGE)).rejects.toThrow(/contrato/);
  });

  it('el caso de uso valida, redondea el radio y permite quitar la cobertura', async () => {
    const repo: ZoneRepository = {
      getAll: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      setCoverage: vi.fn((id: string, coverage: ZoneCoverage | null) => Promise.resolve({ ...ZONE, id, coverage })),
    };
    const useCase = new SetZoneCoverageUseCase(repo);
    await useCase.execute(VALID_UUID, { ...COVERAGE, radiusKm: 2.456 });
    expect(repo.setCoverage).toHaveBeenCalledWith(VALID_UUID, { ...COVERAGE, radiusKm: 2.46 });
    await useCase.execute(VALID_UUID, null);
    expect(repo.setCoverage).toHaveBeenLastCalledWith(VALID_UUID, null);
    expect(() => useCase.execute('no-es-uuid', COVERAGE)).toThrow(/inválido/);
    expect(() => useCase.execute(VALID_UUID, { ...COVERAGE, radiusKm: 99 })).toThrow(/radio/);
  });

  it('useZones.setCoverage actualiza la zona en la lista y avisa', async () => {
    const repo: ZoneRepository = {
      getAll: vi.fn(() => Promise.resolve([ZONE])),
      getById: vi.fn(() => Promise.resolve(ZONE)),
      create: vi.fn(),
      setCoverage: vi.fn((id: string, coverage: ZoneCoverage | null) => Promise.resolve({ ...ZONE, id, coverage })),
    };
    const { result } = renderHook(() => useZones(repo));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let saved = false;
    await act(async () => {
      saved = await result.current.setCoverage(VALID_UUID, COVERAGE);
    });
    expect(saved).toBe(true);
    expect(result.current.zones[0]?.coverage).toEqual(COVERAGE);
    expect(result.current.successMessage).toMatch(/guardada/);
    await act(async () => {
      saved = await result.current.setCoverage(VALID_UUID, { ...COVERAGE, radiusKm: 99 });
    });
    expect(saved).toBe(false);
    expect(result.current.error).toMatch(/radio/);
  });
});

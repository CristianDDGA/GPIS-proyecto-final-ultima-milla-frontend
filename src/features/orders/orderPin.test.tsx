import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { validateOrder, type OrderGateway } from './domain/index.js';
import { CreateOrderUseCase } from './application/createOrderUseCase.js';
import { HttpOrderGateway } from './infrastructure/http/httpOrderGateway.js';
import { OrderForm } from './presentation/components/OrderForm.js';
import type { Zone } from '../zones/domain/index.js';
import { createFakeHttpClient, VALID_UUID } from '../../test/fakeHttpClient.js';

// El mapa real usa teselas y búsqueda en línea: aquí se sustituye por botones que marcan un punto.
vi.mock('../store/presentation/components/EcuadorMapPicker.js', () => ({
  EcuadorMapPicker: ({ onChange }: { onChange: (c: { latitude: number; longitude: number }) => void }) => (
    <>
      <button type="button" onClick={() => onChange({ latitude: -1.2491, longitude: -78.6167 })}>
        Punto dentro
      </button>
      <button type="button" onClick={() => onChange({ latitude: -2.1894, longitude: -79.8891 })}>
        Punto fuera
      </button>
    </>
  ),
}));

const ZONE: Zone = {
  id: VALID_UUID,
  name: 'Ambato Centro',
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
  coverage: { latitude: -1.2491, longitude: -78.6167, radiusKm: 5 },
  isActive: true,
};

const BASE = { zoneId: VALID_UUID, deliveryAddress: 'Av. Cevallos y Montalvo', deliveryDate: '2026-11-25', deliveryTime: '10:00' };

describe('pin del pedido (dominio, caso de uso y gateway)', () => {
  it('sin pin es válido salvo que el formulario lo exija', () => {
    expect(validateOrder(BASE).isValid).toBe(true);
    expect(validateOrder(BASE, { requirePin: true }).errors.location).toMatch(/Marca en el mapa/);
  });

  it('exige las dos coordenadas y dentro de Ecuador', () => {
    expect(validateOrder({ ...BASE, latitude: -1.25, longitude: null }).errors.location).toMatch(/completo/);
    expect(validateOrder({ ...BASE, latitude: 40.4, longitude: -3.7 }).errors.location).toMatch(/Ecuador/);
    expect(validateOrder({ ...BASE, latitude: -1.25, longitude: -78.61 }, { requirePin: true }).isValid).toBe(true);
  });

  it('el caso de uso conserva el pin y el gateway lo envía a POST /orders', async () => {
    const http = createFakeHttpClient({ ...BASE, id: VALID_UUID, status: 'pendiente', createdAt: '2026-11-24T10:00:00.000Z', updatedAt: '2026-11-24T10:00:00.000Z', latitude: -1.25, longitude: -78.61 });
    const gateway = new HttpOrderGateway(http);
    await new CreateOrderUseCase(gateway as OrderGateway).execute({ ...BASE, latitude: -1.25, longitude: -78.61 });
    expect(http.post).toHaveBeenCalledWith('/orders', { ...BASE, latitude: -1.25, longitude: -78.61 });
  });

  it('sin pin no se envían las coordenadas', async () => {
    const http = createFakeHttpClient({ ...BASE, id: VALID_UUID, status: 'pendiente', createdAt: '2026-11-24T10:00:00.000Z', updatedAt: '2026-11-24T10:00:00.000Z', latitude: null, longitude: null });
    await new HttpOrderGateway(http).create(BASE);
    expect(http.post).toHaveBeenCalledWith('/orders', BASE);
  });
});

describe('OrderForm con pin obligatorio', () => {
  async function fill() {
    await userEvent.selectOptions(screen.getByLabelText(/Zona de Cobertura/), VALID_UUID);
    await userEvent.type(screen.getByLabelText(/Dirección de Entrega/), 'Av. Cevallos y Montalvo');
    await userEvent.type(screen.getByLabelText(/Fecha de Entrega/), '2026-11-25');
    await userEvent.type(screen.getByLabelText(/Hora de Entrega/), '10:00');
  }

  it('no envía sin marcar el punto en el mapa', async () => {
    const onSubmit = vi.fn(() => Promise.resolve(true));
    render(<OrderForm zones={[ZONE]} isLoadingZones={false} onSubmit={onSubmit} />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Crear Pedido' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Marca en el mapa el punto exacto/);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rechaza un punto fuera del círculo de la zona elegida', async () => {
    const onSubmit = vi.fn(() => Promise.resolve(true));
    render(<OrderForm zones={[ZONE]} isLoadingZones={false} onSubmit={onSubmit} />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Punto fuera' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/queda fuera de la zona "Ambato Centro"/);
    await userEvent.click(screen.getByRole('button', { name: 'Crear Pedido' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('envía el pedido con el pin cuando cae dentro de la zona y limpia el formulario', async () => {
    const onSubmit = vi.fn(() => Promise.resolve(true));
    render(<OrderForm zones={[ZONE]} isLoadingZones={false} onSubmit={onSubmit} />);
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Punto dentro' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Crear Pedido' }));
    expect(onSubmit).toHaveBeenCalledWith({ ...BASE, latitude: -1.2491, longitude: -78.6167 });
    await waitFor(() => expect(screen.getByLabelText(/Dirección de Entrega/)).toHaveValue(''));
  });
});

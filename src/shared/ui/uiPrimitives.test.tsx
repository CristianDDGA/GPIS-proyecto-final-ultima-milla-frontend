import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { KpiStrip } from './KpiStrip/KpiStrip.js';
import { PageHeader } from './PageHeader/PageHeader.js';
import {
  KpiStripSkeleton,
  ProductGridSkeleton,
  Skeleton,
  TableRowsSkeleton,
  TopRefetchBar,
} from './Skeleton/Skeleton.js';
import { RouteStopsMap, type RouteMapStop } from './Map/RouteStopsMap.js';

const STOPS: readonly RouteMapStop[] = [
  {
    orderId: '44444444-4444-4444-8444-444444444401',
    position: 1,
    address: 'Av. Amazonas N34-120 y República',
    status: 'entregado',
    latitude: -0.1765,
    longitude: -78.4852,
    deliveryDate: '2026-11-26',
    deliveryTime: '14:00',
    totalCents: 13998,
  },
  {
    orderId: '44444444-4444-4444-8444-444444444402',
    position: 2,
    address: 'Calle Venezuela N4-32 y Chile',
    status: 'en_camino',
    latitude: -0.2201,
    longitude: -78.5123,
    deliveryDate: '2026-11-26',
    deliveryTime: '16:00',
    recipientName: 'Sofía Montalvo',
    recipientPhone: '+593 99 876 5432',
    totalCents: 3450,
  },
];

function stubOsrm(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            routes: [
              {
                distance: 6400,
                duration: 960,
                geometry: { coordinates: [[-78.4852, -0.1765], [-78.5, -0.2], [-78.5123, -0.2201]] },
              },
            ],
          }),
      } as Response),
    ),
  );
}

describe('primitivos de dashboard', () => {
  it('KpiStrip muestra etiquetas, valores, pistas y tonos', () => {
    render(
      <KpiStrip
        ariaLabel="Resumen de prueba"
        items={[
          { label: 'Entregas', value: 12, hint: 'Hoy', tone: 'green', icon: <span>★</span> },
          { label: 'Fallidas', value: '0' },
        ]}
      />,
    );
    const region = screen.getByRole('region', { name: 'Resumen de prueba' });
    expect(region).toHaveTextContent('Entregas');
    expect(region).toHaveTextContent('12');
    expect(region).toHaveTextContent('Hoy');
    expect(region.querySelector('.wl-kpi-tile--green')).not.toBeNull();
  });

  it('PageHeader renderiza un único h2 con eyebrow, subtítulo, badge y acciones', () => {
    render(
      <PageHeader
        id="titulo"
        eyebrow="Operación"
        title="Zonas de cobertura"
        subtitle="Sectores habilitados"
        badge={<span>Nuevo</span>}
        actions={<button type="button">Actualizar</button>}
      />,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Zonas de cobertura' })).toHaveAttribute('id', 'titulo');
    expect(screen.getByText('Operación')).toBeInTheDocument();
    expect(screen.getByText('Sectores habilitados')).toBeInTheDocument();
    expect(screen.getByText('Nuevo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeInTheDocument();
  });

  it('los skeletons son accesibles y TopRefetchBar solo aparece mientras está activo', () => {
    const { rerender } = render(
      <>
        <Skeleton height="2rem" width={120} radius={8} />
        <KpiStripSkeleton count={2} />
        <ProductGridSkeleton count={2} />
        <TableRowsSkeleton rows={2} label="Cargando tabla de prueba" />
        <TopRefetchBar active={false} />
      </>,
    );
    expect(screen.getByRole('status', { name: 'Cargando tabla de prueba' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Cargando métricas' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Actualizando datos...' })).toBeNull();

    rerender(<TopRefetchBar active label="Actualizando prueba" />);
    expect(screen.getByRole('status', { name: 'Actualizando prueba' })).toBeInTheDocument();
  });
});

describe('RouteStopsMap estilo Uber', () => {
  it('arranca en la capa Uber, con HUD, dock de la parada en camino y enlaces de navegación', async () => {
    stubOsrm();
    const { container } = render(<RouteStopsMap stops={STOPS} title="Mapa de prueba" />);

    expect(container.querySelector('.route-map-shell')).toHaveAttribute('data-map-layer', 'uber');
    expect(screen.getByRole('region', { name: 'Mapa de prueba' })).not.toHaveAttribute('tabindex');
    expect(screen.getByRole('button', { name: /Mover el mapa con el teclado/i })).toBeInTheDocument();

    const dock = screen.getByRole('region', { name: /Parada 2 seleccionada/i });
    expect(dock).toHaveTextContent('Calle Venezuela N4-32 y Chile');
    expect(dock.querySelector('a[href^="https://waze.com/ul"]')).not.toBeNull();
    expect(dock.querySelector('a[href^="https://www.google.com/maps/dir"]')).not.toBeNull();

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('16 min'));
    expect(screen.getByRole('status')).toHaveTextContent('1/2 entregadas');
  });

  it('mantiene un único diseño de mapa con máscara territorial sin botones de cambio de capa', () => {
    stubOsrm();
    const { container } = render(<RouteStopsMap stops={STOPS} />);
    const shell = container.querySelector('.route-map-shell');

    expect(shell).toHaveAttribute('data-map-layer', 'uber');
    expect(container.querySelector('.route-map-territory-mask')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Satélite' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Calles' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Uber' })).toBeNull();
  });

  it('recorre las paradas con el dock, avisa a quien lo escucha y permite cerrarlo', () => {
    stubOsrm();
    const onSelect = vi.fn();
    render(<RouteStopsMap stops={STOPS} onSelectStop={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: 'Parada siguiente' }));
    expect(onSelect).toHaveBeenLastCalledWith(STOPS[0]?.orderId);
    expect(screen.getByRole('region', { name: /Parada 1 seleccionada/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Parada anterior' }));
    expect(onSelect).toHaveBeenLastCalledWith(STOPS[1]?.orderId);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar detalle de parada' }));
    expect(screen.queryByRole('region', { name: /Parada \d seleccionada/i })).toBeNull();
  });

  it('expande y contrae el mapa, y responde a las teclas de zoom y desplazamiento', () => {
    stubOsrm();
    const { container } = render(<RouteStopsMap stops={STOPS} title="Mapa de prueba" />);
    const viewport = screen.getByRole('region', { name: 'Mapa de prueba' });

    fireEvent.click(screen.getByRole('button', { name: 'Expandir mapa' }));
    expect(viewport).toHaveStyle({ height: '640px' });
    expect(container.querySelector('.route-map-shell--expanded')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Contraer mapa' }));
    expect(viewport).toHaveStyle({ height: '460px' });

    for (const key of ['+', '-', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
      fireEvent.keyDown(screen.getByRole('button', { name: /Mover el mapa con el teclado/i }), { key });
    }
    expect(viewport).toBeInTheDocument();
  });

  it('valida la ubicación GPS dentro de Ecuador', () => {
    stubOsrm();
    let position = { latitude: -0.18, longitude: -78.47 };
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (success: (value: { coords: typeof position }) => void) => success({ coords: position }),
      },
    });
    render(<RouteStopsMap stops={STOPS} />);

    fireEvent.click(screen.getByRole('button', { name: 'Mi ubicación' }));
    expect(screen.getByRole('button', { name: 'Mi ubicación' })).toHaveClass('route-map-ctrl-btn--active');

    position = { latitude: 40.7, longitude: -74 };
    fireEvent.click(screen.getByRole('button', { name: 'Mi ubicación' }));
    expect(screen.getByText(/fuera de Ecuador/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar aviso de ubicación' }));
    expect(screen.queryByText(/fuera de Ecuador/i)).toBeNull();
  });

  it('muestra el mensaje vacío cuando ninguna parada tiene pin', () => {
    render(
      <RouteStopsMap
        stops={[{ ...STOPS[0]!, latitude: null, longitude: null }]}
        emptyMessage="Sin pines en esta ruta."
      />,
    );
    expect(screen.getByText('Sin pines en esta ruta.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /seleccionada/i })).toBeNull();
  });
});

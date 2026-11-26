import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describeDelivery, formatMoment, orderCode, statusInfo } from './components/ClientOrdersView.js';
import { AccountMenu, greetingName, initialsOf } from '../../auth/presentation/components/AccountMenu.js';
import { validateProfilePhone } from '../../auth/domain/managedUser.js';
import { readProfile } from '../../auth/infrastructure/http/response.js';
import { GetProfileUseCase, UpdateProfileUseCase } from '../../auth/application/authUseCases.js';
import { HttpAuthGateway } from '../../auth/infrastructure/http/httpAuthGateway.js';
import { validateDisplayName } from '../../auth/domain/authUser.js';
import type { AuthGateway } from '../../auth/domain/authGateway.js';
import { buildAuthUser, createFakeHttpClient, VALID_UUID } from '../../../test/fakeHttpClient.js';
import { shortAddress } from './ClientShopContext.js';

describe('textos del pedido para el cliente', () => {
  it('describe el día y la franja de entrega', () => {
    expect(describeDelivery('2026-11-23', '17:00', '2026-11-23')).toBe('hoy, 17:00 – 18:00');
    expect(describeDelivery('2026-11-24', '09:00', '2026-11-23')).toBe('mañana, 09:00 – 10:00');
    expect(describeDelivery('2026-11-25', '08:00', '2026-11-23')).toMatch(/25.*08:00 – 09:00/);
  });

  it('código corto del pedido y estados en palabras simples', () => {
    expect(orderCode('4bc67534-58f3-4e55-9ae1-6e6d9064d721')).toBe('PED-4BC6');
    expect(statusInfo('asignado_a_ruta').label).toBe('Preparando');
    expect(statusInfo('entrega_fallida').label).toBe('No se pudo entregar');
    expect(statusInfo('otro').label).toBe('En proceso');
  });

  it('hora de cada paso en la zona horaria de Ecuador', () => {
    expect(formatMoment('2026-11-23T21:36:00.000Z')).toMatch(/16:36/);
    expect(formatMoment('no-es-fecha')).toBe('');
  });
});

describe('menú de la cuenta', () => {
  const user = buildAuthUser({ displayName: 'Cristian Ango' }) as never;

  it('saluda por el nombre de pila o el inicio del correo', () => {
    expect(greetingName({ displayName: 'Cristian Ango', email: 'c@x.ec' })).toBe('Cristian');
    expect(greetingName({ displayName: null, email: 'ana.perez@millast.ec' })).toBe('ana.perez');
    expect(initialsOf('Cristian Ango')).toBe('CA');
  });

  it('abre el menú con el perfil y la salida', async () => {
    const onOpenProfile = vi.fn();
    const onLogout = vi.fn();
    render(<AccountMenu user={user} onOpenProfile={onOpenProfile} onLogout={onLogout} />);

    expect(screen.getByText('Cristian')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /menú de la cuenta/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Mi perfil' }));
    expect(onOpenProfile).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: /menú de la cuenta/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Cerrar sesión' }));
    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('perfil', () => {
  const profile = {
    id: VALID_UUID,
    email: 'c@millast.ec',
    role: 'cliente',
    publicRole: 'cliente',
    displayName: 'Cristian Ango',
    phone: null,
    emailVerified: true,
    hasPassword: true,
    googleLinked: true,
    createdAt: '2026-11-19T15:00:00.000Z',
  };

  it('valida el teléfono como el backend', () => {
    expect(validateProfilePhone('')).toBeNull();
    expect(validateProfilePhone('+593 99 123 4567')).toBeNull();
    expect(validateProfilePhone('12345')).toMatch(/7 y 15/);
  });

  it('lee el perfil y rechaza respuestas incompletas', () => {
    expect(readProfile({ profile }).googleLinked).toBe(true);
    expect(() => readProfile({ profile: { ...profile, hasPassword: 'si' } })).toThrow(/contrato/);
  });

  it('el caso de uso envía null para borrar y no llama si hay errores', async () => {
    const updateProfile = vi.fn(() => Promise.resolve(profile as never));
    const gateway = { updateProfile } as unknown as AuthGateway;
    await new UpdateProfileUseCase(gateway).execute({ displayName: '  ', phone: '' });
    expect(updateProfile).toHaveBeenCalledWith({ displayName: null, phone: null });

    await expect(new UpdateProfileUseCase(gateway).execute({ phone: '123' })).rejects.toThrow(/teléfono/);
    await expect(new UpdateProfileUseCase(gateway).execute({ displayName: 'Ana 2' })).rejects.toThrow();
    expect(updateProfile).toHaveBeenCalledTimes(1);
  });

  it('el caso de uso guarda nombre y teléfono limpios', async () => {
    const updateProfile = vi.fn(() => Promise.resolve(profile as never));
    const gateway = { updateProfile } as unknown as AuthGateway;
    await new UpdateProfileUseCase(gateway).execute({ displayName: '  Ana Pérez ', phone: ' 0991234567 ' });
    expect(updateProfile).toHaveBeenCalledWith({ displayName: 'Ana Pérez', phone: '0991234567' });
    await new UpdateProfileUseCase(gateway).execute({ phone: null });
    expect(updateProfile).toHaveBeenLastCalledWith({ phone: null });
  });

  it('consulta el perfil por el caso de uso', async () => {
    const getProfile = vi.fn(() => Promise.resolve(profile as never));
    const result = await new GetProfileUseCase({ getProfile } as unknown as AuthGateway).execute();
    expect(result.displayName).toBe('Cristian Ango');
  });

  it('valida el nombre con las reglas del registro', () => {
    expect(validateDisplayName('Ana Pérez')).toBeNull();
    expect(validateDisplayName('Ana 2')).not.toBeNull();
  });

  it('el gateway lee y actualiza el perfil en /auth/me/profile', async () => {
    const http = createFakeHttpClient({ profile });
    const gateway = new HttpAuthGateway(http);
    expect((await gateway.getProfile()).email).toBe('c@millast.ec');
    expect(http.get).toHaveBeenCalledWith('/auth/me/profile');

    await gateway.updateProfile({ displayName: 'Ana', phone: null });
    expect(http.patch).toHaveBeenCalledWith('/auth/me/profile', { displayName: 'Ana', phone: null });
    await gateway.updateProfile({});
    expect(http.patch).toHaveBeenLastCalledWith('/auth/me/profile', {});
  });
});

describe('barra superior del cliente', () => {
  it('acorta la dirección para "Entregar a…"', () => {
    expect(shortAddress('Av. Cevallos 12-34 y Montalvo, Ambato')).toBe('Av. Cevallos 12-34 y Montalvo, Ambato');
    expect(shortAddress('Quillan Loma, Izamba, Ambato, Tungurahua, 180503, Ecuador')).toBe('Quillan Loma, Ambato');
    expect(shortAddress('Calle 1, Barrio Norte, Parroquia X, Provincia Y')).toBe('Calle 1, Barrio Norte');
  });
});

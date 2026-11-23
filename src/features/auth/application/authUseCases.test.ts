import { describe, expect, it, vi } from 'vitest';
import type { AuthGateway } from '../domain/authGateway.js';
import {
  LoginUseCase,
  LoginWithGoogleUseCase,
  RegisterCustomerUseCase,
  VerifyEmailUseCase,
} from './authUseCases.js';

function fakeGateway(): AuthGateway {
  const resolved = vi.fn(() => Promise.resolve({} as never));
  return new Proxy({} as AuthGateway, { get: (target, key) => ((target as never)[key] ??= resolved as never) });
}

describe('casos de uso de autenticación', () => {
  it('login normaliza el correo antes de llamar a la API', async () => {
    const gateway = fakeGateway();
    await new LoginUseCase(gateway).execute({ email: '  Admin@UltimaMilla.COM ', password: '12345678' });
    expect(gateway.login).toHaveBeenCalledWith({ email: 'admin@ultimamilla.com', password: '12345678' });
  });

  it('login no llama a la API si los datos son inválidos', async () => {
    const gateway = fakeGateway();
    await expect(new LoginUseCase(gateway).execute({ email: '', password: '1' })).rejects.toThrow(/obligatorio/);
    expect(gateway.login).not.toHaveBeenCalled();
  });

  it('Google exige un token no vacío', async () => {
    const gateway = fakeGateway();
    await expect(new LoginWithGoogleUseCase(gateway).execute('   ')).rejects.toThrow(/token de Google/);
    await new LoginWithGoogleUseCase(gateway).execute(' tok ');
    expect(gateway.loginWithGoogle).toHaveBeenCalledWith('tok');
  });

  it('registro envía nombre nulo cuando viene vacío', async () => {
    const gateway = fakeGateway();
    await new RegisterCustomerUseCase(gateway).execute({
      email: 'Ana@Millast.ec',
      password: 'Rio-Ambato-2026',
      displayName: '   ',
    });
    expect(gateway.registerCustomer).toHaveBeenCalledWith({
      email: 'ana@millast.ec',
      password: 'Rio-Ambato-2026',
      displayName: null,
    });
  });

  it('verificación recorta el código', async () => {
    const gateway = fakeGateway();
    await new VerifyEmailUseCase(gateway).execute({ email: 'a@b.ec', code: ' 123456 ' });
    expect(gateway.verifyEmail).toHaveBeenCalledWith({ email: 'a@b.ec', code: '123456' });
  });
});

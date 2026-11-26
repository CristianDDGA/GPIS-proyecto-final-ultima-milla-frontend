import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { FormEvent } from 'react';
import type { AuthUseCases } from '../../application/authUseCases.js';
import { useAuthFlows } from './useAuthFlows.js';

const SESSION = {
  token: 'token-de-prueba',
  user: { id: 'u1', email: 'ana@test.com', role: 'cliente' },
};

function buildUseCases(login: () => Promise<unknown>): AuthUseCases {
  return { login: { execute: vi.fn(login) } } as unknown as AuthUseCases;
}

const submitEvent = { preventDefault: () => undefined } as unknown as FormEvent<HTMLFormElement>;

describe('useAuthFlows · inicio de sesión', () => {
  it('tras un login correcto no muestra errores de campo mientras la vista sigue visible', async () => {
    // La vista de acceso sigue montada hasta que /auth/me responde: onAuthenticated no la cierra al instante.
    const onAuthenticated = vi.fn();
    const { result } = renderHook(() =>
      useAuthFlows({ useCases: buildUseCases(() => Promise.resolve(SESSION)), onAuthenticated }),
    );

    act(() => {
      result.current.setLoginEmail('ana@test.com');
      result.current.setLoginPassword('ClaveSegura2026');
    });
    await act(async () => {
      await result.current.handleLoginSubmit(submitEvent);
    });

    expect(onAuthenticated).toHaveBeenCalledWith(SESSION.user);
    expect(result.current.errorFor('password')).toBeUndefined();
    expect(result.current.errorFor('email')).toBeUndefined();
    expect(result.current.requestError).toBeNull();
  });

  it('con credenciales incorrectas sí muestra el mensaje del servidor', async () => {
    const { result } = renderHook(() =>
      useAuthFlows({
        useCases: buildUseCases(() => Promise.reject(new Error('Correo o contraseña incorrectos.'))),
      }),
    );

    act(() => {
      result.current.setLoginEmail('ana@test.com');
      result.current.setLoginPassword('ClaveSegura2026');
    });
    await act(async () => {
      await result.current.handleLoginSubmit(submitEvent);
    });

    expect(result.current.requestError).toBe('Correo o contraseña incorrectos.');
  });
});

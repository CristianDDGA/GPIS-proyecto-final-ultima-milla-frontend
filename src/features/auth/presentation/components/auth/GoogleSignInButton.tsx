import { useEffect, useRef, useState, type FC } from 'react';
import { GoogleLogoIcon } from './AuthIcons.js';

interface GoogleCredentialResponse {
  readonly credential?: string;
}

interface GoogleIdentityApi {
  readonly accounts?: {
    readonly id?: {
      initialize(config: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
      }): void;
      renderButton(
        parent: HTMLElement,
        options: {
          theme?: 'outline' | 'filled_blue' | 'filled_black';
          size?: 'large' | 'medium' | 'small';
          text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
          shape?: 'rectangular' | 'pill' | 'circle' | 'square';
          locale?: string;
          width?: number;
        },
      ): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityApi;
    __MILLAST_GOOGLE_CLIENT_ID__?: string;
  }
}

export interface GoogleSignInButtonProps {
  readonly mode?: 'login' | 'register' | undefined;
  readonly disabled: boolean;
  readonly hidden?: boolean | undefined;
  readonly onCredential: (idToken: string) => void;
  readonly onUnavailable?: ((message: string) => void) | undefined;
}

const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

function resolveGoogleClientId(): string {
  const fromEnv = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();
  if (fromEnv.length > 0) return fromEnv;
  if (typeof window !== 'undefined' && typeof window.__MILLAST_GOOGLE_CLIENT_ID__ === 'string') {
    return window.__MILLAST_GOOGLE_CLIENT_ID__.trim();
  }
  return '';
}

/**
 * Botón "Continuar con Google" para POST /auth/google (Google Identity Services).
 * - Cuando VITE_GOOGLE_CLIENT_ID está configurado, carga GSI y renderiza el botón oficial.
 * - Mientras GSI carga, si falla la red o si falta VITE_GOOGLE_CLIENT_ID en el entorno,
 *   muestra un botón Liquid Glass equivalente que informa claramente qué configurar.
 * - Si el backend responde 503 GOOGLE_NOT_ENABLED (`hidden`), se oculta según contrato.
 */
export const GoogleSignInButton: FC<GoogleSignInButtonProps> = ({
  mode = 'login',
  disabled,
  hidden = false,
  onCredential,
  onUnavailable,
}) => {
  const clientId = resolveGoogleClientId();
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;

  const [gsiState, setGsiState] = useState<'idle' | 'loading' | 'ready' | 'error'>(() => {
    if (clientId.length === 0) return 'idle';
    if (typeof window !== 'undefined' && Boolean(window.google?.accounts?.id)) return 'ready';
    return 'loading';
  });
  const [renderedWidth, setRenderedWidth] = useState<number>(320);

  useEffect(() => {
    if (hidden) return;
    if (clientId.length === 0) {
      setGsiState('idle');
      return;
    }
    if (window.google?.accounts?.id) {
      setGsiState('ready');
      return;
    }

    setGsiState('loading');
    let existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SCRIPT_SRC}"]`);

    const onLoad = () => {
      if (existing) existing.dataset.gsiStatus = 'loaded';
      if (window.google?.accounts?.id) {
        setGsiState('ready');
      } else {
        setGsiState('error');
      }
    };

    const onError = () => {
      if (existing) existing.dataset.gsiStatus = 'error';
      setGsiState('error');
    };

    if (existing) {
      if (existing.dataset.gsiStatus === 'loaded') {
        onLoad();
        return;
      }
      if (existing.dataset.gsiStatus === 'error') {
        setGsiState('error');
        return;
      }
      existing.addEventListener('load', onLoad);
      existing.addEventListener('error', onError);
      return () => {
        existing?.removeEventListener('load', onLoad);
        existing?.removeEventListener('error', onError);
      };
    }

    const script = document.createElement('script');
    script.src = GSI_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.dataset.gsiStatus = 'loading';
    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);
    document.head.appendChild(script);
    existing = script;

    return () => {
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
    };
  }, [clientId, hidden]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || hidden) return;

    const updateWidth = () => {
      const next = Math.min(380, Math.max(240, Math.floor(section.clientWidth || 320)));
      setRenderedWidth((prev) => (Math.abs(prev - next) >= 4 ? next : prev));
    };

    updateWidth();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(updateWidth);
    ro.observe(section);
    return () => ro.disconnect();
  }, [hidden]);

  useEffect(() => {
    if (clientId.length === 0 || hidden || gsiState !== 'ready') return;
    const gsi = window.google?.accounts?.id;
    const host = hostRef.current;
    if (!gsi || !host) return;

    host.innerHTML = '';
    gsi.initialize({
      client_id: clientId,
      callback: (response) => {
        if (response.credential && response.credential.trim().length > 0) {
          onCredentialRef.current(response.credential);
        }
      },
    });
    gsi.renderButton(host, {
      theme: 'outline',
      size: 'large',
      text: mode === 'register' ? 'signup_with' : 'continue_with',
      shape: 'rectangular',
      locale: 'es',
      width: renderedWidth,
    });
  }, [clientId, hidden, gsiState, mode, renderedWidth]);

  if (hidden) {
    return null;
  }

  const showOfficialGsi = clientId.length > 0 && gsiState === 'ready';
  const dividerLabel = mode === 'register' ? 'o regístrate con' : 'o continúa con';
  const fallbackLabel = mode === 'register' ? 'Registrarse con Google' : 'Continuar con Google';

  const handleFallbackClick = () => {
    if (clientId.length === 0) {
      onUnavailable?.(
        'Falta configurar VITE_GOOGLE_CLIENT_ID en el archivo .env del frontend con el Client ID OAuth web de Google Cloud (el mismo de GOOGLE_CLIENT_ID en el backend).',
      );
      return;
    }
    if (gsiState === 'error') {
      onUnavailable?.(
        'No se pudo cargar Google Identity Services. Verifica tu conexión o permite accounts.google.com en tu navegador.',
      );
      return;
    }
    onUnavailable?.('Cargando el acceso con Google… intenta nuevamente en un segundo.');
  };

  return (
    <div
      ref={sectionRef}
      className={'mlg-google-section' + (disabled ? ' mlg-google-section--disabled' : '')}
    >
      <div className="mlg-divider" aria-hidden="true">
        <span className="mlg-divider__line" />
        <span>{dividerLabel}</span>
        <span className="mlg-divider__line" />
      </div>

      <div
        ref={hostRef}
        className={'mlg-google-host' + (showOfficialGsi ? '' : ' mlg-google-host--hidden')}
        aria-label={fallbackLabel}
      />

      {!showOfficialGsi && (
        <button
          type="button"
          className="mlg-google-btn"
          disabled={disabled || gsiState === 'loading'}
          onClick={handleFallbackClick}
        >
          <GoogleLogoIcon className="mlg-google-btn__icon" />
          <span>{gsiState === 'loading' ? 'Cargando Google...' : fallbackLabel}</span>
        </button>
      )}
    </div>
  );
};

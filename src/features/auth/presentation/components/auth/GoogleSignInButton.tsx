import { useEffect, useRef, useState, type FC } from 'react';

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
  }
}

export interface GoogleSignInButtonProps {
  readonly disabled: boolean;
  readonly hidden?: boolean | undefined;
  readonly onCredential: (idToken: string) => void;
}

const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

/**
 * Botón oficial de Google Identity Services ("Continuar con Google") para POST /auth/google.
 * Solo se renderiza cuando VITE_GOOGLE_CLIENT_ID está definido y el backend no ha respondido
 * 503 GOOGLE_NOT_ENABLED (siguiendo docs/contracts/auth-accounts.md).
 */
export const GoogleSignInButton: FC<GoogleSignInButtonProps> = ({
  disabled,
  hidden = false,
  onCredential,
}) => {
  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;
  const [scriptReady, setScriptReady] = useState(
    () => typeof window !== 'undefined' && Boolean(window.google?.accounts?.id),
  );

  useEffect(() => {
    if (clientId.length === 0 || hidden) return;
    if (window.google?.accounts?.id) {
      setScriptReady(true);
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SCRIPT_SRC}"]`);
    const onLoad = () => setScriptReady(true);

    if (existing) {
      existing.addEventListener('load', onLoad);
      return () => existing.removeEventListener('load', onLoad);
    }

    const script = document.createElement('script');
    script.src = GSI_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', onLoad);
    document.head.appendChild(script);
    return () => script.removeEventListener('load', onLoad);
  }, [clientId, hidden]);

  useEffect(() => {
    if (clientId.length === 0 || hidden || !scriptReady) return;
    const gsi = window.google?.accounts?.id;
    const container = containerRef.current;
    if (!gsi || !container) return;

    container.innerHTML = '';
    gsi.initialize({
      client_id: clientId,
      callback: (response) => {
        if (response.credential && response.credential.trim().length > 0) {
          onCredentialRef.current(response.credential);
        }
      },
    });
    gsi.renderButton(container, {
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      locale: 'es',
      width: Math.min(340, Math.max(240, Math.floor(container.clientWidth || 320))),
    });
  }, [clientId, hidden, scriptReady]);

  if (clientId.length === 0 || hidden) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        marginTop: '6px',
        opacity: disabled ? 0.55 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '12px',
          color: '#64748b',
        }}
      >
        <span style={{ flex: 1, height: '1px', background: 'rgba(15, 23, 42, 0.12)' }} />
        <span>o continúa con</span>
        <span style={{ flex: 1, height: '1px', background: 'rgba(15, 23, 42, 0.12)' }} />
      </div>
      <div
        ref={containerRef}
        aria-label="Continuar con Google"
        style={{ display: 'flex', justifyContent: 'center', minHeight: '42px' }}
      />
    </div>
  );
};

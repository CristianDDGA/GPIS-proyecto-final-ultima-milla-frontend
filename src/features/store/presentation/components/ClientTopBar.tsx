import { useEffect, useRef, useState, type FC, type FormEvent } from 'react';
import { AccountMenu, greetingName } from '../../../auth/presentation/components/AccountMenu.js';
import type { AuthUser } from '../../../auth/domain/index.js';
import { MillastEmblemGlyph } from '../../../../shared/ui/index.js';
import { shortAddress, useClientShop } from '../ClientShopContext.js';
import '../styles/client.css';

export interface ClientTopBarProps {
  readonly user: AuthUser;
  readonly isLoading?: boolean | undefined;
  /** Lleva a la tienda (la barra también sirve desde "Mis pedidos" o "Mi perfil"). */
  readonly onGoStore: () => void;
  readonly onOpenOrders: () => void;
  readonly onOpenProfile: () => void;
  readonly onOpenCourierApplication: () => void;
  readonly onLogout: () => void;
}

/** Barra del cliente con el diseño del prototipo: logo, "Entregar a…", buscador, cuenta, carrito y categorías. */
export const ClientTopBar: FC<ClientTopBarProps> = ({
  user,
  isLoading = false,
  onGoStore,
  onOpenOrders,
  onOpenProfile,
  onOpenCourierApplication,
  onLogout,
}) => {
  const shop = useClientShop();
  const [draft, setDraft] = useState(shop.searchText);
  const [locOpen, setLocOpen] = useState(false);
  const locRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDraft(shop.searchText);
  }, [shop.searchText]);

  useEffect(() => {
    if (!locOpen) return undefined;
    const onPointer = (event: PointerEvent) => {
      if (locRef.current && !locRef.current.contains(event.target as Node)) setLocOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLocOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [locOpen]);

  const preferred =
    shop.addresses.find((address) => address.id === shop.preferredAddressId) ??
    shop.addresses.find((address) => address.isDefault) ??
    shop.addresses[0] ??
    null;

  const goCatalog = () => {
    shop.requestScreen('catalog');
    onGoStore();
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    shop.setSearchText(draft.trim());
    goCatalog();
  };

  return (
    <header className="client-topbar">
      <div className="client-topbar__main">
        <button type="button" className="client-topbar__brand" onClick={goCatalog} aria-label="Ir a la tienda Millast">
          <span className="client-topbar__logo" aria-hidden="true">
            <MillastEmblemGlyph size={18} />
          </span>
          <span className="client-topbar__wordmark">Millast</span>
        </button>

        <div className="client-topbar__loc" ref={locRef}>
          <button
            type="button"
            className="client-topbar__link client-topbar__stack"
            aria-haspopup="dialog"
            aria-expanded={locOpen}
            onClick={() => setLocOpen((value) => !value)}
          >
            <small>Entregar a {greetingName(user)}</small>
            <strong>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
              {preferred ? shortAddress(preferred.address) : 'Elige dónde entregar'}
            </strong>
          </button>
          {locOpen && (
            <div className="client-topbar__pop" role="dialog" aria-label="¿Dónde lo entregamos?">
              <p className="client-topbar__pop-title">¿Dónde lo entregamos?</p>
              <p className="client-muted" style={{ marginBottom: '10px' }}>
                Así te mostramos cuándo puede llegar.
              </p>
              <div className="client-options">
                {shop.addresses.map((address) => {
                  const selected = preferred?.id === address.id;
                  return (
                    <button
                      key={address.id}
                      type="button"
                      className={`client-option ${selected ? 'client-option--selected' : ''}`}
                      onClick={() => {
                        shop.setPreferredAddressId(address.id);
                        setLocOpen(false);
                      }}
                    >
                      <span className="client-option__radio" aria-hidden="true" />
                      <span className="client-option__body">
                        <span className="client-option__title">{address.label}</span>
                        <span className="client-option__text">{address.address}</span>
                      </span>
                    </button>
                  );
                })}
                {shop.addresses.length === 0 && <p className="client-muted">Aún no tienes direcciones guardadas.</p>}
              </div>
              <button
                type="button"
                className="client-link-btn"
                onClick={() => {
                  setLocOpen(false);
                  onOpenProfile();
                }}
              >
                {shop.addresses.length === 0 ? 'Agregar una dirección' : 'Administrar mis direcciones'}
              </button>
            </div>
          )}
        </div>

        <form className="client-topbar__search" role="search" onSubmit={submitSearch}>
          <label htmlFor="client-topbar-search" className="sr-only">
            Buscar productos
          </label>
          <input
            id="client-topbar-search"
            placeholder="Buscar productos"
            value={draft}
            maxLength={60}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit" aria-label="Buscar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </button>
        </form>

        <AccountMenu
          user={user}
          tone="dark"
          isLoading={isLoading}
          onOpenProfile={onOpenProfile}
          onOpenOrders={onOpenOrders}
          onOpenCourierApplication={onOpenCourierApplication}
          onLogout={onLogout}
        />

        <button
          type="button"
          className="client-topbar__link client-topbar__cart"
          onClick={() => {
            shop.requestScreen('cart');
            onGoStore();
          }}
          aria-label={`Ver carrito, ${shop.cartUnits} ${shop.cartUnits === 1 ? 'producto' : 'productos'}`}
        >
          <span className="client-topbar__cart-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
              <path d="M3 4h2l2.2 10.4a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L20.5 8H6.2" />
              <circle cx="10" cy="20" r="1.4" />
              <circle cx="17" cy="20" r="1.4" />
            </svg>
            <span className="client-topbar__count">{shop.cartUnits}</span>
          </span>
          <span>Carrito</span>
        </button>
      </div>

      <nav className="client-topbar__cats" aria-label="Categorías">
        {[{ id: '', name: 'Todo' }, ...shop.categories].map((category) => (
          <button
            key={category.id || 'todo'}
            type="button"
            className={`client-topbar__cat ${shop.categoryId === category.id ? 'client-topbar__cat--active' : ''}`}
            aria-pressed={shop.categoryId === category.id}
            onClick={() => {
              shop.setCategoryId(category.id);
              goCatalog();
            }}
          >
            {category.name}
          </button>
        ))}
      </nav>
    </header>
  );
};

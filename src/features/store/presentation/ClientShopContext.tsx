import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type FC,
  type ReactNode,
  type SetStateAction,
} from 'react';
import type { CartItem, StoreAddress, StoreCategory } from '../domain/storeTypes.js';
import type { HttpStoreGateway } from '../infrastructure/http/httpStoreGateway.js';

/**
 * Estado de la tienda que comparten la barra superior del cliente y la pantalla de la tienda:
 * carrito, búsqueda, categoría elegida, dirección de entrega y a qué pantalla de la tienda ir.
 */
export type ShopScreenRequest = 'catalog' | 'cart';

export interface ClientShopState {
  readonly cart: readonly CartItem[];
  readonly setCart: Dispatch<SetStateAction<CartItem[]>>;
  readonly cartUnits: number;
  readonly cartTotalCents: number;
  readonly categories: readonly StoreCategory[];
  readonly searchText: string;
  readonly setSearchText: (value: string) => void;
  readonly categoryId: string;
  readonly setCategoryId: (value: string) => void;
  readonly addresses: readonly StoreAddress[];
  readonly reloadAddresses: () => Promise<void>;
  /** Dirección elegida en la barra ("Entregar a…"); la compra la usa como primera opción. */
  readonly preferredAddressId: string;
  readonly setPreferredAddressId: (value: string) => void;
  /** Cada pedido de pantalla incrementa el contador para que la tienda reaccione aunque se repita. */
  readonly screenRequest: { readonly screen: ShopScreenRequest; readonly seq: number };
  readonly requestScreen: (screen: ShopScreenRequest) => void;
  /** Devuelve la pantalla pedida que aún no se atendió (una sola vez), o null. */
  readonly takeScreenRequest: () => ShopScreenRequest | null;
}

const CART_STORAGE_KEY = 'millast.store.cart.v1';

function loadStoredCart(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

const ClientShopContext = createContext<ClientShopState | null>(null);

export const ClientShopProvider: FC<{ readonly storeGateway: HttpStoreGateway; readonly children: ReactNode }> = ({
  storeGateway,
  children,
}) => {
  const [cart, setCart] = useState<CartItem[]>(loadStoredCart);
  const [categories, setCategories] = useState<readonly StoreCategory[]>([]);
  const [searchText, setSearchText] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [addresses, setAddresses] = useState<readonly StoreAddress[]>([]);
  const [preferredAddressId, setPreferredAddressId] = useState('');
  const [screenRequest, setScreenRequest] = useState<{ screen: ShopScreenRequest; seq: number }>({ screen: 'catalog', seq: 0 });

  useEffect(() => {
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Sin almacenamiento el carrito vive solo en memoria.
    }
  }, [cart]);

  useEffect(() => {
    void (async () => {
      try {
        setCategories(await storeGateway.listCategories());
      } catch {
        // La tienda funciona aunque no carguen las categorías.
      }
    })();
  }, [storeGateway]);

  const reloadAddresses = useCallback(async () => {
    try {
      setAddresses(await storeGateway.listAddresses());
    } catch {
      setAddresses([]);
    }
  }, [storeGateway]);

  useEffect(() => {
    void reloadAddresses();
  }, [reloadAddresses]);

  const requestScreen = useCallback((screen: ShopScreenRequest) => {
    setScreenRequest((prev) => ({ screen, seq: prev.seq + 1 }));
  }, []);

  // La tienda puede montarse después del pedido (por ejemplo, desde "Mis pedidos"): el pedido queda pendiente
  // hasta que la tienda lo toma, y se atiende una sola vez.
  const consumedSeqRef = useRef(0);
  const latestRequestRef = useRef(screenRequest);
  latestRequestRef.current = screenRequest;
  const takeScreenRequest = useCallback((): ShopScreenRequest | null => {
    const current = latestRequestRef.current;
    if (current.seq <= consumedSeqRef.current) return null;
    consumedSeqRef.current = current.seq;
    return current.screen;
  }, []);

  const value = useMemo<ClientShopState>(
    () => ({
      cart,
      setCart,
      cartUnits: cart.reduce((acc, item) => acc + item.quantity, 0),
      cartTotalCents: cart.reduce((acc, item) => acc + item.quantity * item.unitPriceCents, 0),
      categories,
      searchText,
      setSearchText,
      categoryId,
      setCategoryId,
      addresses,
      reloadAddresses,
      preferredAddressId,
      setPreferredAddressId,
      screenRequest,
      requestScreen,
      takeScreenRequest,
    }),
    [cart, categories, searchText, categoryId, addresses, reloadAddresses, preferredAddressId, screenRequest, requestScreen, takeScreenRequest],
  );

  return <ClientShopContext.Provider value={value}>{children}</ClientShopContext.Provider>;
};

export function useClientShop(): ClientShopState {
  const value = useContext(ClientShopContext);
  if (value === null) throw new Error('useClientShop debe usarse dentro de ClientShopProvider.');
  return value;
}

/** Versión corta de una dirección para la barra: "Av. Cevallos, Ambato". */
export function shortAddress(address: string): string {
  const parts = address
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !/^\d{5,6}$/.test(part) && part.toLowerCase() !== 'ecuador');
  if (parts.length <= 2) return parts.join(', ');
  const city = parts.find((part, index) => index > 0 && /^(ambato|quito|guayaquil|cuenca|riobamba|latacunga|loja|manta|machala|ibarra)$/i.test(part));
  return city ? `${parts[0]}, ${city}` : `${parts[0]}, ${parts[1]}`;
}

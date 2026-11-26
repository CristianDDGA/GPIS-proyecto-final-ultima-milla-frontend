import http from 'node:http';
import { randomUUID } from 'node:crypto';

const PORT = Number.parseInt(process.env.MOCK_API_PORT || '3100', 10);
const TODAY = new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10);

const COURIER_ID = '22222222-2222-4222-8222-222222222201';
const ROUTE_ID = '55555555-5555-4555-8555-555555555501';

let state;

function createInitialState() {
  const now = new Date().toISOString();

  const zones = [
    { id: '11111111-1111-4111-8111-111111111101', name: 'Norte · Iñaquito', createdAt: now, updatedAt: now },
    { id: '11111111-1111-4111-8111-111111111102', name: 'Centro Histórico', createdAt: now, updatedAt: now },
    { id: '11111111-1111-4111-8111-111111111103', name: 'Valles · Cumbayá', createdAt: now, updatedAt: now },
  ];

  const couriers = [
    { id: COURIER_ID, displayName: 'Carlos Andrade', maxOrdersPerTrip: 6, isEnabled: true, isAvailable: true, createdAt: now, updatedAt: now },
    { id: '22222222-2222-4222-8222-222222222202', displayName: 'Lucía Paredes', maxOrdersPerTrip: 4, isEnabled: true, isAvailable: false, createdAt: now, updatedAt: now },
  ];

  const users = [
    {
      id: '33333333-3333-4333-8333-333333333301',
      authSubject: 'admin@millast.ec',
      email: 'admin@millast.ec',
      role: 'personal',
      publicRole: 'admin',
      displayName: 'Matius Paredes',
      courierId: null,
      isActive: true,
      emailVerified: true,
      emailVerifiedVia: 'admin',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: '33333333-3333-4333-8333-333333333302',
      authSubject: 'repartidor@millast.ec',
      email: 'repartidor@millast.ec',
      role: 'repartidor',
      publicRole: 'repartidor',
      displayName: 'Carlos Andrade',
      courierId: COURIER_ID,
      isActive: true,
      emailVerified: true,
      emailVerifiedVia: 'admin',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: '33333333-3333-4333-8333-333333333303',
      authSubject: 'cliente@millast.ec',
      email: 'cliente@millast.ec',
      role: 'cliente',
      publicRole: 'cliente',
      displayName: 'Sofía Montalvo',
      courierId: null,
      isActive: true,
      emailVerified: true,
      emailVerifiedVia: 'google',
      createdAt: now,
      updatedAt: now,
    },
  ];

  const categories = [
    { id: '77777777-7777-4777-8777-777777777701', name: 'Audio y Tecnología', isActive: true, version: 1 },
    { id: '77777777-7777-4777-8777-777777777702', name: 'Hogar Inteligente', isActive: true, version: 1 },
    { id: '77777777-7777-4777-8777-777777777703', name: 'Deportes y Fitness', isActive: true, version: 1 },
  ];

  const products = [
    {
      id: '88888888-8888-4888-8888-888888888801',
      sku: 'AUD-100',
      name: 'Audífonos Inalámbricos Studio ANC',
      brand: 'SoundMax',
      description: 'Cancelación activa de ruido con 36 horas de autonomía y carga rápida USB-C.',
      category: { id: categories[0].id, name: categories[0].name },
      priceCents: 6999,
      compareAtPriceCents: 8999,
      discountPercent: 22,
      stockQuantity: 14,
      imageUrl: null,
      isActive: true,
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: '88888888-8888-4888-8888-888888888802',
      sku: 'HOG-210',
      name: 'Lámpara Ambiental LED WiFi',
      brand: 'LumaHome',
      description: 'Iluminación cálida y fría regulable compatible con rutinas horarias.',
      category: { id: categories[1].id, name: categories[1].name },
      priceCents: 3450,
      compareAtPriceCents: null,
      discountPercent: null,
      stockQuantity: 3,
      imageUrl: null,
      isActive: true,
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: '88888888-8888-4888-8888-888888888803',
      sku: 'FIT-305',
      name: 'Botella Térmica Acero 1L',
      brand: 'AndesGear',
      description: 'Conserva bebidas frías 24 horas y calientes 12 horas.',
      category: { id: categories[2].id, name: categories[2].name },
      priceCents: 2400,
      compareAtPriceCents: 2999,
      discountPercent: 20,
      stockQuantity: 0,
      imageUrl: null,
      isActive: true,
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const addresses = [
    {
      id: '99999999-9999-4999-8999-999999999901',
      label: 'Casa · Iñaquito',
      zoneId: zones[0].id,
      address: 'Av. Amazonas N34-120 y República',
      recipientName: 'Sofía Montalvo',
      recipientPhone: '+593 99 876 5432',
      isDefault: true,
      version: 1,
      latitude: -0.1765,
      longitude: -78.4852,
    },
  ];

  const orders = [
    {
      id: '44444444-4444-4444-8444-444444444401',
      zoneId: zones[0].id,
      deliveryAddress: 'Av. Amazonas N34-120 y República',
      deliveryDate: TODAY,
      deliveryTime: '14:00',
      status: 'en_camino',
      version: 2,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: '44444444-4444-4444-8444-444444444402',
      zoneId: zones[1].id,
      deliveryAddress: 'Calle Venezuela N4-32 y Chile',
      deliveryDate: TODAY,
      deliveryTime: '16:00',
      status: 'entrega_fallida',
      version: 3,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: '44444444-4444-4444-8444-444444444403',
      zoneId: zones[0].id,
      deliveryAddress: 'Av. Naciones Unidas E4-200',
      deliveryDate: TODAY,
      deliveryTime: '18:00',
      status: 'pendiente',
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const storeOrders = [
    {
      id: orders[0].id,
      status: 'en_camino',
      zoneId: zones[0].id,
      deliveryAddress: 'Av. Amazonas N34-120 y República',
      deliveryDate: TODAY,
      deliveryTime: '14:00',
      totalCents: 13998,
      itemsCount: 1,
      paymentMethod: 'contra_entrega',
      createdAt: now,
      customerId: users[2].id,
      recipientName: 'Sofía Montalvo',
      recipientPhone: '+593 99 876 5432',
      notes: 'Tocar el timbre dos veces',
      deliveryLatitude: -0.1765,
      deliveryLongitude: -78.4852,
      version: 2,
      items: [
        {
          productId: products[0].id,
          sku: products[0].sku,
          name: products[0].name,
          unitPriceCents: 6999,
          quantity: 2,
          lineTotalCents: 13998,
          imageUrl: null,
        },
      ],
    },
    {
      id: orders[1].id,
      status: 'entrega_fallida',
      zoneId: zones[1].id,
      deliveryAddress: 'Calle Venezuela N4-32 y Chile',
      deliveryDate: TODAY,
      deliveryTime: '16:00',
      totalCents: 3450,
      itemsCount: 1,
      paymentMethod: 'contra_entrega',
      createdAt: now,
      customerId: users[2].id,
      recipientName: 'Sofía Montalvo',
      recipientPhone: '+593 99 876 5432',
      notes: null,
      deliveryLatitude: -0.2201,
      deliveryLongitude: -78.5123,
      version: 3,
      items: [
        {
          productId: products[1].id,
          sku: products[1].sku,
          name: products[1].name,
          unitPriceCents: 3450,
          quantity: 1,
          lineTotalCents: 3450,
          imageUrl: null,
        },
      ],
    },
  ];

  const routes = [
    {
      id: ROUTE_ID,
      zoneId: zones[0].id,
      serviceDate: TODAY,
      capacityLimit: 6,
      status: 'en_curso',
      courierId: COURIER_ID,
      occupiedSlots: 2,
      stops: [
        {
          orderId: orders[0].id,
          position: 1,
          deliveryAddress: orders[0].deliveryAddress,
          deliveryDate: TODAY,
          deliveryTime: '14:00',
          status: 'en_camino',
        },
        {
          orderId: orders[1].id,
          position: 2,
          deliveryAddress: orders[1].deliveryAddress,
          deliveryDate: TODAY,
          deliveryTime: '16:00',
          status: 'asignado_a_ruta',
        },
      ],
    },
  ];

  return {
    now,
    zones,
    couriers,
    users,
    categories,
    products,
    settings: { slotCapacity: 10, firstSlotHour: 8, lastSlotHour: 20, minLeadMinutes: 60 },
    addresses,
    orders,
    storeOrders,
    routes,
    applications: [],
    courierCollectedCents: 6999,
    courierCollectedCount: 1,
    settlement: null,
    tokens: new Map(),
  };
}

state = createInitialState();

function customerProductView(p) {
  const availability =
    p.stockQuantity <= 0 ? 'out_of_stock' : p.stockQuantity <= 5 ? 'low_stock' : 'in_stock';
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    brand: p.brand,
    description: p.description,
    category: p.category,
    priceCents: p.priceCents,
    compareAtPriceCents: p.compareAtPriceCents,
    discountPercent: p.discountPercent,
    availability,
    lowStockRemaining: availability === 'low_stock' ? p.stockQuantity : null,
    imageUrl: p.imageUrl,
  };
}

/**
 * Orígenes del frontend de pruebas permitidos (lista cerrada). Nunca se refleja el encabezado
 * `Origin` recibido: solo se responde con una constante de esta lista (evita CORS por entrada del usuario).
 */
const ALLOWED_ORIGINS = [
  'http://127.0.0.1:5174',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
];

function corsHeaders(req) {
  const requested = req.headers.origin;
  const allowedOrigin = ALLOWED_ORIGINS.find((candidate) => candidate === requested) ?? ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    Vary: 'Origin',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  };
}

function send(req, res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...corsHeaders(req),
  });
  res.end(body === null ? '' : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function actorFrom(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return state.tokens.get(token) || null;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(req));
    return res.end();
  }

  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  const path = url.pathname;

  if (req.method === 'POST' && path === '/__test/reset') {
    state = createInitialState();
    return send(req, res, 200, { reset: true });
  }

  if (path === '/health') return send(req, res, 200, { status: 'ok' });

  // --- Public Auth ---
  if (req.method === 'POST' && path === '/auth/login') {
    const body = await readBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const user = state.users.find((u) => u.email === email);
    if (!user || password === 'wrong-password') {
      return send(req, res, 401, { code: 'INVALID_CREDENTIALS', message: 'Correo o contraseña incorrectos.' });
    }
    if (!user.isActive) {
      return send(req, res, 403, { code: 'ACCOUNT_DISABLED', message: 'Tu cuenta está desactivada.' });
    }
    const token = `e2e-jwt-${randomUUID()}`;
    state.tokens.set(token, user);
    return send(req, res, 200, { token, user });
  }

  if (req.method === 'POST' && path === '/auth/register') {
    const body = await readBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const existing = state.users.find((u) => u.email === email);
    if (existing) {
      return send(req, res, 409, { code: 'EMAIL_EXISTS', message: 'Este correo ya está registrado.' });
    }
    const user = {
      id: randomUUID(),
      authSubject: email,
      email,
      role: 'cliente',
      publicRole: 'cliente',
      displayName: body.displayName || 'Nuevo Cliente',
      courierId: null,
      isActive: true,
      emailVerified: false,
      emailVerifiedVia: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.users.push(user);
    return send(req, res, 201, { verificationRequired: true, user });
  }

  if (req.method === 'POST' && path === '/auth/verify-email') {
    const body = await readBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const code = String(body.code || '').trim();
    const user = state.users.find((u) => u.email === email);
    if (!user || code !== '123456') {
      return send(req, res, 400, { code: 'INVALID_VERIFICATION_CODE', message: 'Código de verificación inválido.' });
    }
    user.emailVerified = true;
    user.emailVerifiedVia = 'code';
    const token = `e2e-jwt-${randomUUID()}`;
    state.tokens.set(token, user);
    return send(req, res, 200, { token, user });
  }

  if (req.method === 'POST' && path === '/auth/resend-verification') {
    return send(req, res, 200, { ok: true });
  }

  if (req.method === 'POST' && path === '/auth/forgot-password') {
    return send(req, res, 200, { ok: true });
  }

  if (req.method === 'POST' && path === '/auth/reset-password') {
    const body = await readBody(req);
    if (String(body.code || '') !== '654321') {
      return send(req, res, 400, { code: 'INVALID_RESET_CODE', message: 'Código de recuperación inválido.' });
    }
    return send(req, res, 200, { ok: true });
  }

  if (req.method === 'POST' && path === '/auth/google') {
    const body = await readBody(req);
    const idToken = String(body.idToken || '').trim();
    if (idToken === 'trigger-disabled') {
      return send(req, res, 503, { code: 'GOOGLE_NOT_ENABLED', message: 'Google Sign-In no está habilitado.' });
    }
    if (!idToken.startsWith('google-valid-')) {
      return send(req, res, 401, { code: 'INVALID_GOOGLE_TOKEN', message: 'El token de Google no es válido.' });
    }
    const user = { ...state.users[2], emailVerifiedVia: 'google' };
    const token = `e2e-jwt-${randomUUID()}`;
    state.tokens.set(token, user);
    return send(req, res, 200, { token, user });
  }

  if (req.method === 'POST' && path === '/auth/logout') {
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    state.tokens.delete(token);
    return send(req, res, 200, { ok: true });
  }

  const actor = actorFrom(req);
  if (!actor) return send(req, res, 401, { code: 'UNAUTHORIZED', message: 'Sesión requerida.' });

  // --- Authenticated Auth ---
  if (req.method === 'GET' && path === '/auth/me') return send(req, res, 200, { user: actor });
  if (req.method === 'GET' && path === '/auth/me/profile') {
    return send(req, res, 200, {
      profile: {
        id: actor.id,
        email: actor.email,
        role: actor.role,
        publicRole: actor.publicRole ?? actor.role,
        displayName: actor.displayName ?? null,
        phone: actor.phone ?? '+593 99 876 5432',
        emailVerified: true,
        hasPassword: true,
        googleLinked: actor.emailVerifiedVia === 'google',
        createdAt: actor.createdAt ?? '2026-09-01T12:00:00Z',
      },
    });
  }
  if (req.method === 'PATCH' && path === '/auth/me/profile') {
    const body = await readBody(req);
    if (typeof body.displayName === 'string') actor.displayName = body.displayName.trim();
    if (typeof body.phone === 'string') actor.phone = body.phone.trim();
    return send(req, res, 200, {
      profile: {
        id: actor.id,
        email: actor.email,
        role: actor.role,
        publicRole: actor.publicRole ?? actor.role,
        displayName: actor.displayName ?? null,
        phone: actor.phone ?? null,
        emailVerified: true,
        hasPassword: true,
        googleLinked: actor.emailVerifiedVia === 'google',
        createdAt: actor.createdAt ?? '2026-09-01T12:00:00Z',
      },
    });
  }
  if (req.method === 'POST' && path === '/auth/change-password') {
    const token = `e2e-jwt-${randomUUID()}`;
    state.tokens.set(token, actor);
    return send(req, res, 200, { token, user: actor });
  }
  if (req.method === 'GET' && path === '/auth/users') {
    return send(req, res, 200, { items: state.users, total: state.users.length, limit: 20, offset: 0 });
  }
  if (req.method === 'POST' && path === '/auth/users') {
    const body = await readBody(req);
    const publicRole = body.role || 'cliente';
    const role = publicRole === 'admin' ? 'personal' : publicRole;
    const created = {
      id: randomUUID(),
      authSubject: body.email,
      email: body.email,
      role,
      publicRole,
      displayName: body.displayName || body.email,
      courierId: null,
      isActive: true,
      emailVerified: true,
      emailVerifiedVia: 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.users.unshift(created);
    return send(req, res, 201, { user: created });
  }
  if (req.method === 'GET' && /^\/auth\/users\/[^/]+$/.test(path)) {
    const u = state.users.find((x) => x.id === path.split('/')[3]);
    return u ? send(req, res, 200, { user: u }) : send(req, res, 404, { code: 'USER_NOT_FOUND', message: 'No encontrado.' });
  }
  if (req.method === 'PATCH' && /^\/auth\/users\/[^/]+$/.test(path)) {
    const u = state.users.find((x) => x.id === path.split('/')[3]);
    const body = await readBody(req);
    if (!u) return send(req, res, 404, { code: 'USER_NOT_FOUND', message: 'No encontrado.' });
    if (typeof body.isActive === 'boolean') u.isActive = body.isActive;
    return send(req, res, 200, { user: u });
  }
  if (req.method === 'POST' && /^\/auth\/users\/[^/]+\/reset-password$/.test(path)) {
    return send(req, res, 200, { ok: true });
  }

  // --- Zones ---
  if (req.method === 'GET' && path === '/zones') return send(req, res, 200, { items: state.zones });
  if (req.method === 'POST' && path === '/zones') {
    const body = await readBody(req);
    const created = {
      id: randomUUID(),
      name: String(body.name || 'Nueva Zona').trim(),
      isActive: true,
      coverage: body.coverage ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.zones.push(created);
    return send(req, res, 201, created);
  }
  if (req.method === 'PUT' && /^\/zones\/[^/]+\/coverage$/.test(path)) {
    const zoneId = path.split('/')[2];
    const zone = state.zones.find((z) => z.id === zoneId);
    if (!zone) return send(req, res, 404, { code: 'ZONE_NOT_FOUND', message: 'Zona no encontrada.' });
    const body = await readBody(req);
    const cov = body && typeof body.coverage === 'object' ? body.coverage : body;
    zone.coverage = cov
      ? {
          latitude: Number(cov.latitude),
          longitude: Number(cov.longitude),
          radiusKm: Number(cov.radiusKm),
        }
      : null;
    zone.updatedAt = new Date().toISOString();
    return send(req, res, 200, zone);
  }
  if (req.method === 'PATCH' && /^\/zones\/[^/]+$/.test(path)) {
    const zoneId = path.split('/')[2];
    const zone = state.zones.find((z) => z.id === zoneId);
    if (!zone) return send(req, res, 404, { code: 'ZONE_NOT_FOUND', message: 'Zona no encontrada.' });
    const body = await readBody(req);
    if (typeof body.isActive === 'boolean') zone.isActive = body.isActive;
    zone.updatedAt = new Date().toISOString();
    return send(req, res, 200, zone);
  }

  // --- Orders ---
  if (req.method === 'GET' && path === '/orders') {
    const filterDate = url.searchParams.get('deliveryDate');
    const filterZone = url.searchParams.get('zoneId');
    const filtered = state.orders.filter(
      (o) => (!filterDate || o.deliveryDate === filterDate) && (!filterZone || o.zoneId === filterZone),
    );
    return send(req, res, 200, { items: filtered });
  }
  if (req.method === 'POST' && path === '/orders') {
    const body = await readBody(req);
    const created = {
      id: randomUUID(),
      zoneId: body.zoneId,
      deliveryAddress: body.deliveryAddress,
      deliveryDate: body.deliveryDate,
      deliveryTime: body.deliveryTime,
      status: 'pendiente',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.orders.unshift(created);
    return send(req, res, 201, created);
  }
  if (req.method === 'GET' && /^\/orders\/[^/]+$/.test(path)) {
    const id = path.split('/')[2];
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return send(req, res, 400, { code: 'INVALID_ID', message: 'Identificador de pedido inválido.' });
    }
    const o = state.orders.find((x) => x.id === id);
    return o ? send(req, res, 200, o) : send(req, res, 404, { code: 'NOT_FOUND', message: 'Pedido no encontrado.' });
  }

  // --- Routes ---
  if (req.method === 'POST' && path === '/route-plans') {
    const body = await readBody(req);
    const serviceDate = body.serviceDate || TODAY;
    const capacityLimit = Number(body.capacityLimit || 4);
    const pending = state.orders.filter((o) => o.status === 'pendiente');
    if (pending.length === 0) {
      return send(req, res, 200, { serviceDate, routeIds: [] });
    }
    const newRouteId = randomUUID();
    const stops = pending.slice(0, capacityLimit).map((o, idx) => {
      o.status = 'asignado_a_ruta';
      return {
        orderId: o.id,
        position: idx + 1,
        deliveryAddress: o.deliveryAddress,
        deliveryDate: o.deliveryDate,
        deliveryTime: o.deliveryTime,
        status: 'asignado_a_ruta',
      };
    });
    state.routes.unshift({
      id: newRouteId,
      zoneId: pending[0].zoneId,
      serviceDate,
      capacityLimit,
      status: 'planificada',
      courierId: null,
      occupiedSlots: stops.length,
      stops,
    });
    return send(req, res, 200, { serviceDate, routeIds: [newRouteId] });
  }

  if (req.method === 'GET' && path === '/routes') {
    return send(req, res, 200, {
      items: state.routes.map(({ stops: _s, ...summary }) => summary),
      limit: 100,
      offset: 0,
    });
  }
  if (req.method === 'GET' && /^\/routes\/[^/]+$/.test(path)) {
    const r = state.routes.find((x) => x.id === path.split('/')[2]);
    return r ? send(req, res, 200, r) : send(req, res, 404, { code: 'ROUTE_NOT_FOUND', message: 'Ruta no encontrada.' });
  }
  if (req.method === 'PUT' && /^\/routes\/[^/]+\/stop-order$/.test(path)) {
    const r = state.routes.find((x) => x.id === path.split('/')[2]);
    const body = await readBody(req);
    if (!r) return send(req, res, 404, { code: 'ROUTE_NOT_FOUND', message: 'Ruta no encontrada.' });
    const ids = Array.isArray(body.orderIds) ? body.orderIds : [];
    const byId = new Map(r.stops.map((s) => [s.orderId, s]));
    r.stops = ids
      .map((id, i) => {
        const stop = byId.get(id);
        return stop ? { ...stop, position: i + 1 } : null;
      })
      .filter(Boolean);
    return send(req, res, 200, r);
  }
  if (req.method === 'POST' && /^\/routes\/[^/]+\/cancel$/.test(path)) {
    const r = state.routes.find((x) => x.id === path.split('/')[2]);
    if (!r) return send(req, res, 404, { code: 'ROUTE_NOT_FOUND', message: 'Ruta no encontrada.' });
    r.status = 'cancelada';
    return send(req, res, 200, { ok: true });
  }
  if (req.method === 'POST' && path === '/route-moves') {
    return send(req, res, 200, { ok: true });
  }
  if (req.method === 'POST' && path === '/late-order-placements') {
    const body = await readBody(req);
    return send(req, res, 200, { orderId: body.orderId, status: 'asignado_a_ruta', routeId: ROUTE_ID });
  }

  // --- Couriers & Deliveries ---
  if (req.method === 'GET' && path === '/couriers') {
    return send(req, res, 200, { items: state.couriers, limit: 50, offset: 0 });
  }
  if (req.method === 'POST' && path === '/couriers') {
    const body = await readBody(req);
    const created = {
      id: randomUUID(),
      displayName: body.displayName,
      maxOrdersPerTrip: Number(body.maxOrdersPerTrip || 5),
      isEnabled: true,
      isAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.couriers.push(created);
    return send(req, res, 201, created);
  }
  if (req.method === 'PATCH' && /^\/couriers\/[^/]+\/availability$/.test(path)) {
    const c = state.couriers.find((x) => x.id === path.split('/')[2]);
    const body = await readBody(req);
    if (!c) return send(req, res, 404, { code: 'COURIER_NOT_FOUND', message: 'No encontrado.' });
    c.isAvailable = Boolean(body.isAvailable);
    return send(req, res, 200, c);
  }
  if (req.method === 'POST' && path === '/courier-assignments') {
    const body = await readBody(req);
    const r = state.routes.find((x) => x.id === body.routeId);
    if (r) {
      r.courierId = body.courierId;
      r.status = 'asignada';
    }
    return send(req, res, 200, { routeId: body.routeId, courierId: body.courierId, status: 'asignada' });
  }
  if (req.method === 'GET' && /^\/couriers\/[^/]+\/route$/.test(path)) {
    const courierId = path.split('/')[2];
    const r = state.routes.find((x) => x.courierId === courierId && (x.status === 'asignada' || x.status === 'en_curso'));
    return send(req, res, 200, {
      item: r
        ? {
            routeId: r.id,
            zoneId: r.zoneId,
            serviceDate: r.serviceDate,
            status: r.status,
            stops: r.stops,
          }
        : null,
    });
  }
  if (req.method === 'GET' && /^\/delivery-orders\/[^/]+$/.test(path)) {
    const id = path.split('/')[2];
    const o = state.orders.find((x) => x.id === id);
    return o
      ? send(req, res, 200, {
          orderId: o.id,
          routeId: ROUTE_ID,
          status: o.status,
          version: String(o.version ?? 2),
          deliveredAt: o.status === 'entregado' ? new Date().toISOString() : null,
          updatedAt: o.updatedAt,
        })
      : send(req, res, 404, { code: 'NOT_FOUND', message: 'No encontrado.' });
  }
  if (req.method === 'POST' && path === '/delivery-status-changes') {
    const body = await readBody(req);
    const o = state.orders.find((x) => x.id === body.orderId);
    if (!o) return send(req, res, 404, { code: 'NOT_FOUND', message: 'No encontrado.' });
    o.status = body.newStatus;
    o.version = (o.version || 1) + 1;
    for (const r of state.routes) {
      const stop = r.stops.find((s) => s.orderId === o.id);
      if (stop) stop.status = body.newStatus;
    }
    const so = state.storeOrders.find((x) => x.id === o.id);
    if (so) so.status = body.newStatus;
    return send(req, res, 200, { orderId: o.id, status: o.status, version: String(o.version) });
  }
  if (req.method === 'POST' && path === '/route-completions') {
    const body = await readBody(req);
    const r = state.routes.find((x) => x.id === body.routeId);
    if (r) r.status = 'completada';
    return send(req, res, 200, { ok: true });
  }

  // --- Courier Applications ---
  if (req.method === 'GET' && path === '/courier-applications/me') {
    const app = state.applications.find((a) => a.userId === actor.id) || null;
    return send(req, res, 200, { application: app });
  }
  if (req.method === 'GET' && path === '/courier-applications') {
    return send(req, res, 200, {
      items: state.applications,
      total: state.applications.length,
      limit: 20,
      offset: 0,
    });
  }

  // --- /store endpoints (all 35) ---
  if (req.method === 'GET' && path === '/store/categories') {
    return send(req, res, 200, { items: state.categories.filter((c) => c.isActive) });
  }
  if (req.method === 'GET' && path === '/store/products') {
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    const catId = url.searchParams.get('categoryId') || '';
    const filtered = state.products
      .filter((p) => p.isActive)
      .filter((p) => !catId || p.category.id === catId)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q))
      .map(customerProductView);
    return send(req, res, 200, { items: filtered, page: 1, pageSize: 12, total: filtered.length });
  }
  if (req.method === 'GET' && /^\/store\/products\/[^/]+$/.test(path)) {
    const p = state.products.find((x) => x.id === path.split('/')[3]);
    return p ? send(req, res, 200, customerProductView(p)) : send(req, res, 404, { code: 'PRODUCT_NOT_FOUND', message: 'No encontrado.' });
  }
  if (req.method === 'GET' && path === '/store/delivery-slots') {
    const zoneId = url.searchParams.get('zoneId') || state.zones[0].id;
    const date = url.searchParams.get('date') || TODAY;
    return send(req, res, 200, {
      zoneId,
      date,
      items: [
        { time: '10:00', capacity: 10, reserved: 10, available: false },
        { time: '12:00', capacity: 10, reserved: 4, available: true },
        { time: '14:00', capacity: 10, reserved: 2, available: true },
        { time: '16:00', capacity: 10, reserved: 1, available: true },
        { time: '18:00', capacity: 10, reserved: 0, available: true },
      ],
    });
  }
  if (req.method === 'POST' && path === '/store/orders') {
    const body = await readBody(req);
    const id = randomUUID();
    const lines = (body.items || []).map((it) => {
      const p = state.products.find((x) => x.id === it.productId) || state.products[0];
      p.stockQuantity = Math.max(0, p.stockQuantity - (it.quantity || 1));
      return {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        unitPriceCents: p.priceCents,
        quantity: it.quantity || 1,
        lineTotalCents: p.priceCents * (it.quantity || 1),
        imageUrl: p.imageUrl,
      };
    });
    const totalCents = lines.reduce((a, l) => a + l.lineTotalCents, 0);
    const order = {
      id,
      status: 'pendiente',
      zoneId: body.zoneId,
      deliveryAddress: body.deliveryAddress,
      deliveryDate: body.deliveryDate,
      deliveryTime: body.deliveryTime,
      totalCents,
      itemsCount: lines.length,
      paymentMethod: 'contra_entrega',
      createdAt: new Date().toISOString(),
      customerId: actor.id,
      recipientName: body.recipientName || null,
      recipientPhone: body.recipientPhone || null,
      notes: body.notes || null,
      deliveryLatitude: body.latitude ?? null,
      deliveryLongitude: body.longitude ?? null,
      version: 1,
      items: lines,
    };
    state.storeOrders.unshift(order);
    state.orders.unshift({
      id,
      zoneId: body.zoneId,
      deliveryAddress: body.deliveryAddress,
      deliveryDate: body.deliveryDate,
      deliveryTime: body.deliveryTime,
      status: 'pendiente',
      version: 1,
      createdAt: order.createdAt,
      updatedAt: order.createdAt,
    });
    return send(req, res, 201, order);
  }
  if (req.method === 'GET' && path === '/store/orders') {
    return send(req, res, 200, {
      items: state.storeOrders.map(({ items: _i, ...sum }) => sum),
      page: 1,
      pageSize: 15,
      total: state.storeOrders.length,
    });
  }
  if (req.method === 'GET' && /^\/store\/orders\/[^/]+$/.test(path)) {
    const o = state.storeOrders.find((x) => x.id === path.split('/')[3]);
    return o ? send(req, res, 200, o) : send(req, res, 404, { code: 'ORDER_NOT_FOUND', message: 'No encontrado.' });
  }
  if (req.method === 'POST' && /^\/store\/orders\/[^/]+\/cancel$/.test(path)) {
    const o = state.storeOrders.find((x) => x.id === path.split('/')[3]);
    if (!o) return send(req, res, 404, { code: 'ORDER_NOT_FOUND', message: 'No encontrado.' });
    o.status = 'cancelado';
    o.version += 1;
    return send(req, res, 200, { status: 'cancelado', alreadyCancelled: false, restocked: true, version: o.version, order: o });
  }
  if (req.method === 'POST' && /^\/store\/orders\/[^/]+\/reschedule$/.test(path)) {
    const o = state.storeOrders.find((x) => x.id === path.split('/')[3]);
    const body = await readBody(req);
    if (!o) return send(req, res, 404, { code: 'ORDER_NOT_FOUND', message: 'No encontrado.' });
    o.status = 'pendiente';
    o.deliveryDate = body.deliveryDate;
    o.deliveryTime = body.deliveryTime;
    o.version += 1;
    return send(req, res, 200, o);
  }

  if (req.method === 'GET' && path === '/store/addresses') return send(req, res, 200, { items: state.addresses });
  if (req.method === 'POST' && path === '/store/addresses') {
    const body = await readBody(req);
    const created = {
      id: randomUUID(),
      label: body.label,
      zoneId: body.zoneId,
      address: body.address,
      recipientName: body.recipientName || null,
      recipientPhone: body.recipientPhone || null,
      isDefault: Boolean(body.isDefault),
      version: 1,
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
    };
    state.addresses.push(created);
    return send(req, res, 201, created);
  }
  if (req.method === 'PATCH' && /^\/store\/addresses\/[^/]+$/.test(path)) {
    const a = state.addresses.find((x) => x.id === path.split('/')[3]);
    const body = await readBody(req);
    if (!a) return send(req, res, 404, { code: 'NOT_FOUND', message: 'No encontrada.' });
    Object.assign(a, body, { version: a.version + 1 });
    return send(req, res, 200, a);
  }
  if (req.method === 'DELETE' && /^\/store\/addresses\/[^/]+$/.test(path)) {
    const id = path.split('/')[3];
    const idx = state.addresses.findIndex((x) => x.id === id);
    if (idx >= 0) state.addresses.splice(idx, 1);
    return send(req, res, 204, null);
  }

  // --- Courier store ---
  if (req.method === 'GET' && path === '/store/courier/orders') {
    const activeStops = state.storeOrders
      .filter((x) => x.status !== 'cancelado')
      .sort((a, b) =>
        a.status === 'en_camino' && b.status !== 'en_camino'
          ? -1
          : b.status === 'en_camino' && a.status !== 'en_camino'
            ? 1
            : 0,
      );
    return send(req, res, 200, {
      items: activeStops.map((o, idx) => ({
        orderId: o.id,
        version: o.version,
        status: o.status,
        routeId: ROUTE_ID,
        routeStatus: 'en_curso',
        position: idx + 1,
        deliveryAddress: o.deliveryAddress,
        deliveryDate: o.deliveryDate,
        deliveryTime: o.deliveryTime,
        recipientName: o.recipientName,
        recipientPhone: o.recipientPhone,
        notes: o.notes,
        isStoreOrder: true,
        totalCents: o.totalCents,
        items: o.items.map((l) => ({
          name: l.name,
          quantity: l.quantity,
          unitPriceCents: l.unitPriceCents,
          lineTotalCents: l.lineTotalCents,
        })),
        failedAttempts: o.status === 'entrega_fallida' ? 1 : 0,
        deliveryLatitude: o.deliveryLatitude,
        deliveryLongitude: o.deliveryLongitude,
      })),
    });
  }
  if (req.method === 'POST' && /^\/store\/courier\/orders\/[^/]+\/deliver$/.test(path)) {
    const id = path.split('/')[4];
    const body = await readBody(req);
    const o = state.storeOrders.find((x) => x.id === id);
    if (o) {
      o.status = 'entregado';
      o.version += 1;
    }
    state.courierCollectedCents += body.collectedCents || 0;
    state.courierCollectedCount += 1;
    return send(req, res, 200, {
      orderId: id,
      status: 'entregado',
      version: (body.expectedVersion || 1) + 1,
      collectedCents: body.collectedCents,
      replayed: false,
    });
  }
  if (req.method === 'POST' && /^\/store\/courier\/orders\/[^/]+\/fail$/.test(path)) {
    const id = path.split('/')[4];
    const body = await readBody(req);
    const o = state.storeOrders.find((x) => x.id === id);
    if (o) {
      o.status = 'entrega_fallida';
      o.version += 1;
    }
    return send(req, res, 200, {
      orderId: id,
      status: 'entrega_fallida',
      version: (body.expectedVersion || 1) + 1,
      attempt: 1,
      replayed: false,
    });
  }
  if (req.method === 'GET' && path === '/store/courier/cash') {
    return send(req, res, 200, {
      date: url.searchParams.get('date') || TODAY,
      collectedCents: state.courierCollectedCents,
      ordersCount: state.courierCollectedCount,
      settlement: state.settlement,
    });
  }

  // --- Admin store ---
  if (req.method === 'GET' && path === '/store/admin/categories') return send(req, res, 200, { items: state.categories });
  if (req.method === 'POST' && path === '/store/admin/categories') {
    const body = await readBody(req);
    const cat = { id: randomUUID(), name: body.name, isActive: true, version: 1 };
    state.categories.push(cat);
    return send(req, res, 201, cat);
  }
  if (req.method === 'PATCH' && /^\/store\/admin\/categories\/[^/]+$/.test(path)) {
    const c = state.categories.find((x) => x.id === path.split('/')[4]);
    const body = await readBody(req);
    if (!c) return send(req, res, 404, { code: 'CATEGORY_NOT_FOUND', message: 'No encontrada.' });
    Object.assign(c, body, { version: c.version + 1 });
    return send(req, res, 200, c);
  }
  if (req.method === 'GET' && path === '/store/admin/products') {
    return send(req, res, 200, { items: state.products, page: 1, pageSize: 15, total: state.products.length });
  }
  if (req.method === 'POST' && path === '/store/admin/products') {
    const body = await readBody(req);
    const cat = state.categories.find((c) => c.id === body.categoryId) || state.categories[0];
    const prod = {
      id: randomUUID(),
      sku: body.sku,
      name: body.name,
      brand: body.brand || null,
      description: body.description || null,
      category: { id: cat.id, name: cat.name },
      priceCents: body.priceCents,
      compareAtPriceCents: body.compareAtPriceCents ?? null,
      discountPercent: null,
      stockQuantity: body.stock ?? 0,
      imageUrl: null,
      isActive: body.isActive ?? true,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.products.unshift(prod);
    return send(req, res, 201, prod);
  }
  if (req.method === 'GET' && /^\/store\/admin\/products\/[^/]+$/.test(path)) {
    const p = state.products.find((x) => x.id === path.split('/')[4]);
    return p ? send(req, res, 200, p) : send(req, res, 404, { code: 'PRODUCT_NOT_FOUND', message: 'No encontrado.' });
  }
  if (req.method === 'PATCH' && /^\/store\/admin\/products\/[^/]+$/.test(path)) {
    const p = state.products.find((x) => x.id === path.split('/')[4]);
    const body = await readBody(req);
    if (!p) return send(req, res, 404, { code: 'PRODUCT_NOT_FOUND', message: 'No encontrado.' });
    Object.assign(p, body, { version: p.version + 1 });
    return send(req, res, 200, p);
  }
  if (req.method === 'POST' && /^\/store\/admin\/products\/[^/]+\/stock-adjustments$/.test(path)) {
    const p = state.products.find((x) => x.id === path.split('/')[4]);
    const body = await readBody(req);
    if (!p) return send(req, res, 404, { code: 'PRODUCT_NOT_FOUND', message: 'No encontrado.' });
    p.stockQuantity = Math.max(0, p.stockQuantity + (body.delta || 0));
    return send(req, res, 200, { id: p.id, stock: p.stockQuantity });
  }
  if (req.method === 'GET' && /^\/store\/admin\/products\/[^/]+\/events$/.test(path)) {
    return send(req, res, 200, {
      items: [{ id: randomUUID(), action: 'created', actorUserId: state.users[0].id, changes: { stock: 14 }, createdAt: state.now }],
    });
  }
  if (req.method === 'GET' && path === '/store/admin/settings') return send(req, res, 200, state.settings);
  if (req.method === 'PUT' && path === '/store/admin/settings') {
    state.settings = await readBody(req);
    return send(req, res, 200, state.settings);
  }
  if (req.method === 'GET' && path === '/store/admin/orders') {
    return send(req, res, 200, { items: state.storeOrders, page: 1, pageSize: 20, total: state.storeOrders.length });
  }
  if (req.method === 'GET' && path === '/store/admin/low-stock') {
    const thr = Number.parseInt(url.searchParams.get('threshold') || '5', 10);
    const items = state.products
      .filter((p) => p.stockQuantity <= thr)
      .map((p) => ({ id: p.id, sku: p.sku, name: p.name, stockQuantity: p.stockQuantity, isActive: p.isActive }));
    return send(req, res, 200, { threshold: thr, items });
  }
  if (req.method === 'GET' && path === '/store/admin/summary') {
    return send(req, res, 200, {
      from: url.searchParams.get('from') || TODAY,
      to: url.searchParams.get('to') || TODAY,
      orders: { total: state.storeOrders.length, byStatus: { en_camino: 1, entrega_fallida: 1 } },
      grossCents: state.storeOrders.reduce((acc, o) => acc + o.totalCents, 0),
      collectedCents: state.courierCollectedCents,
      cancellations: { count: 0, byReason: {} },
      failures: { count: 1, byReason: { cliente_ausente: 1 } },
      topProducts: [{ productId: state.products[0].id, name: state.products[0].name, units: 2, revenueCents: 13998 }],
      lowStockCount: state.products.filter((p) => p.stockQuantity <= 5).length,
    });
  }
  if (req.method === 'GET' && path === '/store/admin/cash') {
    return send(req, res, 200, {
      date: url.searchParams.get('date') || TODAY,
      items: [
        {
          courierUserId: state.users[1].id,
          courierName: state.users[1].displayName,
          date: TODAY,
          collectedCents: state.courierCollectedCents,
          ordersCount: state.courierCollectedCount,
          settlement: state.settlement,
        },
      ],
    });
  }
  if (req.method === 'POST' && path === '/store/admin/cash/settlements') {
    const body = await readBody(req);
    const diff = (body.receivedCents || 0) - state.courierCollectedCents;
    state.settlement = { receivedCents: body.receivedCents, differenceCents: diff, settledAt: new Date().toISOString() };
    return send(req, res, 201, {
      expectedCents: state.courierCollectedCents,
      receivedCents: body.receivedCents,
      differenceCents: diff,
    });
  }

  return send(req, res, 404, { code: 'NOT_FOUND', message: `Ruta no encontrada: ${path}` });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Mock Millast API listening on http://127.0.0.1:${PORT}`);
});

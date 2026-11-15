\set ON_ERROR_STOP on
SET search_path = logistica, pg_catalog;

-- 1) Cuatro cuentas de prueba con hash Scrypt compatible con ScryptPasswordHasher.
INSERT INTO app_users(id, auth_subject, email, password_hash, role, display_name, is_active)
VALUES
  ('30000000-0000-4000-8000-000000000001', 'admin@logistica.local', 'admin@logistica.local', 'scrypt$b0fb388a8281cb13e5efefdb7e286524$91d02cdc2d58a90489ace4b0abe2c3405f76bb8fff2d4a9c1cdf327dbe109d79b5b8637ec455f525d9cf07681eb6fe09a0f80111cc02c18986bd68e8bcbb9804', 'personal', 'Admin / Personal', true),
  ('30000000-0000-4000-8000-000000000002', 'repartidor1@logistica.local', 'repartidor1@logistica.local', 'scrypt$e86cfc4c1fa5f8c7adec40cccd630738$e4556c7eb97e526c76ba7a142a15cd55fe6b9f2e4a1fdf97ae432440fa94fc1fc6c644eeaaa86963b25c75f26ec69d5698e65a86236a3609b1191e33af588a3e', 'repartidor', 'Repartidor Demo 1', true),
  ('30000000-0000-4000-8000-000000000003', 'repartidor2@logistica.local', 'repartidor2@logistica.local', 'scrypt$16d48d82e520cb798272cb8d72a5af43$9fe9de10e4c10691926bf332cd495d774673978bd0a8430d95c3f2a9c6fcdc4bfdc21c342b3545f46f5441876b2c4f98d024433afac176d10600ce27e6f70961', 'repartidor', 'Repartidor Demo 2', true),
  ('30000000-0000-4000-8000-000000000004', 'cliente@logistica.local', 'cliente@logistica.local', 'scrypt$230d52a0566955974340728a2632bc8d$9cf9943ddc1263b5a685d8b27a7d985c2be0797999c136a8bafbab4470adbcc25bdf41ce66166d96d12b6fbf25421c25fb07a9946ba923ce0925adcd7e796ad7', 'cliente', 'Cliente Demo', true)
ON CONFLICT (id) DO UPDATE SET
  auth_subject = EXCLUDED.auth_subject,
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  display_name = EXCLUDED.display_name,
  is_active = EXCLUDED.is_active;

-- 2) Vincular cada cuenta de repartidor con su courier (RBAC de /couriers/:id/availability y /couriers/:id/route).
UPDATE couriers
SET user_id = '30000000-0000-4000-8000-000000000002'
WHERE id = '40000000-0000-4000-8000-000000000001'
  AND user_id IS DISTINCT FROM '30000000-0000-4000-8000-000000000002';

UPDATE couriers
SET user_id = '30000000-0000-4000-8000-000000000003'
WHERE id = '40000000-0000-4000-8000-000000000002'
  AND user_id IS DISTINCT FROM '30000000-0000-4000-8000-000000000003';

-- 3) Los pedidos demo pendientes pasan a la fecha vigente local para poder planificar rutas hoy.
UPDATE orders
SET delivery_date = (clock_timestamp() AT TIME ZONE 'America/Guayaquil')::date
WHERE status = 'pendiente'
  AND delivery_date < (clock_timestamp() AT TIME ZONE 'America/Guayaquil')::date
  AND id IN (
    SELECT id FROM orders WHERE status = 'pendiente' ORDER BY id LIMIT 12
  );

SELECT u.email, u.role, u.display_name, c.id AS courier_id
FROM app_users u
LEFT JOIN couriers c ON c.user_id = u.id
ORDER BY u.email;

SELECT status, delivery_date, count(*) AS pedidos
FROM orders
GROUP BY status, delivery_date
ORDER BY delivery_date, status;

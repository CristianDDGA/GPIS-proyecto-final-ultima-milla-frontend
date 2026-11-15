// APE4-CP-12 / INC05: detalle de pedido con API y PostgreSQL reales.
// El flujo exige JWT: se registra un usuario de prueba por API, se envian las
// peticiones con `Authorization: Bearer <token>` y se inyecta el token en
// localStorage (clave gpis_ultima_milla_jwt) antes de abrir la aplicacion.

const SESSION_KEY = 'gpis_ultima_milla_jwt';

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

describe('S2-CP-004: detalle de pedido con API y PostgreSQL reales', () => {
  it('recupera filtros y detalle, sobrevive a F5, vuelve al listado y muestra ausencia', () => {
    const api = Cypress.expose('apiUrl');
    const suffix = Date.now();
    const name = `S2-${suffix}`;
    const address = `Entrega ${name}`;
    const credentials = {
      email: `cypress-${suffix}@example.com`,
      password: 'Cypress-2026!',
      displayName: 'Cypress Probe',
    };
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Guayaquil',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(Date.now() + 3 * 86400000));

    cy.request('POST', `${api}/auth/register`, credentials).its('body.token').then((token) => {
      cy.request({ method: 'POST', url: `${api}/zones`, headers: authHeaders(token), body: { name } })
        .its('body')
        .then((zone) => {
          cy.request({
            method: 'POST',
            url: `${api}/orders`,
            headers: authHeaders(token),
            body: { zoneId: zone.id, deliveryAddress: address, deliveryDate: date, deliveryTime: '14:30' },
          })
            .its('body')
            .then((order) => {
              const visitOrders = (extra = '') => cy.visit(`/?tab=orders&deliveryDate=${date}&zoneId=${zone.id}${extra}`, {
                onBeforeLoad(window) {
                  window.localStorage.setItem(SESSION_KEY, token);
                },
              });

              visitOrders();
              cy.contains('tr', address).contains('button', 'Ver detalle').click();
              cy.contains('Detalle del pedido').should('be.visible');
              cy.get('dl')
                .should('contain', order.id)
                .and('contain', address)
                .and('contain', date)
                .and('contain', '14:30')
                .and('contain', order.status)
                .and('contain', name);

              // F5: la recarga conserva la sesion y la consulta activa.
              cy.reload();
              cy.get('dl').should('contain', order.id).and('contain', address);

              cy.contains('button', 'Volver al listado').click();
              cy.get('#filter-date').should('have.value', date);
              cy.get('#filter-zone').should('have.value', zone.id);
              cy.contains('tr', address).should('be.visible');

              cy.go('back');
              cy.get('dl').should('contain', order.id).and('contain', address);
              cy.go('forward');
              cy.get('#filter-date').should('have.value', date);
              cy.get('#filter-zone').should('have.value', zone.id);

              // Pedido inexistente: 404 controlado.
              visitOrders('&orderId=00000000-0000-4000-8000-000000000000');
              cy.contains('Pedido no encontrado').should('be.visible');
              cy.get('dl').should('not.exist');
              cy.contains('button', 'Volver al listado').click();
              cy.get('#filter-date').should('have.value', date);
              cy.get('#filter-zone').should('have.value', zone.id);

              // Identificador invalido: error controlado de consulta.
              visitOrders('&orderId=invalido');
              cy.contains('No se pudo consultar el pedido').should('be.visible');
              cy.get('dl').should('not.exist');

              // INC08: filtro sin coincidencias con el mensaje corregido.
              cy.visit(`/?tab=orders&deliveryDate=2030-12-31&zoneId=${zone.id}`, {
                onBeforeLoad(window) {
                  window.localStorage.setItem(SESSION_KEY, token);
                },
              });
              cy.contains('Sin coincidencias para los filtros activos').should('be.visible');
            });
        });
    });
  });
});

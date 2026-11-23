import { describe, expect, it } from 'vitest';
import { HttpCourierApplicationGateway } from './infrastructure/http/httpCourierApplicationGateway.js';
import {
  ApproveApplicationUseCase,
  CancelApplicationUseCase,
  GetApplicationUseCase,
  GetMyApplicationUseCase,
  ListApplicationsUseCase,
  RejectApplicationUseCase,
  SaveApplicationDraftUseCase,
  SubmitApplicationUseCase,
} from './application/courierApplicationUseCases.js';
import { createFakeHttpClient, VALID_UUID } from '../../test/fakeHttpClient.js';

const APPLICATION = {
  id: VALID_UUID,
  userId: VALID_UUID,
  fullName: 'Luis Andrade',
  nationalId: '1710034065',
  phone: '0991234567',
  birthDate: '1995-04-10',
  vehicleType: 'moto',
  licenseNumber: 'ABC-12345',
  licenseCategory: 'A',
  licenseExpiresOn: '2030-01-01',
  status: 'pendiente',
  files: [{ kind: 'photo', contentType: 'image/png', sizeBytes: 1200, uploadedAt: '2026-11-20T10:00:00Z' }],
  submittedAt: '2026-11-20T10:05:00Z',
  reviewedAt: null,
  rejectionReason: null,
  approvedCapacity: null,
  createdAt: '2026-11-20T09:00:00Z',
};
const DETAIL = { ...APPLICATION, applicantEmail: 'luis@millast.ec', applicantName: 'Luis' };

function gateway(response: unknown) {
  const http = createFakeHttpClient(response);
  return { http, gateway: new HttpCourierApplicationGateway(http) };
}

describe('solicitud del cliente para ser conductor', () => {
  it('lee la solicitud propia o null si no existe', async () => {
    await expect(new GetMyApplicationUseCase(gateway({ application: APPLICATION }).gateway).execute()).resolves.toMatchObject({
      status: 'pendiente',
    });
    await expect(new GetMyApplicationUseCase(gateway({ application: null }).gateway).execute()).resolves.toBeNull();
    await expect(gateway({}).gateway.getMine()).rejects.toThrow(/contrato/);
  });

  it('guarda el borrador solo si es válido', async () => {
    const { http, gateway: port } = gateway({ application: APPLICATION });
    await expect(
      new SaveApplicationDraftUseCase(port).execute({ ...APPLICATION, nationalId: '123' } as never),
    ).rejects.toThrow(/10 dígitos/);
    expect(http.put).not.toHaveBeenCalled();

    await new SaveApplicationDraftUseCase(port).execute(APPLICATION as never);
    expect(http.put).toHaveBeenCalledWith('/courier-applications/me', expect.objectContaining({ nationalId: '1710034065' }));
  });

  it('envía, cancela y sube imágenes', async () => {
    const { http, gateway: port } = gateway({ application: APPLICATION });
    await new SubmitApplicationUseCase(port).execute();
    await new CancelApplicationUseCase(port).execute();
    expect(http.post).toHaveBeenCalledWith('/courier-applications/me/submit');
    expect(http.post).toHaveBeenCalledWith('/courier-applications/me/cancel');

    await port.uploadFile('license', new Blob(['x']), 'image/jpeg');
    expect(http.putBinary).toHaveBeenCalledWith('/courier-applications/me/files/license', expect.any(Blob), 'image/jpeg');
  });

  it('rechaza archivos con tipo desconocido en la respuesta', async () => {
    const broken = { application: { ...APPLICATION, files: [{ kind: 'photo', contentType: 'image/gif', sizeBytes: 1, uploadedAt: 'x' }] } };
    await expect(gateway(broken).gateway.submit()).rejects.toThrow(/contrato/);
  });
});

describe('revisión del administrador', () => {
  it('lista con filtros recortados', async () => {
    const { http, gateway: port } = gateway({ items: [DETAIL], total: 1, limit: 10, offset: 0 });
    const page = await new ListApplicationsUseCase(port).execute({ status: 'pendiente', q: '  luis ', limit: 10 });
    expect(http.get).toHaveBeenCalledWith('/courier-applications?status=pendiente&q=luis&limit=10');
    expect(page.items[0]?.applicantEmail).toBe('luis@millast.ec');
  });

  it('consulta, aprueba con capacidad y rechaza con motivo', async () => {
    const { http, gateway: port } = gateway({ application: DETAIL });
    expect(() => new GetApplicationUseCase(port).execute('  ')).toThrow();
    await new GetApplicationUseCase(port).execute(VALID_UUID);

    expect(() => new ApproveApplicationUseCase(port).execute(VALID_UUID, 0)).toThrow(/entre 1 y 200/);
    await new ApproveApplicationUseCase(port).execute(VALID_UUID, 12);
    expect(http.post).toHaveBeenCalledWith(`/courier-applications/${VALID_UUID}/approve`, { capacity: 12 });

    expect(() => new RejectApplicationUseCase(port).execute(VALID_UUID, 'no')).toThrow(/entre 5 y 500/);
    await new RejectApplicationUseCase(port).execute(VALID_UUID, '  Licencia ilegible  ');
    expect(http.post).toHaveBeenCalledWith(`/courier-applications/${VALID_UUID}/reject`, { reason: 'Licencia ilegible' });
  });
});

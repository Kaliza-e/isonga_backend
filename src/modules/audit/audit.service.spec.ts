import { Test, TestingModule } from '@nestjs/testing';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: Partial<Record<keyof PrismaService, any>>;

  beforeEach(async () => {
    prisma = {
      auditLog: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'log-1', ...data })),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  it('should sanitize secrets from audit details before persistence', async () => {
    await service.record({
      userId: 'user-1',
      action: AuditAction.USER_LOGIN,
      resource: 'User',
      details: {
        phone: '+250788000001',
        password: 'PlainTextPasswordShouldNotBeLogged',
        otp: '123456',
        token: 'secret-bearer-token',
        ip: '127.0.0.1',
      },
    });

    const createCall = (prisma.auditLog.create as jest.Mock).mock.calls[0][0];
    const savedDetails = createCall.data.details;

    expect(savedDetails.phone).toBe('+250788000001');
    expect(savedDetails.ip).toBe('127.0.0.1');
    expect(savedDetails.password).toBeUndefined();
    expect(savedDetails.otp).toBeUndefined();
    expect(savedDetails.token).toBeUndefined();
  });
});

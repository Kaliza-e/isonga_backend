import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: Partial<Record<keyof PrismaService, any>>;
  let jwtService: Partial<Record<keyof JwtService, jest.Mock>>;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      administrativeArea: {
        findUnique: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mocked-jwt-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('development'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should throw BadRequestException if consent is not given', async () => {
      await expect(
        service.register({
          phone: '+250788123456',
          password: 'Password123!',
          firstName: 'Eric',
          lastName: 'Mugisha',
          areaId: 'area-uuid',
          consentGiven: false,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if phone number already exists', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'existing-id' });

      await expect(
        service.register({
          phone: '+250788123456',
          password: 'Password123!',
          firstName: 'Eric',
          lastName: 'Mugisha',
          areaId: 'area-uuid',
          consentGiven: true,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should register user and return dev OTP in development', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null); // phone check
      (prisma.administrativeArea.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'area-uuid',
        name: 'Rebero',
      });

      const mockCreatedUser = {
        id: 'new-user-id',
        phone: '+250788123456',
        role: UserRole.RESIDENT,
        status: UserStatus.PENDING_VERIFICATION,
      };

      (prisma.user.create as jest.Mock).mockResolvedValueOnce(mockCreatedUser);

      const result = await service.register({
        phone: '+250788123456',
        password: 'Password123!',
        firstName: 'Eric',
        lastName: 'Mugisha',
        areaId: 'area-uuid',
        consentGiven: true,
      });

      expect(result.userId).toBe('new-user-id');
      expect(result.status).toBe(UserStatus.PENDING_VERIFICATION);
      expect(result).toHaveProperty('devOtp');
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException on invalid user or password', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        service.login({ identifier: '+250788999999', password: 'WrongPassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException if account is pending verification', async () => {
      const hashedPassword = await bcrypt.hash('Password123!', 10);
      (prisma.user.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'user-id',
        passwordHash: hashedPassword,
        status: UserStatus.PENDING_VERIFICATION,
      });

      await expect(
        service.login({ identifier: '+250788111222', password: 'Password123!' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return accessToken for active user with valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('Password123!', 10);
      const activeUser = {
        id: 'user-id',
        phone: '+250788000001',
        email: 'admin@isonga.gov.rw',
        passwordHash: hashedPassword,
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        residentProfile: null,
        adminPermissions: [],
      };

      (prisma.user.findFirst as jest.Mock).mockResolvedValueOnce(activeUser);
      (prisma.user.update as jest.Mock).mockResolvedValueOnce(activeUser);

      const result = await service.login({
        identifier: '+250788000001',
        password: 'Password123!',
      });

      expect(result.accessToken).toBe('mocked-jwt-token');
      expect(result.user.role).toBe(UserRole.SUPER_ADMIN);
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('verifyOtp', () => {
    it('should verify OTP, activate user, and return JWT token', async () => {
      const rawOtp = '123456';
      const otpHash = crypto.createHash('sha256').update(rawOtp).digest('hex');

      const pendingUser = {
        id: 'user-id',
        phone: '+250788123456',
        role: UserRole.RESIDENT,
        status: UserStatus.PENDING_VERIFICATION,
        phoneVerified: false,
        otpHash,
        otpExpiresAt: new Date(Date.now() + 500000),
        otpAttempts: 0,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(pendingUser);
      (prisma.user.update as jest.Mock).mockResolvedValueOnce({
        ...pendingUser,
        phoneVerified: true,
        status: UserStatus.ACTIVE,
      });

      const result = await service.verifyOtp({
        phone: '+250788123456',
        otp: '123456',
      });

      expect(result.accessToken).toBe('mocked-jwt-token');
      expect(result.user.status).toBe(UserStatus.ACTIVE);
    });

    it('should reject invalid OTP and increment attempt counter', async () => {
      const rawOtp = '123456';
      const otpHash = crypto.createHash('sha256').update(rawOtp).digest('hex');

      const pendingUser = {
        id: 'user-id',
        phone: '+250788123456',
        otpHash,
        otpExpiresAt: new Date(Date.now() + 500000),
        otpAttempts: 0,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(pendingUser);

      await expect(
        service.verifyOtp({ phone: '+250788123456', otp: '999999' }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { otpAttempts: { increment: 1 } },
        }),
      );
    });
  });
});


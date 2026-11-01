import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuditAction, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Cryptographically hash OTP before persisting in DB
   */
  private hashOtp(otp: string): string {
    return crypto.createHash('sha256').update(otp).digest('hex');
  }

  /**
   * Generate a secure 6-digit numeric OTP code
   */
  private generateOtp(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Register a new resident account
   */
  async register(dto: RegisterDto) {
    if (!dto.consentGiven) {
      throw new BadRequestException(
        'Consent is required to receive community announcements under Rwandan Data Protection Law No 058/2021.',
      );
    }

    // Check existing phone
    const existingPhone = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });
    if (existingPhone) {
      throw new ConflictException('A user with this phone number is already registered.');
    }

    // Check existing email if provided
    if (dto.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existingEmail) {
        throw new ConflictException('A user with this email address is already registered.');
      }
    }

    // Verify area exists
    const area = await this.prisma.administrativeArea.findUnique({
      where: { id: dto.areaId },
    });
    if (!area) {
      throw new NotFoundException(`Administrative area with ID "${dto.areaId}" does not exist.`);
    }

    // Hash password securely
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Generate 6-digit OTP
    const rawOtp = this.generateOtp();
    const otpHash = this.hashOtp(rawOtp);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Execute atomic registration in transaction
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          phone: dto.phone,
          email: dto.email || null,
          passwordHash,
          role: UserRole.RESIDENT,
          status: UserStatus.PENDING_VERIFICATION,
          otpHash,
          otpExpiresAt,
          otpAttempts: 0,
          residentProfile: {
            create: {
              firstName: dto.firstName,
              lastName: dto.lastName,
              areaId: dto.areaId,
              preferredLanguage: dto.preferredLanguage || 'rw',
              consentGiven: true,
              consentTimestamp: new Date(),
              consentVersion: 'v1.0',
              preference: {
                create: {
                  smsEnabled: true,
                  pushEnabled: true,
                  inAppEnabled: true,
                  whatsappEnabled: false,
                  communityMeetings: true,
                  umuganda: true,
                  publicServices: true,
                  healthInfo: true,
                  education: true,
                  administrativeNotice: true,
                  communityEvents: true,
                },
              },
            },
          },
        },
        include: {
          residentProfile: {
            include: {
              area: true,
            },
          },
        },
      });

      // Audit log creation (no secrets recorded)
      await tx.auditLog.create({
        data: {
          userId: newUser.id,
          action: AuditAction.USER_REGISTER,
          resource: 'User',
          resourceId: newUser.id,
          details: {
            phone: dto.phone,
            role: newUser.role,
            areaId: dto.areaId,
            areaName: area.name,
          },
        },
      });

      return newUser;
    });

    this.logger.log(`[SMS-MOCK] Generated verification OTP for ${dto.phone}: ${rawOtp}`);

    return {
      message: 'Registration successful. An OTP has been sent to your phone for verification.',
      userId: user.id,
      phone: user.phone,
      status: user.status,
      // Provide OTP in response only in non-production environments to facilitate rapid testing
      ...(this.configService.get('nodeEnv') !== 'production' && { devOtp: rawOtp }),
    };
  }

  /**
   * Login user with Phone or Email and password
   */
  async login(dto: LoginDto) {
    const isEmail = dto.identifier.includes('@');
    const user = await this.prisma.user.findFirst({
      where: isEmail ? { email: dto.identifier } : { phone: dto.identifier },
      include: {
        residentProfile: {
          include: {
            area: true,
          },
        },
        adminPermissions: {
          include: {
            area: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid phone number/email or password.');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid phone number/email or password.');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Account suspended. Please contact platform administrators.');
    }

    if (user.status === UserStatus.DEACTIVATED) {
      throw new ForbiddenException('Account deactivated.');
    }

    if (user.status === UserStatus.PENDING_VERIFICATION) {
      throw new ForbiddenException(
        'Account phone number is not yet verified. Please verify your OTP before logging in.',
      );
    }

    // Update last login timestamp
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: AuditAction.USER_LOGIN,
        resource: 'User',
        resourceId: user.id,
        details: { phone: user.phone, role: user.role },
      },
    });

    // Generate JWT token
    const token = this.jwtService.sign({
      sub: user.id,
      phone: user.phone,
      role: user.role,
    });

    return {
      accessToken: token,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        role: user.role,
        status: user.status,
        profile: user.residentProfile
          ? {
              firstName: user.residentProfile.firstName,
              lastName: user.residentProfile.lastName,
              area: user.residentProfile.area,
            }
          : null,
        adminPermissions: user.adminPermissions,
      },
    };
  }

  /**
   * Verify registration OTP
   */
  async verifyOtp(dto: VerifyOtpDto) {
    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
      include: {
        residentProfile: {
          include: {
            area: true,
          },
        },
        adminPermissions: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User with this phone number was not found.');
    }

    if (user.phoneVerified && user.status === UserStatus.ACTIVE) {
      return {
        message: 'Phone number is already verified.',
        alreadyVerified: true,
      };
    }

    if (!user.otpHash || !user.otpExpiresAt) {
      throw new BadRequestException('No OTP request found for this phone number. Please request a new OTP.');
    }

    if (user.otpExpiresAt < new Date()) {
      throw new BadRequestException('OTP has expired. Please request a new OTP.');
    }

    if (user.otpAttempts >= 5) {
      throw new BadRequestException(
        'Maximum OTP attempts exceeded. Please request a new OTP.',
      );
    }

    // Verify OTP hash
    const inputHash = this.hashOtp(dto.otp);
    if (inputHash !== user.otpHash) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { otpAttempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid OTP code. Please check and try again.');
    }

    // Activate account
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        phoneVerified: true,
        status: UserStatus.ACTIVE,
        otpHash: null,
        otpExpiresAt: null,
        otpAttempts: 0,
      },
    });

    // Issue token upon successful activation
    const token = this.jwtService.sign({
      sub: updatedUser.id,
      phone: updatedUser.phone,
      role: updatedUser.role,
    });

    return {
      message: 'Phone number verified successfully. Account is now active.',
      accessToken: token,
      tokenType: 'Bearer',
      user: {
        id: updatedUser.id,
        phone: updatedUser.phone,
        role: updatedUser.role,
        status: updatedUser.status,
      },
    };
  }

  /**
   * Request a new OTP (resend verification or password reset)
   */
  async requestOtp(dto: RequestOtpDto) {
    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });

    if (!user) {
      // Return ambiguous response to avoid user enumeration
      return {
        message: 'If the phone number is registered, an OTP has been sent.',
      };
    }

    // Rate limiting: allow request only after 60s
    if (user.otpExpiresAt) {
      const remainingMs = user.otpExpiresAt.getTime() - Date.now();
      // If expires in 10 mins, less than 60s has passed if remaining > 9 mins (540000ms)
      if (remainingMs > 9 * 60 * 1000) {
        throw new BadRequestException(
          'Please wait at least 60 seconds before requesting another OTP.',
        );
      }
    }

    const rawOtp = this.generateOtp();
    const otpHash = this.hashOtp(rawOtp);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        otpHash,
        otpExpiresAt,
        otpAttempts: 0,
      },
    });

    this.logger.log(`[SMS-MOCK] OTP for ${dto.phone} (${dto.purpose}): ${rawOtp}`);

    return {
      message: 'OTP has been dispatched to your phone number.',
      ...(this.configService.get('nodeEnv') !== 'production' && { devOtp: rawOtp }),
    };
  }

  /**
   * Reset forgotten password using OTP
   */
  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });

    if (!user || !user.otpHash || !user.otpExpiresAt) {
      throw new BadRequestException('Invalid or expired password reset request.');
    }

    if (user.otpExpiresAt < new Date()) {
      throw new BadRequestException('OTP code has expired.');
    }

    if (user.otpAttempts >= 5) {
      throw new BadRequestException('Maximum verification attempts exceeded.');
    }

    const inputHash = this.hashOtp(dto.otp);
    if (inputHash !== user.otpHash) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { otpAttempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid OTP code.');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        otpHash: null,
        otpExpiresAt: null,
        otpAttempts: 0,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: AuditAction.PASSWORD_RESET_SUCCESS,
        resource: 'User',
        resourceId: user.id,
        details: { phone: user.phone },
      },
    });

    return {
      message: 'Password has been reset successfully. You may now login.',
    };
  }
}


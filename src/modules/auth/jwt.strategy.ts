import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  phone: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'jwt.secret',
        'development_isonga_jwt_secret_key_32_chars_long',
      ),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
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
      throw new UnauthorizedException('Authentication token is no longer valid. User does not exist.');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Your account has been suspended. Please contact administrative support.');
    }

    if (user.status === UserStatus.DEACTIVATED) {
      throw new UnauthorizedException('Your account has been deactivated.');
    }

    return user;
  }
}


import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new resident account',
    description:
      'Creates a resident profile linked to a village/cell location with consent recording under Rwandan Data Protection Law No 058/2021.',
  })
  @ApiResponse({
    status: 201,
    description: 'Account registered. Verification OTP dispatched via SMS.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed or consent not provided.',
  })
  @ApiResponse({
    status: 409,
    description: 'Phone number or email is already registered.',
  })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'User login',
    description:
      'Authenticates a resident or administrator using Rwandan phone number (+250...) or email with password.',
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful. Returns JWT access token and user metadata.',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials.',
  })
  @ApiResponse({
    status: 403,
    description: 'Account pending verification or suspended.',
  })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify phone number using OTP',
    description:
      'Verifies the 6-digit OTP sent to the resident mobile number. Activates the account and issues a JWT token.',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP verified. Account activated.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired OTP code.',
  })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtp(verifyOtpDto);
  }

  @Public()
  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request a new OTP (Resend code)',
    description:
      'Dispatches a new 6-digit verification or password reset OTP with 60-second rate-limiting.',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP requested and dispatched.',
  })
  @ApiResponse({
    status: 400,
    description: 'Rate limit: must wait 60s between OTP requests.',
  })
  async requestOtp(@Body() requestOtpDto: RequestOtpDto) {
    return this.authService.requestOtp(requestOtpDto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password with OTP verification',
    description: 'Verifies the OTP and securely sets a new account password.',
  })
  @ApiResponse({
    status: 200,
    description: 'Password reset successful.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid OTP or password validation failed.',
  })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get current authenticated user profile & permissions',
    description:
      'Returns the authenticated user details, resident profile, and assigned geographical permissions.',
  })
  @ApiResponse({
    status: 200,
    description: 'Authenticated user profile retrieved.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized: missing or invalid JWT bearer token.',
  })
  async getProfile(@CurrentUser() user: any) {
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      role: user.role,
      status: user.status,
      phoneVerified: user.phoneVerified,
      profile: user.residentProfile,
      adminPermissions: user.adminPermissions,
    };
  }
}


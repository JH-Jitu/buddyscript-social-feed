import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUserId } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AUTH_COOKIE, JwtAuthGuard } from './jwt-auth.guard';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, token } = await this.auth.register(dto);
    this.setAuthCookie(res, token);
    return { user };
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, token } = await this.auth.login(dto);
    this.setAuthCookie(res, token);
    return { user };
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(AUTH_COOKIE, { path: '/' });
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUserId() userId: string) {
    return { user: await this.auth.getById(userId) };
  }

  private setAuthCookie(res: Response, token: string) {
    res.cookie(AUTH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('NODE_ENV') === 'production',
      maxAge: SEVEN_DAYS_MS,
      path: '/',
    });
  }
}

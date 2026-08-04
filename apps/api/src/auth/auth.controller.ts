import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ClientJwtAuthGuard, JwtAuthGuard } from './jwt-auth.guard';
import type { ClientJwtPayload, JwtPayload } from './types/jwt-payload';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.authService.me(user);
  }

  @Post('client/login')
  clientLogin(@Body() dto: LoginDto) {
    return this.authService.clientLogin(dto);
  }

  @UseGuards(ClientJwtAuthGuard)
  @Get('client/me')
  clientMe(@CurrentUser() user: ClientJwtPayload) {
    return this.authService.clientMe(user);
  }

  @UseGuards(ClientJwtAuthGuard)
  @Post('client/change-password')
  clientChangePassword(
    @CurrentUser() user: ClientJwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.clientChangePassword(user, dto);
  }
}

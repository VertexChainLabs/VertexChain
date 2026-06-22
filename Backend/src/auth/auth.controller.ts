import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // Accept refresh token in Authorization header as Bearer for simplicity in E2E.
  // Can be changed to cookies later.
  @Post('refresh')
  async refresh(@Req() req: Request, @Res() res: Response) {
    const auth = req.headers['authorization'];
    const refreshToken = typeof auth === 'string' ? auth.replace(/^Bearer\s+/i, '') : undefined;
    if (!refreshToken) {
      return res.status(401).json({ message: 'Missing refresh token' });
    }

    return this.authService.refresh(refreshToken);
  }
}

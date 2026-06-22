import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtUser {
  wallet: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET', 'dev_access_secret_change_me') as any,
    });
  }

  async validate(payload: any): Promise<JwtUser> {
    if (!payload || typeof payload.wallet !== 'string') {
      throw new UnauthorizedException('Invalid token payload');
    }
    return { wallet: payload.wallet };
  }
}

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { verify as verifyEd25519Signature } from 'crypto';
import { parseStellarPublicKeyRawBytes } from './stellar';

import { LoginDto } from './dto/login.dto';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresInSeconds: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto): Promise<AuthResponse> {
    const publicKey = dto.publicKey.trim();

    // 1) cryptographic validation of signature
    // The current codebase uses Soroban integration but doesn't provide an existing
    // message-format/nonce flow. For real security, the FE should request a
    // nonce, then sign it. Here, we validate signature over `dto.message`.
    const isValid = await this.verifyWalletSignature(publicKey, dto.message, dto.signature);
    if (!isValid) throw new UnauthorizedException('Invalid signature');

    // 2) Issue tokens
    const jwtAccessSecret = this.config.get<string>(
      'JWT_ACCESS_SECRET',
      'dev_access_secret_change_me',
    );
    const jwtRefreshSecret = this.config.get<string>(
      'JWT_REFRESH_SECRET',
      'dev_refresh_secret_change_me',
    );

    const accessTtl = this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m');
    const refreshTtl = this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '30d');

    const accessPayload = { wallet: publicKey, sub: publicKey, type: 'access' };
    const refreshPayload = { wallet: publicKey, sub: publicKey, type: 'refresh' };

    const accessToken = this.jwtService.sign(accessPayload as any, {
      secret: jwtAccessSecret,
      expiresIn: accessTtl as any,
    });

    const refreshToken = this.jwtService.sign(refreshPayload as any, {
      secret: jwtRefreshSecret,
      expiresIn: refreshTtl as any,
    });

    const expiresInSeconds = this.parseTtlToSeconds(accessTtl);

    this.logger.log(`Auth login success → wallet=${publicKey}`);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresInSeconds,
    };
  }

  async refresh(
    refreshToken: string,
  ): Promise<{ accessToken: string; tokenType: 'Bearer'; expiresInSeconds: number }> {
    const jwtRefreshSecret = this.config.get<string>(
      'JWT_REFRESH_SECRET',
      'dev_refresh_secret_change_me',
    );

    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: jwtRefreshSecret,
      }) as any;

      if (!payload || payload.type !== 'refresh' || typeof payload.wallet !== 'string') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Issue a new access token
      const publicKey = payload.wallet;
      const accessTtl = this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m');
      const jwtAccessSecret = this.config.get<string>(
        'JWT_ACCESS_SECRET',
        'dev_access_secret_change_me',
      );

      const accessToken = this.jwtService.sign(
        { wallet: publicKey, sub: publicKey, type: 'access' } as any,
        { secret: jwtAccessSecret, expiresIn: accessTtl as any },
      );

      return {
        accessToken,
        tokenType: 'Bearer',
        expiresInSeconds: this.parseTtlToSeconds(accessTtl),
      };
    } catch {
      throw new UnauthorizedException('Invalid/expired refresh token');
    }
  }

  private parseTtlToSeconds(ttl: string): number {
    // supports '15m', '30d', '3600s'
    const m = /^([0-9]+)(s|m|h|d)$/.exec(ttl.trim());
    if (!m) return 15 * 60;
    const value = Number(m[1]);
    const unit = m[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return value;
    }
  }

  private async verifyWalletSignature(
    publicKey: string,
    message: string,
    signatureBase64: string,
  ): Promise<boolean> {
    // Stellar wallet signatures are ed25519 over message bytes.
    // FE typically signs a byte array of the message.
    // We assume `signature` is base64 encoded.
    try {
      const publicKeyRawBytes = parseStellarPublicKeyRawBytes(publicKey);
      const msgBytes = Buffer.from(message, 'utf8');
      const sigBytes = Buffer.from(signatureBase64, 'base64');

      // Node's crypto verify with ed25519 (no hash algorithm for ed25519)
      return verifyEd25519Signature(null, msgBytes, publicKeyRawBytes, sigBytes);
    } catch {
      return false;
    }
  }
}

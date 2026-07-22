import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StrKey } from '@stellar/stellar-sdk';
import { verifyAsync } from '@noble/ed25519';
import { createHash } from 'crypto';

const DEFAULT_REPLAY_WINDOW_SECONDS = 300;

function canonicalizeBody(body: unknown): string {
  if (body === null || body === undefined) return '';
  if (typeof body !== 'object' || Array.isArray(body)) return JSON.stringify(body);
  const keys = Object.keys(body as Record<string, unknown>).sort();
  const canonical: Record<string, unknown> = {};
  for (const key of keys) {
    const value = (body as Record<string, unknown>)[key];
    canonical[key] = value !== null && typeof value === 'object' && !Array.isArray(value)
      ? JSON.parse(canonicalizeBody(value))
      : value;
  }
  return JSON.stringify(canonical);
}

@Injectable()
export class StellarAuthGuard implements CanActivate {
  private readonly replayWindowSeconds: number;

  constructor(private readonly configService: ConfigService) {
    this.replayWindowSeconds = this.configService.get<number>(
      'STELLAR_REPLAY_WINDOW_SECONDS',
      DEFAULT_REPLAY_WINDOW_SECONDS,
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const signature = request.headers['x-stellar-signature'] as string | undefined;
    const address = request.headers['x-stellar-address'] as string | undefined;
    const timestamp = request.headers['x-stellar-timestamp'] as string | undefined;

    if (!signature && !address && !timestamp) {
      request.stellarVerified = null;
      return true;
    }

    if (!signature || !address || !timestamp) {
      throw new UnauthorizedException(
        'All X-Stellar-* headers must be provided when using Stellar auth',
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const ts = parseInt(timestamp, 10);
    if (isNaN(ts) || now - ts > this.replayWindowSeconds || ts > now + 5) {
      throw new UnauthorizedException('X-Stellar-Timestamp is outside the accepted window');
    }

    let publicKey: Uint8Array;
    try {
      publicKey = StrKey.decodeEd25519PublicKey(address);
    } catch {
      throw new UnauthorizedException('Invalid X-Stellar-Address');
    }

    const body = request.body ?? {};
    const canonicalBody = canonicalizeBody(body);
    const bodyHash = createHash('sha256').update(canonicalBody, 'utf-8').digest();
    const message = `${timestamp}.${bodyHash.toString('hex')}`;
    const messageBytes = new TextEncoder().encode(message);

    let sigBytes: Uint8Array;
    try {
      sigBytes = Buffer.from(signature, 'hex');
    } catch {
      throw new UnauthorizedException('Invalid X-Stellar-Signature encoding');
    }

    try {
      const valid = await verifyAsync(sigBytes, messageBytes, publicKey);
      if (!valid) {
        throw new UnauthorizedException('X-Stellar-Signature verification failed');
      }
    } catch {
      throw new UnauthorizedException('X-Stellar-Signature verification failed');
    }

    request.stellarVerified = {
      address,
      verifiedAt: new Date(),
    };

    return true;
  }
}

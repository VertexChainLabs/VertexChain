import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { StellarVerified } from '../interfaces/stellar-verified.interface';

export const StellarVerifiedUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): StellarVerified | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.stellarVerified ?? null;
  },
);

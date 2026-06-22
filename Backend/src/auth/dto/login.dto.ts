import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Stellar public key (wallet address) that will be used to verify the signature',
    example: 'GABC...XYZ',
  })
  @IsString()
  @MaxLength(64)
  publicKey: string;

  @ApiProperty({
    description: 'Signature over the server-provided message',
    example: 'MEUCIQD...',
  })
  @IsString()
  signature: string;

  @ApiProperty({
    description: 'Signed message text (must match server expectations)',
    example: 'VertexChain login:\npublicKey=G...\nnonce=...\nissuedAt=...',
  })
  @IsString()
  @MaxLength(2000)
  message: string;

  @ApiProperty({
    description: 'Optional signing scheme',
    enum: ['ed25519'],
    default: 'ed25519',
  })
  @IsString()
  @IsIn(['ed25519'])
  scheme: 'ed25519' = 'ed25519' as const;
}

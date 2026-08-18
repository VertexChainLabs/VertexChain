import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateGistDto {
  @ApiProperty({
    description: 'Corrected gist content (max 280 characters)',
    example: 'Great coffee spot here! (typo fixed)',
    maxLength: 280,
  })
  @IsString()
  @MaxLength(280)
  content: string;

  @ApiPropertyOptional({
    description:
      'Deprecated: the author is now derived from the X-Stellar-* signature headers. This field is accepted for compatibility but ignored.',
    example: 'GABC...XYZ',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  author?: string;
}

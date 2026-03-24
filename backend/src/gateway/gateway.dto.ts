import { IsString, IsNumber, Matches, Min } from 'class-validator';

export class SealIntentDto {
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{64}$/, { message: 'commitmentHash must be a 32-byte hex string' })
  commitmentHash!: `0x${string}`;

  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'token must be a 20-byte address' })
  token!: `0x${string}`;

  @IsNumber()
  @Min(1)
  sourceChain!: number;

  @IsNumber()
  @Min(1)
  targetChainId!: number;

  @IsString()
  @Matches(/^0x[a-fA-F0-9]{64}$/, { message: 'recipientHash must be a 32-byte hex string' })
  recipientHash!: `0x${string}`;

  @IsNumber()
  @Min(0)
  batchWindow!: number;
}

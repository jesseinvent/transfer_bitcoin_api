import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class SendBitcoinDto {
  @IsString()
  @IsNotEmpty()
  senderAddress: string;

  @IsString()
  @IsNotEmpty()
  recieverAddress: string;

  @IsNumber()
  @IsNotEmpty()
  bitcoinToSend: number; // In Bitcoin
}

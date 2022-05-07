import { Body, Controller, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BitcoinService } from './bitcoin.service';
import { SendBitcoinDto } from './dto/sendBitcoin.dto';

@Controller('bitcoin')
export class BitcoinController {
  constructor(
    private bitcoinService: BitcoinService,
    private configService: ConfigService,
  ) {}

  @Post('send')
  async sendBitcoin(@Body() dto: SendBitcoinDto) {
    const senderPrivateKey = this.configService.get(
      'BITCOIN_WALLET_PRIVATE_KEY',
    );
    const result = await this.bitcoinService.sendBitcoin({
      senderAddress: dto.senderAddress,
      senderPrivateKey,
      recieverAddress: dto.recieverAddress,
      bitcoinToSend: dto.bitcoinToSend,
    });

    return { result };
  }
}

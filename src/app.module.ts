import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BitcoinModule } from './bitcoin/bitcoin.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), BitcoinModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

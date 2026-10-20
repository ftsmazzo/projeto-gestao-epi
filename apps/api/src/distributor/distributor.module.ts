import { Module } from '@nestjs/common';
import { StockModule } from '../stock/stock.module';
import { DistributorController } from './distributor.controller';
import { DistributorService } from './distributor.service';

@Module({
  imports: [StockModule],
  controllers: [DistributorController],
  providers: [DistributorService],
})
export class DistributorModule {}

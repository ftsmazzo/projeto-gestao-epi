import { Module } from '@nestjs/common';
import { CaepiModule } from '../caepi/caepi.module';
import { ServedClientsModule } from '../served-clients/served-clients.module';
import { McpApiController } from './mcp-api.controller';
import { McpApiKeyGuard } from './mcp-api-key.guard';
import { McpApiService } from './mcp-api.service';

@Module({
  imports: [ServedClientsModule, CaepiModule],
  controllers: [McpApiController],
  providers: [McpApiService, McpApiKeyGuard],
})
export class McpApiModule {}

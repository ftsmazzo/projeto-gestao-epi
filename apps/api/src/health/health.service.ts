import { Injectable } from '@nestjs/common';
import type { HealthResponse } from '@gestao-epi/shared';

@Injectable()
export class HealthService {
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'gestao-epi-api',
      timestamp: new Date().toISOString(),
    };
  }
}

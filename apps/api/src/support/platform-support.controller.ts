import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { ActivePlatformAdminGuard } from '../auth/active-platform-admin.guard';
import { PlatformJwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/types/jwt-payload';
import {
  PlatformSupportListQueryDto,
  PlatformSupportMessagesQueryDto,
  PlatformSupportReplyDto,
} from './dto/platform-support.dto';
import { PlatformSupportService } from './platform-support.service';

@Controller('platform/support')
@UseGuards(PlatformJwtAuthGuard, ActivePlatformAdminGuard)
export class PlatformSupportController {
  constructor(private readonly support: PlatformSupportService) {}

  @Get('overview')
  @Header('Cache-Control', 'private, no-store')
  overview() {
    return this.support.overview();
  }

  @Get('threads')
  @Header('Cache-Control', 'private, no-store')
  list(@Query() query: PlatformSupportListQueryDto) {
    return this.support.list(query);
  }

  @Get('threads/:id')
  @Header('Cache-Control', 'private, no-store')
  detail(
    @Param('id') id: string,
    @Query() query: PlatformSupportMessagesQueryDto,
  ) {
    return this.support.detail(id, query);
  }

  @Post('threads/:id/claim')
  claim(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.support.claim(user.sub, id);
  }

  @Post('threads/:id/reply')
  reply(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: PlatformSupportReplyDto,
  ) {
    return this.support.reply(user.sub, id, dto.body);
  }

  @Post('threads/:id/resolve')
  resolve(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.support.resolve(user.sub, id);
  }

  @Post('threads/:id/return-ai')
  returnToAi(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.support.returnToAi(user.sub, id);
  }
}

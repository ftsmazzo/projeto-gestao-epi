import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/types/jwt-payload';
import {
  ActivateSubscriptionDto,
  AdjustMonthlyDto,
  GrantLivesDto,
  ReactivateSubscriptionDto,
  ReplaceLifeReducersDto,
  StartTrialDto,
  SuspendSubscriptionDto,
  UpdateLifePricingDto,
} from './dto/subscription.dto';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  overview(@CurrentUser() user: JwtPayload) {
    return this.subscriptions.getOverview(user.organizationId);
  }

  @Get('quote')
  quote(@CurrentUser() user: JwtPayload, @Query('lives') lives: string) {
    return this.subscriptions.previewQuote(
      user.organizationId,
      Number(lives) || 0,
    );
  }

  @Patch('pricing')
  updatePricing(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateLifePricingDto,
  ) {
    return this.subscriptions.updatePricing(
      user.organizationId,
      user.sub,
      user.membershipRole,
      dto,
    );
  }

  @Put('pricing/reducers')
  replaceReducers(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ReplaceLifeReducersDto,
  ) {
    return this.subscriptions.replaceReducers(
      user.organizationId,
      user.sub,
      user.membershipRole,
      dto,
    );
  }

  @Post('clients/:id/trial')
  startTrial(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: StartTrialDto,
  ) {
    return this.subscriptions.startTrial(
      user.organizationId,
      user.sub,
      user.membershipRole,
      id,
      dto,
    );
  }

  @Post('clients/:id/activate')
  activate(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ActivateSubscriptionDto,
  ) {
    return this.subscriptions.activatePaid(
      user.organizationId,
      user.sub,
      user.membershipRole,
      id,
      dto,
    );
  }

  @Post('clients/:id/grant-lives')
  grantLives(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: GrantLivesDto,
  ) {
    return this.subscriptions.grantLives(
      user.organizationId,
      user.sub,
      user.membershipRole,
      id,
      dto,
    );
  }

  @Post('clients/:id/monthly')
  adjustMonthly(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AdjustMonthlyDto,
  ) {
    return this.subscriptions.adjustMonthly(
      user.organizationId,
      user.sub,
      user.membershipRole,
      id,
      dto,
    );
  }

  @Post('clients/:id/past-due')
  markPastDue(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.subscriptions.markPastDue(
      user.organizationId,
      user.sub,
      user.membershipRole,
      id,
    );
  }

  @Post('clients/:id/suspend')
  suspend(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SuspendSubscriptionDto,
  ) {
    return this.subscriptions.suspendForNonPayment(
      user.organizationId,
      user.sub,
      user.membershipRole,
      id,
      dto,
    );
  }

  @Post('clients/:id/reactivate')
  reactivate(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ReactivateSubscriptionDto,
  ) {
    return this.subscriptions.reactivate(
      user.organizationId,
      user.sub,
      user.membershipRole,
      id,
      dto,
    );
  }
}

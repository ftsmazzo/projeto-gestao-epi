import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/types/jwt-payload';
import { DistributorService } from './distributor.service';
import {
  AddDistributorVariantDto,
  CreateDistributorProductDto,
  LinkInboundLineDto,
  ManualDistributorMovementDto,
  UpdateDistributorProductDto,
} from './dto/distributor.dto';

@Controller('distributor')
@UseGuards(JwtAuthGuard)
export class DistributorController {
  constructor(private readonly distributor: DistributorService) {}

  @Get('products')
  listProducts(@CurrentUser() user: JwtPayload) {
    return this.distributor.listProducts(user.organizationId, user.membershipRole);
  }

  @Post('products')
  createProduct(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateDistributorProductDto,
  ) {
    return this.distributor.createProduct(
      user.organizationId,
      user.membershipRole,
      dto,
    );
  }

  @Patch('products/:productId')
  updateProduct(
    @CurrentUser() user: JwtPayload,
    @Param('productId') productId: string,
    @Body() dto: UpdateDistributorProductDto,
  ) {
    return this.distributor.updateProduct(
      user.organizationId,
      user.membershipRole,
      productId,
      dto,
    );
  }

  @Post('products/:productId/variants')
  addVariant(
    @CurrentUser() user: JwtPayload,
    @Param('productId') productId: string,
    @Body() dto: AddDistributorVariantDto,
  ) {
    return this.distributor.addVariant(
      user.organizationId,
      user.membershipRole,
      productId,
      dto,
    );
  }

  @Get('balances')
  balances(@CurrentUser() user: JwtPayload) {
    return this.distributor.listBalances(user.organizationId, user.membershipRole);
  }

  @Get('alerts/low-stock')
  lowStock(@CurrentUser() user: JwtPayload) {
    return this.distributor.listLowStock(user.organizationId, user.membershipRole);
  }

  @Get('ca/:caNumber')
  lookupCa(
    @CurrentUser() user: JwtPayload,
    @Param('caNumber') caNumber: string,
  ) {
    return this.distributor.lookupCa(
      user.organizationId,
      user.membershipRole,
      caNumber,
    );
  }

  @Post('movements')
  move(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ManualDistributorMovementDto,
  ) {
    return this.distributor.move(
      user.organizationId,
      user.membershipRole,
      user.sub,
      dto,
    );
  }

  @Post('inbound/extract')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }),
  )
  extract(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.distributor.extractInbound(
      user.organizationId,
      user.membershipRole,
      user.sub,
      file,
    );
  }

  @Get('inbound/:documentId')
  getInbound(
    @CurrentUser() user: JwtPayload,
    @Param('documentId') documentId: string,
  ) {
    return this.distributor.getInbound(
      user.organizationId,
      user.membershipRole,
      documentId,
    );
  }

  @Patch('inbound/:documentId/lines/:lineId')
  linkLine(
    @CurrentUser() user: JwtPayload,
    @Param('documentId') documentId: string,
    @Param('lineId') lineId: string,
    @Body() dto: LinkInboundLineDto,
  ) {
    return this.distributor.linkLine(
      user.organizationId,
      user.membershipRole,
      documentId,
      lineId,
      dto.variantId,
    );
  }

  @Post('inbound/:documentId/confirm')
  confirm(
    @CurrentUser() user: JwtPayload,
    @Param('documentId') documentId: string,
  ) {
    return this.distributor.confirmInbound(
      user.organizationId,
      user.membershipRole,
      user.sub,
      documentId,
    );
  }

  @Post('inbound/:documentId/discard')
  discard(
    @CurrentUser() user: JwtPayload,
    @Param('documentId') documentId: string,
  ) {
    return this.distributor.discardInbound(
      user.organizationId,
      user.membershipRole,
      documentId,
    );
  }
}

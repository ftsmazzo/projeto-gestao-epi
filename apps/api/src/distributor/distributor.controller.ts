import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
  CreatePurchaseOrderDto,
  CreateQuoteDto,
  ManualDistributorMovementDto,
  RejectPurchaseOrderDto,
  SetSellerCeilingDto,
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
      dto.lotCode !== undefined || dto.expiresOn !== undefined
        ? { lotCode: dto.lotCode, expiresOn: dto.expiresOn }
        : undefined,
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

  @Get('purchase-orders')
  listPurchaseOrders(@CurrentUser() user: JwtPayload) {
    return this.distributor.listPurchaseOrders(
      user.organizationId,
      user.membershipRole,
    );
  }

  @Post('purchase-orders')
  createPurchaseOrder(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePurchaseOrderDto,
  ) {
    return this.distributor.createPurchaseOrder(
      user.organizationId,
      user.membershipRole,
      user.sub,
      dto,
    );
  }

  @Post('purchase-orders/:orderId/first-release')
  firstRelease(
    @CurrentUser() user: JwtPayload,
    @Param('orderId') orderId: string,
  ) {
    return this.distributor.releasePurchaseOrder(
      user.organizationId,
      user.membershipRole,
      user.sub,
      orderId,
      1,
    );
  }

  @Post('purchase-orders/:orderId/second-release')
  secondRelease(
    @CurrentUser() user: JwtPayload,
    @Param('orderId') orderId: string,
  ) {
    return this.distributor.releasePurchaseOrder(
      user.organizationId,
      user.membershipRole,
      user.sub,
      orderId,
      2,
    );
  }

  @Post('purchase-orders/:orderId/reject')
  rejectPurchaseOrder(
    @CurrentUser() user: JwtPayload,
    @Param('orderId') orderId: string,
    @Body() dto: RejectPurchaseOrderDto,
  ) {
    return this.distributor.rejectPurchaseOrder(
      user.organizationId,
      user.membershipRole,
      user.sub,
      orderId,
      dto.note,
    );
  }

  @Post('purchase-orders/:orderId/receive')
  receivePurchaseOrder(
    @CurrentUser() user: JwtPayload,
    @Param('orderId') orderId: string,
  ) {
    return this.distributor.receivePurchaseOrder(
      user.organizationId,
      user.membershipRole,
      user.sub,
      orderId,
    );
  }

  @Get('sellers')
  listSellers(@CurrentUser() user: JwtPayload) {
    return this.distributor.listSellers(user.organizationId, user.membershipRole);
  }

  @Post('sellers/ceiling')
  setSellerCeiling(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SetSellerCeilingDto,
  ) {
    return this.distributor.setSellerCeiling(
      user.organizationId,
      user.membershipRole,
      dto,
    );
  }

  @Get('quotes')
  listQuotes(@CurrentUser() user: JwtPayload) {
    return this.distributor.listQuotes(user.organizationId, user.membershipRole);
  }

  @Post('quotes')
  createQuote(@CurrentUser() user: JwtPayload, @Body() dto: CreateQuoteDto) {
    return this.distributor.createQuote(
      user.organizationId,
      user.membershipRole,
      user.sub,
      dto,
    );
  }

  @Post('quotes/:quoteId/approve')
  approveQuote(
    @CurrentUser() user: JwtPayload,
    @Param('quoteId') quoteId: string,
  ) {
    return this.distributor.approveQuote(
      user.organizationId,
      user.membershipRole,
      user.sub,
      quoteId,
    );
  }

  @Post('quotes/:quoteId/reject')
  rejectQuote(
    @CurrentUser() user: JwtPayload,
    @Param('quoteId') quoteId: string,
  ) {
    return this.distributor.rejectQuote(
      user.organizationId,
      user.membershipRole,
      user.sub,
      quoteId,
    );
  }

  @Get('quotes/discount-report')
  discountReport(
    @CurrentUser() user: JwtPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.distributor.discountReport(
      user.organizationId,
      user.membershipRole,
      from,
      to,
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

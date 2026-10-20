import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
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
  SaveDistributorFiscalDto,
  CreateBankAccountDto,
  CreateCashMovementDto,
  CreateDistributorCustomerDto,
  CreateDistributorVisitDto,
  CreateFieldQuoteDto,
  CreateLedgerAccountDto,
  CreateOutboundFromQuoteDto,
  CreatePayableDto,
  CreatePlusContractDto,
  CreatePurchaseOrderDto,
  CreateQuoteDto,
  CreateReceivableDto,
  ManualDistributorMovementDto,
  RejectPurchaseOrderDto,
  SetSellerCeilingDto,
  SettleWithBankDto,
  UpdateDistributorProductDto,
  UpsertPlusMappingDto,
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

  @Get('fiscal')
  fiscalProfile(@CurrentUser() user: JwtPayload) {
    return this.distributor.getFiscalProfile(user.organizationId, user.membershipRole);
  }

  @Put('fiscal')
  saveFiscal(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SaveDistributorFiscalDto,
  ) {
    return this.distributor.saveFiscalProfile(
      user.organizationId,
      user.membershipRole,
      dto,
    );
  }

  @Post('fiscal/certificate')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 1_000_000 } }))
  storeCertificate(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body('password') password?: string,
  ) {
    return this.distributor.storeFiscalCertificate(
      user.organizationId,
      user.membershipRole,
      file,
      password,
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

  @Get('sellers/me')
  mySellerCeiling(@CurrentUser() user: JwtPayload) {
    return this.distributor.mySellerCeiling(
      user.organizationId,
      user.membershipRole,
      user.sub,
    );
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

  @Post('field-quotes')
  createFieldQuote(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateFieldQuoteDto,
  ) {
    return this.distributor.createFieldQuote(
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

  @Get('outbound')
  listOutbound(@CurrentUser() user: JwtPayload) {
    return this.distributor.listOutboundInvoices(
      user.organizationId,
      user.membershipRole,
    );
  }

  @Post('outbound/from-quote')
  createOutboundFromQuote(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateOutboundFromQuoteDto,
  ) {
    return this.distributor.createOutboundFromQuote(
      user.organizationId,
      user.membershipRole,
      user.sub,
      dto,
    );
  }

  @Post('outbound/:invoiceId/confirm')
  confirmOutbound(
    @CurrentUser() user: JwtPayload,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.distributor.confirmOutboundInvoice(
      user.organizationId,
      user.membershipRole,
      user.sub,
      invoiceId,
    );
  }

  @Post('outbound/:invoiceId/authorize')
  authorizeOutbound(
    @CurrentUser() user: JwtPayload,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.distributor.authorizeOutboundInvoice(
      user.organizationId,
      user.membershipRole,
      invoiceId,
    );
  }

  @Post('outbound/:invoiceId/cancel')
  cancelOutbound(
    @CurrentUser() user: JwtPayload,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.distributor.cancelOutboundInvoice(
      user.organizationId,
      user.membershipRole,
      invoiceId,
    );
  }

  @Get('payables')
  listPayables(@CurrentUser() user: JwtPayload) {
    return this.distributor.listPayables(
      user.organizationId,
      user.membershipRole,
    );
  }

  @Post('payables')
  createPayable(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePayableDto,
  ) {
    return this.distributor.createPayable(
      user.organizationId,
      user.membershipRole,
      user.sub,
      dto,
    );
  }

  @Post('payables/:payableId/pay')
  markPayablePaid(
    @CurrentUser() user: JwtPayload,
    @Param('payableId') payableId: string,
    @Body() dto: SettleWithBankDto,
  ) {
    return this.distributor.markPayablePaid(
      user.organizationId,
      user.membershipRole,
      user.sub,
      payableId,
      dto,
    );
  }

  @Post('payables/:payableId/cancel')
  cancelPayable(
    @CurrentUser() user: JwtPayload,
    @Param('payableId') payableId: string,
  ) {
    return this.distributor.cancelPayable(
      user.organizationId,
      user.membershipRole,
      payableId,
    );
  }

  @Get('receivables')
  listReceivables(@CurrentUser() user: JwtPayload) {
    return this.distributor.listReceivables(
      user.organizationId,
      user.membershipRole,
    );
  }

  @Post('receivables')
  createReceivable(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateReceivableDto,
  ) {
    return this.distributor.createReceivable(
      user.organizationId,
      user.membershipRole,
      user.sub,
      dto,
    );
  }

  @Post('receivables/:receivableId/receive')
  markReceivableReceived(
    @CurrentUser() user: JwtPayload,
    @Param('receivableId') receivableId: string,
    @Body() dto: SettleWithBankDto,
  ) {
    return this.distributor.markReceivableReceived(
      user.organizationId,
      user.membershipRole,
      user.sub,
      receivableId,
      dto,
    );
  }

  @Post('receivables/:receivableId/cancel')
  cancelReceivable(
    @CurrentUser() user: JwtPayload,
    @Param('receivableId') receivableId: string,
  ) {
    return this.distributor.cancelReceivable(
      user.organizationId,
      user.membershipRole,
      receivableId,
    );
  }

  @Get('ledger')
  listLedger(@CurrentUser() user: JwtPayload) {
    return this.distributor.listLedgerAccounts(
      user.organizationId,
      user.membershipRole,
    );
  }

  @Post('ledger')
  createLedger(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateLedgerAccountDto,
  ) {
    return this.distributor.createLedgerAccount(
      user.organizationId,
      user.membershipRole,
      dto,
    );
  }

  @Get('finance/summary')
  financeSummary(@CurrentUser() user: JwtPayload) {
    return this.distributor.financeSummary(
      user.organizationId,
      user.membershipRole,
    );
  }

  @Get('banks')
  listBanks(@CurrentUser() user: JwtPayload) {
    return this.distributor.listBankAccounts(
      user.organizationId,
      user.membershipRole,
    );
  }

  @Post('banks')
  createBank(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateBankAccountDto,
  ) {
    return this.distributor.createBankAccount(
      user.organizationId,
      user.membershipRole,
      user.sub,
      dto,
    );
  }

  @Get('cash-movements')
  listCashMovements(
    @CurrentUser() user: JwtPayload,
    @Query('bankAccountId') bankAccountId?: string,
    @Query('unreconciledOnly') unreconciledOnly?: string,
  ) {
    return this.distributor.listCashMovements(
      user.organizationId,
      user.membershipRole,
      {
        bankAccountId,
        unreconciledOnly:
          unreconciledOnly === '1' || unreconciledOnly === 'true',
      },
    );
  }

  @Post('cash-movements')
  createCashMovement(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateCashMovementDto,
  ) {
    return this.distributor.createCashMovement(
      user.organizationId,
      user.membershipRole,
      user.sub,
      dto,
    );
  }

  @Post('cash-movements/:movementId/reconcile')
  reconcileCashMovement(
    @CurrentUser() user: JwtPayload,
    @Param('movementId') movementId: string,
  ) {
    return this.distributor.setCashMovementReconciled(
      user.organizationId,
      user.membershipRole,
      user.sub,
      movementId,
      true,
    );
  }

  @Post('cash-movements/:movementId/unreconcile')
  unreconcileCashMovement(
    @CurrentUser() user: JwtPayload,
    @Param('movementId') movementId: string,
  ) {
    return this.distributor.setCashMovementReconciled(
      user.organizationId,
      user.membershipRole,
      user.sub,
      movementId,
      false,
    );
  }

  @Get('cash-flow')
  cashFlow(
    @CurrentUser() user: JwtPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('bankAccountId') bankAccountId?: string,
  ) {
    return this.distributor.cashFlowReport(
      user.organizationId,
      user.membershipRole,
      from,
      to,
      bankAccountId,
    );
  }

  @Get('customers')
  listCustomers(
    @CurrentUser() user: JwtPayload,
    @Query('q') q?: string,
  ) {
    return this.distributor.listCustomers(
      user.organizationId,
      user.membershipRole,
      q,
    );
  }

  @Post('customers')
  createCustomer(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateDistributorCustomerDto,
  ) {
    return this.distributor.createCustomer(
      user.organizationId,
      user.membershipRole,
      dto,
    );
  }

  @Get('customers/:customerId')
  customerHistory(
    @CurrentUser() user: JwtPayload,
    @Param('customerId') customerId: string,
  ) {
    return this.distributor.customerHistory(
      user.organizationId,
      user.membershipRole,
      customerId,
    );
  }

  @Get('visits')
  listVisits(
    @CurrentUser() user: JwtPayload,
    @Query('customerId') customerId?: string,
    @Query('sellerUserId') sellerUserId?: string,
  ) {
    return this.distributor.listVisits(
      user.organizationId,
      user.membershipRole,
      { customerId, sellerUserId },
    );
  }

  @Post('visits')
  createVisit(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateDistributorVisitDto,
  ) {
    return this.distributor.createVisit(
      user.organizationId,
      user.membershipRole,
      user.sub,
      dto,
    );
  }

  @Get('plus/preview')
  previewPlus(
    @CurrentUser() user: JwtPayload,
    @Query('cnpj') cnpj: string,
  ) {
    return this.distributor.previewPlusClient(
      user.organizationId,
      user.membershipRole,
      cnpj ?? '',
    );
  }

  @Get('plus/contracts')
  listPlusContracts(@CurrentUser() user: JwtPayload) {
    return this.distributor.listPlusContracts(
      user.organizationId,
      user.membershipRole,
    );
  }

  @Post('plus/contracts')
  createPlusContract(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePlusContractDto,
  ) {
    return this.distributor.createPlusContract(
      user.organizationId,
      user.membershipRole,
      user.sub,
      dto,
    );
  }

  @Post('plus/contracts/:contractId/revoke')
  revokePlusContract(
    @CurrentUser() user: JwtPayload,
    @Param('contractId') contractId: string,
  ) {
    return this.distributor.revokePlusContract(
      user.organizationId,
      user.membershipRole,
      user.sub,
      contractId,
    );
  }

  @Get('plus/contracts/:contractId/mappings')
  listPlusMappings(
    @CurrentUser() user: JwtPayload,
    @Param('contractId') contractId: string,
  ) {
    return this.distributor.listPlusMappings(
      user.organizationId,
      user.membershipRole,
      contractId,
    );
  }

  @Put('plus/contracts/:contractId/mappings')
  upsertPlusMapping(
    @CurrentUser() user: JwtPayload,
    @Param('contractId') contractId: string,
    @Body() dto: UpsertPlusMappingDto,
  ) {
    return this.distributor.upsertPlusMapping(
      user.organizationId,
      user.membershipRole,
      contractId,
      dto,
    );
  }

  @Get('plus/contracts/:contractId/catalog')
  listPlusCatalog(
    @CurrentUser() user: JwtPayload,
    @Param('contractId') contractId: string,
    @Query('q') q?: string,
  ) {
    return this.distributor.listPlusCatalog(
      user.organizationId,
      user.membershipRole,
      contractId,
      q,
    );
  }

  @Get('plus/shipments')
  listPlusShipments(
    @CurrentUser() user: JwtPayload,
    @Query('contractId') contractId?: string,
  ) {
    return this.distributor.listPlusShipments(
      user.organizationId,
      user.membershipRole,
      contractId,
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

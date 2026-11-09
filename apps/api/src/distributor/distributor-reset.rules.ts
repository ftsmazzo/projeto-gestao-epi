import type { Prisma } from '@prisma/client';

export type DistributorResetSummary = {
  products: number;
  movements: number;
  inboundDocuments: number;
  purchaseOrders: number;
  quotes: number;
  outboundInvoices: number;
  payables: number;
  receivables: number;
  customers: number;
  suppliers: number;
  visits: number;
  plusContracts: number;
  cashMovements: number;
  bankAccounts: number;
  ledgerAccounts: number;
};

type Tx = Prisma.TransactionClient;

/** Apaga operacao da distribuidora. Mantem org, usuarios, marca e perfil fiscal. */
export async function wipeDistributorOperationalData(
  tx: Tx,
  organizationId: string,
): Promise<DistributorResetSummary> {
  const summary: DistributorResetSummary = {
    products: await tx.distributorProduct.count({ where: { organizationId } }),
    movements: await tx.distributorMovement.count({
      where: { variant: { product: { organizationId } } },
    }),
    inboundDocuments: await tx.distributorInboundDocument.count({
      where: { organizationId },
    }),
    purchaseOrders: await tx.distributorPurchaseOrder.count({
      where: { organizationId },
    }),
    quotes: await tx.distributorQuote.count({ where: { organizationId } }),
    outboundInvoices: await tx.distributorOutboundInvoice.count({
      where: { organizationId },
    }),
    payables: await tx.distributorPayable.count({ where: { organizationId } }),
    receivables: await tx.distributorReceivable.count({
      where: { organizationId },
    }),
    customers: await tx.distributorCustomer.count({ where: { organizationId } }),
    suppliers: await tx.distributorSupplier.count({ where: { organizationId } }),
    visits: await tx.distributorVisit.count({ where: { organizationId } }),
    plusContracts: await tx.distributorPlusContract.count({
      where: { organizationId },
    }),
    cashMovements: await tx.distributorCashMovement.count({
      where: { bankAccount: { organizationId } },
    }),
    bankAccounts: await tx.distributorBankAccount.count({
      where: { organizationId },
    }),
    ledgerAccounts: await tx.distributorLedgerAccount.count({
      where: { organizationId },
    }),
  };

  await tx.distributorCashMovement.deleteMany({
    where: { bankAccount: { organizationId } },
  });
  await tx.distributorPayable.deleteMany({ where: { organizationId } });
  await tx.distributorReceivable.deleteMany({ where: { organizationId } });

  await tx.distributorPlusShipmentLine.deleteMany({
    where: { shipment: { contract: { organizationId } } },
  });
  await tx.distributorPlusShipment.deleteMany({
    where: { contract: { organizationId } },
  });
  await tx.distributorPlusMapping.deleteMany({
    where: { contract: { organizationId } },
  });
  await tx.distributorPlusContract.deleteMany({ where: { organizationId } });

  await tx.distributorOutboundLine.deleteMany({
    where: { invoice: { organizationId } },
  });
  await tx.distributorMovement.deleteMany({
    where: { outboundInvoice: { organizationId } },
  });
  await tx.distributorOutboundInvoice.deleteMany({ where: { organizationId } });

  await tx.distributorVisit.deleteMany({ where: { organizationId } });
  await tx.distributorQuoteLine.deleteMany({
    where: { quote: { organizationId } },
  });
  await tx.distributorQuote.deleteMany({ where: { organizationId } });

  await tx.distributorPurchaseLine.deleteMany({
    where: { order: { organizationId } },
  });
  await tx.distributorMovement.deleteMany({
    where: { purchaseOrder: { organizationId } },
  });
  await tx.distributorPurchaseOrder.deleteMany({ where: { organizationId } });

  await tx.distributorInboundLine.deleteMany({
    where: { document: { organizationId } },
  });
  await tx.distributorMovement.deleteMany({
    where: { document: { organizationId } },
  });
  await tx.distributorInboundDocument.deleteMany({ where: { organizationId } });

  await tx.distributorMovement.deleteMany({
    where: { variant: { product: { organizationId } } },
  });
  await tx.distributorLot.deleteMany({
    where: { variant: { product: { organizationId } } },
  });
  await tx.distributorBalance.deleteMany({
    where: { variant: { product: { organizationId } } },
  });
  await tx.distributorProduct.deleteMany({ where: { organizationId } });

  await tx.distributorCustomer.deleteMany({ where: { organizationId } });
  await tx.distributorSupplier.deleteMany({ where: { organizationId } });
  await tx.distributorLedgerAccount.deleteMany({ where: { organizationId } });
  await tx.distributorBankAccount.deleteMany({ where: { organizationId } });

  return summary;
}

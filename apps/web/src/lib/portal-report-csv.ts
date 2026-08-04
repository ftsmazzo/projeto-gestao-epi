import type {
  PortalReportsActivityResponse,
  PortalReportsCoverageResponse,
  PortalReportsDeliveriesResponse,
  PortalReportsOverviewResponse,
  PortalReportsReplacementsResponse,
  PortalReportsReturnsResponse,
  PortalReportsStockResponse,
} from '@gestao-epi/shared';
import { downloadCsvText } from './epis';

function csvEscape(value: string | number | boolean | null | undefined): string {
  const raw = value == null ? '' : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function toCsv(headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>) {
  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => row.map(csvEscape).join(',')),
  ];
  // BOM ajuda Excel a abrir UTF-8
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

export function exportOverviewCsv(data: PortalReportsOverviewResponse) {
  const csv = toCsv(
    ['indicador', 'valor', 'periodo_de', 'periodo_ate'],
    [
      ['entregas', data.cards.deliveriesInPeriod, data.period.from, data.period.to],
      ['itens_entregues', data.cards.itemsDelivered, data.period.from, data.period.to],
      ['devolucoes', data.cards.returnsInPeriod, data.period.from, data.period.to],
      [
        'cancelamentos',
        data.cards.cancellationsInPeriod,
        data.period.from,
        data.period.to,
      ],
      ['trabalhadores_ativos', data.cards.workersActive, data.period.from, data.period.to],
      [
        'necessidades_sem_epi_real',
        data.cards.needsWithoutLinkedEpi,
        data.period.from,
        data.period.to,
      ],
      [
        'necessidades_sem_estoque',
        data.cards.needsWithoutStock,
        data.period.from,
        data.period.to,
      ],
      [
        'estoque_baixo_ou_zerado',
        data.cards.stockLowOrZero,
        data.period.from,
        data.period.to,
      ],
      ['estoque_baixo', data.cards.stockLow, data.period.from, data.period.to],
      ['estoque_zerado', data.cards.stockZero, data.period.from, data.period.to],
    ],
  );
  downloadCsvText(`relatorio-visao-geral-${stamp()}.csv`, csv);
}

export function exportDeliveriesCsv(data: PortalReportsDeliveriesResponse) {
  const csv = toCsv(
    [
      'data',
      'recibo',
      'trabalhador',
      'matricula',
      'unidade',
      'setor',
      'funcao',
      'itens',
      'qtd_itens',
      'status',
      'operador',
      'evidencia_facial',
      'entrega_id',
    ],
    data.rows.map((row) => [
      row.deliveredAt,
      row.receiptNumber,
      row.worker.name,
      row.worker.registration,
      row.worker.unitName,
      row.worker.sectorName,
      row.worker.jobFunctionName,
      row.itemsSummary,
      row.itemCount,
      row.statusLabel,
      row.operatorName,
      row.hasFacialEvidence ? 'sim' : 'nao',
      row.id,
    ]),
  );
  downloadCsvText(`relatorio-entregas-${stamp()}.csv`, csv);
}

export function exportStockCsv(data: PortalReportsStockResponse) {
  const csv = toCsv(
    [
      'epi',
      'categoria',
      'ca',
      'validade_ca',
      'necessidades',
      'local',
      'saldo',
      'minimo',
      'status',
    ],
    data.rows.map((row) => [
      row.epiName,
      row.category,
      row.caNumber,
      row.caExpiresAt,
      row.needsLabel,
      row.locationName,
      row.quantity,
      row.minQuantity,
      row.statusLabel,
    ]),
  );
  downloadCsvText(`relatorio-estoque-${stamp()}.csv`, csv);
}

export function exportReturnsCsv(data: PortalReportsReturnsResponse) {
  const csv = toCsv(
    [
      'data',
      'tipo',
      'recibo',
      'trabalhador',
      'matricula',
      'item',
      'quantidade',
      'condicao',
      'retornou_estoque',
      'motivo',
      'operador',
      'entrega_id',
    ],
    data.rows.map((row) => [
      row.at,
      row.typeLabel,
      row.receiptNumber,
      row.workerName,
      row.workerRegistration,
      row.itemLabel,
      row.quantity,
      row.condition,
      row.returnedToStock == null
        ? ''
        : row.returnedToStock
          ? 'sim'
          : 'nao',
      row.reason,
      row.operatorName,
      row.deliveryId,
    ]),
  );
  downloadCsvText(`relatorio-devolucoes-${stamp()}.csv`, csv);
}

export function exportCoverageCsv(data: PortalReportsCoverageResponse) {
  const rows: Array<Array<string | number | boolean | null | undefined>> = [];
  for (const job of data.byJobFunction) {
    for (const need of job.needs) {
      rows.push([
        job.jobFunctionName,
        job.sectorName,
        need.needName,
        need.risks.map((r) => r.name).join('; '),
        need.linkedEpiCount,
        need.availableStock,
        need.statusLabel,
        need.warnings.join('; '),
        need.isRequired ? 'sim' : 'nao',
        need.quantity,
        need.replacementIntervalDays,
      ]);
    }
  }
  const csv = toCsv(
    [
      'funcao',
      'setor',
      'necessidade',
      'riscos',
      'epis_vinculados',
      'estoque_disponivel',
      'status',
      'avisos',
      'obrigatoria',
      'quantidade',
      'intervalo_reposicao_dias',
    ],
    rows,
  );
  downloadCsvText(`relatorio-cobertura-${stamp()}.csv`, csv);
}

export function exportReplacementsCsv(data: PortalReportsReplacementsResponse) {
  const csv = toCsv(
    [
      'prioridade',
      'dias_restantes',
      'proxima_troca',
      'trabalhador',
      'matricula',
      'unidade',
      'setor',
      'funcao',
      'epi',
      'necessidade',
      'ca',
      'vida_util',
      'recibo',
      'entrega_id',
    ],
    data.rows.map((row) => [
      row.toneLabel,
      row.daysRemaining,
      row.nextReplacementAt,
      row.workerName,
      row.workerRegistration,
      row.unitName,
      row.sectorName,
      row.jobFunctionName,
      row.epiName,
      row.needName,
      row.caNumber,
      row.usefulLifeLabel,
      row.receiptNumber,
      row.deliveryId,
    ]),
  );
  downloadCsvText(`relatorio-trocas-${stamp()}.csv`, csv);
}

export function exportActivityCsv(data: PortalReportsActivityResponse) {
  const workerCsv = toCsv(
    [
      'trabalhador',
      'matricula',
      'unidade',
      'setor',
      'funcao',
      'entregas',
      'itens',
      'com_facial',
      'taxa_facial_pct',
    ],
    data.byWorker.map((row) => [
      row.workerName,
      row.registration,
      row.unitName,
      row.sectorName,
      row.jobFunctionName,
      row.deliveries,
      row.itemsDelivered,
      row.withFacial,
      row.facialRate,
    ]),
  );
  downloadCsvText(`relatorio-atividade-trabalhadores-${stamp()}.csv`, workerCsv);

  const sectorCsv = toCsv(
    ['setor', 'entregas', 'itens'],
    data.bySector.map((row) => [
      row.sectorName,
      row.deliveries,
      row.itemsDelivered,
    ]),
  );
  downloadCsvText(`relatorio-atividade-setores-${stamp()}.csv`, sectorCsv);
}

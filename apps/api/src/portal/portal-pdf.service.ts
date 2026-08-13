import { Injectable } from '@nestjs/common';
import {
  EPI_LEGAL_DECLARATION,
  formatEpiLegalDeclarationPlain,
  type PortalDeliveryDetail,
  type PortalWorkerEpiSheetResponse,
} from '@gestao-epi/shared';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import PDFDocument from 'pdfkit';

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });
  } catch {
    return iso;
  }
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });
  } catch {
    return iso;
  }
}

function formatCnpj(digits: string) {
  const d = digits.replace(/\D/g, '');
  if (d.length !== 14) return digits;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function bufferFromPdf(
  build: (doc: PDFKit.PDFDocument) => void | Promise<void>,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 48,
      info: {
        Title: 'ProntEPI',
        Author: 'ProntEPI',
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    Promise.resolve(build(doc))
      .then(() => doc.end())
      .catch(reject);
  });
}

function ensureSpace(doc: PDFKit.PDFDocument, needed = 72) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string) {
  ensureSpace(doc, 36);
  doc.moveDown(0.4);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111').text(title);
  doc
    .moveTo(doc.page.margins.left, doc.y + 2)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y + 2)
    .strokeColor('#cccccc')
    .lineWidth(0.5)
    .stroke();
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(9).fillColor('#222');
}

function kv(doc: PDFKit.PDFDocument, label: string, value: string) {
  ensureSpace(doc, 16);
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#444')
    .text(`${label}: `, { continued: true });
  doc.font('Helvetica').fillColor('#111').text(value || '—');
}

@Injectable()
export class PortalPdfService {
  async buildDeliveryReceiptPdf(
    detail: PortalDeliveryDetail,
    evidenceAbsolutePath?: string | null,
  ): Promise<Buffer> {
    return bufferFromPdf(async (doc) => {
      doc
        .font('Helvetica-Bold')
        .fontSize(16)
        .fillColor('#111')
        .text('Comprovante de entrega de EPI');
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#555')
        .text(`Recibo ${detail.receiptNumber} · ${detail.statusLabel}`);
      doc.text(`Emitido em ${formatDateTime(new Date().toISOString())}`);

      sectionTitle(doc, 'Empresa');
      kv(doc, 'Razao social', detail.client.legalName);
      if (detail.client.tradeName) {
        kv(doc, 'Nome fantasia', detail.client.tradeName);
      }
      kv(doc, 'CNPJ', formatCnpj(detail.client.cnpj));

      sectionTitle(doc, 'Trabalhador');
      kv(doc, 'Nome', detail.worker.name);
      if (detail.worker.registration) {
        kv(doc, 'Matricula', detail.worker.registration);
      }
      if (detail.worker.cpfMasked) {
        kv(doc, 'CPF', detail.worker.cpfMasked);
      }
      const estrutura = [
        detail.worker.unitName,
        detail.worker.sectorName,
        detail.worker.jobFunctionName,
      ]
        .filter(Boolean)
        .join(' / ');
      if (estrutura) kv(doc, 'Estrutura', estrutura);

      sectionTitle(doc, 'Entrega');
      kv(doc, 'Data/hora', formatDateTime(detail.deliveredAt));
      kv(
        doc,
        'Responsavel',
        `${detail.deliveredBy.name} (${detail.deliveredBy.email})`,
      );
      if (detail.notes) kv(doc, 'Observacoes', detail.notes);

      sectionTitle(doc, 'Itens');
      for (const item of detail.items) {
        ensureSpace(doc, 48);
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#111')
          .text(`${item.needName} — ${item.epiName}`);
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#333')
          .text(
            [
              item.caNumber ? `CA ${item.caNumber}` : null,
              `Qtd ${item.quantity}`,
              item.returnedQuantity
                ? `Devolvido ${item.returnedQuantity}`
                : null,
              item.statusLabel,
              item.locationName ? `Local ${item.locationName}` : null,
              item.nextReplacementAt
                ? `Proxima troca ${formatDate(item.nextReplacementAt)}`
                : null,
            ]
              .filter(Boolean)
              .join(' · '),
          );
        doc.moveDown(0.35);
      }

      if (detail.evidence) {
        sectionTitle(doc, 'Evidencia facial');
        kv(doc, 'Metodo', detail.evidence.method);
        kv(doc, 'Status', detail.evidence.statusLabel);
        kv(doc, 'Capturada em', formatDateTime(detail.evidence.capturedAt));
        if (
          evidenceAbsolutePath &&
          existsSync(evidenceAbsolutePath) &&
          detail.evidence.hasFile
        ) {
          try {
            const img = await readFile(evidenceAbsolutePath);
            ensureSpace(doc, 140);
            doc.image(img, {
              fit: [120, 120],
            });
            doc.moveDown(0.5);
          } catch {
            doc
              .font('Helvetica')
              .fontSize(8)
              .fillColor('#666')
              .text('(Thumbnail indisponivel neste PDF.)');
          }
        }
      }

      sectionTitle(doc, 'Termo de responsabilidade');
      const declarationText =
        detail.declaration?.text?.trim() ||
        formatEpiLegalDeclarationPlain(EPI_LEGAL_DECLARATION);
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#222')
        .text(declarationText, { align: 'justify', lineGap: 2 });
      if (detail.declaration?.version) {
        doc.moveDown(0.3);
        doc
          .font('Helvetica')
          .fontSize(7)
          .fillColor('#777')
          .text(`Versao do termo: ${detail.declaration.version}`);
      }

      doc.moveDown(1);
      ensureSpace(doc, 48);
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#444')
        .text(
          'Documento gerado pelo ProntEPI. A impressao pelo navegador permanece disponivel como alternativa.',
        );
    });
  }

  async buildWorkerEpiSheetPdf(
    sheet: PortalWorkerEpiSheetResponse,
  ): Promise<Buffer> {
    return bufferFromPdf(async (doc) => {
      doc
        .font('Helvetica-Bold')
        .fontSize(16)
        .fillColor('#111')
        .text('Ficha individual de EPI');
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#555')
        .text(`Gerada em ${formatDateTime(sheet.generatedAt)}`);

      const periodParts: string[] = [];
      if (sheet.period.from) {
        periodParts.push(`de ${formatDate(`${sheet.period.from}T00:00:00.000Z`)}`);
      }
      if (sheet.period.to) {
        periodParts.push(`ate ${formatDate(`${sheet.period.to}T00:00:00.000Z`)}`);
      }
      kv(
        doc,
        'Periodo',
        periodParts.length ? periodParts.join(' ') : 'Todo o historico',
      );

      sectionTitle(doc, 'Empresa');
      kv(doc, 'Razao social', sheet.client.legalName);
      if (sheet.client.tradeName) {
        kv(doc, 'Nome fantasia', sheet.client.tradeName);
      }
      kv(doc, 'CNPJ', formatCnpj(sheet.client.cnpj));

      sectionTitle(doc, 'Trabalhador');
      kv(doc, 'Nome', sheet.worker.name);
      if (sheet.worker.registration) {
        kv(doc, 'Matricula', sheet.worker.registration);
      }
      if (sheet.worker.cpfMasked) {
        kv(doc, 'CPF', sheet.worker.cpfMasked);
      }
      const estrutura = [
        sheet.worker.unitName,
        sheet.worker.sectorName,
        sheet.worker.jobFunctionName,
      ]
        .filter(Boolean)
        .join(' / ');
      if (estrutura) kv(doc, 'Estrutura', estrutura);
      kv(doc, 'Status', sheet.worker.status === 'ACTIVE' ? 'Ativo' : 'Inativo');

      sectionTitle(doc, 'Resumo');
      kv(doc, 'Entregas', String(sheet.summary.deliveryCount));
      kv(doc, 'Itens', String(sheet.summary.itemCount));

      sectionTitle(doc, 'Historico de entregas');
      if (sheet.deliveries.length === 0) {
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#555')
          .text('Nenhuma entrega no periodo/filtro selecionado.');
      }

      for (const delivery of sheet.deliveries) {
        ensureSpace(doc, 56);
        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor('#111')
          .text(
            `${delivery.receiptNumber} · ${formatDateTime(delivery.deliveredAt)}`,
          );
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#444')
          .text(delivery.statusLabel);
        for (const item of delivery.items) {
          doc
            .font('Helvetica')
            .fontSize(8)
            .fillColor('#222')
            .text(
              `• ${item.needName} — ${item.epiName}` +
                (item.caNumber ? ` (CA ${item.caNumber})` : '') +
                ` · Qtd ${item.quantity}` +
                (item.returnedQuantity
                  ? ` · Dev. ${item.returnedQuantity}`
                  : '') +
                (item.usefulLifeLabel
                  ? ` · Vida util ${item.usefulLifeLabel}`
                  : '') +
                (item.remainingLabel ? ` · ${item.remainingLabel}` : '') +
                ` · ${item.statusLabel}`,
            );
        }
        if (delivery.evidence) {
          doc
            .font('Helvetica')
            .fontSize(7)
            .fillColor('#666')
            .text(
              `Evidencia: ${delivery.evidence.verificationStatus} em ${formatDateTime(delivery.evidence.capturedAt)}`,
            );
        }
        doc.moveDown(0.45);
      }

      sectionTitle(doc, 'Termo de responsabilidade');
      const declarationText =
        sheet.declaration?.text?.trim() ||
        formatEpiLegalDeclarationPlain(EPI_LEGAL_DECLARATION);
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#222')
        .text(declarationText, { align: 'justify', lineGap: 2 });
      if (sheet.declaration?.version) {
        doc.moveDown(0.3);
        doc
          .font('Helvetica')
          .fontSize(7)
          .fillColor('#777')
          .text(`Versao do termo: ${sheet.declaration.version}`);
      }

      doc.moveDown(1);
      ensureSpace(doc, 48);
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#444')
        .text(
          'Documento gerado pelo ProntEPI. A impressao pelo navegador permanece disponivel como alternativa.',
        );
    });
  }
}

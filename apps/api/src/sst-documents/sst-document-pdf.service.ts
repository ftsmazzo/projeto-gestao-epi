import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import {
  formatCnpj,
  type SstDocumentPayload,
} from './sst-document-content';

function bufferFromPdf(
  build: (doc: PDFKit.PDFDocument) => void,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 48,
      info: { Title: 'ProntEPI — Documento SST', Author: 'ProntEPI' },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    build(doc);
    doc.end();
  });
}

function ensureSpace(doc: PDFKit.PDFDocument, needed = 64) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

function heading(doc: PDFKit.PDFDocument, title: string) {
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#0f172a').text(title, {
    align: 'center',
  });
  doc.moveDown(0.35);
}

function section(doc: PDFKit.PDFDocument, title: string) {
  ensureSpace(doc, 28);
  doc.moveDown(0.35);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f766e').text(title);
  doc
    .moveTo(doc.page.margins.left, doc.y + 2)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y + 2)
    .strokeColor('#99f6e4')
    .lineWidth(0.8)
    .stroke();
  doc.moveDown(0.45);
  doc.font('Helvetica').fontSize(9).fillColor('#1e293b');
}

function kv(doc: PDFKit.PDFDocument, label: string, value: string) {
  ensureSpace(doc, 14);
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#334155')
    .text(`${label}: `, { continued: true });
  doc.font('Helvetica').fillColor('#0f172a').text(value || '—');
}

function bullet(doc: PDFKit.PDFDocument, text: string) {
  ensureSpace(doc, 14);
  doc.font('Helvetica').fontSize(9).fillColor('#1e293b').text(`•  ${text}`, {
    paragraphGap: 2,
  });
}

@Injectable()
export class SstDocumentPdfService {
  build(payload: SstDocumentPayload, signedAt?: string | null): Promise<Buffer> {
    return bufferFromPdf((doc) => {
      const isOs = payload.type === 'ORDEM_SERVICO';
      heading(
        doc,
        isOs
          ? 'ORDEM DE SERVICO DE SEGURANCA'
          : 'COMPROVANTE DE TREINAMENTO DE INTEGRACAO DE SST',
      );
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#64748b')
        .text(
          isOs
            ? 'NR-01, item 1.4.1 — ciencia dos riscos da funcao'
            : 'NR-01 — Disposicoes Gerais e Gerenciamento de Riscos Ocupacionais',
          { align: 'center' },
        );
      doc.moveDown(0.8);

      section(doc, 'Empresa');
      kv(doc, 'Razao social', payload.company.legalName);
      if (payload.company.tradeName) {
        kv(doc, 'Nome fantasia', payload.company.tradeName);
      }
      kv(doc, 'CNPJ', formatCnpj(payload.company.cnpj));
      if (payload.company.city) kv(doc, 'Cidade', payload.company.city);

      section(doc, 'Trabalhador');
      kv(doc, 'Nome', payload.worker.name);
      kv(doc, 'CPF', payload.worker.cpfMasked);
      if (payload.worker.registration) {
        kv(doc, 'Matricula', payload.worker.registration);
      }
      kv(doc, 'Setor', payload.worker.sectorName ?? '—');
      kv(doc, 'Funcao', payload.worker.jobFunctionName ?? '—');
      kv(doc, 'Admissao', payload.worker.admissionDate ?? '—');

      if (payload.integration) {
        section(doc, 'Integracao');
        kv(doc, 'Data', payload.integration.date ?? '—');
        kv(doc, 'Horario', payload.integration.time);
        kv(doc, 'Duracao', `${payload.integration.durationHours} hora(s)`);
        section(doc, 'Assuntos abordados');
        for (const topic of payload.integration.topics) {
          bullet(doc, topic);
        }
      }

      if (payload.os) {
        section(doc, '1. Descricao da funcao');
        doc
          .font('Helvetica')
          .fontSize(9)
          .text(payload.os.functionDescription || 'Nao informada.');
        section(doc, 'Ambiente');
        doc
          .font('Helvetica')
          .fontSize(9)
          .text(payload.os.environment || 'Nao informado.');

        section(doc, '2. Agentes associados as atividades');
        if (payload.os.risks.length === 0) {
          doc.text('Nenhum risco vinculado a esta funcao no PGR.');
        } else {
          for (const risk of payload.os.risks) {
            ensureSpace(doc, 36);
            doc
              .font('Helvetica-Bold')
              .fontSize(9)
              .text(`${risk.category} — ${risk.agent}`);
            doc
              .font('Helvetica')
              .fontSize(8)
              .fillColor('#475569')
              .text(
                `Fonte: ${risk.source ?? '—'}  ·  Avaliacao: ${risk.evaluation}  ·  Exposicao: ${risk.exposure ?? '—'}`,
              );
            doc.fillColor('#1e293b');
          }
        }

        section(doc, '3. EPIs de uso obrigatorio');
        if (payload.os.epis.length === 0) {
          doc.text('Nenhuma necessidade de EPI vinculada a funcao.');
        } else {
          for (const epi of payload.os.epis) bullet(doc, epi);
        }

        section(doc, '4. EPCs');
        for (const epc of payload.os.epcs) bullet(doc, epc);

        section(doc, '5. Recomendacoes gerais');
        for (const row of payload.os.recommendations) bullet(doc, row);

        section(doc, '6. Responsabilidade do funcionario');
        for (const row of payload.os.responsibilities) bullet(doc, row);
      }

      if (payload.technicalResponsible.name) {
        section(doc, 'Responsavel tecnico');
        kv(doc, 'Nome', payload.technicalResponsible.name);
        kv(
          doc,
          'Registro MTE',
          payload.technicalResponsible.registry ?? '—',
        );
      }

      section(doc, 'Termo de responsabilidade');
      doc.font('Helvetica').fontSize(9).text(payload.termText, {
        align: 'justify',
      });

      doc.moveDown(1);
      if (signedAt) {
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#047857')
          .text(
            `Ciencia confirmada por biometria facial em ${new Date(signedAt).toLocaleString('pt-BR')}.`,
          );
      } else {
        doc
          .font('Helvetica-Oblique')
          .fontSize(8)
          .fillColor('#b45309')
          .text('Aguardando ciencia facial do trabalhador.');
      }
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#64748b')
        .text(
          `Documento gerado pelo ProntEPI em ${new Date(payload.generatedAt).toLocaleString('pt-BR')}.`,
        );
    });
  }
}

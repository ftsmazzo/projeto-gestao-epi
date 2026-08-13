import { Injectable } from '@nestjs/common';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import PDFDocument from 'pdfkit';
import {
  DEFAULT_INTEGRATION_OBJECTIVE,
  DEFAULT_OS_OBSERVATIONS,
  formatCnpj,
  formatDayBr,
  riskCategoryLabel,
  uniqueRisks,
  uniqueStrings,
  type SstDocumentPayload,
} from './sst-document-content';
import { groupOsRisksByCategory } from '../client-structure/risk-context';

export type SstPdfBuildOptions = {
  signedAt?: string | null;
  evidenceAbsolutePath?: string | null;
};

type TableCell = {
  text: string;
  width: number;
  header?: boolean;
  align?: 'left' | 'center';
};

function bufferFromPdf(
  build: (doc: PDFKit.PDFDocument) => void | Promise<void>,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 36,
      bufferPages: true,
      info: { Title: 'ProntEPI — Documento SST', Author: 'ProntEPI' },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    Promise.resolve(build(doc))
      .then(() => {
        const range = doc.bufferedPageRange();
        for (let i = 0; i < range.count; i += 1) {
          doc.switchToPage(range.start + i);
          doc
            .font('Helvetica')
            .fontSize(7)
            .fillColor('#64748b')
            .text(
              `ProntEPI  ·  pagina ${i + 1} de ${range.count}`,
              36,
              doc.page.height - 28,
              { width: doc.page.width - 72, align: 'center' },
            );
        }
        doc.end();
      })
      .catch(reject);
  });
}

function pageInnerWidth(doc: PDFKit.PDFDocument) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function ensureSpace(doc: PDFKit.PDFDocument, needed = 56) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom - 12) {
    doc.addPage();
  }
}

function titleBlock(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
  const x = doc.page.margins.left;
  const w = pageInnerWidth(doc);
  const y = doc.y;
  doc.rect(x, y, w, 44).fill('#0f766e');
  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(13)
    .text(title, x + 8, y + 8, { width: w - 16, align: 'center' });
  doc
    .font('Helvetica')
    .fontSize(8)
    .text(subtitle, x + 8, y + 26, { width: w - 16, align: 'center' });
  doc.fillColor('#0f172a');
  doc.y = y + 52;
}

function section(doc: PDFKit.PDFDocument, title: string) {
  ensureSpace(doc, 22);
  doc.moveDown(0.25);
  const x = doc.page.margins.left;
  const w = pageInnerWidth(doc);
  const y = doc.y;
  doc.rect(x, y, w, 16).fill('#ecfdf5');
  doc
    .fillColor('#0f766e')
    .font('Helvetica-Bold')
    .fontSize(8)
    .text(title, x + 6, y + 4, { width: w - 12 });
  doc.fillColor('#0f172a');
  doc.y = y + 20;
}

function fieldBox(
  doc: PDFKit.PDFDocument,
  rows: Array<Array<{ label: string; value: string; width: number }>>,
) {
  const x0 = doc.page.margins.left;
  for (const row of rows) {
    const heights = row.map((cell) => {
      doc.font('Helvetica').fontSize(8);
      return Math.max(
        22,
        doc.heightOfString(cell.value || '—', { width: cell.width - 10 }) + 14,
      );
    });
    const h = Math.max(...heights);
    ensureSpace(doc, h + 2);
    let x = x0;
    const y = doc.y;
    for (const cell of row) {
      doc
        .rect(x, y, cell.width, h)
        .strokeColor('#94a3b8')
        .lineWidth(0.5)
        .stroke();
      doc
        .font('Helvetica-Bold')
        .fontSize(6.5)
        .fillColor('#64748b')
        .text(cell.label, x + 4, y + 3, { width: cell.width - 8 });
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#0f172a')
        .text(cell.value || '—', x + 4, y + 12, { width: cell.width - 8 });
      x += cell.width;
    }
    doc.y = y + h;
  }
}

function bodyText(doc: PDFKit.PDFDocument, text: string) {
  ensureSpace(doc, 28);
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#1e293b')
    .text(text || 'Nao informada.', {
      align: 'justify',
      lineGap: 1.5,
    });
}

function numberedList(doc: PDFKit.PDFDocument, items: string[]) {
  items.forEach((item, index) => {
    ensureSpace(doc, 16);
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#1e293b')
      .text(`${index + 1}.  ${item}`, { paragraphGap: 2, lineGap: 1 });
  });
}

function twoColumnChecks(doc: PDFKit.PDFDocument, items: string[]) {
  const gap = 8;
  const colW = (pageInnerWidth(doc) - gap) / 2;
  const x0 = doc.page.margins.left;
  for (let i = 0; i < items.length; i += 2) {
    const left = items[i];
    const right = items[i + 1];
    doc.font('Helvetica').fontSize(7.5);
    const h = Math.max(
      14,
      doc.heightOfString(`[X]  ${left}`, { width: colW }) + 2,
      right
        ? doc.heightOfString(`[X]  ${right}`, { width: colW }) + 2
        : 0,
    );
    ensureSpace(doc, h + 2);
    const y = doc.y;
    doc
      .fillColor('#1e293b')
      .text(`[X]  ${left}`, x0, y, { width: colW });
    if (right) {
      doc.text(`[X]  ${right}`, x0 + colW + gap, y, { width: colW });
    }
    doc.y = y + h;
  }
}

function twoColumnBullets(doc: PDFKit.PDFDocument, items: string[]) {
  const gap = 8;
  const colW = (pageInnerWidth(doc) - gap) / 2;
  const x0 = doc.page.margins.left;
  for (let i = 0; i < items.length; i += 2) {
    const left = items[i];
    const right = items[i + 1];
    doc.font('Helvetica').fontSize(8);
    const h = Math.max(
      14,
      doc.heightOfString(`•  ${left}`, { width: colW }) + 2,
      right ? doc.heightOfString(`•  ${right}`, { width: colW }) + 2 : 0,
    );
    ensureSpace(doc, h + 2);
    const y = doc.y;
    doc.fillColor('#1e293b').text(`•  ${left}`, x0, y, { width: colW });
    if (right) {
      doc.text(`•  ${right}`, x0 + colW + gap, y, { width: colW });
    }
    doc.y = y + h;
  }
}

function drawTableRow(doc: PDFKit.PDFDocument, cells: TableCell[]) {
  const x0 = doc.page.margins.left;
  const heights = cells.map((cell) => {
    doc.font(cell.header ? 'Helvetica-Bold' : 'Helvetica').fontSize(6.5);
    return Math.max(
      cell.header ? 20 : 22,
      doc.heightOfString(cell.text || '—', { width: cell.width - 6 }) + 6,
    );
  });
  const h = Math.max(...heights);
  ensureSpace(doc, h + 2);
  let x = x0;
  const y = doc.y;
  for (const cell of cells) {
    if (cell.header) {
      doc.rect(x, y, cell.width, h).fill('#0f766e');
    } else {
      doc
        .rect(x, y, cell.width, h)
        .strokeColor('#94a3b8')
        .lineWidth(0.4)
        .stroke();
    }
    doc
      .font(cell.header ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(6.5)
      .fillColor(cell.header ? '#ffffff' : '#0f172a')
      .text(cell.text || '—', x + 3, y + 3, {
        width: cell.width - 6,
        align: cell.align ?? 'left',
      });
    x += cell.width;
  }
  doc.fillColor('#0f172a');
  doc.y = y + h;
}

async function drawFaceEvidence(
  doc: PDFKit.PDFDocument,
  payload: SstDocumentPayload,
  options: SstPdfBuildOptions,
) {
  section(doc, 'CIENCIA / ASSINATURA DO TRABALHADOR');
  const boxH = 132;
  ensureSpace(doc, boxH + 8);
  const x = doc.page.margins.left;
  const w = pageInnerWidth(doc);
  const y = doc.y;
  doc.rect(x, y, w, boxH).strokeColor('#94a3b8').lineWidth(0.6).stroke();
  doc.rect(x, y, 110, boxH).strokeColor('#94a3b8').lineWidth(0.6).stroke();

  const photoPath = options.evidenceAbsolutePath;
  if (photoPath && existsSync(photoPath)) {
    try {
      const img = await readFile(photoPath);
      doc.image(img, x + 6, y + 6, { fit: [98, 120] });
    } catch {
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor('#64748b')
        .text('Foto indisponivel', x + 10, y + 58, { width: 90, align: 'center' });
    }
  } else {
    doc
      .font('Helvetica-Oblique')
      .fontSize(7)
      .fillColor('#b45309')
      .text(
        options.signedAt
          ? 'Foto nao encontrada'
          : 'Aguardando ciencia facial',
        x + 8,
        y + 58,
        { width: 94, align: 'center' },
      );
  }

  const textX = x + 118;
  const textW = w - 126;
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#0f172a')
    .text(payload.worker.name, textX, y + 12, { width: textW });
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#334155')
    .text(`CPF: ${payload.worker.cpfMasked}`, textX, y + 28, { width: textW });
  if (payload.worker.jobFunctionName) {
    doc.text(`Funcao: ${payload.worker.jobFunctionName}`, textX, y + 42, {
      width: textW,
    });
  }
  if (options.signedAt) {
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#047857')
      .text(
        `Ciencia confirmada por biometria facial em ${new Date(options.signedAt).toLocaleString('pt-BR')}.`,
        textX,
        y + 64,
        { width: textW },
      );
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor('#64748b')
      .text(
        'A foto ao lado e a evidencia da confirmacao, no mesmo padrao do comprovante de entrega de EPI.',
        textX,
        y + 90,
        { width: textW },
      );
  } else {
    doc
      .font('Helvetica-Oblique')
      .fontSize(8)
      .fillColor('#b45309')
      .text('Aguardando ciencia facial do trabalhador.', textX, y + 64, {
        width: textW,
      });
  }
  doc.y = y + boxH + 8;
}

@Injectable()
export class SstDocumentPdfService {
  build(
    payload: SstDocumentPayload,
    options: SstPdfBuildOptions = {},
  ): Promise<Buffer> {
    return bufferFromPdf(async (doc) => {
      if (payload.type === 'ORDEM_SERVICO') {
        await this.renderOs(doc, payload, options);
      } else {
        await this.renderIntegration(doc, payload, options);
      }
    });
  }

  private async renderOs(
    doc: PDFKit.PDFDocument,
    payload: SstDocumentPayload,
    options: SstPdfBuildOptions,
  ) {
    const w = pageInnerWidth(doc);
    titleBlock(
      doc,
      'ORDEM DE SERVICO DE SEGURANCA',
      'NORMA REGULAMENTADORA — NR-01, item 1.4.1',
    );

    fieldBox(doc, [
      [
        { label: 'EMPRESA', value: payload.company.legalName, width: w * 0.68 },
        {
          label: 'CNPJ',
          value: formatCnpj(payload.company.cnpj),
          width: w * 0.32,
        },
      ],
      [
        { label: 'NOME', value: payload.worker.name, width: w * 0.62 },
        {
          label: 'DATA DA ADMISSAO',
          value: formatDayBr(payload.worker.admissionDate),
          width: w * 0.38,
        },
      ],
      [
        {
          label: 'FUNCAO',
          value: payload.worker.jobFunctionName ?? '—',
          width: w * 0.5,
        },
        {
          label: 'SETOR',
          value: payload.worker.sectorName ?? '—',
          width: w * 0.5,
        },
      ],
      [
        {
          label: 'DESCRICAO DO AMBIENTE',
          value: payload.os?.environment || 'Nao informado.',
          width: w,
        },
      ],
    ]);

    section(doc, '1. DESCRICAO DA FUNCAO');
    bodyText(doc, payload.os?.functionDescription || 'Nao informada.');

    section(doc, '2. AGENTES ASSOCIADOS AS ATIVIDADES');
    const col = {
      tipo: w * 0.14,
      agente: w * 0.22,
      fonte: w * 0.28,
      aval: w * 0.16,
      expo: w * 0.2,
    };
    drawTableRow(doc, [
      { text: 'TIPO DE RISCO', width: col.tipo, header: true, align: 'center' },
      { text: 'AGENTE AGRESSOR', width: col.agente, header: true, align: 'center' },
      { text: 'FONTE GERADORA', width: col.fonte, header: true, align: 'center' },
      { text: 'AVALIACAO', width: col.aval, header: true, align: 'center' },
      { text: 'TIPO DE EXPOSICAO', width: col.expo, header: true, align: 'center' },
    ]);
    const risks = uniqueRisks(payload.os?.risks ?? []);
    if (risks.length === 0) {
      bodyText(doc, 'Nenhum risco vinculado a esta funcao no PGR.');
    } else {
      for (const group of groupOsRisksByCategory(risks)) {
        group.agents.forEach((risk, index) => {
          drawTableRow(doc, [
            {
              text: index === 0 ? riskCategoryLabel(group.category) : '',
              width: col.tipo,
            },
            { text: risk.agent, width: col.agente },
            { text: risk.source || 'Atividades da funcao', width: col.fonte },
            { text: risk.evaluation || 'Qualitativa', width: col.aval },
            {
              text: risk.exposure || 'Habitual e intermitente',
              width: col.expo,
            },
          ]);
        });
      }
    }

    section(doc, "3. EPI'S DE USO OBRIGATORIO");
    const epis = uniqueStrings(payload.os?.epis ?? []);
    if (epis.length === 0) {
      bodyText(doc, 'Nenhuma necessidade de EPI vinculada a funcao.');
    } else {
      twoColumnBullets(doc, epis);
    }

    section(doc, "4. EPC'S DE USO OBRIGATORIO");
    twoColumnBullets(doc, uniqueStrings(payload.os?.epcs ?? []));

    section(doc, '5. RECOMENDACOES GERAIS');
    numberedList(doc, payload.os?.recommendations ?? []);

    section(doc, '6. RESPONSABILIDADE DO FUNCIONARIO');
    numberedList(doc, payload.os?.responsibilities ?? []);

    section(doc, '7. OBSERVACOES');
    numberedList(
      doc,
      payload.os?.observations?.length
        ? payload.os.observations
        : [...DEFAULT_OS_OBSERVATIONS],
    );

    if (payload.technicalResponsible.name) {
      section(doc, 'RESPONSAVEL TECNICO');
      fieldBox(doc, [
        [
          {
            label: 'NOME',
            value: payload.technicalResponsible.name,
            width: w * 0.62,
          },
          {
            label: 'REGISTRO MTE',
            value: payload.technicalResponsible.registry ?? '—',
            width: w * 0.38,
          },
        ],
      ]);
    }

    section(doc, 'TERMO DE RESPONSABILIDADE — ORDEM DE SERVICO NR-01');
    bodyText(doc, payload.termText);
    doc.moveDown(0.3);
    doc
      .font('Helvetica')
      .fontSize(8)
      .text(`Funcao: ${payload.worker.jobFunctionName ?? '—'}`);
    if (payload.company.city) {
      doc.text(
        `${payload.company.city}, ${formatDayBr(options.signedAt ?? payload.generatedAt)}.`,
      );
    }

    await drawFaceEvidence(doc, payload, options);
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor('#64748b')
      .text(
        `Documento gerado pelo ProntEPI em ${new Date(payload.generatedAt).toLocaleString('pt-BR')}.`,
      );
  }

  private async renderIntegration(
    doc: PDFKit.PDFDocument,
    payload: SstDocumentPayload,
    options: SstPdfBuildOptions,
  ) {
    const w = pageInnerWidth(doc);
    titleBlock(
      doc,
      'COMPROVANTE DE TREINAMENTO DE INTEGRACAO DE SEGURANCA',
      'NR-01 — Disposicoes Gerais e Gerenciamento de Riscos Ocupacionais',
    );

    fieldBox(doc, [
      [
        {
          label: 'EMPRESA',
          value: payload.company.legalName,
          width: w * 0.68,
        },
        {
          label: 'CNPJ',
          value: formatCnpj(payload.company.cnpj),
          width: w * 0.32,
        },
      ],
      [
        {
          label: 'DATA DA ADMISSAO / INTEGRACAO',
          value: formatDayBr(payload.integration?.date),
          width: w * 0.4,
        },
        {
          label: 'HORARIO',
          value: payload.integration?.time ?? '08:00',
          width: w * 0.28,
        },
        {
          label: 'TEMPO DE INTEGRACAO',
          value: `${payload.integration?.durationHours ?? 2} hora(s)`,
          width: w * 0.32,
        },
      ],
      [
        {
          label: 'FUNCAO / REGISTRO',
          value: [
            payload.worker.jobFunctionName,
            payload.worker.registration,
          ]
            .filter(Boolean)
            .join('  ·  ') || '—',
          width: w * 0.5,
        },
        {
          label: 'SETOR',
          value: payload.worker.sectorName ?? '—',
          width: w * 0.5,
        },
      ],
    ]);

    section(doc, 'OBJETIVO');
    bodyText(doc, DEFAULT_INTEGRATION_OBJECTIVE);

    section(doc, 'FUNCIONARIO LIBERADO');
    drawTableRow(doc, [
      { text: 'NOME COMPLETO', width: w * 0.42, header: true },
      { text: 'CPF', width: w * 0.22, header: true, align: 'center' },
      { text: 'ASSINATURA / CIENCIA', width: w * 0.36, header: true, align: 'center' },
    ]);
    drawTableRow(doc, [
      { text: payload.worker.name, width: w * 0.42 },
      { text: payload.worker.cpfMasked, width: w * 0.22, align: 'center' },
      {
        text: options.signedAt
          ? `Ciencia facial em ${new Date(options.signedAt).toLocaleString('pt-BR')}`
          : 'Aguardando ciencia facial',
        width: w * 0.36,
        align: 'center',
      },
    ]);

    section(doc, 'ASSUNTOS ABORDADOS');
    twoColumnChecks(doc, payload.integration?.topics ?? []);

    if (payload.technicalResponsible.name) {
      section(doc, 'RESPONSAVEL TECNICO');
      fieldBox(doc, [
        [
          {
            label: 'NOME',
            value: payload.technicalResponsible.name,
            width: w * 0.62,
          },
          {
            label: 'REGISTRO MTE',
            value: payload.technicalResponsible.registry ?? '—',
            width: w * 0.38,
          },
        ],
      ]);
    }

    section(doc, 'TERMO DE RESPONSABILIDADE');
    bodyText(doc, payload.termText);

    await drawFaceEvidence(doc, payload, options);
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor('#64748b')
      .text(
        `Documento gerado pelo ProntEPI em ${new Date(payload.generatedAt).toLocaleString('pt-BR')}.`,
      );
  }
}

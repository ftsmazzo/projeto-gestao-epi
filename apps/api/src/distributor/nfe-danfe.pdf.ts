import PDFDocument from 'pdfkit';

export type DanfeInvoiceInput = {
  series: string;
  number: number;
  status: string;
  customerName: string;
  customerCnpj: string;
  customerUf: string;
  emitterRazaoSocial: string;
  emitterFantasia?: string | null;
  emitterCnpj: string;
  emitterIe?: string | null;
  emitterUf: string;
  emitterMunicipio?: string | null;
  emitterEndereco?: string | null;
  naturezaOperacao?: string | null;
  totalCents: number;
  accessKey: string | null;
  protocol: string | null;
  createdAt: Date | string;
  lines: Array<{
    description: string;
    ncm: string;
    cfop: string;
    quantity: number;
    unitPriceCents: number;
    totalCents: number;
    originCode?: number | null;
  }>;
};

function money(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function moneyBrl(cents: number) {
  return `R$ ${money(cents)}`;
}

function formatCnpj(digits: string) {
  const d = digits.replace(/\D/g, '');
  if (d.length !== 14) return digits || '—';
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function formatIe(value?: string | null) {
  if (!value) return '—';
  const d = value.replace(/\D/g, '');
  if (d.length === 12) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}.${d.slice(9)}`;
  }
  return value;
}

function formatDate(value: Date | string) {
  try {
    return new Date(value).toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });
  } catch {
    return String(value);
  }
}

function formatDateTime(value: Date | string) {
  try {
    return new Date(value).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });
  } catch {
    return String(value);
  }
}

function formatAccessKey(key: string | null) {
  if (!key) return '—';
  const d = key.replace(/\D/g, '');
  return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function box(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  doc.rect(x, y, w, h).strokeColor('#111').lineWidth(0.8).stroke();
}

function hLine(
  doc: PDFKit.PDFDocument,
  x1: number,
  x2: number,
  y: number,
) {
  doc
    .moveTo(x1, y)
    .lineTo(x2, y)
    .strokeColor('#111')
    .lineWidth(0.6)
    .stroke();
}

function vLine(
  doc: PDFKit.PDFDocument,
  x: number,
  y1: number,
  y2: number,
) {
  doc
    .moveTo(x, y1)
    .lineTo(x, y2)
    .strokeColor('#111')
    .lineWidth(0.6)
    .stroke();
}

function label(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  w?: number,
) {
  doc
    .font('Helvetica')
    .fontSize(5.5)
    .fillColor('#333')
    .text(text.toUpperCase(), x + 2, y + 2, { width: (w ?? 80) - 4, lineBreak: false });
}

function value(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  w: number,
  opts?: { bold?: boolean; size?: number; align?: 'left' | 'center' | 'right' },
) {
  doc
    .font(opts?.bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(opts?.size ?? 8)
    .fillColor('#000')
    .text(text || '—', x + 2, y, {
      width: w - 4,
      align: opts?.align ?? 'left',
      lineBreak: false,
    });
}

/** Desenha barras decorativas no estilo código de barras (não é Code128 validável). */
function drawFakeBarcode(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: string,
) {
  const digits = (seed.replace(/\D/g, '') || '0').padEnd(44, '0');
  let cursor = x;
  const end = x + w;
  for (let i = 0; i < digits.length && cursor < end; i += 1) {
    const n = Number(digits[i] ?? 0);
    const barW = 0.7 + (n % 3) * 0.55;
    if (n % 2 === 0) {
      doc.rect(cursor, y, barW, h).fillColor('#000').fill();
    }
    cursor += barW + 0.45;
  }
  doc.fillColor('#000');
}

/**
 * DANFE com diagramação próxima ao formulário oficial (homologação/mock).
 * Não é o DANFE fiscal assinado; serve para conferência visual no ERP.
 */
export function buildDanfePdf(invoice: DanfeInvoiceInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 18,
      info: {
        Title: `DANFE NF-e ${invoice.series}/${invoice.number}`,
        Author: 'ProntEPI',
        Subject: 'Documento Auxiliar da Nota Fiscal Eletronica',
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageW = doc.page.width;
    const left = 18;
    const right = pageW - 18;
    const width = right - left;
    let y = 18;

    const canhotoH = 52;
    box(doc, left, y, width, canhotoH);
    label(doc, 'Recebemos de', left, y, 200);
    value(
      doc,
      invoice.emitterRazaoSocial || 'Emitente',
      left,
      y + 12,
      width * 0.62,
      { bold: true, size: 8 },
    );
    value(
      doc,
      `os produtos e/ou serviços constantes da NF-e ao lado. Nº ${String(invoice.number).padStart(9, '0')}  Série ${invoice.series}`,
      left,
      y + 24,
      width * 0.62,
      { size: 7 },
    );
    vLine(doc, left + width * 0.62, y, y + canhotoH);
    label(doc, 'Data de recebimento', left + width * 0.62, y, width * 0.18);
    hLine(doc, left + width * 0.62, right, y + canhotoH / 2);
    label(doc, 'Identificação e assinatura do recebedor', left + width * 0.62, y + canhotoH / 2, width * 0.38);
    y += canhotoH + 6;

    // Linha de corte
    doc
      .dash(2, { space: 2 })
      .moveTo(left, y)
      .lineTo(right, y)
      .strokeColor('#666')
      .lineWidth(0.5)
      .stroke()
      .undash();
    doc
      .font('Helvetica')
      .fontSize(6)
      .fillColor('#666')
      .text('✂  Corte na linha pontilhada', left, y + 2, { width, align: 'center' });
    y += 14;

    const headerH = 92;
    const emitW = width * 0.48;
    const danfeW = width * 0.18;
    const keyW = width - emitW - danfeW;

    box(doc, left, y, emitW, headerH);
    label(doc, 'Identificação do emitente', left, y, emitW);
    value(doc, invoice.emitterRazaoSocial, left, y + 12, emitW, { bold: true, size: 9 });
    if (invoice.emitterFantasia) {
      value(doc, invoice.emitterFantasia, left, y + 24, emitW, { size: 7 });
    }
    value(
      doc,
      invoice.emitterEndereco ||
        [invoice.emitterMunicipio, invoice.emitterUf].filter(Boolean).join(' / ') ||
        `UF ${invoice.emitterUf}`,
      left,
      y + 36,
      emitW,
      { size: 7 },
    );
    value(doc, `CNPJ: ${formatCnpj(invoice.emitterCnpj)}`, left, y + 50, emitW, { size: 7 });
    value(doc, `IE: ${formatIe(invoice.emitterIe)}`, left, y + 62, emitW / 2, { size: 7 });
    value(doc, `UF: ${invoice.emitterUf}`, left + emitW / 2, y + 62, emitW / 2, { size: 7 });

    const danfeX = left + emitW;
    box(doc, danfeX, y, danfeW, headerH);
    doc
      .font('Helvetica-Bold')
      .fontSize(16)
      .fillColor('#000')
      .text('DANFE', danfeX, y + 10, { width: danfeW, align: 'center' });
    doc
      .font('Helvetica')
      .fontSize(6)
      .text('Documento Auxiliar da\nNota Fiscal Eletrônica', danfeX + 4, y + 28, {
        width: danfeW - 8,
        align: 'center',
      });
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('0 — ENTRADA', danfeX + 4, y + 52, { width: danfeW - 8 });
    doc.font('Helvetica-Bold').fontSize(8).text('1 — SAÍDA', danfeX + 4, y + 62, {
      width: danfeW - 8,
    });
    box(doc, danfeX + danfeW - 22, y + 54, 16, 16);
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .text('1', danfeX + danfeW - 22, y + 56, { width: 16, align: 'center' });
    doc
      .font('Helvetica')
      .fontSize(7)
      .text(`Nº ${String(invoice.number).padStart(9, '0')}`, danfeX + 4, y + 74, {
        width: danfeW - 8,
        align: 'center',
      });
    doc.text(`SÉRIE ${invoice.series}`, danfeX + 4, y + 82, {
      width: danfeW - 8,
      align: 'center',
    });

    const keyX = danfeX + danfeW;
    box(doc, keyX, y, keyW, headerH);
    label(doc, 'Chave de acesso', keyX, y, keyW);
    const key = invoice.accessKey?.replace(/\D/g, '') || '';
    if (key) {
      drawFakeBarcode(doc, keyX + 6, y + 14, keyW - 12, 22, key);
    }
    value(doc, formatAccessKey(invoice.accessKey), keyX, y + 42, keyW, {
      size: 6.5,
      align: 'center',
      bold: true,
    });
    doc
      .font('Helvetica')
      .fontSize(6)
      .fillColor('#333')
      .text(
        'Consulta de autenticidade no portal nacional da NF-e\nwww.nfe.fazenda.gov.br/portal ou no site da SEFAZ Autorizadora',
        keyX + 4,
        y + 58,
        { width: keyW - 8, align: 'center' },
      );
    y += headerH;

    const natH = 28;
    box(doc, left, y, width * 0.7, natH);
    label(doc, 'Natureza da operação', left, y, width * 0.7);
    value(
      doc,
      invoice.naturezaOperacao || 'Venda de mercadoria',
      left,
      y + 12,
      width * 0.7,
      { bold: true, size: 8 },
    );
    box(doc, left + width * 0.7, y, width * 0.3, natH);
    label(doc, 'Protocolo de autorização de uso', left + width * 0.7, y, width * 0.3);
    value(
      doc,
      invoice.protocol
        ? `${invoice.protocol} - ${formatDateTime(invoice.createdAt)}`
        : formatDateTime(invoice.createdAt),
      left + width * 0.7,
      y + 12,
      width * 0.3,
      { size: 7 },
    );
    y += natH;

    const destH = 56;
    box(doc, left, y, width, destH);
    label(doc, 'Destinatário / remetente', left, y, 160);
    value(doc, 'Nome / Razão social', left, y + 10, width * 0.55, { size: 5.5 });
    value(doc, invoice.customerName, left, y + 18, width * 0.55, { bold: true, size: 8 });
    vLine(doc, left + width * 0.55, y, y + destH);
    label(doc, 'CNPJ / CPF', left + width * 0.55, y, width * 0.25);
    value(doc, formatCnpj(invoice.customerCnpj), left + width * 0.55, y + 14, width * 0.25, {
      size: 8,
      bold: true,
    });
    vLine(doc, left + width * 0.8, y, y + destH);
    label(doc, 'Data da emissão', left + width * 0.8, y, width * 0.2);
    value(doc, formatDate(invoice.createdAt), left + width * 0.8, y + 14, width * 0.2, {
      size: 8,
      bold: true,
    });
    hLine(doc, left, right, y + 32);
    label(doc, 'UF', left, y + 32, 40);
    value(doc, invoice.customerUf, left, y + 42, 40, { size: 8, bold: true });
    vLine(doc, left + 40, y + 32, y + destH);
    label(doc, 'Inscrição estadual', left + 40, y + 32, 120);
    value(doc, '—', left + 40, y + 42, 120, { size: 8 });
    vLine(doc, left + 200, y + 32, y + destH);
    label(doc, 'Situação', left + 200, y + 32, 120);
    value(
      doc,
      invoice.status === 'AUTHORIZED' ? 'Autorizada' : invoice.status,
      left + 200,
      y + 42,
      120,
      { size: 8, bold: true },
    );
    y += destH + 4;

    // Cálculo do imposto (resumo)
    const calcH = 36;
    const calcCols = [
      { title: 'Base cálculo ICMS', val: '0,00' },
      { title: 'Valor ICMS', val: '0,00' },
      { title: 'Base cálculo ICMS ST', val: '0,00' },
      { title: 'Valor ICMS ST', val: '0,00' },
      { title: 'Valor total dos produtos', val: money(invoice.totalCents) },
    ];
    const calcW = width / calcCols.length;
    box(doc, left, y, width, calcH);
    calcCols.forEach((col, i) => {
      const x = left + i * calcW;
      if (i > 0) vLine(doc, x, y, y + calcH);
      label(doc, col.title, x, y, calcW);
      value(doc, col.val, x, y + 16, calcW, { bold: true, size: 8, align: 'right' });
    });
    y += calcH;

    const calc2Cols = [
      { title: 'Valor frete', val: '0,00' },
      { title: 'Valor seguro', val: '0,00' },
      { title: 'Desconto', val: '0,00' },
      { title: 'Outras despesas', val: '0,00' },
      { title: 'Valor total da nota', val: money(invoice.totalCents) },
    ];
    box(doc, left, y, width, calcH);
    calc2Cols.forEach((col, i) => {
      const x = left + i * calcW;
      if (i > 0) vLine(doc, x, y, y + calcH);
      label(doc, col.title, x, y, calcW);
      value(doc, col.val, x, y + 16, calcW, {
        bold: i === calc2Cols.length - 1,
        size: 8,
        align: 'right',
      });
    });
    y += calcH + 4;

    // Itens
    const colDefs = [
      { key: 'cod', title: 'Cód.', w: 28 },
      { key: 'desc', title: 'Descrição do produto / serviço', w: 178 },
      { key: 'ncm', title: 'NCM/SH', w: 48 },
      { key: 'cst', title: 'O/CST', w: 28 },
      { key: 'cfop', title: 'CFOP', w: 30 },
      { key: 'un', title: 'Un', w: 22 },
      { key: 'qtd', title: 'Quant.', w: 36 },
      { key: 'vu', title: 'V. unitário', w: 52 },
      { key: 'vt', title: 'V. total', w: 52 },
    ] as const;
    const sumW = colDefs.reduce((s, c) => s + c.w, 0);
    const scale = width / sumW;
    const cols = colDefs.map((c) => ({ ...c, w: c.w * scale }));

    const headH = 16;
    box(doc, left, y, width, headH);
    let cx = left;
    doc.font('Helvetica-Bold').fontSize(5.5).fillColor('#000');
    for (const col of cols) {
      doc.text(col.title, cx + 1, y + 5, { width: col.w - 2, align: 'center', lineBreak: false });
      cx += col.w;
      if (cx < right) vLine(doc, cx, y, y + headH);
    }
    y += headH;

    const rowMin = 14;
    invoice.lines.forEach((line, idx) => {
      const desc = line.description || '—';
      doc.font('Helvetica').fontSize(6.5);
      const descH = Math.max(rowMin, doc.heightOfString(desc, { width: cols[1].w - 4 }) + 4);
      if (y + descH > doc.page.height - 70) {
        doc.addPage();
        y = 18;
        box(doc, left, y, width, headH);
        let hx = left;
        doc.font('Helvetica-Bold').fontSize(5.5);
        for (const col of cols) {
          doc.text(col.title, hx + 1, y + 5, {
            width: col.w - 2,
            align: 'center',
            lineBreak: false,
          });
          hx += col.w;
          if (hx < right) vLine(doc, hx, y, y + headH);
        }
        y += headH;
      }

      box(doc, left, y, width, descH);
      let x = left;
      const cells = [
        String(idx + 1).padStart(3, '0'),
        desc,
        line.ncm || '—',
        String(line.originCode ?? 0),
        line.cfop || '—',
        'UN',
        String(line.quantity),
        money(line.unitPriceCents),
        money(line.totalCents),
      ];
      cells.forEach((text, i) => {
        const align =
          i === 1 ? 'left' : i >= 6 ? 'right' : 'center';
        doc
          .font(i === 1 ? 'Helvetica' : 'Helvetica')
          .fontSize(i === 1 ? 6.5 : 6.5)
          .fillColor('#000')
          .text(text, x + 2, y + 3, {
            width: cols[i].w - 4,
            align,
          });
        x += cols[i].w;
        if (x < right) vLine(doc, x, y, y + descH);
      });
      y += descH;
    });

    y += 4;
    const infoH = 48;
    if (y + infoH > doc.page.height - 30) {
      doc.addPage();
      y = 18;
    }
    box(doc, left, y, width * 0.62, infoH);
    label(doc, 'Dados adicionais', left, y, width * 0.62);
    value(
      doc,
      [
        invoice.status === 'AUTHORIZED'
          ? 'NF-e autorizada (ambiente de homologação / mock).'
          : `Situação: ${invoice.status}`,
        'Documento auxiliar gerado pelo ProntEPI para conferência operacional.',
        'O XML autorizado permanece a fonte oficial perante a SEFAZ.',
      ].join('\n'),
      left,
      y + 12,
      width * 0.62,
      { size: 6.5 },
    );

    box(doc, left + width * 0.62, y, width * 0.38, infoH);
    label(doc, 'Reservado ao fisco', left + width * 0.62, y, width * 0.38);
    value(doc, moneyBrl(invoice.totalCents), left + width * 0.62, y + 20, width * 0.38, {
      bold: true,
      size: 11,
      align: 'center',
    });
    value(doc, 'TOTAL DA NOTA', left + width * 0.62, y + 36, width * 0.38, {
      size: 6,
      align: 'center',
    });

    doc.end();
  });
}

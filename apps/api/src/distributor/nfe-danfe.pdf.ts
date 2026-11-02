import PDFDocument from 'pdfkit';

export type DanfeInvoiceInput = {
  series: string;
  number: number;
  status: string;
  customerName: string;
  customerCnpj: string;
  customerUf: string;
  emitterCnpj: string;
  emitterUf: string;
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
  }>;
};

function money(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatCnpj(digits: string) {
  const d = digits.replace(/\D/g, '');
  if (d.length !== 14) return digits;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function formatDate(value: Date | string) {
  try {
    return new Date(value).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });
  } catch {
    return String(value);
  }
}

/** DANFE simplificado (homologação/mock). Não substitui o DANFE oficial da SEFAZ. */
export function buildDanfePdf(invoice: DanfeInvoiceInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 36,
      info: {
        Title: `DANFE ${invoice.series}/${invoice.number}`,
        Author: 'ProntEPI Gateway Fiscal',
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;

    doc.font('Helvetica-Bold').fontSize(14).text('DANFE — Documento Auxiliar da NF-e', left, 36, {
      width,
      align: 'center',
    });
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#444')
      .text('Versão interna / homologação. Gerado a partir dos dados da nota no ERP.', {
        width,
        align: 'center',
      });
    doc.fillColor('#000').moveDown(0.8);

    doc.font('Helvetica-Bold').fontSize(11).text(`NF-e ${invoice.series}/${invoice.number}`);
    doc.font('Helvetica').fontSize(9);
    doc.text(`Situação: ${invoice.status}`);
    doc.text(`Emissão: ${formatDate(invoice.createdAt)}`);
    if (invoice.accessKey) doc.text(`Chave de acesso: ${invoice.accessKey}`);
    if (invoice.protocol) doc.text(`Protocolo: ${invoice.protocol}`);
    doc.moveDown(0.6);

    doc.font('Helvetica-Bold').fontSize(10).text('Emitente');
    doc.font('Helvetica').fontSize(9);
    doc.text(`CNPJ: ${formatCnpj(invoice.emitterCnpj)} · UF: ${invoice.emitterUf}`);
    doc.moveDown(0.4);

    doc.font('Helvetica-Bold').fontSize(10).text('Destinatário');
    doc.font('Helvetica').fontSize(9);
    doc.text(invoice.customerName);
    doc.text(`CNPJ: ${formatCnpj(invoice.customerCnpj)} · UF: ${invoice.customerUf}`);
    doc.moveDown(0.6);

    doc.font('Helvetica-Bold').fontSize(10).text('Itens');
    doc.moveDown(0.2);
    doc.font('Helvetica-Bold').fontSize(8);
    const col = {
      desc: left,
      ncm: left + 220,
      cfop: left + 280,
      qtd: left + 320,
      unit: left + 360,
      total: left + 430,
    };
    const y0 = doc.y;
    doc.text('Descrição', col.desc, y0, { width: 210 });
    doc.text('NCM', col.ncm, y0, { width: 50 });
    doc.text('CFOP', col.cfop, y0, { width: 35 });
    doc.text('Qtd', col.qtd, y0, { width: 35 });
    doc.text('Unit.', col.unit, y0, { width: 60 });
    doc.text('Total', col.total, y0, { width: 70 });
    doc
      .moveTo(left, doc.y + 2)
      .lineTo(right, doc.y + 2)
      .strokeColor('#999')
      .lineWidth(0.5)
      .stroke();
    doc.moveDown(0.4);

    doc.font('Helvetica').fontSize(8).fillColor('#000');
    for (const line of invoice.lines) {
      if (doc.y > doc.page.height - 80) doc.addPage();
      const y = doc.y;
      doc.text(line.description || '—', col.desc, y, { width: 210 });
      const nextY = doc.y;
      doc.text(line.ncm || '—', col.ncm, y, { width: 50 });
      doc.text(line.cfop || '—', col.cfop, y, { width: 35 });
      doc.text(String(line.quantity), col.qtd, y, { width: 35 });
      doc.text(money(line.unitPriceCents), col.unit, y, { width: 60 });
      doc.text(money(line.totalCents), col.total, y, { width: 70 });
      doc.y = Math.max(nextY, y + 12);
      doc.moveDown(0.2);
    }

    doc.moveDown(0.6);
    doc
      .moveTo(left, doc.y)
      .lineTo(right, doc.y)
      .strokeColor('#999')
      .lineWidth(0.5)
      .stroke();
    doc.moveDown(0.4);
    doc.font('Helvetica-Bold').fontSize(11).text(`Total da nota: ${money(invoice.totalCents)}`, {
      align: 'right',
    });
    doc.moveDown(1);
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#555')
      .text(
        'Este PDF é auxiliar para conferência no ERP. Quando a SEFAZ real estiver ligada, o XML autorizado continua sendo a fonte oficial; o layout DANFE pode evoluir sem mudar o fluxo de emissão.',
        { width },
      );

    doc.end();
  });
}

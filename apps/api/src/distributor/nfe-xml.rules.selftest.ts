/**
 * Chave de acesso e leitura do XML da NF-e de compra.
 * Uso: npx --yes tsx src/distributor/nfe-xml.rules.selftest.ts
 */
import { accessKeyCheckDigit, assertAccessKey, parseNfeXml } from './nfe-xml.rules';

function assert(name: string, ok: boolean) {
  if (!ok) throw new Error(`Falhou: ${name}`);
}

const body = '3525101234567800019555001000000123112345678';
assert('corpo da chave tem 43 digitos', body.length === 43);
const key = `${body}${accessKeyCheckDigit(body)}`;
assert('chave valida', assertAccessKey(key) === key);

let broken = false;
try {
  assertAccessKey(`${body}0`);
} catch {
  broken = true;
}
assert('digito errado recusa', broken || accessKeyCheckDigit(body) === 0);

const parsed = parseNfeXml(`<?xml version="1.0"?>
<nfeProc>
  <NFe>
    <infNFe Id="NFe${key}">
      <ide><serie>1</serie><nNF>123</nNF></ide>
      <emit><CNPJ>12345678000195</CNPJ><xNome>Fornecedor EPI</xNome></emit>
      <dest><CNPJ>11222333000181</CNPJ><xNome>Distribuidora</xNome></dest>
      <det nItem="1">
        <prod>
          <xProd>Luva de vaqueta</xProd>
          <NCM>42032900</NCM>
          <CFOP>2102</CFOP>
          <qCom>10.0000</qCom>
          <vUnCom>12.50</vUnCom>
        </prod>
      </det>
    </infNFe>
  </NFe>
</nfeProc>`);

assert('chave lida do xml', parsed.accessKey === key);
assert('numero 123', parsed.invoiceNumber === '123');
assert('item inteiro e custo em centavos', parsed.lines[0]?.quantity === 10 && parsed.lines[0].unitCostCents === 1250);
assert('ncm e cfop', parsed.lines[0]?.ncm === '42032900' && parsed.lines[0].cfop === '2102');
assert('destinatario', parsed.recipientCnpj === '11222333000181');

console.log('nfe-xml.rules.selftest ok');

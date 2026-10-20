'use client';

import Link from 'next/link';
import { FormEvent, RefObject } from 'react';
import type { DistributorProduct } from '../lib/distributor';

type DistributorScanPanelProps = {
  inputId: string;
  inputRef: RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (value: string) => void;
  onResolve: (code: string) => void | Promise<void>;
  scannedLabel: string | null;
  products: DistributorProduct[];
  mode: 'entrada' | 'saida';
};

export function DistributorScanPanel({
  inputId,
  inputRef,
  value,
  onChange,
  onResolve,
  scannedLabel,
  products,
  mode,
}: DistributorScanPanelProps) {
  const shortcuts = products
    .filter((product) => product.gtin)
    .slice(0, 6)
    .map((product) => ({
      code: product.gtin!,
      label: product.name,
      sku: product.internalSku,
    }));

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void onResolve(value);
  }

  return (
    <section className="dash-panel scan-panel">
      <h2 className="dash-panel__title">Leitor de código de barras</h2>
      <ol className="scan-panel__how">
        <li>
          Plugue o leitor USB (ou Bluetooth). Ele funciona como teclado — não
          precisa configurar nada neste sistema.
        </li>
        <li>Deixe este campo focado (borda azul) e bipar o produto.</li>
        <li>
          Sem leitor: digite o GTIN ou o SKU e aperte Enter, ou use um atalho
          abaixo.
        </li>
        <li>
          Confira o tamanho/quantidade e registre a {mode === 'entrada' ? 'entrada' : 'saída'}.
        </li>
      </ol>
      <p className="field-hint">
        Sem GTIN na ficha, use o SKU —{' '}
        <Link href="/distribuidora/produtos">complete em Produtos</Link>.
      </p>
      <form className="scan-panel__form" onSubmit={onSubmit}>
        <label htmlFor={inputId}>Aponte o leitor aqui</label>
        <div className="scan-panel__row">
          <input
            ref={inputRef}
            id={inputId}
            className="scan-panel__input"
            value={value}
            autoComplete="off"
            placeholder="Código de barras ou SKU"
            onChange={(e) => onChange(e.target.value)}
          />
          <button type="submit" className="btn btn-primary scan-panel__go">
            Buscar
          </button>
        </div>
      </form>
      {scannedLabel ? <p className="scan-panel__hit">{scannedLabel}</p> : null}
      {shortcuts.length > 0 ? (
        <div className="scan-panel__shortcuts">
          <p className="scan-panel__shortcuts-label">Testar sem leitor (clique):</p>
          <ul className="scan-panel__chips">
            {shortcuts.map((item) => (
              <li key={item.code}>
                <button
                  type="button"
                  className="scan-panel__chip"
                  onClick={() => void onResolve(item.code)}
                  title={`SKU ${item.sku}`}
                >
                  <span className="scan-panel__chip-name">{item.label}</span>
                  <span className="scan-panel__chip-code">{item.code}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="field-hint">
          Nenhum produto com GTIN ainda. Em Produtos, use “Gerar catálogo demo”
          ou preencha o código de barras na ficha.
        </p>
      )}
    </section>
  );
}

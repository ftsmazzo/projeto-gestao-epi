'use client';

export type SizeChipOption = {
  id: string;
  label: string;
  quantity?: number;
};

type Props = {
  options: SizeChipOption[];
  value: string;
  onChange: (variantId: string) => void;
  disabled?: boolean;
  showBalance?: boolean;
  emptyLabel?: string;
};

function displayLabel(label: string) {
  if (label === 'Único' || label === 'Unico') return 'Único';
  return label;
}

export function SizeChips({
  options,
  value,
  onChange,
  disabled = false,
  showBalance = false,
  emptyLabel = 'Nenhum tamanho neste produto.',
}: Props) {
  if (options.length === 0) {
    return <p className="field-hint">{emptyLabel}</p>;
  }

  return (
    <div className="size-chips" role="group" aria-label="Tamanhos">
      {options.map((option) => {
        const selected = option.id === value;
        const label = displayLabel(option.label);
        const balance =
          showBalance && option.quantity != null ? ` (${option.quantity})` : '';
        return (
          <button
            key={option.id}
            type="button"
            className={`size-chip${selected ? ' size-chip--selected' : ''}`}
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(selected ? '' : option.id)}
          >
            {label}
            {balance}
          </button>
        );
      })}
    </div>
  );
}

export function formatVariantConfirmLabel(
  productName: string,
  sizeLabel: string,
  quantity: number | string,
) {
  const size =
    sizeLabel === 'Único' || sizeLabel === 'Unico' ? 'sem numeração' : sizeLabel;
  return `${productName} · ${size} × ${quantity}`;
}

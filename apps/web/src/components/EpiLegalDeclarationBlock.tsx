import {
  EPI_LEGAL_DECLARATION,
  EPI_LEGAL_DECLARATION_VERSION,
  type EpiLegalDeclaration,
} from '@gestao-epi/shared';

type Props = {
  /** Texto plano legado (entregas antigas). */
  plainText?: string;
  /** Versao gravada no documento; se diferente da atual, usa plainText. */
  version?: string;
  declaration?: EpiLegalDeclaration;
};

/**
 * Termo NR-06/CLT diagramado para ficha e comprovante.
 * Entregas com versao antiga continuam mostrando o texto plano gravado.
 */
export function EpiLegalDeclarationBlock({
  plainText,
  version,
  declaration = EPI_LEGAL_DECLARATION,
}: Props) {
  const useStructured =
    !version || version === EPI_LEGAL_DECLARATION_VERSION || !plainText;

  if (!useStructured && plainText) {
    return <p className="epi-doc__term">{plainText}</p>;
  }

  return (
    <div className="epi-doc__legal">
      <p className="epi-doc__legal-intro">{declaration.intro}</p>
      <ol className="epi-doc__legal-list">
        {declaration.obligations.map((item) => (
          <li key={item.letter}>
            <span className="epi-doc__legal-letter">{item.letter})</span>
            <span>{item.text}</span>
          </li>
        ))}
      </ol>
      {declaration.closing.map((paragraph) => (
        <p key={paragraph.slice(0, 48)} className="epi-doc__legal-closing">
          {paragraph}
        </p>
      ))}
    </div>
  );
}

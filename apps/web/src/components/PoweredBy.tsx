import { APP_NAME } from '@gestao-epi/shared';

type Props = {
  compact?: boolean;
};

export function PoweredBy({ compact = false }: Props) {
  return (
    <p className={`powered-by${compact ? ' powered-by--compact' : ''}`}>
      {compact ? (
        <>
          Powered by <strong>{APP_NAME}</strong>
        </>
      ) : (
        <>
          Sistema <strong>{APP_NAME}</strong>
        </>
      )}
    </p>
  );
}

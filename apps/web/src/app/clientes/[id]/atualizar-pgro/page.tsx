'use client';

import { useParams } from 'next/navigation';
import { PgroImportWizard } from '../../../../components/PgroImportWizard';

export default function AtualizarPgroPage() {
  const params = useParams<{ id: string }>();
  const clientId = String(params.id ?? '');
  if (!clientId) {
    return <p className="error">Cliente nao informado.</p>;
  }
  return <PgroImportWizard lockedClientId={clientId} />;
}

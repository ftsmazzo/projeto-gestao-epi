import { redirect } from 'next/navigation';

/** A consulta CAEPI vive no Catalogo de EPIs. */
export default function CaepiRedirectPage() {
  redirect('/epis');
}

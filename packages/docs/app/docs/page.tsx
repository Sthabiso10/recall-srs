import { redirect } from 'next/navigation';

/** /docs has no landing page of its own — send readers to the first chapter. */
export default function DocsIndexPage() {
  redirect('/docs/getting-started');
}

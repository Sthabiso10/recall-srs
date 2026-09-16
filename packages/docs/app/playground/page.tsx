import type { Metadata } from 'next';
import { Playground } from '@/components/Playground';

export const metadata: Metadata = { title: 'Playground' };

export default function PlaygroundPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex max-w-2xl flex-col gap-3">
        <h1 className="text-4xl font-semibold">Playground</h1>
        <p className="opacity-75">
          A real deck running on <code>@recall-srs/adapter-localstorage</code>. Progress is
          saved in this browser only — nothing leaves your machine, and clearing site
          data resets it.
        </p>
      </div>
      <Playground />
    </div>
  );
}

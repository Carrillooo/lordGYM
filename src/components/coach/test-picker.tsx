'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export function TestPicker({
  tests,
  selectedId,
}: {
  tests: { id: string; name: string }[];
  selectedId: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();

  return (
    <label className="block">
      <span className="sr-only">Prueba</span>
      <select
        value={selectedId ?? ''}
        onChange={(event) => {
          const next = new URLSearchParams(params.toString());
          next.set('test', event.target.value);
          router.replace(`/coach/tests?${next.toString()}`, { scroll: false });
        }}
        className="h-9 rounded-lg border border-ink-700 bg-ink-900 px-2.5 text-xs text-ink-100 focus:border-volt-500 focus:outline-none"
      >
        {tests.map((test) => (
          <option key={test.id} value={test.id}>
            {test.name}
          </option>
        ))}
      </select>
    </label>
  );
}

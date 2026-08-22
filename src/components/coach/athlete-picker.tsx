'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function AthletePicker({
  athletes,
  selectedId,
}: {
  athletes: { id: string; name: string }[];
  selectedId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <label className="block">
      <span className="sr-only">Jugador</span>
      <select
        value={selectedId}
        onChange={(event) => {
          const next = new URLSearchParams(params.toString());
          next.set('athlete', event.target.value);
          // Al cambiar de jugador el ejercicio anterior puede no existir.
          next.delete('exercise');
          router.replace(`${pathname}?${next.toString()}`, { scroll: false });
        }}
        className="h-10 rounded-xl border border-ink-700 bg-ink-900 px-3 text-sm text-ink-100 focus:border-volt-500 focus:outline-none"
      >
        {athletes.map((athlete) => (
          <option key={athlete.id} value={athlete.id}>
            {athlete.name}
          </option>
        ))}
      </select>
    </label>
  );
}

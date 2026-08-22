import { requireCoach } from '@/lib/auth/guards';
import { listTests, testComparison } from '@/lib/services/tests';
import { getRoster } from '@/lib/services/roster';
import { todayKey } from '@/lib/domain/datetime';
import { formatNumber, fullName } from '@/lib/domain/labels';
import { Card, CardHeader, PageHeader, EmptyState } from '@/components/ui/primitives';
import { TestForms } from '@/components/coach/test-forms';
import { TestPicker } from '@/components/coach/test-picker';
import { BarsChart } from '@/components/charts/charts';

export const metadata = { title: 'Tests' };

export default async function CoachTestsPage({
  searchParams,
}: {
  searchParams: Promise<{ test?: string }>;
}) {
  const { coach } = await requireCoach();
  const { test } = await searchParams;

  const [tests, roster] = await Promise.all([listTests(coach.id), getRoster(coach.id)]);
  const selected = tests.find((row) => row.id === test) ?? tests[0] ?? null;

  const comparison = selected
    ? await testComparison(
        coach.id,
        selected.id,
        roster.map((entry) => entry.athlete.id),
      )
    : [];

  const nameByAthlete = new Map(
    roster.map((entry) => [entry.athlete.id, fullName(entry.profile.first_name, entry.profile.last_name)]),
  );

  const chartData = comparison
    .filter((row) => row.value !== null)
    .map((row) => ({ label: (nameByAthlete.get(row.athleteId) ?? '').split(' ')[0], value: row.value as number }))
    .sort((a, b) => (selected?.lower_is_better ? a.value - b.value : b.value - a.value));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Valoración"
        title="Tests"
        description="Registra pruebas físicas y compara la evolución del equipo. Menos es mejor en sprints y agilidad."
      />

      {tests.length === 0 ? (
        <EmptyState title="Sin pruebas disponibles" description="Crea la primera prueba para empezar a medir." />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <Card>
              <CardHeader
                title="Comparativa del equipo"
                subtitle={
                  selected
                    ? `${selected.name} (${selected.unit}) · última marca de cada jugador`
                    : 'Selecciona una prueba'
                }
                action={<TestPicker tests={tests.map((row) => ({ id: row.id, name: row.name }))} selectedId={selected?.id ?? null} />}
              />

              {chartData.length === 0 ? (
                <p className="rounded-xl border border-dashed border-ink-700 px-4 py-10 text-center text-sm text-ink-500">
                  Todavía no hay resultados registrados para esta prueba.
                </p>
              ) : (
                <>
                  <BarsChart data={chartData} unit={selected?.unit} color="data" height={240} />
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[380px] text-sm">
                      <thead>
                        <tr className="border-b border-ink-800 text-left text-xs uppercase tracking-wider text-ink-500">
                          <th scope="col" className="py-2 pr-3 font-medium">Jugador</th>
                          <th scope="col" className="py-2 pr-3 font-medium">Marca</th>
                          <th scope="col" className="py-2 font-medium">Fecha</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-850">
                        {comparison.map((row) => (
                          <tr key={row.athleteId}>
                            <td className="py-2.5 pr-3 text-ink-100">{nameByAthlete.get(row.athleteId)}</td>
                            <td className="tabular py-2.5 pr-3 text-ink-200">
                              {row.value === null ? '—' : `${formatNumber(row.value, 2)} ${selected?.unit ?? ''}`}
                            </td>
                            <td className="py-2.5 text-ink-500">{row.date ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Card>

            <TestForms
              tests={tests.map((row) => ({ id: row.id, name: row.name, unit: row.unit }))}
              athletes={roster.map((entry) => ({
                id: entry.athlete.id,
                name: fullName(entry.profile.first_name, entry.profile.last_name),
              }))}
              today={todayKey()}
            />
          </div>
        </>
      )}
    </div>
  );
}

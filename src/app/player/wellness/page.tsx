import { requireAthlete } from '@/lib/auth/guards';
import { painHistory, wellnessHistory, wellnessToday } from '@/lib/services/wellness';
import { todayKey } from '@/lib/domain/datetime';
import { Card, CardHeader, PageHeader } from '@/components/ui/primitives';
import { TrendChart } from '@/components/charts/charts';
import { WellnessForm } from '@/components/player/wellness-form';
import { PainForm } from '@/components/player/pain-form';

export const metadata = { title: 'Bienestar' };

export default async function PlayerWellnessPage() {
  const { athlete } = await requireAthlete();
  const today = todayKey();

  const [existing, history, pains] = await Promise.all([
    wellnessToday(athlete.id, today),
    wellnessHistory(athlete.id, 30, today),
    painHistory(athlete.id, 90, today),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bienestar"
        description="Tu entrenador usa estos datos para ajustar cargas. Cuanto más honesto, mejor planificación."
      />

      <WellnessForm today={today} existing={existing} />

      {history.length > 1 ? (
        <Card>
          <CardHeader title="Tendencia de fatiga" subtitle="Últimos 30 días" />
          <TrendChart
            data={history.map((row) => ({ date: row.date, value: row.fatigue }))}
            color="amber"
            height={180}
            variant="line"
          />
          <div className="mt-4">
            <CardHeader title="Sueño" subtitle="Escala 1–5" className="mb-2" />
            <TrendChart
              data={history.map((row) => ({ date: row.date, value: row.sleep }))}
              color="teal"
              height={160}
              variant="line"
            />
          </div>
        </Card>
      ) : null}

      <PainForm today={today} history={pains} />
    </div>
  );
}

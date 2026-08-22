import Link from 'next/link';
import { CalendarRange, Copy, ListChecks } from 'lucide-react';
import { requireCoach } from '@/lib/auth/guards';
import { listPrograms } from '@/lib/services/programs';
import { formatShortDate } from '@/lib/domain/datetime';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { duplicateProgramAction } from '@/lib/actions/programs';
import { NewProgramForm } from '@/components/coach/new-program-form';

export const metadata = { title: 'Programas' };

export default async function CoachProgramsPage() {
  const { coach } = await requireCoach();
  const programs = await listPrograms(coach.id);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Planificación"
        title="Programas"
        description="Bloques de varias semanas. Al asignarlos se vuelcan automáticamente al calendario de los jugadores."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          {programs.length === 0 ? (
            <EmptyState
              icon={<ListChecks className="h-6 w-6" />}
              title="Todavía no hay programas"
              description="Crea uno de 8 semanas para la pretemporada y coloca en cada semana las sesiones que ya tienes."
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {programs.map((program) => (
                <li key={program.id}>
                  <Card className="flex h-full flex-col">
                    <Link href={`/coach/programs/${program.id}`} className="flex-1">
                      <h2 className="font-semibold uppercase leading-tight text-ink-50">{program.name}</h2>
                      {program.description ? (
                        <p className="mt-2 line-clamp-2 text-sm text-ink-400">{program.description}</p>
                      ) : null}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge tone="volt">
                          <CalendarRange className="h-3 w-3" />
                          {program.weeks_count} semanas
                        </Badge>
                        <Badge>{program.workoutCount} sesiones</Badge>
                        {program.start_date ? <Badge>Inicio {formatShortDate(program.start_date)}</Badge> : null}
                      </div>
                    </Link>
                    <form action={duplicateProgramAction} className="mt-4 border-t border-ink-800 pt-3">
                      <input type="hidden" name="programId" value={program.id} />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-50"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Duplicar programa
                      </button>
                    </form>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Card>
          <NewProgramForm />
        </Card>
      </div>
    </div>
  );
}

'use client';

import { useActionState } from 'react';
import { createTestAction, recordTestResultAction } from '@/lib/actions/tests';
import { idleState } from '@/lib/actions/state';
import { Alert, Card, CardHeader } from '@/components/ui/primitives';
import { Input, Select, SubmitButton, Textarea } from '@/components/ui/form';

export function TestForms({
  tests,
  athletes,
  today,
}: {
  tests: { id: string; name: string; unit: string }[];
  athletes: { id: string; name: string }[];
  today: string;
}) {
  const [resultState, resultAction] = useActionState(recordTestResultAction, idleState);
  const [testState, testAction] = useActionState(createTestAction, idleState);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Registrar resultado" subtitle="Una marca por jugador y fecha." />
        {athletes.length === 0 ? (
          <p className="text-sm text-ink-500">Necesitas jugadores vinculados.</p>
        ) : (
          <form action={resultAction} className="space-y-3">
            <Select label="Prueba" name="testId" required>
              {tests.map((test) => (
                <option key={test.id} value={test.id}>
                  {test.name} ({test.unit})
                </option>
              ))}
            </Select>
            <Select label="Jugador" name="athleteId" required>
              {athletes.map((athlete) => (
                <option key={athlete.id} value={athlete.id}>
                  {athlete.name}
                </option>
              ))}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Marca" name="value" type="text" inputMode="decimal" required placeholder="3,31" />
              <Input label="Fecha" name="date" type="date" defaultValue={today} required />
            </div>
            <Textarea label="Nota" name="note" rows={2} />
            {resultState.status === 'error' ? <Alert>{resultState.message}</Alert> : null}
            {resultState.status === 'success' ? <Alert tone="success">{resultState.message}</Alert> : null}
            <SubmitButton className="w-full" pendingLabel="Guardando…">
              Registrar
            </SubmitButton>
          </form>
        )}
      </Card>

      <Card>
        <CardHeader title="Nueva prueba" subtitle="Añade pruebas propias a la batería de tests." />
        <form action={testAction} className="space-y-3">
          <Input label="Nombre" name="name" required placeholder="Sprint 40 m" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Unidad" name="unit" required placeholder="s" />
            <Input label="Categoría" name="category" placeholder="Velocidad" />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-300">
            <input
              type="checkbox"
              name="lowerIsBetter"
              className="h-4 w-4 rounded border-ink-600 bg-ink-900 accent-[var(--color-volt-500)]"
            />
            Menos es mejor (sprints, agilidad)
          </label>
          {testState.status === 'error' ? <Alert>{testState.message}</Alert> : null}
          {testState.status === 'success' ? <Alert tone="success">{testState.message}</Alert> : null}
          <SubmitButton variant="secondary" className="w-full" pendingLabel="Creando…">
            Crear prueba
          </SubmitButton>
        </form>
      </Card>
    </div>
  );
}

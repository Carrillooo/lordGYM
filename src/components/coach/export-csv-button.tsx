'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Exportación a CSV (§58). Se genera en el cliente, sin enviar datos fuera. */
export function ExportCsvButton({
  rows,
  filename,
  label = 'Exportar CSV',
}: {
  rows: string[][];
  filename: string;
  label?: string;
}) {
  function download() {
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(';'))
      .join('\n');
    // BOM para que Excel en español respete los acentos.
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="secondary" size="sm" onClick={download}>
      <Download className="h-4 w-4" />
      {label}
    </Button>
  );
}

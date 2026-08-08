
export function errorMessage(err: unknown, depth = 0): string {

  if (err instanceof Error) {
    return err.message && err.message.trim() !== '' ? err.message : err.name || 'Unknown error';
  }

  if (typeof err === 'string') {
    return err.trim() !== '' ? err : 'Unknown error';
  }

  if (typeof err === 'number' || typeof err === 'boolean') {
    return String(err);
  }

  if (err && typeof err === 'object' && depth < 5) {
    const o = err as Record<string, unknown>;

    for (const k of ['message', 'error_description', 'error', 'msg', 'reason']) {
      const v = o[k];
      if (typeof v === 'string' && v.trim() !== '') return v.trim();
      if (v && typeof v === 'object' && v !== err) {
        const nested = errorMessage(v, depth + 1);
        if (nested !== 'Unknown error') return nested;
      }
    }

    const bits: string[] = [];
    for (const k of ['details', 'hint', 'code'] as const) {
      const v = o[k];
      if (typeof v === 'string' && v.trim() !== '') bits.push(v.trim());
    }
    if (bits.length > 0) return bits.join(' — ');

    try {
      const json = JSON.stringify(o);
      if (json && json !== '{}' && json.length < 160) return json;
    } catch {  }
  }
  return 'Unknown error';
}

export function errorDetail(err: unknown): string | undefined {
  if (err == null) return undefined;
  if (typeof err === 'string' || typeof err === 'number' || typeof err === 'boolean') return undefined;
  if (err instanceof Error) return undefined;
  try {
    const json = JSON.stringify(err);
    return json && json !== '{}' && json !== '[]' ? json.slice(0, 500) : undefined;
  } catch {
    return undefined;
  }
}

export function safeMessage(message: string): string {
  if (isGarbageMessage(message)) return 'Something went wrong while loading.';
  return message;
}

export function isGarbageMessage(message: string | null | undefined): boolean {
  if (!message) return true;
  const t = message.trim();
  if (t === '') return true;

  if (/^(null|undefined)$/i.test(t)) return true;

  if (/^\[object .+\]$/i.test(t)) return true;
  return false;
}

export interface GatedErrorEntry {
  message: string;
  detail?: string;
  [k: string]: unknown;
}

export function gateErrorEntry(e: GatedErrorEntry): {
  entry: GatedErrorEntry;
  sentinel?: GatedErrorEntry;
} {
  if (!isGarbageMessage(e.message)) {
    return { entry: e };
  }
  const raw = e.message;
  const sentinel: GatedErrorEntry = {
    ...e,
    action: 'error_gate',
    message: `GARBAGE ERROR MESSAGE INTERCEPTED (was: ${raw}) — see detail for the raw object. This means a catch site stringified a non-Error object instead of extracting its message.`,
    detail: `RAW=${String(e.detail ?? '')} | GARBAGE=${raw}`
  };
  const entry: GatedErrorEntry = {
    ...e,
    message: 'Error occurred (unclear message intercepted by error gate — see error_gate log).',
    detail: `Garbage message replaced by error gate. ${String(e.detail ?? '')}`.trim()
  };
  return { entry, sentinel };
}

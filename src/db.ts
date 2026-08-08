
import type { Bill, BillStatus, Room } from './engine';
import { DEFAULT_SURCHARGE } from './engine';
import { SEED_BILLS } from './seed-data';
import { gateErrorEntry, isGarbageMessage } from './errors';

export interface Building {
  id: number;
  name: string;
  active: boolean;
}

export interface Settings {
  rate: number;
  surcharge: number;
}

export interface LogEntry {
  id: number;
  ts: string;
  event: string;
  building?: string;
  month?: string;
  rate?: number;
  surcharge?: number;
  rooms?: number;
  total?: number;
  msg?: string;
}

export interface ErrorEntry {
  id: number;
  ts: string;
  action: string;
  building?: string;
  month?: string;
  room?: string;
  rate?: number;
  message: string;
  detail?: string;
  stack?: string;
  url?: string;
  userAgent?: string;
}

export interface DataAdapter {
  getBuildings(): Promise<Building[]>;
  getRooms(buildingId: number): Promise<Room[]>;
  getBills(month: string): Promise<Bill[]>;
  getAllBills(): Promise<Bill[]>;
  getBill(roomId: number, month: string): Promise<Bill | null>;
  getPreviousBills(roomIds: number[], month: string): Promise<Bill[]>;
  upsertBills(bills: Bill[]): Promise<void>;
  getSettings(): Promise<Settings>;
  saveSettings(rate: number, surcharge: number): Promise<void>;
  logEvent(e: Omit<LogEntry, 'id' | 'ts'>): Promise<void>;
  getLogs(): Promise<LogEntry[]>;
  reportError(e: Omit<ErrorEntry, 'id' | 'ts'>): Promise<void>;
  unlock(email: string, key: string): Promise<{ ok: boolean; message?: string }>;
  lockout(): void;
}

const LS_BILLS = 'sioneloflow.bills.v2';
const LS_SETTINGS = 'sioneloflow.settings.v3';
const LS_LOG = 'sioneloflow.log.v1';
const LS_ERRORS = 'sioneloflow.errors.v1';

const LOCAL_MASTER_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function seedAll(): Bill[] {
  const roomById = new Map<string, Room>();
  for (const room of ROOMS) roomById.set(room.number, room);

  const bills: Bill[] = [];
  for (const s of SEED_BILLS) {
    const room = roomById.get(s.room);
    if (!room) continue;
    bills.push({
      roomId: room.id,
      roomNumber: room.number,
      floor: room.floor,
      month: s.month,
      rate: s.rate,
      prevReading: s.prev,
      presReading: s.pres,
      consumption: s.consumption,
      subtotal: s.pres === null ? 0 : Math.round(s.consumption * s.rate * 100) / 100,
      surcharge: s.surcharge,
      total: s.total,
      status: s.status,
      paidDate: null
    });
  }
  return bills;
}

function ramosRooms(): Room[] {
  const rooms: Room[] = [];
  let id = 1;
  const byFloor: Record<number, string[]> = {
    1: ['2','3','4','5','6'],
    2: ['7','8','9','10','11','12'],
    3: ['13','14','15','16','17','18'],
    4: ['19','20']
  };
  for (const [floor, nums] of Object.entries(byFloor)) {
    for (const n of nums) {
      rooms.push({ id: id++, buildingId: 1, number: n, floor: Number(floor), side: null, wing: n === '19' || n === '20' ? 'gate' : null, active: true });
    }
  }
  return rooms;
}

function empressRooms(): Room[] {
  const rooms: Room[] = [];
  let id = 100;
  const perFloor: Record<number, number> = { 1: 4, 2: 4, 3: 4, 4: 4, 5: 3 };
  for (const [floorStr, count] of Object.entries(perFloor)) {
    const floor = Number(floorStr);
    for (let i = 1; i <= count; i++) {
      for (const side of ['A', 'B'] as const) {
        rooms.push({ id: id++, buildingId: 2, number: `${floor}${String(i).padStart(2, '0')} ${side}`, floor, side, wing: null, active: true });
      }
    }
  }
  return rooms;
}

export const BUILDINGS: Building[] = [
  { id: 1, name: 'Ramos', active: true },
  { id: 2, name: 'Empress', active: true }
];

export const ROOMS: Room[] = [...ramosRooms(), ...empressRooms()];

function loadBills(): Bill[] {
  try {
    const raw = localStorage.getItem(LS_BILLS);
    return raw ? JSON.parse(raw) : seedAll();
  } catch {
    return seedAll();
  }
}

function persistBills(bills: Bill[]): void {
  localStorage.setItem(LS_BILLS, JSON.stringify(bills));
}

export class LocalAdapter implements DataAdapter {
  private bills: Bill[] = loadBills();

  constructor() {
    try {
      const raw = localStorage.getItem(LS_ERRORS);
      if (!raw) return;
      const errs: ErrorEntry[] = JSON.parse(raw);
      const clean = errs.filter(x => !isGarbageMessage(x.message));
      if (clean.length !== errs.length) localStorage.setItem(LS_ERRORS, JSON.stringify(clean));
    } catch {  }
  }

  async getBuildings(): Promise<Building[]> {
    return BUILDINGS.filter(b => b.active);
  }

  async getRooms(buildingId: number): Promise<Room[]> {

    return ROOMS
      .filter(r => r.buildingId === buildingId && r.active)
      .sort((a, b) => a.floor - b.floor || numericRoomKey(a.number) - numericRoomKey(b.number) || a.number.localeCompare(b.number));
  }

  async getBills(month: string): Promise<Bill[]> {
    return this.bills.filter(b => b.month === month);
  }

  async getAllBills(): Promise<Bill[]> {
    return [...this.bills];
  }

  async getBill(roomId: number, month: string): Promise<Bill | null> {
    return this.bills.find(b => b.roomId === roomId && b.month === month) ?? null;
  }

  async getPreviousBills(roomIds: number[], month: string): Promise<Bill[]> {
    const set = new Set(roomIds);
    const prior = this.bills
      .filter(b => set.has(b.roomId) && b.month < month)
      .sort((a, b) => (a.month < b.month ? 1 : a.month > b.month ? -1 : 0));
    const map = new Map<number, Bill>();
    for (const b of prior) if (!map.has(b.roomId)) map.set(b.roomId, b);
    return [...map.values()];
  }

  async upsertBills(incoming: Bill[]): Promise<void> {
    for (const bill of incoming) {
      const idx = this.bills.findIndex(b => b.roomId === bill.roomId && b.month === bill.month);
      if (idx >= 0) this.bills[idx] = { ...this.bills[idx], ...bill };
      else this.bills.push(bill);
    }
    persistBills(this.bills);
  }

  async getSettings(): Promise<Settings> {
    try {
      const raw = localStorage.getItem(LS_SETTINGS);
      if (raw) return JSON.parse(raw);
    } catch {  }

    return { rate: 0, surcharge: DEFAULT_SURCHARGE };
  }

  async saveSettings(rate: number, surcharge: number): Promise<void> {
    localStorage.setItem(LS_SETTINGS, JSON.stringify({ rate, surcharge }));
  }

  async logEvent(e: Omit<LogEntry, 'id' | 'ts'>): Promise<void> {
    try {
      const raw = localStorage.getItem(LS_LOG);
      const log: LogEntry[] = raw ? JSON.parse(raw) : [];
      log.push({ id: Date.now() + Math.floor(Math.random() * 1000), ts: new Date().toISOString(), ...e });
      const capped = log.length > 500 ? log.slice(-500) : log;
      localStorage.setItem(LS_LOG, JSON.stringify(capped));
      console.info('[log]', capped[capped.length - 1]);
    } catch (err) {
      console.error('[log] failed', err);
    }
  }

  async getLogs(): Promise<LogEntry[]> {
    try {
      const raw = localStorage.getItem(LS_LOG);
      const log: LogEntry[] = raw ? JSON.parse(raw) : [];
      return [...log].reverse();
    } catch {
      return [];
    }
  }

  async reportError(e: Omit<ErrorEntry, 'id' | 'ts'>): Promise<void> {
    try {
      const { entry, sentinel } = gateErrorEntry(e);
      const raw = localStorage.getItem(LS_ERRORS);
      const errs: ErrorEntry[] = raw ? JSON.parse(raw) : [];

      const clean = errs.filter(x => !isGarbageMessage(x.message));
      const push = (x: import('./errors').GatedErrorEntry) => {

        clean.push({ ...x, id: Date.now() + Math.floor(Math.random() * 1000), ts: new Date().toISOString() } as unknown as ErrorEntry);
      };
      push(entry);
      if (sentinel) push(sentinel);
      const capped = clean.length > 200 ? clean.slice(-200) : clean;
      localStorage.setItem(LS_ERRORS, JSON.stringify(capped));
      console.error('[error]', entry.action, entry.message, entry.detail ?? '');
    } catch {

    }
  }

  async unlock(_email: string, key: string): Promise<{ ok: boolean; message?: string }> {
    const hash = await sha256(key);
    if (hash === LOCAL_MASTER_HASH) return { ok: true };
    return { ok: false, message: 'Access denied. Try again.' };
  }

  lockout(): void {

  }
}

async function ensureLocalSeed(supabase: { from: (t: string) => any }): Promise<void> {

  const { count, error } = await supabase.from('buildings').select('id', { count: 'exact', head: true });
  if (error) throw error;
  if (count && count > 0) return;
  const { error: bErr } = await supabase.from('buildings').insert(
    BUILDINGS.map(b => ({ id: b.id, name: b.name, active: b.active }))
  );
  if (bErr) throw bErr;
  const { error: rErr } = await supabase.from('rooms').insert(
    ROOMS.map(r => ({ id: r.id, building_id: r.buildingId, number: r.number, floor: r.floor, side: r.side, wing: r.wing, active: r.active }))
  );
  if (rErr) throw rErr;
  const bills = SEED_BILLS.map(s => {
    const bld = BUILDINGS.find(b => b.name === s.building);
    const room = ROOMS.find(r => r.buildingId === bld?.id && r.number === s.room);
    if (!room) return null;
    return {
      room_id: room.id,
      month: s.month,
      rate: s.rate,
      prev_reading: s.prev,
      pres_reading: s.pres,
      consumption: s.consumption,
      subtotal: s.pres === null ? 0 : Math.round(s.consumption * s.rate * 100) / 100,
      surcharge: s.surcharge,
      total: s.total,
      status: s.status
    };
  }).filter((x): x is NonNullable<typeof x> => x !== null);
  if (bills.length > 0) {
    const { error: blErr } = await supabase.from('bills').insert(bills);
    if (blErr) throw blErr;
  }
}

async function supabaseAdapter(): Promise<DataAdapter | null> {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
  const url = env.VITE_SUPABASE_URL;
  const anon = env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const { createClient } = await import('@supabase/supabase-js');

  const isDev = import.meta.env.DEV;
  const supabase = createClient(url, anon, {
    auth: { persistSession: false },
    db: isDev ? { schema: 'local' } : undefined
  });

  let localSeeded = false;
  async function seedLocalOnce(): Promise<void> {
    if (!isDev || localSeeded) return;
    try {
      await ensureLocalSeed(supabase as { from: (t: string) => any });
      localSeeded = true;

    } catch (err) {
      console.error('[local seed]', err);
    }
  }

  return {
    async unlock(email: string, key: string): Promise<{ ok: boolean; message?: string }> {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: key });
      if (error) {

        const em = error.message.toLowerCase();
        if (em.includes('future')) {
          return { ok: false, message: 'Your device clock is ahead — enable automatic date & time, then try again.' };
        }
        const msg = em.includes('invalid login')
          ? 'Access denied. Wrong email or key.'
          : error.message;
        return { ok: false, message: msg };
      }
      if (!data.session) return { ok: false, message: 'No session returned.' };
      return { ok: true };
    },
    lockout(): void {
      void supabase.auth.signOut().catch(() => {});
    },
    async getBuildings() {
      await seedLocalOnce();
      const { data, error } = await supabase.from('buildings').select('*').eq('active', true).order('id');
      if (error) throw error;
      return data as Building[];
    },
    async getRooms(buildingId: number) {

      const { data, error } = await supabase.from('rooms').select('*').eq('building_id', buildingId).eq('active', true);
      if (error) throw error;
      return (data as any[])
        .map(r => ({ id: r.id, buildingId: r.building_id, number: r.number, floor: r.floor, side: r.side, wing: r.wing, active: r.active }))
        .sort((a, b) => a.floor - b.floor || numericRoomKey(a.number) - numericRoomKey(b.number) || a.number.localeCompare(b.number)) as Room[];
    },
    async getBills(month: string) {
      const { data, error } = await supabase.from('bills').select('*').eq('month', month);
      if (error) throw error;
      return (data as any[]).map(b => toBill(b));
    },
    async getAllBills() {
      const { data, error } = await supabase.from('bills').select('*').order('month');
      if (error) throw error;
      return (data as any[]).map(b => toBill(b));
    },
    async getBill(roomId: number, month: string) {
      const { data, error } = await supabase.from('bills').select('*').eq('room_id', roomId).eq('month', month).maybeSingle();
      if (error) throw error;
      return data ? toBill(data) : null;
    },
    async getPreviousBills(roomIds: number[], month: string) {
      if (roomIds.length === 0) return [];
      const { data, error } = await supabase
        .from('bills')
        .select('*')
        .in('room_id', roomIds)
        .lt('month', month)
        .order('month', { ascending: false });
      if (error) throw error;
      const map = new Map<number, Bill>();
      for (const row of (data as any[])) {
        const bill = toBill(row);
        if (!map.has(bill.roomId)) map.set(bill.roomId, bill);
      }
      return [...map.values()];
    },
    async upsertBills(bills: Bill[]) {
      const rows = bills.map(b => fromBill(b));

      const { error } = await supabase.from('bills').upsert(rows, { onConflict: 'room_id,month' });
      if (error) throw error;
    },
    async getSettings() {
      const { data, error } = await supabase.from('settings').select('key, value');
      if (error) throw error;
      const map = new Map((data as any[]).map(s => [s.key, s.value]));

      return { rate: parseFloat(map.get('rate') ?? '0'), surcharge: parseFloat(map.get('surcharge') ?? '50') };
    },
    async saveSettings(rate: number, surcharge: number) {
      const { error } = await supabase.from('settings').upsert([
        { key: 'rate', value: String(rate) },
        { key: 'surcharge', value: String(surcharge) }
      ]);
      if (error) throw error;
    },
    async logEvent(e: Omit<LogEntry, 'id' | 'ts'>) {
      const { error } = await supabase.from('logs').insert(e);
      if (error) console.error('[log] supabase insert failed', error);
    },
    async getLogs() {
      const { data, error } = await supabase.from('logs').select('*').order('id', { ascending: false }).limit(200);
      if (error) throw error;
      return (data as any[]).map(r => ({ id: r.id, ts: r.ts, event: r.event, building: r.building ?? undefined, month: r.month ?? undefined, rate: r.rate == null ? undefined : Number(r.rate), surcharge: r.surcharge == null ? undefined : Number(r.surcharge), rooms: r.rooms == null ? undefined : Number(r.rooms), total: r.total == null ? undefined : Number(r.total), msg: r.msg ?? undefined }) as LogEntry);
    },
    async reportError(e: Omit<ErrorEntry, 'id' | 'ts'>) {
      try {

        const { entry, sentinel } = gateErrorEntry(e);
        const { error } = await supabase.from('app_errors').insert(entry);
        if (error) console.error('[error] supabase insert failed', entry.action, error.message);
        if (sentinel) {
          const s = await supabase.from('app_errors').insert(sentinel);
          if (s.error) console.error('[error] sentinel insert failed', s.error.message);
        }
      } catch (err) {
        console.error('[error] reportError failed', err);
      }
    }
  };
}

function numericRoomKey(n: string): number {
  const m = /^(\d+)/.exec(n);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

function toBill(row: any): Bill {
  return {
    id: row.id,
    roomId: row.room_id,
    roomNumber: row.room_number ?? '',
    floor: row.floor ?? 0,
    month: row.month,
    rate: Number(row.rate),

    prevReading: row.prev_reading === null || row.prev_reading === undefined ? null : Number(row.prev_reading),
    presReading: row.pres_reading === null || row.pres_reading === undefined ? null : Number(row.pres_reading),
    consumption: Number(row.consumption),
    subtotal: Number(row.subtotal ?? 0),
    surcharge: Number(row.surcharge),
    total: Number(row.total),
    status: (row.status ?? 'unpaid') as BillStatus,
    paidDate: row.paid_date ?? null
  };
}

function fromBill(b: Bill): Record<string, unknown> {
  return {
    room_id: b.roomId,
    month: b.month,
    rate: b.rate,
    prev_reading: b.prevReading,
    pres_reading: b.presReading,
    consumption: b.consumption,
    subtotal: b.subtotal,
    surcharge: b.surcharge,
    total: b.total,
    status: b.status,
    paid_date: b.paidDate
  };
}

let adapterPromise: Promise<DataAdapter> | null = null;

async function adapter(): Promise<DataAdapter> {
  if (!adapterPromise) {
    adapterPromise = supabaseAdapter().then(s => s ?? new LocalAdapter());
  }
  return adapterPromise;
}

export const api = {
  getBuildings: () => adapter().then(a => a.getBuildings()),
  getRooms: (id: number) => adapter().then(a => a.getRooms(id)),
  getBills: (month: string) => adapter().then(a => a.getBills(month)),
  getAllBills: () => adapter().then(a => a.getAllBills()),
  getBill: (roomId: number, month: string) => adapter().then(a => a.getBill(roomId, month)),
  getPreviousBills: (roomIds: number[], month: string) => adapter().then(a => a.getPreviousBills(roomIds, month)),
  upsertBills: (bills: Bill[]) => adapter().then(a => a.upsertBills(bills)),
  getSettings: () => adapter().then(a => a.getSettings()),
  saveSettings: (rate: number, surcharge: number) => adapter().then(a => a.saveSettings(rate, surcharge)),
  logEvent: (e: Omit<LogEntry, 'id' | 'ts'>) => adapter().then(a => a.logEvent(e)),
  getLogs: () => adapter().then(a => a.getLogs()),
  reportError: (e: Omit<ErrorEntry, 'id' | 'ts'>) => adapter().then(a => a.reportError(e)),
  unlock: (email: string, key: string) => adapter().then(a => a.unlock(email, key)),
  lockout: () => void adapter().then(a => a.lockout()),
  usingSupabase: () => adapter().then(() => !!(import.meta as { env?: Record<string, string | undefined> }).env?.VITE_SUPABASE_URL)
};

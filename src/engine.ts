
export const DEFAULT_SURCHARGE = 50;

export interface Room {
  id: number;
  buildingId: number;
  number: string;
  floor: number;
  side: 'A' | 'B' | null;
  wing: 'gate' | null;
  active: boolean;
}

export function orderRooms(rooms: Room[]): Room[] {
  return [...rooms].sort((a, b) => {
    const as = a.side, bs = b.side;
    if (as !== bs) {
      if (as === 'A') return -1;
      if (bs === 'A') return 1;
      if (as === 'B') return -1;
      return 1;
    }
    const af = a.floor ?? 0, bf = b.floor ?? 0;
    if (af !== bf) return af - bf;
    const an = parseInt(a.number, 10) || 0;
    const bn = parseInt(b.number, 10) || 0;
    if (an !== bn) return an - bn;
    return a.number.localeCompare(b.number);
  });
}

export type BillStatus = 'unpaid' | 'paid';

export interface Bill {
  id?: number;
  roomId: number;
  roomNumber: string;
  floor: number;
  month: string;
  rate: number;

  prevReading: number | null;
  presReading: number | null;
  consumption: number;
  subtotal: number;
  surcharge: number;
  total: number;
  status: BillStatus;
  paidDate: string | null;
}

export interface BillResult {
  consumption: number;
  subtotal: number;
  total: number;
}

export function computeBill(prev: number | null, pres: number | null, rate: number, surcharge: number = DEFAULT_SURCHARGE): BillResult {

  const consumption = pres === null || prev === null ? 0 : Math.max(0, pres - prev);
  const subtotal = Math.ceil(round2(consumption * rate));
  const total = subtotal + surcharge;
  return { consumption: round1(consumption), subtotal, total };
}

export function money(n: number): string {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function reading(n: number | null): string {
  return n === null ? '—' : n.toLocaleString('en-PH', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function monthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${names[m - 1]} ${y}`;
}

export function monthShortLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${names[m - 1]} '${String(y).slice(2)}`;
}

export function lastMonths(from: Date, count = 12): string[] {
  const keys: string[] = [];
  const d = new Date(from.getFullYear(), from.getMonth(), 1);
  for (let i = 0; i < count; i++) {
    keys.push(monthKey(d));
    d.setMonth(d.getMonth() - 1);
  }
  return keys;
}

export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];


export interface SeedBill {
  building: string;
  room: string;
  month: string;
  rate: number;
  prev: number;
  pres: number | null;
  surcharge: number;
  consumption: number;
  total: number;
  status: 'unpaid' | 'paid';
}

export const SEED_BILLS: SeedBill[] = [

  { building: 'Ramos', room: '2', month: '2026-06', rate: 86.5, prev: 100, pres: 106.5, surcharge: 50, consumption: 6.5, total: 613, status: 'unpaid' },
  { building: 'Ramos', room: '3', month: '2026-06', rate: 86.5, prev: 200, pres: 203.4, surcharge: 50, consumption: 3.4, total: 345, status: 'unpaid' },
  { building: 'Ramos', room: '4', month: '2026-06', rate: 86.5, prev: 150, pres: 155, surcharge: 50, consumption: 5, total: 483, status: 'unpaid' },
  { building: 'Ramos', room: '5', month: '2026-06', rate: 86.5, prev: 60, pres: 61.3, surcharge: 50, consumption: 1.3, total: 163, status: 'unpaid' },

  { building: 'Ramos', room: '2', month: '2026-07', rate: 86.5, prev: 106.5, pres: null, surcharge: 50, consumption: 0, total: 50, status: 'unpaid' },

  { building: 'Empress', room: '101 A', month: '2026-06', rate: 45.5, prev: 500, pres: 504.2, surcharge: 50, consumption: 4.2, total: 242, status: 'unpaid' },
  { building: 'Empress', room: '101 B', month: '2026-06', rate: 45.5, prev: 700, pres: 702.1, surcharge: 50, consumption: 2.1, total: 146, status: 'unpaid' },
  { building: 'Empress', room: '102 A', month: '2026-06', rate: 45.5, prev: 300, pres: 302, surcharge: 50, consumption: 2, total: 141, status: 'unpaid' },
  { building: 'Empress', room: '201 A', month: '2026-06', rate: 45.5, prev: 900, pres: 904.6, surcharge: 50, consumption: 4.6, total: 260, status: 'unpaid' },

  { building: 'Empress', room: '101 A', month: '2026-07', rate: 45.5, prev: 504.2, pres: null, surcharge: 50, consumption: 0, total: 50, status: 'unpaid' },
];

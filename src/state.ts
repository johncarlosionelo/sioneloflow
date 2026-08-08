
type Listener = () => void;

function createStore<T extends object>(initial: T) {
  let state: T = initial;
  const listeners = new Set<Listener>();

  function set(patch: Partial<T>) {
    state = { ...state, ...patch };
    listeners.forEach(l => l());
  }

  function get(): T {
    return state;
  }

  function subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return { set, get, subscribe };
}

export interface AppState {
  ready: boolean;
  authed: boolean;
  buildingId: number;
  buildingName: string;
  month: string;
  rate: number;
  surcharge: number;
  floor: number;
  rooms: import('./engine').Room[];
  bills: Record<string, import('./engine').Bill>;
  saving: boolean;
}

export const state = createStore<AppState>({
  ready: false,
  authed: false,
  buildingId: 1,
  buildingName: 'Ramos',
  month: '',

  rate: 0,
  surcharge: 50,
  floor: 1,
  rooms: [],
  bills: {},
  saving: false
});

export { createStore };

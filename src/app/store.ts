export type Unsubscribe = () => void;

export type Store<State> = {
  getState(): State;
  setState(patch: Partial<State>): void;
  subscribe(fn: (s: State) => void): Unsubscribe;
};

export function createStore<State extends Record<string, any>>(initial: State): Store<State> {
  let state = initial;
  const listeners = new Set<(s: State) => void>();

  return {
    getState: () => state,
    setState: (patch) => {
      state = Object.assign({}, state, patch);
      listeners.forEach((fn) => {
        try {
          fn(state);
        } catch {
          // ignore
        }
      });
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    }
  };
}

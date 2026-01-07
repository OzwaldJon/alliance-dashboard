import { createLsPrefix } from './storage';

export type StorageApi = {
  LS_BASE_PREFIX: string;
  LS_PREFIX: string;
  save(key: string, value: any): void;
  load<T>(key: string, defVal: T): T;
  migrateLegacyLocalStorageToWorldPrefix(): void;
};

export function createStorageApi(opts?: { basePrefix?: string }): StorageApi {
  const LS_BASE_PREFIX = (opts?.basePrefix ? String(opts.basePrefix) : 'AllianceDashboard_v01_') || 'AllianceDashboard_v01_';
  const LS_PREFIX = createLsPrefix(LS_BASE_PREFIX);

  function save(key: string, value: any): void {
    try {
      localStorage.setItem(String(key), JSON.stringify(value));
    } catch {
      // ignore
    }
  }

  function load<T>(key: string, defVal: T): T {
    try {
      const raw = localStorage.getItem(String(key));
      if (raw === null || raw === undefined) return defVal;
      return JSON.parse(raw) as T;
    } catch {
      return defVal;
    }
  }

  function getHostKey(): string {
    try {
      const host = window && window.location && window.location.hostname ? String(window.location.hostname) : '';
      const first = host.split('.')[0] ? String(host.split('.')[0]) : host;
      const key = first || host || 'unknown';
      return key.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    } catch {
      return 'unknown';
    }
  }

  function parseNamespace(prefix: string): { worldKey: string; playerKey: string } {
    try {
      const parts = String(prefix || '').split('__');
      // expected: <basePrefix>__<worldKey>__<playerKey>__
      const worldKey = String(parts[1] || 'unknown');
      const playerKey = String(parts[2] || 'punknown');
      return { worldKey, playerKey };
    } catch {
      return { worldKey: 'unknown', playerKey: 'punknown' };
    }
  }

  function migratePrefix(fromPrefix: string, toPrefix: string, promptMsg: string): void {
    try {
      if (!fromPrefix || !toPrefix) return;
      if (fromPrefix === toPrefix) return;

      const hasTo = (() => {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && String(k).indexOf(toPrefix) === 0) return true;
          }
        } catch {
          // ignore
        }
        return false;
      })();
      if (hasTo) return;

      const fromKeys: string[] = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && String(k).indexOf(fromPrefix) === 0) fromKeys.push(String(k));
        }
      } catch {
        // ignore
      }
      if (!fromKeys.length) return;

      const ok = window.confirm(String(promptMsg || 'Alliance Dashboard: Migrate data?'));
      if (!ok) return;

      fromKeys.forEach((oldKey) => {
        try {
          const suffix = String(oldKey).slice(fromPrefix.length);
          const newKey = toPrefix + suffix;
          const val = localStorage.getItem(oldKey);
          if (val === null || val === undefined) return;
          localStorage.setItem(newKey, val);
        } catch {
          // ignore
        }
      });
    } catch {
      // ignore
    }
  }

  function migrateWorldNamespace(fromWorldKey: string, toWorldKey: string): void {
    try {
      const toNs = parseNamespace(LS_PREFIX);
      const fromPrefix = LS_BASE_PREFIX + '__' + String(fromWorldKey) + '__';
      const toPrefix = LS_BASE_PREFIX + '__' + String(toWorldKey) + '__' + String(toNs.playerKey) + '__';
      migratePrefix(
        fromPrefix,
        toPrefix,
        'Alliance Dashboard: Migrate data from ' + String(fromWorldKey) + ' into this world (' + String(toWorldKey) + ')?'
      );
    } catch {
      // ignore
    }
  }

  function migrateLegacyLocalStorageToWorldPrefix(): void {
    try {
      const newPrefix = LS_PREFIX;
      const hostKey = getHostKey();
      const ns = parseNamespace(LS_PREFIX);
      const worldKey = ns.worldKey;

      try {
        if (String(hostKey) !== String(worldKey)) {
          migrateWorldNamespace(hostKey, worldKey);
        }
      } catch {
        // ignore
      }

      // Migrate old world-only namespace (base__world__*) into new world+player namespace (base__world__player__*).
      try {
        const oldWorldOnlyPrefix = LS_BASE_PREFIX + '__' + String(worldKey) + '__';
        migratePrefix(
          oldWorldOnlyPrefix,
          newPrefix,
          'Alliance Dashboard: Migrate existing world data into player-specific keys? (recommended)'
        );
      } catch {
        // ignore
      }

      const hasNew = (() => {
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && String(k).indexOf(newPrefix) === 0) return true;
          }
        } catch {
          // ignore
        }
        return false;
      })();

      const legacyKeys: string[] = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          const ks = String(k);
          if (ks.indexOf(LS_BASE_PREFIX) !== 0) continue;
          if (ks.indexOf(newPrefix) === 0) continue;
          if (ks.indexOf(LS_BASE_PREFIX + '__') === 0) continue;
          legacyKeys.push(ks);
        }
      } catch {
        // ignore
      }

      if (hasNew) return;
      if (!legacyKeys.length) return;

      const ok = window.confirm(
        'Alliance Dashboard: Migrate existing data into world-namespaced keys? (recommended)\n\nThis is a one-time migration.'
      );
      if (!ok) return;

      legacyKeys.forEach((k) => {
        try {
          const suffix = String(k).slice(LS_BASE_PREFIX.length);
          const nk = newPrefix + suffix;
          const v = localStorage.getItem(k);
          if (v === null || v === undefined) return;
          localStorage.setItem(nk, v);
        } catch {
          // ignore
        }
      });
    } catch {
      // ignore
    }
  }

  return { LS_BASE_PREFIX, LS_PREFIX, save, load, migrateLegacyLocalStorageToWorldPrefix };
}

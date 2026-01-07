export type UiState = {
  open: boolean;
  activeTabId: string;
  search: string;
  pickActive: boolean;
  bypassChatLogs?: boolean;
  themeAccent?: string;
  filters: {
    teamId: string;
    onlineOnly: boolean;
    hasHubOnly: boolean;
  };
};

export type ChatLogEntry = { ts: number; text: string };

export type DataState = {
  lastRefreshAt: number;
  lastRefreshStatus: string;
  players: any[];
  chatLogs: ChatLogEntry[];
  orders: any[];
  poiDetectDebug: any[];
  _logTick: number;
  selectedPlayerId?: string | number | null;
  loading?: boolean;
  error?: string | null;
  _teamsTick?: number;
  _tplTick?: number;
  _targetsTick?: number;
  _renderTick?: number;
};

export type AppState = {
  ui: UiState;
  data: DataState;
};

export function createInitialState(): AppState {
  return {
    ui: {
      open: false,
      activeTabId: 'players',
      search: '',
      pickActive: false,
      bypassChatLogs: false,
      themeAccent: '#2cff74',
      filters: {
        teamId: '',
        onlineOnly: false,
        hasHubOnly: false
      }
    },
    data: {
      lastRefreshAt: 0,
      lastRefreshStatus: '',
      players: [],
      chatLogs: [],
      orders: [],
      poiDetectDebug: [],
      _logTick: 0
    }
  };
}

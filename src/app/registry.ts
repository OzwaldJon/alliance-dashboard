export type Tab = {
  id: string;
  title: string;
  icon?: string;
  render(container: HTMLElement): void;
};

export type Provider = {
  id: string;
  getPlayers(): unknown[];
};

export type Registry = {
  registerTab(tab: Tab): void;
  getTabs(): Tab[];
  registerProvider(provider: Provider): void;
  getProviders(): Provider[];
};

export function createRegistry(): Registry {
  const tabs: Tab[] = [];
  const providers: Provider[] = [];

  return {
    registerTab: (tab) => {
      if (!tab || !tab.id || !tab.title || typeof tab.render !== 'function') return;
      const idx = tabs.findIndex((t) => t.id === tab.id);
      if (idx >= 0) {
        tabs[idx] = tab;
        return;
      }
      tabs.push(tab);
    },
    getTabs: () => tabs.slice(),
    registerProvider: (provider) => {
      if (!provider || !provider.id || typeof provider.getPlayers !== 'function') return;
      if (providers.some((p) => p.id === provider.id)) return;
      providers.push(provider);
    },
    getProviders: () => providers.slice()
  };
}

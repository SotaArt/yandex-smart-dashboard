import { useState, useEffect } from "react";

export type TileSize = "1x1" | "2x1" | "1x2" | "2x2";

export interface TileConfig {
  id: string;
  size: TileSize;
  pinned: boolean;
  order: number;
  hidden: boolean;
}

export type PanelConfig = Record<string, TileConfig>;

export function usePanelConfig() {
  const [config, setConfigState] = useState<PanelConfig>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("panel_config_v3");
    if (saved) {
      try {
        setConfigState(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
    setIsLoaded(true);
  }, []);

  const setConfig = (newConfig: PanelConfig | ((prev: PanelConfig) => PanelConfig)) => {
    setConfigState((prev) => {
      const updated = typeof newConfig === "function" ? newConfig(prev) : newConfig;
      localStorage.setItem("panel_config_v3", JSON.stringify(updated));
      return updated;
    });
  };

  const initDeviceConfig = (deviceId: string) => {
    setConfig((prev) => {
      if (prev[deviceId]) return prev;
      return {
        ...prev,
        [deviceId]: {
          id: deviceId,
          size: "1x1",
          pinned: false,
          order: Object.keys(prev).length,
          hidden: false,
        }
      };
    });
  };

  const updateTileConfig = (deviceId: string, updates: Partial<TileConfig>) => {
    setConfig((prev) => ({
      ...prev,
      [deviceId]: { ...prev[deviceId], ...updates }
    }));
  };

  return { config, setConfig, initDeviceConfig, updateTileConfig, isLoaded };
}

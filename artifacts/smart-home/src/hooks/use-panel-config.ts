import { useState, useEffect, useCallback } from "react";

export type TileSize = "1x1" | "2x1" | "1x2" | "2x2";

export interface TileConfig {
  id: string;
  size: TileSize;
  pinned: boolean;
  order: number;
  hidden: boolean;
}

export type PanelConfig = Record<string, TileConfig>;
export type RoomOrder = Record<string, number>;

export function usePanelConfig(householdId?: string) {
  const tileKey = householdId ? `panel_config_v3_${householdId}` : "panel_config_v3";
  const roomKey = householdId ? `room_order_v1_${householdId}` : "room_order_v1";

  const [config, setConfigState] = useState<PanelConfig>({});
  const [roomOrder, setRoomOrderState] = useState<RoomOrder>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(tileKey);
      if (saved) setConfigState(JSON.parse(saved));
      const savedRooms = localStorage.getItem(roomKey);
      if (savedRooms) setRoomOrderState(JSON.parse(savedRooms));
    } catch {
      // ignore parse errors
    }
    setIsLoaded(true);
  }, [tileKey, roomKey]);

  const setConfig = useCallback(
    (newConfig: PanelConfig | ((prev: PanelConfig) => PanelConfig)) => {
      setConfigState((prev) => {
        const updated = typeof newConfig === "function" ? newConfig(prev) : newConfig;
        localStorage.setItem(tileKey, JSON.stringify(updated));
        return updated;
      });
    },
    [tileKey]
  );

  const initDeviceConfig = useCallback(
    (deviceId: string) => {
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
          },
        };
      });
    },
    [setConfig]
  );

  const updateTileConfig = useCallback(
    (deviceId: string, updates: Partial<TileConfig>) => {
      setConfig((prev) => ({
        ...prev,
        [deviceId]: {
          ...(prev[deviceId] ?? {
            id: deviceId,
            size: "1x1",
            pinned: false,
            order: 0,
            hidden: false,
          }),
          ...updates,
        },
      }));
    },
    [setConfig]
  );

  const swapRoomOrder = useCallback(
    (roomIdA: string, roomIdB: string, allRoomIds: string[]) => {
      setRoomOrderState((prev) => {
        const getOrder = (id: string) =>
          prev[id] !== undefined ? prev[id] : allRoomIds.indexOf(id);
        const newOrder: RoomOrder = {
          ...prev,
          [roomIdA]: getOrder(roomIdB),
          [roomIdB]: getOrder(roomIdA),
        };
        localStorage.setItem(roomKey, JSON.stringify(newOrder));
        return newOrder;
      });
    },
    [roomKey]
  );

  return {
    config,
    setConfig,
    initDeviceConfig,
    updateTileConfig,
    roomOrder,
    swapRoomOrder,
    isLoaded,
  };
}

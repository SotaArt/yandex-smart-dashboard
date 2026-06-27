import { useState, useMemo, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetUserInfo,
  getGetUserInfoQueryKey,
  useGetWeather,
  useControlDevice,
} from "@workspace/api-client-react";
import { useYandexToken } from "@/hooks/use-yandex-token";
import { usePanelConfig, type TileSize } from "@/hooks/use-panel-config";
import { useSensorHistory } from "@/hooks/use-sensor-history";
import { getDeviceIcon, isDeviceOn, getDeviceProperty, getWeatherEmoji } from "@/lib/yandex";
import { TokenForm } from "@/components/token-form";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, Pin, X, Plus, ChevronLeft, ChevronRight } from "lucide-react";

/* ─── Weather Card ─── */
function WeatherCard() {
  const weatherQuery = useGetWeather();
  const w = weatherQuery.data;

  const now = new Date();
  const timeStr = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });

  if (weatherQuery.isLoading) {
    return <Skeleton className="w-full h-28 rounded-2xl mb-4" />;
  }

  const current = w?.current;
  const emoji = current ? getWeatherEmoji(current.weather_code) : "🌡️";
  const precipProb = current?.precipitation_probability;

  return (
    <div
      className="w-full rounded-2xl p-4 mb-4 bg-card border border-border/50 flex items-center justify-between gap-4 flex-wrap"
      data-testid="card-weather"
    >
      <div className="flex items-center gap-4">
        <span className="text-5xl leading-none" role="img">{emoji}</span>
        <div>
          <p className="text-4xl font-bold text-foreground leading-none">
            {current ? `${Math.round(current.temperature_2m)}°` : "—"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {w?.city ?? "Москва"}
          </p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <p className="text-xl font-semibold text-foreground">{timeStr}</p>
        <p className="text-xs text-muted-foreground capitalize">{dateStr}</p>
        <div className="flex gap-3 text-xs text-muted-foreground mt-1">
          {current && (
            <>
              <span data-testid="weather-humidity">
                <span style={{ color: "#448aff" }}>💧</span> {current.relative_humidity_2m}%
              </span>
              {precipProb !== null && precipProb !== undefined && (
                <span data-testid="weather-precip">☂️ {precipProb}%</span>
              )}
            </>
          )}
          <span className={`w-1.5 h-1.5 rounded-full self-center ${current ? "bg-green-400 animate-pulse" : "bg-muted-foreground"}`} />
        </div>
      </div>
    </div>
  );
}

/* ─── Sparkline ─── */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 60;
  const H = 20;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x},${y}`;
  });
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─── Device Tile ─── */
function DeviceTile({
  device,
  token,
  editMode,
  config,
  onPin,
  onDelete,
  onResize,
  onDragStart,
  onDragOver,
  onDrop,
  sensorHistory,
}: {
  device: any;
  token: string;
  editMode: boolean;
  config: any;
  onPin: () => void;
  onDelete: () => void;
  onResize: (size: TileSize) => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  sensorHistory: any;
}) {
  const queryClient = useQueryClient();
  const controlDevice = useControlDevice({
    request: { headers: { "x-yandex-token": token } },
  });
  const isOn = isDeviceOn(device);
  const icon = getDeviceIcon(device.type);
  const isSensor = device.type.includes("sensor");
  const size: TileSize = config?.size ?? "1x1";
  const isPinned = config?.pinned ?? false;

  const tempProp = device.properties?.find((p: any) => p.parameters?.instance === "temperature");
  const humProp = device.properties?.find((p: any) => p.parameters?.instance === "humidity");
  const brightnessCap = device.capabilities?.find(
    (c: any) => c.type === "devices.capabilities.range" && c.parameters?.instance === "brightness"
  );
  const brightness = brightnessCap?.state?.value as number | undefined;

  const tempHistory: number[] = sensorHistory?.[device.id]?.temperature ?? [];
  const humHistory: number[] = sensorHistory?.[device.id]?.humidity ?? [];

  const handleClick = () => {
    if (editMode) return;
    const hasToggle = device.capabilities?.find((c: any) => c.type === "devices.capabilities.on_off");
    if (!hasToggle) return;
    controlDevice.mutate(
      {
        deviceId: device.id,
        data: { actions: [{ type: "devices.capabilities.on_off", state: { instance: "on", value: !isOn } }] },
      },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetUserInfoQueryKey() }) }
    );
  };

  const sizeClasses: Record<TileSize, string> = {
    "1x1": "tile-1x1",
    "2x1": "tile-2x1",
    "1x2": "tile-1x2",
    "2x2": "tile-2x2",
  };

  return (
    <div
      className={`relative rounded-2xl p-3 border transition-all duration-300 cursor-pointer select-none overflow-hidden
        ${sizeClasses[size]}
        ${isPinned ? "device-pinned bg-card" : isOn ? "device-on bg-card border-transparent" : "bg-card border-border/50"}
        ${editMode ? "cursor-grab active:cursor-grabbing" : ""}
      `}
      onClick={handleClick}
      draggable={editMode}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      data-testid={`tile-device-${device.id}`}
    >
      {/* Edit mode overlay */}
      {editMode && (
        <div className="absolute inset-0 rounded-2xl bg-background/30 backdrop-blur-[2px] z-10 flex flex-col p-2 gap-1">
          <div className="flex justify-between">
            <button
              onClick={(e) => { e.stopPropagation(); onPin(); }}
              className={`p-1 rounded-md transition-colors ${isPinned ? "text-yellow-400" : "text-muted-foreground hover:text-yellow-400"}`}
              data-testid={`button-pin-${device.id}`}
            >
              <Pin className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1 rounded-md text-muted-foreground hover:text-destructive transition-colors"
              data-testid={`button-delete-${device.id}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 flex items-end">
            <div className="flex gap-1 flex-wrap">
              {(["1x1", "2x1", "1x2", "2x2"] as TileSize[]).map((s) => (
                <button
                  key={s}
                  onClick={(e) => { e.stopPropagation(); onResize(s); }}
                  className={`text-[9px] px-1.5 py-0.5 rounded font-mono border transition-colors ${
                    size === s
                      ? "border-primary text-primary bg-primary/20"
                      : "border-border/50 text-muted-foreground hover:border-border"
                  }`}
                  data-testid={`button-size-${s}-${device.id}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tile content */}
      <div className="flex items-start justify-between mb-1">
        <span
          className={`leading-none ${size === "2x2" ? "text-3xl" : size === "1x2" ? "text-2xl" : "text-xl"}`}
          role="img"
        >
          {icon}
        </span>
        {!isSensor && (
          <span
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
              isOn ? "text-green-400 bg-green-500/10" : "text-muted-foreground"
            }`}
          >
            {isOn ? "ON" : "OFF"}
          </span>
        )}
      </div>
      <p className={`font-semibold leading-tight text-foreground truncate ${size === "2x2" ? "text-sm" : "text-xs"}`}>
        {device.name}
      </p>

      {/* Sensor values */}
      {isSensor && (
        <div className="mt-1 flex gap-2 flex-wrap items-end">
          {tempProp?.state?.value !== undefined && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-mono" style={{ color: "#ff5252" }}>
                {Math.round((tempProp.state.value as number) * 10) / 10}°
              </span>
              {tempHistory.length > 1 && <Sparkline values={tempHistory} color="#ff5252" />}
            </div>
          )}
          {humProp?.state?.value !== undefined && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-mono" style={{ color: "#448aff" }}>
                {Math.round(humProp.state.value as number)}%
              </span>
              {humHistory.length > 1 && <Sparkline values={humHistory} color="#448aff" />}
            </div>
          )}
        </div>
      )}

      {/* Brightness slider */}
      {brightnessCap && isOn && brightness !== undefined && !editMode && (
        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
          <Slider
            value={[brightness]}
            onValueChange={(val) =>
              controlDevice.mutate({
                deviceId: device.id,
                data: {
                  actions: [
                    { type: "devices.capabilities.range", state: { instance: "brightness", value: val[0] } },
                  ],
                },
              })
            }
            min={0}
            max={100}
            step={1}
            className="w-full"
            data-testid={`slider-tile-brightness-${device.id}`}
          />
        </div>
      )}
    </div>
  );
}

/* ─── Main User Panel ─── */
export default function UserPanel() {
  const { token, setToken, isLoaded } = useYandexToken();
  const { config, initDeviceConfig, updateTileConfig } = usePanelConfig();
  const [editMode, setEditMode] = useState(false);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<string | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const userInfoQuery = useGetUserInfo({
    request: { headers: { "x-yandex-token": token ?? "" } },
    query: { enabled: !!token, queryKey: getGetUserInfoQueryKey() },
  });

  const userInfo = userInfoQuery.data;
  const sensorHistory = useSensorHistory(userInfo ?? undefined);

  const rooms = useMemo(() => userInfo?.rooms ?? [], [userInfo]);
  const allDevices = useMemo(() => userInfo?.devices ?? [], [userInfo]);

  const currentRoom = activeRoom ?? rooms[0]?.id ?? null;

  const roomDevices = useMemo(() => {
    const room = currentRoom ? rooms.find((r: any) => r.id === currentRoom) : null;
    if (!room) return allDevices;
    return allDevices.filter(
      (d: any) => room.devices?.includes(d.id) || d.room_id === room.id
    );
  }, [currentRoom, rooms, allDevices]);

  const sortedDevices = useMemo(() => {
    const visible = roomDevices.filter((d: any) => !config[d.id]?.hidden);
    visible.forEach((d: any) => { if (!config[d.id]) initDeviceConfig(d.id); });
    return [...visible].sort((a, b) => {
      const ca = config[a.id];
      const cb = config[b.id];
      if (ca?.pinned && !cb?.pinned) return -1;
      if (!ca?.pinned && cb?.pinned) return 1;
      return (ca?.order ?? 0) - (cb?.order ?? 0);
    });
  }, [roomDevices, config, initDeviceConfig]);

  const hiddenDevices = useMemo(
    () => roomDevices.filter((d: any) => config[d.id]?.hidden),
    [roomDevices, config]
  );

  const scrollTabs = (dir: "left" | "right") => {
    if (tabsRef.current) {
      tabsRef.current.scrollBy({ left: dir === "left" ? -120 : 120, behavior: "smooth" });
    }
  };

  const handleDragStart = useCallback((id: string) => setDragFrom(id), []);
  const handleDrop = useCallback(
    (targetId: string) => {
      if (!dragFrom || dragFrom === targetId) { setDragFrom(null); return; }
      const fromOrder = config[dragFrom]?.order ?? 0;
      const toOrder = config[targetId]?.order ?? 0;
      updateTileConfig(dragFrom, { order: toOrder });
      updateTileConfig(targetId, { order: fromOrder });
      setDragFrom(null);
    },
    [dragFrom, config, updateTileConfig]
  );

  if (!isLoaded) return null;

  if (!token) {
    return (
      <div className="p-4">
        <TokenForm onSave={setToken} />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 pb-16">
      {/* Weather */}
      <div className="px-3 pt-3">
        <WeatherCard />
      </div>

      {/* Room tabs */}
      {rooms.length > 0 && (
        <div className="flex items-center gap-1 px-3 mb-3">
          <button
            onClick={() => scrollTabs("left")}
            className="p-1 text-muted-foreground hover:text-foreground shrink-0"
            data-testid="button-tabs-left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div
            ref={tabsRef}
            className="flex gap-1 overflow-x-auto flex-1"
            style={{ scrollbarWidth: "none" }}
          >
            {rooms.map((room: any) => (
              <button
                key={room.id}
                onClick={() => setActiveRoom(room.id)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  currentRoom === room.id
                    ? "bg-primary text-primary-foreground scale-105"
                    : "bg-card text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
                data-testid={`tab-room-${room.id}`}
              >
                {room.name}
              </button>
            ))}
          </div>
          <button
            onClick={() => scrollTabs("right")}
            className="p-1 text-muted-foreground hover:text-foreground shrink-0"
            data-testid="button-tabs-right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tile grid */}
      <div className="px-3">
        {userInfoQuery.isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 auto-rows-[120px]">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 auto-rows-[120px]">
            {sortedDevices.map((device: any) => (
              <DeviceTile
                key={device.id}
                device={device}
                token={token}
                editMode={editMode}
                config={config[device.id]}
                sensorHistory={sensorHistory}
                onPin={() => updateTileConfig(device.id, { pinned: !config[device.id]?.pinned })}
                onDelete={() => updateTileConfig(device.id, { hidden: true })}
                onResize={(size) => updateTileConfig(device.id, { size })}
                onDragStart={() => handleDragStart(device.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(device.id)}
              />
            ))}

            {/* Add hidden tiles in edit mode */}
            {editMode && hiddenDevices.map((device: any) => (
              <button
                key={`hidden-${device.id}`}
                onClick={() => updateTileConfig(device.id, { hidden: false })}
                className="rounded-2xl border border-dashed border-border/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                data-testid={`button-add-tile-${device.id}`}
              >
                <Plus className="w-4 h-4" />
                <span className="text-[10px] text-center px-2 leading-tight">{device.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Edit mode FAB */}
      <div className="fixed bottom-4 right-4 z-20">
        <button
          onClick={() => setEditMode(!editMode)}
          className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
            editMode
              ? "bg-primary text-primary-foreground scale-110"
              : "bg-card border border-border text-muted-foreground hover:text-foreground"
          }`}
          data-testid="button-edit-mode"
        >
          <Edit className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

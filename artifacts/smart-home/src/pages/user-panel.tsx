import { useState, useMemo, useCallback, useEffect } from "react";
import { useParams, useLocation } from "wouter";
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
import {
  getDeviceIcon,
  isDeviceOn,
  hasToggle,
  isAcDevice,
  getSensorReadings,
  hasSensorReadings,
  getAcMode,
  getDeviceCapability,
  getWeatherEmoji,
  AC_MODE_LABELS,
} from "@/lib/yandex";
import { TokenForm } from "@/components/token-form";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, Pin, X, Plus, ChevronLeft, ChevronRight, Settings, GripVertical } from "lucide-react";

/* ─── Weather Card ─── */
function WeatherCard() {
  const weatherQuery = useGetWeather();
  const w = weatherQuery.data;

  const now = new Date();
  const timeStr = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });

  if (weatherQuery.isLoading) {
    return <Skeleton className="w-full h-28 rounded-2xl mb-3" />;
  }

  const current = w?.current;
  const emoji = current ? getWeatherEmoji(current.weather_code) : "🌡️";

  return (
    <div className="w-full rounded-2xl p-4 mb-3 bg-card border border-border/50 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-4">
        <span className="text-5xl leading-none" role="img">{emoji}</span>
        <div>
          <p className="text-4xl font-bold text-foreground leading-none">
            {current ? `${Math.round(current.temperature_2m)}°` : "—"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">{w?.city ?? "Москва"}</p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <p className="text-xl font-semibold text-foreground">{timeStr}</p>
        <p className="text-xs text-muted-foreground capitalize">{dateStr}</p>
        {current && (
          <div className="flex gap-3 text-xs text-muted-foreground mt-1">
            <span><span style={{ color: "#448aff" }}>💧</span> {current.relative_humidity_2m}%</span>
            {current.precipitation_probability != null && (
              <span>☂️ {current.precipitation_probability}%</span>
            )}
            <span className="w-1.5 h-1.5 rounded-full self-center bg-green-400 animate-pulse" />
          </div>
        )}
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
  const W = 56, H = 18;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── Dual sparkline (temp + humidity on the same canvas) ─── */
function DualSparkline({ tempValues, humValues, width = 96, height = 40 }: { tempValues: number[]; humValues: number[]; width?: number; height?: number }) {
  const W = width, H = height;
  const toPoints = (values: number[]) => {
    if (values.length < 2) return "";
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    return values.map((v, i) => {
      const x = (i / (values.length - 1)) * W;
      const y = H - ((v - min) / range) * (H - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  };
  if (tempValues.length < 2 && humValues.length < 2) return null;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible flex-shrink-0">
      {tempValues.length >= 2 && (
        <polyline points={toPoints(tempValues)} fill="none" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      )}
      {humValues.length >= 2 && (
        <polyline points={toPoints(humValues)} fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      )}
    </svg>
  );
}

/* ─── PM quality helpers ─── */
function pmQuality(pm25: number) {
  if (pm25 <= 12) return { label: "Хорошо", badge: "bg-green-500/15 text-green-400 border-green-500/25" };
  if (pm25 <= 35) return { label: "Норма",  badge: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25" };
  return { label: "Плохо", badge: "bg-red-500/15 text-red-400 border-red-500/25" };
}

function co2Quality(co2: number) {
  if (co2 <= 800)  return { label: "Свежий", badge: "bg-green-500/15 text-green-400 border-green-500/25" };
  if (co2 <= 1200) return { label: "Норма",  badge: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25" };
  return { label: "Душно", badge: "bg-red-500/15 text-red-400 border-red-500/25" };
}

/* ─── Room Sensor Bar ─── */
function RoomSensorBar({
  roomDevices,
  sensorHistory,
}: {
  roomDevices: any[];
  sensorHistory: Record<string, { temperature: number[]; humidity: number[] }>;
}) {
  // Collect from all devices that carry sensor readings (including IR remotes w/ temp+hum)
  const sensorSources = roomDevices.filter((d) => {
    const r = getSensorReadings(d);
    return Object.keys(r).length > 0 || d.type.includes("sensor");
  });
  if (sensorSources.length === 0) return null;

  // Aggregate: first non-undefined value wins per metric
  let temperature: number | undefined;
  let humidity: number | undefined;
  let pm25: number | undefined;
  let co2: number | undefined;
  let openState: boolean | undefined;
  let presenceState: boolean | undefined;
  let motionState: boolean | undefined;
  let vibrationState: boolean | undefined;
  let illumination: number | undefined;
  let sparkTempHistory: number[] = [];
  let sparkHumHistory: number[] = [];

  for (const d of sensorSources) {
    const r = getSensorReadings(d);
    if (temperature === undefined && r.temperature !== undefined) {
      temperature = r.temperature;
      sparkTempHistory = sensorHistory[d.id]?.temperature ?? [];
    }
    if (humidity === undefined && r.humidity !== undefined) {
      humidity = r.humidity;
      if (!sparkHumHistory.length) sparkHumHistory = sensorHistory[d.id]?.humidity ?? [];
    }
    if (pm25 === undefined && r.pm25 !== undefined) pm25 = r.pm25;
    if (co2 === undefined && r.co2 !== undefined) co2 = r.co2;
    if (openState === undefined && r.open !== undefined) openState = r.open;
    if (presenceState === undefined && r.presence !== undefined) presenceState = r.presence;
    if (motionState === undefined && r.motion !== undefined) motionState = r.motion;
    if (vibrationState === undefined && r.vibration !== undefined) vibrationState = r.vibration;
    if (illumination === undefined && r.illumination !== undefined) illumination = r.illumination;
  }

  const hasClimate = temperature !== undefined || humidity !== undefined;
  const hasAir     = pm25 !== undefined || co2 !== undefined || illumination !== undefined;
  const hasStatus  = openState !== undefined || presenceState !== undefined || motionState !== undefined || vibrationState !== undefined;
  const hasChart   = sparkTempHistory.length >= 2 || sparkHumHistory.length >= 2;

  if (!hasClimate && !hasAir && !hasStatus) return null;

  const pm = pm25 !== undefined ? pmQuality(pm25) : null;
  const co = co2 !== undefined ? co2Quality(co2) : null;

  return (
    <div className="px-3 mb-3">
      <div className="rounded-2xl bg-card border border-border/50 overflow-hidden">
        <div className="flex items-stretch divide-x divide-border/40">

          {/* ── Climate: temperature + humidity ── */}
          {hasClimate && (
            <div className="flex items-center gap-5 px-5 py-4 flex-shrink-0">
              {temperature !== undefined && (
                <div>
                  <div className="flex items-end gap-1 leading-none">
                    <span className="text-3xl font-bold text-foreground">{temperature.toFixed(1)}</span>
                    <span className="text-lg font-semibold text-muted-foreground mb-0.5">°C</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">Темп.</p>
                </div>
              )}
              {humidity !== undefined && (
                <div>
                  <div className="flex items-end gap-1 leading-none">
                    <span className="text-3xl font-bold text-sky-400">{humidity}</span>
                    <span className="text-lg font-semibold text-sky-400/70 mb-0.5">%</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">Влажн.</p>
                </div>
              )}
            </div>
          )}

          {/* ── Air quality: PM + CO₂ + illumination ── */}
          {hasAir && (
            <div className="flex flex-col justify-center gap-2 px-5 py-4 flex-shrink-0">
              {pm25 !== undefined && pm && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-12">PM 2.5</span>
                  <span className="text-sm font-bold text-foreground">{pm25}</span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${pm.badge}`}>{pm.label}</span>
                </div>
              )}
              {co2 !== undefined && co && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-12">CO₂</span>
                  <span className="text-sm font-bold text-foreground">{co2} <span className="text-[10px] font-normal text-muted-foreground">ppm</span></span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${co.badge}`}>{co.label}</span>
                </div>
              )}
              {illumination !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-12">Свет</span>
                  <span className="text-sm font-bold text-foreground">{illumination} <span className="text-[10px] font-normal text-muted-foreground">лк</span></span>
                </div>
              )}
            </div>
          )}

          {/* ── Boolean status sensors ── */}
          {hasStatus && (
            <div className="flex flex-wrap items-center gap-2 px-5 py-4 flex-1 min-w-0">
              {openState !== undefined && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${openState ? "bg-amber-500/10 border-amber-500/30" : "bg-muted/30 border-border/40"}`}>
                  <span className="text-base leading-none">🚪</span>
                  <div>
                    <p className={`text-xs font-semibold leading-none ${openState ? "text-amber-400" : "text-foreground"}`}>
                      {openState ? "Открыта" : "Закрыта"}
                    </p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">Дверь / окно</p>
                  </div>
                </div>
              )}
              {presenceState !== undefined && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${presenceState ? "bg-blue-500/10 border-blue-500/30" : "bg-muted/30 border-border/40"}`}>
                  <span className="text-base leading-none">👤</span>
                  <div>
                    <p className={`text-xs font-semibold leading-none ${presenceState ? "text-blue-400" : "text-foreground"}`}>
                      {presenceState ? "Есть" : "Никого"}
                    </p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">Присутствие</p>
                  </div>
                </div>
              )}
              {motionState !== undefined && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${motionState ? "bg-purple-500/10 border-purple-500/30" : "bg-muted/30 border-border/40"}`}>
                  <span className="text-base leading-none">🏃</span>
                  <div>
                    <p className={`text-xs font-semibold leading-none ${motionState ? "text-purple-400" : "text-foreground"}`}>
                      {motionState ? "Движение" : "Покой"}
                    </p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">Движение</p>
                  </div>
                </div>
              )}
              {vibrationState !== undefined && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${vibrationState ? "bg-red-500/10 border-red-500/30" : "bg-muted/30 border-border/40"}`}>
                  <span className="text-base leading-none">📳</span>
                  <div>
                    <p className={`text-xs font-semibold leading-none ${vibrationState ? "text-red-400" : "text-foreground"}`}>
                      {vibrationState ? "Вибрация!" : "Тихо"}
                    </p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">Вибрация</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Trend chart ── */}
          {hasChart && (
            <div className="flex flex-col items-center justify-center gap-2 px-5 py-4 flex-shrink-0">
              <DualSparkline tempValues={sparkTempHistory} humValues={sparkHumHistory} width={96} height={40} />
              <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
                {sparkTempHistory.length >= 2 && (
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-orange-400 rounded inline-block" />Темп.
                  </span>
                )}
                {sparkHumHistory.length >= 2 && (
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-sky-400 rounded inline-block" />Влажн.
                  </span>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
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
  const canToggle = hasToggle(device);
  const isAc = isAcDevice(device);
  const icon = getDeviceIcon(device.type);
  const size: TileSize = config?.size ?? "1x1";
  const isPinned = config?.pinned ?? false;

  const readings = getSensorReadings(device);
  const hasSensors = Object.keys(readings).length > 0;
  // Non-clickable if: pure sensor device with no toggle, or has sensor readings but no toggle capability
  const isInteractive = canToggle;

  const acMode = isAc ? getAcMode(device) : undefined;
  const brightnessCap = getDeviceCapability(device, "devices.capabilities.range", "brightness");
  const brightness = brightnessCap?.state?.value as number | undefined;

  const tempHistory: number[] = sensorHistory?.[device.id]?.temperature ?? [];
  const humHistory: number[] = sensorHistory?.[device.id]?.humidity ?? [];

  const handleClick = () => {
    if (editMode || !isInteractive) return;
    const newValue = !isOn;
    // Optimistic update — flip state in cache immediately, no visible delay
    queryClient.setQueryData(getGetUserInfoQueryKey(), (old: any) => {
      if (!old) return old;
      return {
        ...old,
        devices: old.devices.map((d: any) => {
          if (d.id !== device.id) return d;
          return {
            ...d,
            capabilities: d.capabilities.map((c: any) =>
              c.type === "devices.capabilities.on_off"
                ? { ...c, state: { ...(c.state ?? {}), value: newValue } }
                : c
            ),
          };
        }),
      };
    });
    controlDevice.mutate(
      {
        deviceId: device.id,
        data: { actions: [{ type: "devices.capabilities.on_off", state: { instance: "on", value: newValue } }] },
      },
      {
        onError: () => {
          // Revert optimistic update on error
          queryClient.invalidateQueries({ queryKey: getGetUserInfoQueryKey() });
        },
      }
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
      className={`relative rounded-2xl p-3 border transition-all duration-300 overflow-hidden select-none
        ${sizeClasses[size]}
        ${isPinned ? "device-pinned bg-card" : isOn ? "device-on bg-card border-transparent" : "bg-card border-border/50"}
        ${isInteractive && !editMode ? "cursor-pointer" : "cursor-default"}
        ${editMode ? "cursor-grab active:cursor-grabbing" : ""}
      `}
      onClick={handleClick}
      draggable={editMode}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      data-testid={`tile-device-${device.id}`}
    >
      {/* Edit overlay */}
      {editMode && (
        <div className="absolute inset-0 rounded-2xl bg-background/40 backdrop-blur-[2px] z-10 flex flex-col p-2 gap-1">
          <div className="flex justify-between">
            <button
              onClick={(e) => { e.stopPropagation(); onPin(); }}
              className={`p-1 rounded-md transition-colors ${isPinned ? "text-yellow-400" : "text-muted-foreground hover:text-yellow-400"}`}
            >
              <Pin className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1 rounded-md text-muted-foreground hover:text-destructive transition-colors"
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
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex items-start justify-between mb-1">
        <span className={`leading-none ${size === "2x2" || size === "1x2" ? "text-2xl" : "text-xl"}`} role="img">
          {icon}
        </span>
        {isInteractive && (
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
            isOn ? "text-green-400 bg-green-500/10" : "text-muted-foreground"
          }`}>
            {isOn ? "ON" : "OFF"}
          </span>
        )}
        {isAc && acMode && !isInteractive && (
          <span className="text-base">{AC_MODE_LABELS[acMode]?.emoji ?? "⚙️"}</span>
        )}
      </div>

      <p className={`font-semibold leading-tight text-foreground truncate ${size === "2x2" ? "text-sm" : "text-xs"}`}>
        {device.name}
      </p>

      {/* Sensor readings */}
      {hasSensors && (
        <div className="mt-1 flex gap-2 flex-wrap items-end">
          {readings.temperature !== undefined && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-mono font-semibold" style={{ color: "#ff5252" }}>
                {readings.temperature.toFixed(1)}°
              </span>
              {tempHistory.length > 1 && <Sparkline values={tempHistory} color="#ff5252" />}
            </div>
          )}
          {readings.humidity !== undefined && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-mono font-semibold" style={{ color: "#448aff" }}>
                {Math.round(readings.humidity)}%
              </span>
              {humHistory.length > 1 && <Sparkline values={humHistory} color="#448aff" />}
            </div>
          )}
          {readings.co2 !== undefined && (
            <span className="text-xs font-mono font-semibold" style={{ color: "#b2ff59" }}>
              {Math.round(readings.co2)} ppm
            </span>
          )}
        </div>
      )}

      {/* AC mode info */}
      {isAc && isOn && acMode && (
        <p className="text-[10px] text-muted-foreground mt-1">
          {AC_MODE_LABELS[acMode]?.label ?? acMode}
        </p>
      )}

      {/* Brightness */}
      {brightnessCap && isOn && brightness !== undefined && !editMode && !isAc && (
        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
          <Slider
            value={[brightness]}
            onValueChange={(val) =>
              controlDevice.mutate({
                deviceId: device.id,
                data: { actions: [{ type: "devices.capabilities.range", state: { instance: "brightness", value: val[0] } }] },
              })
            }
            min={0}
            max={100}
            step={1}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
}

/* ─── Room Tab ─── */
function RoomTab({
  room,
  isActive,
  onClick,
  editMode,
  onMoveLeft,
  onMoveRight,
  canMoveLeft,
  canMoveRight,
}: {
  room: any;
  isActive: boolean;
  onClick: () => void;
  editMode: boolean;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  canMoveLeft: boolean;
  canMoveRight: boolean;
}) {
  return (
    <div className="relative flex items-center">
      {editMode && canMoveLeft && (
        <button
          onClick={(e) => { e.stopPropagation(); onMoveLeft(); }}
          className="absolute -left-2 z-10 w-4 h-4 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-primary"
        >
          <ChevronLeft className="w-2.5 h-2.5" />
        </button>
      )}
      <button
        onClick={onClick}
        className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
          isActive
            ? "bg-primary text-primary-foreground scale-105"
            : "bg-card text-muted-foreground hover:text-foreground hover:bg-accent"
        } ${editMode ? "pr-5" : ""}`}
      >
        {editMode && <GripVertical className="w-3 h-3 inline mr-1 opacity-50" />}
        {room.name}
      </button>
      {editMode && canMoveRight && (
        <button
          onClick={(e) => { e.stopPropagation(); onMoveRight(); }}
          className="absolute -right-2 z-10 w-4 h-4 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-primary"
        >
          <ChevronRight className="w-2.5 h-2.5" />
        </button>
      )}
    </div>
  );
}

/* ─── Main User Panel ─── */
export default function UserPanel() {
  const params = useParams<{ householdId: string }>();
  const householdId = params.householdId;
  const [, navigate] = useLocation();

  const { token, setToken, isLoaded } = useYandexToken();
  const { config, initDeviceConfig, updateTileConfig, roomOrder, swapRoomOrder } = usePanelConfig(householdId);
  const [editMode, setEditMode] = useState(false);
  // Track by room ID — survives query refetch reordering rooms in the response
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<string | null>(null);

  const userInfoQuery = useGetUserInfo({
    request: { headers: { "x-yandex-token": token ?? "" } },
    query: { enabled: !!token, queryKey: getGetUserInfoQueryKey() },
  });

  const userInfo = userInfoQuery.data;
  const sensorHistory = useSensorHistory(userInfo ?? undefined);

  const allRooms = useMemo(() => userInfo?.rooms ?? [], [userInfo]);
  const allDevices = useMemo(() => userInfo?.devices ?? [], [userInfo]);

  // Filter to this household
  const householdRooms = useMemo(
    () => allRooms.filter((r: any) => r.household_id === householdId),
    [allRooms, householdId]
  );

  // Sort rooms by user-defined order
  const sortedRooms = useMemo(() => {
    return [...householdRooms].sort((a, b) => {
      const oa = roomOrder[a.id] ?? householdRooms.indexOf(a);
      const ob = roomOrder[b.id] ?? householdRooms.indexOf(b);
      return oa - ob;
    });
  }, [householdRooms, roomOrder]);

  // Resolve current room — stable by ID regardless of sort order changes after refetch
  const safeRoomIndex = useMemo(() => {
    if (!activeRoomId) return 0;
    const idx = sortedRooms.findIndex((r: any) => r.id === activeRoomId);
    return idx >= 0 ? idx : 0;
  }, [activeRoomId, sortedRooms]);
  const currentRoom = sortedRooms[safeRoomIndex] ?? null;

  // Devices for current room
  const roomDevices = useMemo(() => {
    if (!currentRoom) return [];
    return allDevices.filter(
      (d: any) =>
        d.household_id === householdId &&
        (currentRoom.devices?.includes(d.id) || d.room_id === currentRoom.id)
    );
  }, [currentRoom, allDevices, householdId]);

  // Init tile config for new devices (useEffect, not inside useMemo)
  const roomDeviceIds = roomDevices.map((d: any) => d.id).join(",");
  useEffect(() => {
    roomDevices.forEach((d: any) => { if (!config[d.id]) initDeviceConfig(d.id); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomDeviceIds]);

  // Sensor-only = no toggle AND not AC AND (type is sensor OR has any sensor readings)
  // This catches: sensor devices, IR remotes with temp/humidity, vibration sensors, etc.
  const isSensorOnly = (d: any) =>
    !hasToggle(d) && !isAcDevice(d) && (d.type.includes("sensor") || hasSensorReadings(d));

  const sortedDevices = useMemo(() => {
    const visible = roomDevices.filter((d: any) => !config[d.id]?.hidden && !isSensorOnly(d));
    return [...visible].sort((a, b) => {
      const ca = config[a.id];
      const cb = config[b.id];
      if (ca?.pinned && !cb?.pinned) return -1;
      if (!ca?.pinned && cb?.pinned) return 1;
      return (ca?.order ?? 0) - (cb?.order ?? 0);
    });
  }, [roomDevices, config]);

  const hiddenDevices = useMemo(
    () => roomDevices.filter((d: any) => config[d.id]?.hidden && !isSensorOnly(d)),
    [roomDevices, config]
  );

  const goToPrevRoom = useCallback(() => {
    setActiveRoomId((id) => {
      const idx = sortedRooms.findIndex((r: any) => r.id === id) || 0;
      return sortedRooms[Math.max(0, idx - 1)]?.id ?? id;
    });
  }, [sortedRooms]);

  const goToNextRoom = useCallback(() => {
    setActiveRoomId((id) => {
      const idx = id ? sortedRooms.findIndex((r: any) => r.id === id) : 0;
      return sortedRooms[Math.min(sortedRooms.length - 1, idx + 1)]?.id ?? id;
    });
  }, [sortedRooms]);

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

  // Standalone dark wrapper — no shared header
  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-background text-foreground dark">
      {!token ? (
        <div className="p-4 flex-1">
          <TokenForm onSave={setToken} />
        </div>
      ) : (
        <>
          {/* Weather */}
          <div className="px-3 pt-3">
            <WeatherCard />
          </div>

          {/* Room navigation */}
          {sortedRooms.length > 0 && (
            <div className="flex items-center gap-1 px-2 mb-3">
              <button
                onClick={goToPrevRoom}
                disabled={safeRoomIndex === 0}
                className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors shrink-0"
                data-testid="button-room-prev"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex gap-2 overflow-x-auto flex-1 py-1" style={{ scrollbarWidth: "none" }}>
                {sortedRooms.map((room: any, idx: number) => (
                  <RoomTab
                    key={room.id}
                    room={room}
                    isActive={(activeRoomId ?? sortedRooms[0]?.id) === room.id}
                    onClick={() => setActiveRoomId(room.id)}
                    editMode={editMode}
                    canMoveLeft={idx > 0}
                    canMoveRight={idx < sortedRooms.length - 1}
                    onMoveLeft={() => {
                      swapRoomOrder(room.id, sortedRooms[idx - 1].id, sortedRooms.map((r: any) => r.id));
                    }}
                    onMoveRight={() => {
                      swapRoomOrder(room.id, sortedRooms[idx + 1].id, sortedRooms.map((r: any) => r.id));
                    }}
                  />
                ))}
              </div>

              <button
                onClick={goToNextRoom}
                disabled={safeRoomIndex === sortedRooms.length - 1}
                className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors shrink-0"
                data-testid="button-room-next"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Room sensor status bar — replaces duplicate room name */}
          {currentRoom && (
            <RoomSensorBar roomDevices={roomDevices} sensorHistory={sensorHistory} />
          )}

          {/* Tile grid */}
          <div className="px-3 pb-20 flex-1">
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

                {editMode && hiddenDevices.map((device: any) => (
                  <button
                    key={`hidden-${device.id}`}
                    onClick={() => updateTileConfig(device.id, { hidden: false })}
                    className="rounded-2xl border border-dashed border-border/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-[10px] text-center px-2 leading-tight">{device.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bottom FAB row */}
          <div className="fixed bottom-4 right-4 z-20 flex gap-2">
            <button
              onClick={() => navigate("/")}
              className="w-10 h-10 rounded-full shadow-lg flex items-center justify-center bg-card border border-border text-muted-foreground hover:text-foreground transition-all"
              title="Инженерная панель"
            >
              <Settings className="w-4 h-4" />
            </button>
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
        </>
      )}
    </div>
  );
}

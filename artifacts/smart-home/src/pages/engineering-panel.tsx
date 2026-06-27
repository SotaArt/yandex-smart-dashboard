import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  useGetUserInfo,
  getGetUserInfoQueryKey,
  useGetScenarios,
  getGetScenariosQueryKey,
  useControlDevice,
  useRunScenario,
} from "@workspace/api-client-react";
import { useYandexToken } from "@/hooks/use-yandex-token";
import { TokenForm } from "@/components/token-form";
import {
  getDeviceIcon,
  isDeviceOn,
  hasToggle,
  isAcDevice,
  getSensorReadings,
  hasSensorReadings,
  getAcMode,
  getAcModeOptions,
  getAcTemperature,
  getAcFanSpeed,
  getDeviceCapability,
  AC_MODE_LABELS,
  type AcMode,
} from "@/lib/yandex";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Search, Wifi, WifiOff, Play, LogOut, ChevronDown, ChevronUp, Home, EyeOff, Eye } from "lucide-react";

/* ─── Sensor row ─── */
function SensorRow({ device }: { device: any }) {
  const readings = getSensorReadings(device);
  if (Object.keys(readings).length === 0) return null;
  return (
    <div className="flex gap-3 flex-wrap mt-2">
      {readings.temperature !== undefined && (
        <span className="text-xs font-mono font-semibold" style={{ color: "#ff5252" }}>
          {readings.temperature.toFixed(1)}°C
        </span>
      )}
      {readings.humidity !== undefined && (
        <span className="text-xs font-mono font-semibold" style={{ color: "#448aff" }}>
          {Math.round(readings.humidity)}%
        </span>
      )}
      {readings.pm25 !== undefined && (
        <span className="text-xs font-mono font-semibold" style={{ color: "#ff9800" }}>
          PM2.5: {Math.round(readings.pm25)} µg
        </span>
      )}
      {readings.co2 !== undefined && (
        <span className="text-xs font-mono font-semibold" style={{ color: "#b2ff59" }}>
          CO₂: {Math.round(readings.co2)} ppm
        </span>
      )}
      {readings.battery !== undefined && (
        <span className="text-xs font-mono font-semibold" style={{ color: "#69f0ae" }}>
          🔋 {Math.round(readings.battery)}%
        </span>
      )}
    </div>
  );
}

/* ─── AC Card controls ─── */
function AcControls({ device, token }: { device: any; token: string }) {
  const queryClient = useQueryClient();
  const controlDevice = useControlDevice({
    request: { headers: { "x-yandex-token": token } },
  });

  const mode = getAcMode(device);
  const modeOptions = getAcModeOptions(device);
  const tempInfo = getAcTemperature(device);
  const fanInfo = getAcFanSpeed(device);
  const swingCap = getDeviceCapability(device, "devices.capabilities.toggle", "swing");

  const send = (actions: any[]) => {
    controlDevice.mutate(
      { deviceId: device.id, data: { actions } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetUserInfoQueryKey() }) }
    );
  };

  const setMode = (m: AcMode) =>
    send([{ type: "devices.capabilities.mode", state: { instance: "thermostat", value: m } }]);

  const setTemp = (v: number[]) =>
    send([{ type: "devices.capabilities.range", state: { instance: "temperature", value: v[0] } }]);

  const setFan = (v: number[]) =>
    send([{ type: "devices.capabilities.range", state: { instance: "fan_speed", value: v[0] } }]);

  const toggleSwing = () =>
    send([{ type: "devices.capabilities.toggle", state: { instance: "swing", value: !swingCap?.state?.value } }]);

  return (
    <div className="mt-3 space-y-3">
      {/* Mode buttons */}
      {modeOptions.length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Режим</p>
          <div className="flex flex-wrap gap-1">
            {modeOptions.map((m) => {
              const info = AC_MODE_LABELS[m] ?? { emoji: "⚙️", label: m };
              return (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  disabled={controlDevice.isPending}
                  className={`text-xs px-2 py-1 rounded-md border transition-colors flex items-center gap-1 ${
                    mode === m
                      ? "border-primary text-primary bg-primary/20"
                      : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                >
                  <span>{info.emoji}</span>
                  <span>{info.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Temperature */}
      {tempInfo.value !== undefined && tempInfo.min !== undefined && tempInfo.max !== undefined && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">
            Температура: <span className="text-foreground font-mono font-semibold">{tempInfo.value}°C</span>
          </p>
          <Slider
            value={[tempInfo.value]}
            onValueChange={setTemp}
            min={tempInfo.min}
            max={tempInfo.max}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
            <span>{tempInfo.min}°</span><span>{tempInfo.max}°</span>
          </div>
        </div>
      )}

      {/* Fan speed */}
      {fanInfo.value !== undefined && fanInfo.min !== undefined && fanInfo.max !== undefined && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">
            Скорость вентилятора: <span className="text-foreground font-mono font-semibold">{fanInfo.value}</span>
          </p>
          <Slider
            value={[fanInfo.value]}
            onValueChange={setFan}
            min={fanInfo.min}
            max={fanInfo.max}
            step={1}
            className="w-full"
          />
        </div>
      )}

      {/* Swing */}
      {swingCap && (
        <button
          onClick={toggleSwing}
          disabled={controlDevice.isPending}
          className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
            swingCap.state?.value
              ? "border-primary/50 text-primary bg-primary/10"
              : "border-border/50 text-muted-foreground hover:border-border"
          }`}
        >
          🔀 Качание {swingCap.state?.value ? "вкл" : "выкл"}
        </button>
      )}
    </div>
  );
}

/* ─── Device Card ─── */
function DeviceCard({ device, token, hideOffline }: { device: any; token: string; hideOffline: boolean }) {
  const queryClient = useQueryClient();
  const controlDevice = useControlDevice({
    request: { headers: { "x-yandex-token": token } },
  });
  const isOn = isDeviceOn(device);
  const canToggle = hasToggle(device);
  const isAc = isAcDevice(device);
  const isSensor = device.type.includes("sensor");
  const icon = getDeviceIcon(device.type);

  const brightnessCap = getDeviceCapability(device, "devices.capabilities.range", "brightness");
  const brightness = brightnessCap?.state?.value as number | undefined;

  if (hideOffline && !isOn && !isSensor && !isAc) return null;

  const toggle = () => {
    if (!canToggle) return;
    controlDevice.mutate(
      {
        deviceId: device.id,
        data: { actions: [{ type: "devices.capabilities.on_off", state: { instance: "on", value: !isOn } }] },
      },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetUserInfoQueryKey() }) }
    );
  };

  const setBrightness = (val: number[]) => {
    controlDevice.mutate({
      deviceId: device.id,
      data: { actions: [{ type: "devices.capabilities.range", state: { instance: "brightness", value: val[0] } }] },
    });
  };

  return (
    <div
      className={`rounded-xl p-4 border transition-all duration-300 ${
        isOn ? "device-on bg-card border-transparent" : "bg-card border-border/50"
      }`}
      data-testid={`device-card-${device.id}`}
    >
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl flex-shrink-0" role="img">{icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight text-foreground truncate">{device.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{device.type.split(".").pop()}</p>
          </div>
        </div>
        {canToggle && (
          <button
            onClick={toggle}
            disabled={controlDevice.isPending}
            className={`text-xs px-2 py-1 rounded-md border font-mono transition-colors flex-shrink-0 ml-1 ${
              isOn
                ? "border-green-500/50 text-green-400 hover:bg-green-500/10"
                : "border-border text-muted-foreground hover:bg-accent"
            }`}
            data-testid={`button-toggle-${device.id}`}
          >
            {isOn ? "ON" : "OFF"}
          </button>
        )}
      </div>

      {/* Sensor readings — shown for ALL device types that have them */}
      <SensorRow device={device} />

      {/* AC Controls */}
      {isAc && isOn && <AcControls device={device} token={token} />}

      {/* Brightness */}
      {brightnessCap && isOn && brightness !== undefined && !isAc && (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground mb-1">Яркость: {brightness}%</p>
          <Slider
            value={[brightness]}
            onValueChange={setBrightness}
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

/* ─── Room section ─── */
function RoomSection({
  room,
  devices,
  token,
  hideOffline,
}: {
  room: any;
  devices: any[];
  token: string;
  hideOffline: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const roomDevices = devices.filter((d) => d.room_id === room.id);
  if (roomDevices.length === 0) return null;

  const visibleCount = hideOffline
    ? roomDevices.filter((d) => isDeviceOn(d) || d.type.includes("sensor") || isAcDevice(d)).length
    : roomDevices.length;

  return (
    <div className="mb-6">
      <button
        className="flex items-center gap-2 mb-3 w-full text-left hover:opacity-80 transition-opacity"
        onClick={() => setCollapsed(!collapsed)}
      >
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{room.name}</h3>
        <Badge variant="secondary" className="text-xs font-mono">{visibleCount}</Badge>
        <span className="ml-auto text-muted-foreground">
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </span>
      </button>
      {!collapsed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {roomDevices.map((device) => (
            <DeviceCard key={device.id} device={device} token={token} hideOffline={hideOffline} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main ─── */
export default function EngineeringPanel() {
  const { token, setToken, isLoaded } = useYandexToken();
  const [search, setSearch] = useState("");
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | null>(null);
  const [hideOffline, setHideOffline] = useState(false);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const runScenario = useRunScenario({
    request: { headers: { "x-yandex-token": token ?? "" } },
  });

  const userInfoQuery = useGetUserInfo({
    request: { headers: { "x-yandex-token": token ?? "" } },
    query: { enabled: !!token, queryKey: getGetUserInfoQueryKey() },
  });

  const scenariosQuery = useGetScenarios({
    request: { headers: { "x-yandex-token": token ?? "" } },
    query: { enabled: !!token, queryKey: getGetScenariosQueryKey() },
  });

  const userInfo = userInfoQuery.data;
  const isConnected = !!userInfo && userInfo.status === "ok";

  const households = useMemo(() => userInfo?.households ?? [], [userInfo]);
  const allRooms = useMemo(() => userInfo?.rooms ?? [], [userInfo]);
  const allDevices = useMemo(() => userInfo?.devices ?? [], [userInfo]);

  // Select first household by default when data loads
  const effectiveHouseholdId = selectedHouseholdId ?? households[0]?.id ?? null;

  // Filter rooms and devices by selected household
  const rooms = useMemo(
    () =>
      effectiveHouseholdId
        ? allRooms.filter((r: any) => r.household_id === effectiveHouseholdId)
        : allRooms,
    [allRooms, effectiveHouseholdId]
  );

  const householdDevices = useMemo(
    () =>
      effectiveHouseholdId
        ? allDevices.filter((d: any) => d.household_id === effectiveHouseholdId)
        : allDevices,
    [allDevices, effectiveHouseholdId]
  );

  const filteredDevices = useMemo(() => {
    if (!search) return householdDevices;
    const q = search.toLowerCase();
    return householdDevices.filter(
      (d: any) => d.name?.toLowerCase().includes(q) || d.type?.toLowerCase().includes(q)
    );
  }, [householdDevices, search]);

  const activeCount = useMemo(() => householdDevices.filter(isDeviceOn).length, [householdDevices]);

  const unroomedDevices = useMemo(
    () =>
      filteredDevices.filter(
        (d: any) => !d.room_id || !rooms.find((r: any) => r.id === d.room_id)
      ),
    [filteredDevices, rooms]
  );

  const handleRunScenario = (scenarioId: string) => {
    runScenario.mutate(
      { scenarioId },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetUserInfoQueryKey() }) }
    );
  };

  const openUserPanel = (householdId: string) => {
    navigate(`/panel/${householdId}`);
  };

  if (!isLoaded) return null;

  if (!token) {
    return (
      <div className="p-4">
        <TokenForm onSave={setToken} />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-screen-2xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          {isConnected ? (
            <span className="flex items-center gap-1.5 text-xs text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <Wifi className="w-3.5 h-3.5" />
              Подключено
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-muted-foreground" />
              <WifiOff className="w-3.5 h-3.5" />
              {userInfoQuery.isLoading ? "Подключение..." : "Отключено"}
            </span>
          )}
          {activeCount > 0 && (
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs font-mono">
              {activeCount} активно
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHideOffline(!hideOffline)}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
              hideOffline
                ? "border-primary/50 text-primary bg-primary/10"
                : "border-border/50 text-muted-foreground hover:border-border"
            }`}
            title={hideOffline ? "Показать все устройства" : "Скрыть выключенные"}
          >
            {hideOffline ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {hideOffline ? "Только активные" : "Все устройства"}
          </button>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск устройств..."
              className="pl-8 w-52 h-8 text-sm bg-card border-border"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setToken(null)}
            className="text-muted-foreground hover:text-destructive h-8"
            title="Отключиться"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {userInfoQuery.isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      )}

      {userInfoQuery.isError && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 mb-6 text-sm text-destructive">
          Не удалось подключиться. Проверьте токен.
        </div>
      )}

      {isConnected && (
        <>
          {/* Household tabs */}
          {households.length > 0 && (
            <div className="flex gap-2 mb-5 flex-wrap">
              {households.map((hh: any) => (
                <div key={hh.id} className="flex items-center gap-1">
                  <button
                    onClick={() => setSelectedHouseholdId(hh.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 ${
                      effectiveHouseholdId === hh.id
                        ? "bg-primary text-primary-foreground border-primary scale-105 shadow-md shadow-primary/20"
                        : "bg-card text-muted-foreground border-border/50 hover:border-border hover:text-foreground"
                    }`}
                    data-testid={`button-household-${hh.id}`}
                  >
                    {hh.name}
                  </button>
                  <button
                    onClick={() => openUserPanel(hh.id)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 border border-border/30 hover:border-primary/40 transition-colors"
                    title={`Открыть панель пользователя: ${hh.name}`}
                    data-testid={`button-userpanel-${hh.id}`}
                  >
                    <Home className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {search ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-6">
              {filteredDevices.map((device: any) => (
                <DeviceCard key={device.id} device={device} token={token} hideOffline={hideOffline} />
              ))}
              {filteredDevices.length === 0 && (
                <p className="col-span-full text-sm text-muted-foreground py-8 text-center">
                  Устройства не найдены: «{search}»
                </p>
              )}
            </div>
          ) : (
            <>
              {rooms.map((room: any) => (
                <RoomSection
                  key={room.id}
                  room={room}
                  devices={filteredDevices as any[]}
                  token={token}
                  hideOffline={hideOffline}
                />
              ))}
              {unroomedDevices.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Прочие
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {unroomedDevices.map((device: any) => (
                      <DeviceCard key={device.id} device={device} token={token} hideOffline={hideOffline} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Scenarios */}
          {(scenariosQuery.data?.scenarios ?? []).length > 0 && (
            <>
              <Separator className="my-6 bg-border/50" />
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Сценарии
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(scenariosQuery.data?.scenarios ?? []).map((sc: any) => (
                    <Button
                      key={sc.id}
                      variant="outline"
                      size="sm"
                      onClick={() => handleRunScenario(sc.id)}
                      disabled={runScenario.isPending}
                      className="border-border/70 hover:border-primary/50 hover:text-primary text-sm"
                    >
                      <Play className="w-3.5 h-3.5 mr-1.5" />
                      {sc.name}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

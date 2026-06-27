import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { getDeviceIcon, isDeviceOn, getDeviceCapability, getDeviceProperty } from "@/lib/yandex";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Search, Wifi, WifiOff, Play, LogOut, ChevronDown, ChevronUp } from "lucide-react";

function SensorValue({ value, unit, color }: { value: number; unit: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-mono font-semibold" style={{ color }}>
      {value}{unit}
    </span>
  );
}

function DeviceCard({ device, token }: { device: any; token: string }) {
  const queryClient = useQueryClient();
  const controlDevice = useControlDevice({
    request: { headers: { "x-yandex-token": token } },
  });
  const isOn = isDeviceOn(device);
  const icon = getDeviceIcon(device.type);
  const isSensor = device.type.includes("sensor");

  const tempProp = device.properties?.find((p: any) => p.parameters?.instance === "temperature");
  const humProp = device.properties?.find((p: any) => p.parameters?.instance === "humidity");
  const pm25Prop = device.properties?.find((p: any) => p.parameters?.instance === "pm2.5_density");
  const battProp = device.properties?.find((p: any) => p.parameters?.instance === "battery_level");

  const brightnessCap = getDeviceCapability(device, "devices.capabilities.range");
  const brightness = brightnessCap?.state?.value as number | undefined;
  const hasToggle = !!getDeviceCapability(device, "devices.capabilities.on_off");

  const toggle = () => {
    controlDevice.mutate(
      {
        deviceId: device.id,
        data: { actions: [{ type: "devices.capabilities.on_off", state: { instance: "on", value: !isOn } }] },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetUserInfoQueryKey() });
        },
      }
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
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl" role="img">{icon}</span>
          <div>
            <p className="text-sm font-semibold leading-tight text-foreground">{device.name}</p>
            <p className="text-xs text-muted-foreground truncate max-w-[140px]">{device.type.split(".").pop()}</p>
          </div>
        </div>
        {hasToggle && (
          <button
            onClick={toggle}
            disabled={controlDevice.isPending}
            className={`text-xs px-2 py-1 rounded-md border font-mono transition-colors ${
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

      {isSensor && (
        <div className="flex gap-3 mt-2 flex-wrap">
          {tempProp?.state?.value !== undefined && (
            <SensorValue value={Math.round((tempProp.state.value as number) * 10) / 10} unit="°C" color="#ff5252" />
          )}
          {humProp?.state?.value !== undefined && (
            <SensorValue value={Math.round(humProp.state.value as number)} unit="%" color="#448aff" />
          )}
          {pm25Prop?.state?.value !== undefined && (
            <SensorValue value={Math.round(pm25Prop.state.value as number)} unit="µg" color="#ff9800" />
          )}
          {battProp?.state?.value !== undefined && (
            <SensorValue value={Math.round(battProp.state.value as number)} unit="%" color="#69f0ae" />
          )}
        </div>
      )}

      {brightnessCap && isOn && brightness !== undefined && (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground mb-1">Brightness: {brightness}%</p>
          <Slider
            value={[brightness]}
            onValueChange={setBrightness}
            min={0}
            max={100}
            step={1}
            className="w-full"
            data-testid={`slider-brightness-${device.id}`}
          />
        </div>
      )}
    </div>
  );
}

function RoomSection({ room, devices, token }: { room: any; devices: any[]; token: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const roomDevices = devices.filter((d) => d.room_id === room.id);
  if (roomDevices.length === 0) return null;

  return (
    <div className="mb-6">
      <button
        className="flex items-center gap-2 mb-3 w-full text-left hover:opacity-80 transition-opacity"
        onClick={() => setCollapsed(!collapsed)}
        data-testid={`section-room-${room.id}`}
      >
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{room.name}</h3>
        <Badge variant="secondary" className="text-xs font-mono">{roomDevices.length}</Badge>
        <span className="ml-auto text-muted-foreground">
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </span>
      </button>
      {!collapsed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {roomDevices.map((device) => (
            <DeviceCard key={device.id} device={device} token={token} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function EngineeringPanel() {
  const { token, setToken, isLoaded } = useYandexToken();
  const [search, setSearch] = useState("");
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

  const allDevices = useMemo(() => userInfo?.devices ?? [], [userInfo]);
  const rooms = useMemo(() => userInfo?.rooms ?? [], [userInfo]);

  const filteredDevices = useMemo(() => {
    if (!search) return allDevices;
    const q = search.toLowerCase();
    return allDevices.filter(
      (d: any) => d.name?.toLowerCase().includes(q) || d.type?.toLowerCase().includes(q)
    );
  }, [allDevices, search]);

  const activeCount = useMemo(() => allDevices.filter(isDeviceOn).length, [allDevices]);
  const unroomedDevices = useMemo(
    () => filteredDevices.filter((d: any) => !d.room_id || !rooms.find((r: any) => r.id === d.room_id)),
    [filteredDevices, rooms]
  );

  const handleRunScenario = (scenarioId: string) => {
    runScenario.mutate(
      { scenarioId },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetUserInfoQueryKey() }) }
    );
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
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {isConnected ? (
            <span className="flex items-center gap-1.5 text-xs text-green-400" data-testid="status-connected">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <Wifi className="w-3.5 h-3.5" />
              Connected
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="status-disconnected">
              <span className="w-2 h-2 rounded-full bg-muted-foreground" />
              <WifiOff className="w-3.5 h-3.5" />
              {userInfoQuery.isLoading ? "Connecting..." : "Disconnected"}
            </span>
          )}
          {activeCount > 0 && (
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs font-mono" data-testid="badge-active-count">
              {activeCount} active
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search devices..."
              className="pl-8 w-56 h-8 text-sm bg-card border-border"
              data-testid="input-search"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setToken(null)}
            className="text-muted-foreground hover:text-destructive h-8"
            data-testid="button-disconnect"
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
          Failed to connect. Please check your token and try again.
        </div>
      )}

      {isConnected && (
        <>
          {userInfo?.households && userInfo.households.length > 0 && (
            <div className="flex gap-2 mb-6 flex-wrap">
              {userInfo.households.map((hh: any) => (
                <Badge
                  key={hh.id}
                  variant="outline"
                  className="border-primary/30 text-primary bg-primary/10"
                  data-testid={`badge-household-${hh.id}`}
                >
                  {hh.name}
                </Badge>
              ))}
            </div>
          )}

          {search ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-6">
              {filteredDevices.map((device: any) => (
                <DeviceCard key={device.id} device={device} token={token} />
              ))}
              {filteredDevices.length === 0 && (
                <p className="col-span-full text-sm text-muted-foreground py-8 text-center">No devices match "{search}"</p>
              )}
            </div>
          ) : (
            <>
              {rooms.map((room: any) => (
                <RoomSection key={room.id} room={room} devices={filteredDevices as any[]} token={token} />
              ))}
              {unroomedDevices.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Other</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {unroomedDevices.map((device: any) => (
                      <DeviceCard key={device.id} device={device} token={token} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {scenariosQuery.data?.scenarios && scenariosQuery.data.scenarios.length > 0 && (
            <>
              <Separator className="my-6 bg-border/50" />
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Scenarios</h3>
                <div className="flex flex-wrap gap-2">
                  {scenariosQuery.data.scenarios.map((sc: any) => (
                    <Button
                      key={sc.id}
                      variant="outline"
                      size="sm"
                      onClick={() => handleRunScenario(sc.id)}
                      disabled={runScenario.isPending}
                      className="border-border/70 hover:border-primary/50 hover:text-primary text-sm"
                      data-testid={`button-scenario-${sc.id}`}
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

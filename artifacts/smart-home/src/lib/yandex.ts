export const DEVICE_ICONS: Record<string, string> = {
  "devices.types.light": "💡",
  "devices.types.light.dimmable": "🔆",
  "devices.types.switch": "🔘",
  "devices.types.socket": "🔌",
  "devices.types.thermostat": "🌡️",
  "devices.types.thermostat.ac": "❄️",
  "devices.types.sensor.climate": "📊",
  "devices.types.sensor.open": "🚪",
  "devices.types.sensor.presence": "👁️",
  "devices.types.sensor.motion": "🏃",
  "devices.types.sensor.smoke": "🔥",
  "devices.types.sensor.water_leak": "🌊",
  "devices.types.sensor.vibration": "📳",
  "devices.types.sensor.button": "🔔",
  "devices.types.sensor.illumination": "🌤️",
  "devices.types.sensor.power": "⚡",
  "devices.types.sensor.gas": "💨",
  "devices.types.humidifier": "💧",
  "devices.types.purifier": "🌬️",
  "devices.types.curtain": "🪟",
  "devices.types.vacuum_cleaner": "🤖",
  "devices.types.media_device.tv": "📺",
  "devices.types.media_device": "🎵",
  "devices.types.cooking.kettle": "☕",
  "devices.types.other": "📱",
  "default": "📱",
};

/** Human-readable Russian label for a device type */
export const DEVICE_TYPE_LABELS: Record<string, string> = {
  "devices.types.light": "Освещение",
  "devices.types.light.dimmable": "Диммер",
  "devices.types.switch": "Выключатель",
  "devices.types.socket": "Розетка",
  "devices.types.thermostat": "Термостат",
  "devices.types.thermostat.ac": "Кондиционер",
  "devices.types.sensor.climate": "Климат-сенсор",
  "devices.types.sensor.open": "Датчик открытия",
  "devices.types.sensor.presence": "Датчик присутствия",
  "devices.types.sensor.motion": "Датчик движения",
  "devices.types.sensor.smoke": "Датчик дыма",
  "devices.types.sensor.water_leak": "Датчик протечки",
  "devices.types.sensor.vibration": "Датчик вибрации",
  "devices.types.sensor.button": "Кнопка",
  "devices.types.sensor.illumination": "Датчик освещённости",
  "devices.types.sensor.power": "Датчик мощности",
  "devices.types.sensor.gas": "Датчик газа",
  "devices.types.humidifier": "Увлажнитель",
  "devices.types.purifier": "Очиститель воздуха",
  "devices.types.curtain": "Штора",
  "devices.types.vacuum_cleaner": "Пылесос",
  "devices.types.media_device.tv": "Телевизор",
  "devices.types.media_device": "Медиаустройство",
  "devices.types.cooking.kettle": "Чайник",
  "devices.types.other": "Устройство",
};

export function getDeviceTypeLabel(type: string): string {
  if (DEVICE_TYPE_LABELS[type]) return DEVICE_TYPE_LABELS[type];
  // Try prefix match
  for (const key of Object.keys(DEVICE_TYPE_LABELS)) {
    if (type.startsWith(key)) return DEVICE_TYPE_LABELS[key];
  }
  // Fallback: last segment of type string
  return type.split(".").pop() ?? type;
}

export function getDeviceIcon(type: string) {
  if (DEVICE_ICONS[type]) return DEVICE_ICONS[type];
  for (const key of Object.keys(DEVICE_ICONS)) {
    if (type.startsWith(key)) return DEVICE_ICONS[key];
  }
  return DEVICE_ICONS["default"];
}

export function getWeatherEmoji(code: number) {
  if (code === 0) return "☀️";
  if (code >= 1 && code <= 3) return "⛅";
  if (code >= 45 && code <= 48) return "🌫️";
  if (code >= 51 && code <= 67) return "🌧️";
  if (code >= 71 && code <= 77) return "❄️";
  if (code >= 80 && code <= 82) return "🌦️";
  if (code >= 95 && code <= 99) return "⛈️";
  return "🌡️";
}

export function getDeviceCapability(device: any, type: string, instance?: string) {
  return device.capabilities?.find(
    (c: any) => c.type === type && (instance === undefined || c.parameters?.instance === instance)
  );
}

export function getDeviceProperty(device: any, instance: string) {
  return device.properties?.find((p: any) => p.parameters?.instance === instance);
}

export function isDeviceOn(device: any) {
  const cap = getDeviceCapability(device, "devices.capabilities.on_off");
  if (!cap) return false;
  return cap.state?.value === true;
}

export function hasToggle(device: any) {
  return !!getDeviceCapability(device, "devices.capabilities.on_off");
}

export function isAcDevice(device: any) {
  return device.type === "devices.types.thermostat.ac" || device.type === "devices.types.thermostat";
}

/** Returns all sensor-style property values present on a device, regardless of device type */
export function getSensorReadings(device: any): {
  temperature?: number;
  humidity?: number;
  pm25?: number;
  co2?: number;
  battery?: number;
  motion?: boolean;
  open?: boolean;
  presence?: boolean;
  vibration?: boolean;
  illumination?: number;
} {
  const props = device.properties ?? [];
  const get = (instance: string) =>
    props.find((p: any) => p.parameters?.instance === instance)?.state?.value;

  const result: ReturnType<typeof getSensorReadings> = {};
  const temp = get("temperature");
  if (temp !== undefined && temp !== null) result.temperature = Number(temp);
  const hum = get("humidity");
  if (hum !== undefined && hum !== null) result.humidity = Number(hum);
  const pm = get("pm2.5_density");
  if (pm !== undefined && pm !== null) result.pm25 = Number(pm);
  const co2 = get("co2_level");
  if (co2 !== undefined && co2 !== null) result.co2 = Number(co2);
  const bat = get("battery_level");
  if (bat !== undefined && bat !== null) result.battery = Number(bat);
  const motion = get("motion");
  if (motion !== undefined && motion !== null) result.motion = Boolean(motion);
  const open = get("open");
  if (open !== undefined && open !== null) result.open = Boolean(open);
  const presence = get("presence");
  if (presence !== undefined && presence !== null) result.presence = Boolean(presence);
  const vibration = get("vibration");
  if (vibration !== undefined && vibration !== null) result.vibration = Boolean(vibration);
  const illumination = get("illumination");
  if (illumination !== undefined && illumination !== null) result.illumination = Number(illumination);
  return result;
}

export function hasSensorReadings(device: any) {
  const r = getSensorReadings(device);
  return Object.keys(r).length > 0;
}

export type AcMode = "auto" | "cool" | "heat" | "dry" | "fan_only";

export const AC_MODE_LABELS: Record<AcMode, { emoji: string; label: string }> = {
  auto: { emoji: "🔄", label: "Авто" },
  cool: { emoji: "❄️", label: "Охлаждение" },
  heat: { emoji: "🔥", label: "Тепло" },
  dry: { emoji: "💧", label: "Осушение" },
  fan_only: { emoji: "🌬️", label: "Вентилятор" },
};

export function getAcMode(device: any): AcMode | undefined {
  const cap = getDeviceCapability(device, "devices.capabilities.mode", "thermostat");
  return cap?.state?.value as AcMode | undefined;
}

export function getAcModeOptions(device: any): AcMode[] {
  const cap = getDeviceCapability(device, "devices.capabilities.mode", "thermostat");
  return (cap?.parameters?.modes?.map((m: any) => m.value) ?? []) as AcMode[];
}

export function getAcTemperature(device: any): { value?: number; min?: number; max?: number } {
  const cap = getDeviceCapability(device, "devices.capabilities.range", "temperature");
  if (!cap) return {};
  return {
    value: cap.state?.value as number | undefined,
    min: cap.parameters?.min_value as number | undefined,
    max: cap.parameters?.max_value as number | undefined,
  };
}

export function getAcFanSpeed(device: any): { value?: number; min?: number; max?: number } {
  const cap = getDeviceCapability(device, "devices.capabilities.range", "fan_speed");
  if (!cap) return {};
  return {
    value: cap.state?.value as number | undefined,
    min: cap.parameters?.min_value as number | undefined,
    max: cap.parameters?.max_value as number | undefined,
  };
}

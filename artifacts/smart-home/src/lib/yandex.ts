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
  "devices.types.humidifier": "💧",
  "devices.types.purifier": "🌬️",
  "devices.types.curtain": "🪟",
  "devices.types.vacuum_cleaner": "🤖",
  "default": "📱"
};

export function getDeviceIcon(type: string) {
  return DEVICE_ICONS[type] || DEVICE_ICONS["default"];
}

export function getWeatherEmoji(code: number) {
  if (code === 0) return "☀️";
  if (code >= 1 && code <= 3) return "⛅";
  if (code >= 45 && code <= 48) return "🌫️";
  if (code >= 51 && code <= 67) return "🌧️";
  if (code >= 71 && code <= 77) return "❄️";
  if (code >= 80 && code <= 82) return "🌦️";
  if (code >= 95 && code <= 99) return "⛈️";
  return "❓";
}

export function getDeviceCapability(device: any, type: string) {
  return device.capabilities?.find((c: any) => c.type === type);
}

export function getDeviceProperty(device: any, type: string) {
  return device.properties?.find((p: any) => p.type === type);
}

export function isDeviceOn(device: any) {
  const onOffCapability = getDeviceCapability(device, "devices.capabilities.on_off");
  if (!onOffCapability) return false;
  return onOffCapability.state?.value === true;
}

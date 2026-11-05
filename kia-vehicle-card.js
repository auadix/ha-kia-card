/**
 * Kia Vehicle Card for Home Assistant
 * A modern, comprehensive card for Kia/Hyundai vehicles
 * Version: 2.13.0-beta.4
 *
 * Features:
 * - MDI icons (no emojis)
 * - Weather badge on car image (day/night aware - sun or moon for Clear)
 * - Climate Start/Stop toggle button
 * - Climate presets (Cool, Warm, Custom)
 * - Vehicle Info Panel (under car image):
 *   - Odometer
 *   - Next service with enhanced visual progress bar
 *   - Doors status summary
 *   - Windows status summary
 *   - Current speed when driving (NEW in v2.7.0)
 * - Heading/Direction badge (compass arrow showing car orientation)
 * - Alert Warnings (shown when triggered):
 *   - Low Washer Fluid
 *   - Low Fuel
 *   - Key Fob Battery Low
 *   - Check Brake Fluid (binary sensor + fallback)
 *   - Check Engine Oil (binary sensor + fallback)
 *   - All individual lamp faults (headlamps, brake lights, turn signals)
 *   - Tail Lamp Fault (NEW in v2.7.0)
 *   - Stop Lamp Fault (NEW in v2.7.0)
 *   - Hazard Lights Active (NEW in v2.7.0)
 * - NEW SENSORS (v2.7.0):
 *   - Car Battery Warning Level (numeric display)
 *   - Link Status indicator
 *   - RSA (Roadside Assistance) Status
 * - Vehicle Status (Parked/Driving)
 * - Vehicle Health - expandable when issues detected
 * - Tire Pressure accordion with individual tire sensors
 * - Valet Mode toggle switch
 * - Clickable location opens Google Maps
 * - Lock/Unlock toggle, Horn, Update controls
 */

const INTEGRATION_DOMAIN = 'kia_uvo';
const UNKNOWN_STATES = new Set(['unavailable', 'unknown', '', '--', '—']);
const UNLOCK_CONFIRM_MS = 4000;
const CLOCK_REFRESH_MS = 60000;
const KM_TO_MILES = 0.621371;

// Commands the API library has no implementation for. On a fork these fail
// silently, so the card can't rely on an error to show they don't work.
const NO_HAZARD_COMMANDS = new Set(['Kia USA']);
const NO_VALET_COMMANDS = /USA$/;

// Kia USA sends the same weather whatever the sky is doing, so it can't be shown
const FIXED_KIA_WEATHER = new Set(['Kia USA']);
const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';
const WEATHER_REFRESH_MS = 30 * 60 * 1000;

// WMO weather codes: [icon type, label]
const WEATHER_CODES = {
  0: ['clear', 'Clear'], 1: ['clear', 'Mostly Clear'], 2: ['partly_cloudy', 'Partly Cloudy'], 3: ['cloudy', 'Cloudy'],
  45: ['fog', 'Fog'], 48: ['fog', 'Fog'],
  51: ['rain', 'Drizzle'], 53: ['rain', 'Drizzle'], 55: ['rain', 'Drizzle'], 56: ['sleet', 'Freezing Drizzle'], 57: ['sleet', 'Freezing Drizzle'],
  61: ['rain', 'Light Rain'], 63: ['rain', 'Rain'], 65: ['showers', 'Heavy Rain'], 66: ['sleet', 'Freezing Rain'], 67: ['sleet', 'Freezing Rain'],
  71: ['snow', 'Light Snow'], 73: ['snow', 'Snow'], 75: ['snow', 'Heavy Snow'], 77: ['snow', 'Snow'],
  80: ['showers', 'Showers'], 81: ['showers', 'Showers'], 82: ['showers', 'Heavy Showers'], 85: ['snow', 'Snow Showers'], 86: ['snow', 'Snow Showers'],
  95: ['thunderstorm', 'Thunderstorm'], 96: ['thunderstorm', 'Thunderstorm'], 99: ['thunderstorm', 'Thunderstorm'],
};

// Valid in every region: Australia only accepts 17-26.5°C, in 0.5° steps
const TEMP_DEFAULTS = {
  '°F': { cool: 68, warm: 80, custom: 72 },
  '°C': { cool: 19, warm: 26, custom: 22 },
};

// ent(domain, translation_key, ...entity id suffixes)
// translation_key is how current kia_uvo identifies an entity, whatever its id.
// The suffixes cover older installs and forks, which have no translation_key.
// A null translation_key means the entity only exists in the auadix fork.
const ent = (domain, tk, ...suffixes) => ({ domain, tk, suffixes: suffixes.length ? suffixes : [tk] });

const ENTITIES = {
  // Main stats
  fuelRange: ent('sensor', 'fuel_driving_range'),
  totalRange: ent('sensor', 'total_driving_range'),
  evRange: ent('sensor', 'ev_driving_range', 'ev_range', 'ev_driving_range'),
  fuelLevel: ent('sensor', 'fuel_level'),
  carBattery: ent('sensor', 'car_battery_percentage', 'car_battery_level'),
  evBattery: ent('sensor', 'ev_battery_percentage', 'ev_battery_level'),
  odometer: ent('sensor', 'odometer'),
  nextService: ent('sensor', 'next_service_distance', 'next_service', 'next_service_distance'),
  // Status
  lock: ent('lock', 'door_lock'),
  engine: ent('binary_sensor', 'engine_is_running', 'engine'),
  remoteIgnition: ent('binary_sensor', 'remote_ignition'),
  airCon: ent('binary_sensor', 'air_control_is_on', 'air_conditioner'),
  defrost: ent('binary_sensor', 'defrost_is_on', 'defrost'),
  evCharging: ent('binary_sensor', 'ev_battery_is_charging', 'ev_battery_charge'),
  evPlugged: ent('binary_sensor', 'ev_battery_is_plugged_in', 'ev_battery_plug'),
  vehicleStatus: ent('sensor', null, 'vehicle_status'),
  drivingStatus: ent('sensor', null, 'driving_status'),
  valetMode: ent('binary_sensor', null, 'valet_mode'),
  dtcCount: ent('sensor', 'dtc_count'),
  // Doors
  doorFrontLeft: ent('binary_sensor', 'front_left_door_is_open', 'front_left_door'),
  doorFrontRight: ent('binary_sensor', 'front_right_door_is_open', 'front_right_door'),
  doorBackLeft: ent('binary_sensor', 'back_left_door_is_open', 'back_left_door'),
  doorBackRight: ent('binary_sensor', 'back_right_door_is_open', 'back_right_door'),
  trunk: ent('binary_sensor', 'trunk_is_open', 'trunk'),
  hood: ent('binary_sensor', 'hood_is_open', 'hood'),
  // Windows
  windowFrontLeft: ent('binary_sensor', 'front_left_window_is_open', 'front_left_window'),
  windowFrontRight: ent('binary_sensor', 'front_right_window_is_open', 'front_right_window'),
  windowBackLeft: ent('binary_sensor', 'back_left_window_is_open', 'back_left_window'),
  windowBackRight: ent('binary_sensor', 'back_right_window_is_open', 'back_right_window'),
  sunroof: ent('binary_sensor', 'sunroof_is_open', 'sunroof'),
  // Tires: warnings, plus measured pressure where the integration reports it
  tireWarnAll: ent('binary_sensor', 'tire_pressure_all_warning_is_on', 'tire_pressure_all'),
  tireWarnFrontLeft: ent('binary_sensor', 'tire_pressure_front_left_warning_is_on', 'tire_pressure_front_left'),
  tireWarnFrontRight: ent('binary_sensor', 'tire_pressure_front_right_warning_is_on', 'tire_pressure_front_right'),
  tireWarnRearLeft: ent('binary_sensor', 'tire_pressure_rear_left_warning_is_on', 'tire_pressure_rear_left'),
  tireWarnRearRight: ent('binary_sensor', 'tire_pressure_rear_right_warning_is_on', 'tire_pressure_rear_right'),
  tirePressureFrontLeft: ent('sensor', 'tire_pressure_front_left'),
  tirePressureFrontRight: ent('sensor', 'tire_pressure_front_right'),
  tirePressureRearLeft: ent('sensor', 'tire_pressure_rear_left'),
  tirePressureRearRight: ent('sensor', 'tire_pressure_rear_right'),
  // Location and time
  tracker: ent('device_tracker', 'location'),
  geocodedLocation: ent('sensor', 'geocode_name', 'geocoded_location'),
  locationSensor: ent('sensor', null, 'location'),
  lastUpdated: ent('sensor', 'last_updated_at'),
  heading: ent('sensor', null, 'heading'),
  speed: ent('sensor', null, 'speed'),
  // Weather and climate
  weatherTemperature: ent('sensor', null, 'weather_temperature'),
  outsideTemperature: ent('sensor', 'outside_temperature'),
  weatherType: ent('sensor', null, 'weather_type'),
  setTemperature: ent('sensor', 'air_temperature', 'set_temperature'),
  steeringWheelHeater: ent('binary_sensor', 'steering_wheel_heater_is_on', 'steering_wheel_heater'),
  sideMirrorHeater: ent('binary_sensor', 'side_mirror_heater_is_on', 'side_mirror_heater'),
  backWindowHeater: ent('binary_sensor', 'back_window_heater_is_on', 'back_window_heater'),
  // Diagnostics
  carBatteryWarningLevel: ent('sensor', null, 'car_battery_warning_level'),
  linkStatus: ent('sensor', null, 'link_status'),
  roadsideStatus: ent('sensor', null, 'roadside_assistance_status'),
  // Alerts
  washerFluid: ent('binary_sensor', 'washer_fluid_warning_is_on', 'washer_fluid_warning'),
  lowFuel: ent('binary_sensor', 'fuel_level_is_low', 'fuel_low_level'),
  smartKeyBattery: ent('binary_sensor', 'smart_key_battery_warning_is_on', 'smart_key_battery_warning'),
  brakeFluid: ent('binary_sensor', 'brake_fluid_warning_is_on', 'brake_fluid_warning'),
  engineOil: ent('binary_sensor', 'oil_level_warning_is_on', 'oil_level_warning', 'engine_oil_warning'),
  headlightFault: ent('binary_sensor', 'headlamp_status', 'headlamp_status', 'headlight_fault'),
  headlampLeftLow: ent('binary_sensor', 'headlamp_left_low', 'front_left_lamp_fault', 'headlamp_left_low_fault'),
  headlampRightLow: ent('binary_sensor', 'headlamp_right_low', 'front_right_lamp_fault', 'headlamp_right_low_fault'),
  headlampLeftHigh: ent('binary_sensor', 'headlamp_left_high', 'headlamp_left_high_fault'),
  headlampRightHigh: ent('binary_sensor', 'headlamp_right_high', 'headlamp_right_high_fault'),
  headlampLeftBifunc: ent('binary_sensor', 'headlamp_left_bifunc', 'headlamp_left_bifunctional_fault'),
  headlampRightBifunc: ent('binary_sensor', 'headlamp_right_bifunc', 'headlamp_right_bifunctional_fault'),
  stopLampLeft: ent('binary_sensor', 'stop_lamp_left', 'rear_left_lamp_fault', 'stop_lamp_left_fault'),
  stopLampRight: ent('binary_sensor', 'stop_lamp_right', 'rear_right_lamp_fault', 'stop_lamp_right_fault'),
  turnSignalLeftFront: ent('binary_sensor', 'turn_signal_left_front', 'turn_signal_left_front', 'turn_signal_left_front_fault'),
  turnSignalRightFront: ent('binary_sensor', 'turn_signal_right_front', 'turn_signal_right_front', 'turn_signal_right_front_fault'),
  turnSignalLeftRear: ent('binary_sensor', 'turn_signal_left_rear', 'turn_signal_left_rear', 'turn_signal_left_rear_fault'),
  turnSignalRightRear: ent('binary_sensor', 'turn_signal_right_rear', 'turn_signal_right_rear', 'turn_signal_right_rear_fault'),
  tailLampFault: ent('binary_sensor', null, 'tail_lamp_fault'),
  stopLampFault: ent('binary_sensor', null, 'stop_lamp_fault'),
  hazardLights: ent('binary_sensor', 'hazard_lights_on', 'hazard_lights'),
  // Raw API payload
  // Comfort fallback for cars without the raw climate payload
  seatHeaterDriver: ent('binary_sensor', 'front_left_seat_heater_on', 'front_left_seat_heater'),
  seatHeaterPassenger: ent('binary_sensor', 'front_right_seat_heater_on', 'front_right_seat_heater'),
  // Diagnostics / extras
  auxBatteryFault: ent('binary_sensor', 'battery_auxiliary_fail_warning_is_on', 'battery_auxiliary_fail_warning'),
  averageFuelEconomy: ent('sensor', 'average_fuel_economy_accumulated'),
  driveMode: ent('sensor', 'drive_mode'),
  gearPosition: ent('sensor', 'gear_position'),
  evChargeDuration: ent('sensor', 'ev_estimated_current_charge_duration', 'estimated_charge_duration'),
  evChargingPower: ent('sensor', 'ev_charging_power'),
  data: ent('sensor', 'data', 'data', 'all_data'),
};

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// Vehicles the integration has registered: [{ id, name }]
function findVehicleDevices(hass) {
  const ids = new Set();
  for (const entry of Object.values(hass?.entities ?? {})) {
    if (entry.platform === INTEGRATION_DOMAIN && entry.device_id) ids.add(entry.device_id);
  }
  return [...ids].map((id) => {
    const device = hass?.devices?.[id];
    return { id, name: device?.name_by_user || device?.name || id };
  });
}

// start_climate takes the unit of the API's region, whatever the user's HA uses
function climateUnit(hass, deviceId) {
  const manufacturer = hass?.devices?.[deviceId]?.manufacturer;
  if (manufacturer) return manufacturer.endsWith('USA') ? '°F' : '°C';
  return hass?.config?.unit_system?.temperature === '°C' ? '°C' : '°F';
}

function presetTemp(config, preset, unit) {
  const value = Number(config[`${preset}_temp`]);
  if (!value) return TEMP_DEFAULTS[unit][preset];
  // Older versions always stored °F, so convert values in the wrong range
  if (unit === '°C' && value > 40) return Math.round(((value - 32) * 5 / 9) * 2) / 2;
  if (unit === '°F' && value <= 40) return Math.round(value * 9 / 5 + 32);
  return value;
}

// Longest shared "<prefix>_" of a device's entities, e.g. "my_car" from my_car_odometer
function commonObjectIdPrefix(entityIds) {
  const objectIds = entityIds.map((id) => id.split('.')[1]);
  if (objectIds.length < 2) return null;
  const parts = objectIds[0].split('_');
  let length = 0;
  while (length < parts.length - 1 && objectIds.every((id) => id.split('_')[length] === parts[length])) {
    length += 1;
  }
  return length ? parts.slice(0, length).join('_') : null;
}

// Finds the vehicle's device and how its entities are named. Rebuilt only when
// the entity registry or the card config changes.
function buildEntityIndex(hass, config) {
  const registry = Object.values(hass?.entities ?? {});
  const vehicleId = config.vehicle_id || '';
  const hasEntries = (id) => registry.some((entry) => entry.device_id === id);

  let deviceId = config.device_id && hasEntries(config.device_id) ? config.device_id : null;
  if (!deviceId && vehicleId) {
    const prefixes = [`.${vehicleId}_`, `.${vehicleId.toLowerCase()}_`];
    const match = registry.find((entry) => entry.device_id && entry.platform === INTEGRATION_DOMAIN
      && prefixes.some((prefix) => entry.entity_id.includes(prefix)));
    deviceId = match?.device_id ?? null;
  }

  const onDevice = deviceId ? registry.filter((entry) => entry.device_id === deviceId) : [];
  const own = onDevice.filter((entry) => entry.platform === INTEGRATION_DOMAIN);
  const entries = own.length ? own : onDevice;

  const byTranslationKey = new Map();
  for (const entry of entries) {
    if (entry.translation_key) {
      byTranslationKey.set(`${entry.entity_id.split('.')[0]}:${entry.translation_key}`, entry.entity_id);
    }
  }

  const prefixes = [vehicleId, vehicleId.toLowerCase(), commonObjectIdPrefix(entries.map((entry) => entry.entity_id))];
  return {
    deviceId: deviceId || config.device_id || null,
    byTranslationKey,
    prefixes: [...new Set(prefixes.filter(Boolean))],
  };
}

class KiaVehicleCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {
      vehicle_id: '',
      name: 'My Kia',
      image: '',
      show_controls: true,
      show_status_row: true,
      device_id: '',
      car_weather: false,
      // Climate presets (cool_temp, warm_temp, custom_temp default by region)
      duration: 10,
      // Warm preset accessories (which to enable)
      warm_steering_wheel: true,
      warm_front_left_seat: true,
      warm_front_right_seat: true,
      warm_rear_left_seat: false,
      warm_rear_right_seat: false,
      // Seat/steering levels (6=Low Heat, 7=Med Heat, 8=High Heat, 1=Low for steering)
      warm_seat_level: 6,  // Low Heat
      warm_steering_level: 2  // High
    };
    this._climateMode = null;
    this._showClimatePanel = false;
    this._showHealthDetails = false;
    this._showTirePressure = false;
    this._showQuickActions = false;
  }

  setConfig(config) {
    if (!config || typeof config !== 'object') return;
    this._config = { ...this._config, ...config };
    this._index = null;
    if (this._hass) this.render();
  }

  get config() {
    return this._config;
  }

  set hass(hass) {
    const previous = this._hass;
    if (hass?.entities !== previous?.entities) this._index = null;
    this._hass = hass;
    if (!previous || this.needsRender(previous)) this.render();
  }

  // hass is replaced on every state change in Home Assistant, so rebuild only
  // when something this card shows has changed
  needsRender(previous) {
    const hass = this._hass;
    if (hass.entities !== previous.entities || hass.services !== previous.services
      || hass.devices !== previous.devices) return true;
    const tracked = Object.keys(ENTITIES).map((key) => this.entityId(key)).filter(Boolean);
    const trackedKey = tracked.join();
    if (trackedKey !== this._trackedKey) {
      this._trackedKey = trackedKey;
      return true;
    }
    return tracked.some((id) => hass.states[id] !== previous.states[id]);
  }

  connectedCallback() {
    this._clock = setInterval(() => this.updateClock(), CLOCK_REFRESH_MS);
  }

  disconnectedCallback() {
    clearInterval(this._clock);
    this.disarmUnlock();
  }

  // Keeps "12 min ago" moving between data updates without a full redraw
  updateClock() {
    const time = this.formatTime(this.stateOf('lastUpdated'));
    const element = this.shadowRoot.getElementById('updated-time');
    if (time && element) element.textContent = `Updated ${time}`;
    this.refreshCarWeather();
  }

  // Off unless the user opts in, because it sends the car's position to Open-Meteo.
  // Rounded to about 1 km, which is as precise as the forecast anyway.
  refreshCarWeather() {
    const position = this._carPosition;
    if (!this._config.car_weather || !position || !this._hass) return;
    const latitude = position.latitude.toFixed(2);
    const longitude = position.longitude.toFixed(2);
    const key = `${latitude},${longitude}`;
    const current = this._carWeather;
    if (current?.key === key && Date.now() - current.at < WEATHER_REFRESH_MS) return;
    // Also stops a failing service being retried before the next refresh is due
    this._carWeather = { key, at: Date.now() };

    const fahrenheit = this._hass.config?.unit_system?.temperature !== '°C';
    const query = `latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code`
      + `&temperature_unit=${fahrenheit ? 'fahrenheit' : 'celsius'}`;
    fetch(`${WEATHER_API}?${query}`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then(({ current: reading }) => {
        const [type, label] = WEATHER_CODES[reading.weather_code] ?? [null, null];
        const temperature = `${Math.round(reading.temperature_2m)}${fahrenheit ? '°F' : '°C'}`;
        this._carWeather = { key, at: Date.now(), type, label, temperature };
        this.render();
      })
      .catch(() => {});
  }

  armUnlock() {
    this._unlockArmed = true;
    clearTimeout(this._unlockTimer);
    this._unlockTimer = setTimeout(() => {
      this.disarmUnlock();
      this.render();
    }, UNLOCK_CONFIRM_MS);
    this.render();
  }

  disarmUnlock() {
    this._unlockArmed = false;
    clearTimeout(this._unlockTimer);
  }

  get index() {
    if (!this._index) this._index = buildEntityIndex(this._hass, this._config);
    return this._index;
  }

  // The real entity id behind an ENTITIES key, or null if this car doesn't have it
  entityId(key) {
    const { domain, tk, suffixes } = ENTITIES[key];
    const states = this._hass?.states ?? {};
    const registered = tk ? this.index.byTranslationKey.get(`${domain}:${tk}`) : null;
    if (registered && states[registered]) return registered;
    for (const prefix of this.index.prefixes) {
      for (const suffix of suffixes) {
        const candidate = `${domain}.${prefix}_${suffix}`;
        if (states[candidate]) return candidate;
      }
    }
    return null;
  }

  // State text, or null when missing or not currently known
  stateOf(key) {
    const id = this.entityId(key);
    const state = id ? this._hass.states[id].state : null;
    return state === null || UNKNOWN_STATES.has(state) ? null : state;
  }

  // true, false, or null when missing or not currently known
  boolOf(key) {
    const state = this.stateOf(key);
    if (state === 'on') return true;
    return state === 'off' ? false : null;
  }

  attrOf(key, attr) {
    const id = this.entityId(key);
    return id ? this._hass.states[id].attributes?.[attr] ?? null : null;
  }

  hasService(service) {
    return !!this._hass?.services?.[INTEGRATION_DOMAIN]?.[service];
  }

  get deviceId() {
    return this.index.deviceId;
  }

  get manufacturer() {
    return this._hass?.devices?.[this.deviceId]?.manufacturer ?? '';
  }

  get temperatureUnit() {
    return climateUnit(this._hass, this.deviceId);
  }

  temperatureFor(preset) {
    return presetTemp(this._config, preset, this.temperatureUnit);
  }

  distanceUnit(key) {
    return this.attrOf(key, 'unit_of_measurement') || this._hass?.config?.unit_system?.length || 'mi';
  }

  // "12.5 psi" style value using the entity's own unit, or null
  measurement(key) {
    const value = this.stateOf(key);
    if (value === null) return null;
    const unit = this.attrOf(key, 'unit_of_measurement');
    return unit ? `${value} ${unit}` : value;
  }

  formatNumber(num) {
    if (num === 'unavailable' || num === null || num === undefined || num === '—') return '—';
    const n = parseFloat(num);
    return isNaN(n) ? '—' : n.toLocaleString();
  }

  callService(domain, service, data) {
    // Home Assistant shows its own toast when a call fails
    Promise.resolve(this._hass?.callService(domain, service, data)).catch(() => {});
  }

  renderMessage(html) {
    this.shadowRoot.innerHTML = `
      <ha-card>
        <div style="padding: 24px; text-align: center; color: var(--secondary-text-color);">${html}</div>
      </ha-card>
    `;
  }

  render() {
    if (!this._hass) return;
    const { vehicle_id: vehicleId, device_id: deviceId } = this._config;
    if (!vehicleId && !deviceId) {
      this.renderMessage('Select your vehicle in the card editor.');
      return;
    }
    if (!Object.keys(ENTITIES).some((key) => this.entityId(key))) {
      this.renderMessage(`No vehicle entities found for <code>${escapeHtml(vehicleId || deviceId)}</code>. Check the vehicle in the card editor.`);
      return;
    }

    const getNum = (s) => { const n = parseFloat(s); return isNaN(n) ? 0 : n; };
    const bool = (key) => this.boolOf(key);
    const lockState = this.stateOf('lock');
    const tracker = this.stateOf('tracker');
    const rangeKey = ['fuelRange', 'totalRange', 'evRange'].find((key) => this.stateOf(key) !== null);
    const trackerId = this.entityId('tracker');
    const rawInfo = this._hass.states[this.entityId('data')]?.attributes?.vehicle_data?.lastVehicleInfo;
    const rawStatus = rawInfo?.vehicleStatusRpt?.vehicleStatus;

    const carWeather = this._config.car_weather ? this._carWeather : null;
    const kiaWeatherIsFixed = FIXED_KIA_WEATHER.has(this.manufacturer);

    // Gather data. null always means "unknown": hide it, never assume it's fine.
    const data = {
      // Main stats
      range: rangeKey ? this.stateOf(rangeKey) : null,
      rangeUnit: rangeKey ? this.distanceUnit(rangeKey) : null,
      fuel: this.stateOf('fuelLevel'),
      battery: this.stateOf('carBattery'),
      evBattery: this.stateOf('evBattery'),
      odometer: this.stateOf('odometer'),
      odometerUnit: this.distanceUnit('odometer'),

      // Status - use lock entity directly (most reliable)
      locked: lockState === null ? null : lockState === 'locked',
      engine: bool('engine'),
      airCon: bool('airCon'),
      defrost: bool('defrost'),

      // Vehicle status (Parked/Driving) - from various possible entities
      vehicleStatus: this.getVehicleStatus(),

      // Doors
      frontLeftDoor: bool('doorFrontLeft'),
      frontRightDoor: bool('doorFrontRight'),
      backLeftDoor: bool('doorBackLeft'),
      backRightDoor: bool('doorBackRight'),
      trunk: bool('trunk'),
      hood: bool('hood'),

      // Additional status
      valetMode: bool('valetMode'),
      dtcCount: this.stateOf('dtcCount'),

      // Tires: true = warning, false = fine, null = unknown
      tirePressureWarning: bool('tireWarnAll'),
      tireFrontLeft: bool('tireWarnFrontLeft'),
      tireFrontRight: bool('tireWarnFrontRight'),
      tireRearLeft: bool('tireWarnRearLeft'),
      tireRearRight: bool('tireWarnRearRight'),

      // Location & time. A device tracker's state is only a zone name, so prefer
      // a real address and never show its raw not_home value.
      location: this.stateOf('geocodedLocation') ?? this.stateOf('locationSensor')
        ?? (tracker === 'home' ? 'Home' : tracker === 'not_home' ? null : tracker),
      lastUpdated: this.stateOf('lastUpdated'),

      // Lat/Long for map link
      latitude: this._hass.states[trackerId]?.attributes?.latitude,
      longitude: this._hass.states[trackerId]?.attributes?.longitude,

      // Heading/Direction - try sensor first, then data attribute
      heading: [this.stateOf('heading'), rawInfo?.location?.head]
        .map(parseFloat).find((value) => !isNaN(value)) ?? null,

      // Weather at vehicle location
      weatherTemp: carWeather?.temperature ?? this.measurement('weatherTemperature') ?? this.measurement('outsideTemperature') ?? (() => {
        const rawTemp = rawInfo?.weather?.outsideTemp?.[1]?.value;
        return UNKNOWN_STATES.has(rawTemp ?? '') ? null : rawTemp;
      })(),
      weatherType: carWeather?.type
        ?? (kiaWeatherIsFixed ? null : this.stateOf('weatherType') ?? rawInfo?.weather?.weatherType ?? null),
      weatherLabel: carWeather?.label ?? null,

      // Service info
      nextService: this.stateOf('nextService'),
      nextServiceUnit: this.distanceUnit('nextService'),

      // Speed and diagnostic numeric sensors
      speed: this.stateOf('speed'),
      speedUnit: this.attrOf('speed', 'unit_of_measurement') || 'km/h',
      carBatteryWarningLevel: this.stateOf('carBatteryWarningLevel'),
      linkStatus: this.stateOf('linkStatus'),
      rsaStatus: this.stateOf('roadsideStatus'),

      // Warnings / Alerts - use sensors with fallback to data attributes
      washerFluidWarning: bool('washerFluid'),
      lowFuel: bool('lowFuel'),
      smartKeyBattery: bool('smartKeyBattery'),
      brakeFluidWarning: bool('brakeFluid') || rawStatus?.brakeOilStatus === true,
      engineOilWarning: bool('engineOil') || rawStatus?.engineOilStatus === true,
      // Lamp faults - all individual sensors
      headlightFault: bool('headlightFault'),
      headlampLeftFault: bool('headlampLeftLow'),
      headlampRightFault: bool('headlampRightLow'),
      headlampLeftHighFault: bool('headlampLeftHigh'),
      headlampRightHighFault: bool('headlampRightHigh'),
      headlampLeftBifuncFault: bool('headlampLeftBifunc'),
      headlampRightBifuncFault: bool('headlampRightBifunc'),
      stopLampLeftFault: bool('stopLampLeft'),
      stopLampRightFault: bool('stopLampRight'),
      turnSignalLeftFrontFault: bool('turnSignalLeftFront'),
      turnSignalRightFrontFault: bool('turnSignalRightFront'),
      turnSignalLeftRearFault: bool('turnSignalLeftRear'),
      turnSignalRightRearFault: bool('turnSignalRightRear'),
      tailLampFault: bool('tailLampFault'),
      stopLampFault: bool('stopLampFault'),
      hazardLights: bool('hazardLights'),

      // Windows
      frontLeftWindow: bool('windowFrontLeft'),
      frontRightWindow: bool('windowFrontRight'),
      backLeftWindow: bool('windowBackLeft'),
      backRightWindow: bool('windowBackRight'),
      sunroof: bool('sunroof'),

      // EV specific
      evCharging: bool('evCharging'),
      evPluggedIn: bool('evPlugged'),
      evRange: this.measurement('evRange'),

      // Climate
      setTemp: this.measurement('setTemperature'),

      // Extras
      auxBatteryFault: bool('auxBatteryFault'),
      averageFuelEconomy: this.measurement('averageFuelEconomy'),
      driveMode: this.stateOf('driveMode'),
      gearPosition: this.stateOf('gearPosition'),
      evChargeDuration: this.stateOf('evChargeDuration'),
      evChargingPower: this.measurement('evChargingPower'),

      // Comfort / Heating - raw API data is more accurate, but only some regions have it
      ...(() => {
        const heatingData = rawStatus?.climate?.heatingAccessory;
        return {
          steeringWheelHeater: heatingData ? heatingData.steeringWheel > 0 : bool('steeringWheelHeater') === true,
          sideMirrorHeater: heatingData ? heatingData.sideMirror > 0 : bool('sideMirrorHeater') === true,
          rearWindowHeater: heatingData ? heatingData.rearWindow > 0 : bool('backWindowHeater') === true,
        };
      })(),
      // Seats (from data attribute as they are complex objects)
      seatStatus: (() => {
        const seats = rawStatus?.climate?.heatVentSeat;
        // heatVentType: 0=Off, 1=Heat, 2=Cool/Vent; heatVentLevel: 0=Off, 1-3=Level
        if (seats) {
          return {
            driver: seats.driverSeat,
            passenger: seats.passengerSeat,
            rearLeft: seats.rearLeftSeat,
            rearRight: seats.rearRightSeat,
          };
        }
        // Fallback: on/off heater sensors only (no level/type detail)
        const fromHeater = (key) => (bool(key) === true ? { heatVentType: 1, heatVentLevel: 1 } : null);
        const driver = fromHeater('seatHeaterDriver');
        const passenger = fromHeater('seatHeaterPassenger');
        return driver || passenger ? { driver, passenger } : null;
      })(),
    };

    const fuelPercent = getNum(data.fuel);
    const batteryPercent = getNum(data.battery);
    const evBatteryPercent = getNum(data.evBattery);
    const doors = [data.frontLeftDoor, data.frontRightDoor, data.backLeftDoor, data.backRightDoor, data.trunk, data.hood];
    const windows = [data.frontLeftWindow, data.frontRightWindow, data.backLeftWindow, data.backRightWindow, data.sunroof];
    const hasDoors = doors.some((door) => door !== null);
    const hasWindows = windows.some((window) => window !== null);
    const openDoors = doors.filter(Boolean).length;
    const openWindows = windows.filter(Boolean).length;
    const anyDoorOpen = openDoors > 0;
    const anyWindowOpen = openWindows > 0;
    const hasHealthIssue = parseInt(data.dtcCount) > 0;
    const isEV = data.evBattery !== null && data.evBattery !== '0';
    const isFullEV = isEV && data.fuel === null;

    // Pressure sensor first, then the raw payload, which only Kia USA sends (in psi).
    // Zero is the integrations' "no reading" value, not a flat tire.
    const tirePressure = (key, row, side) => {
      if (parseFloat(this.stateOf(key)) > 0) return this.measurement(key);
      const raw = rawStatus?.tirePressureDetail?.[row]?.[side]?.tire?.pressure;
      return raw > 0 ? `${raw} psi` : null;
    };

    // Tires: show the section if anything at all is known about them
    const tires = [
      { axle: 'Front', side: 'Left', warning: data.tireFrontLeft, pressure: tirePressure('tirePressureFrontLeft', 'row1', 'Left') },
      { axle: 'Front', side: 'Right', warning: data.tireFrontRight, pressure: tirePressure('tirePressureFrontRight', 'row1', 'Right') },
      { axle: 'Rear', side: 'Left', warning: data.tireRearLeft, pressure: tirePressure('tirePressureRearLeft', 'row2', 'Left') },
      { axle: 'Rear', side: 'Right', warning: data.tireRearRight, pressure: tirePressure('tirePressureRearRight', 'row2', 'Right') },
    ].filter((tire) => tire.warning !== null || tire.pressure !== null);
    const hasTireStatus = data.tirePressureWarning !== null || tires.some((tire) => tire.warning !== null);
    const tireWarning = data.tirePressureWarning === true || tires.some((tire) => tire.warning === true);

    // Only offer controls that can work on this install
    const engineRunning = data.engine === true;
    // An EV can run climate with no engine at all
    const climateRunning = engineRunning || (isEV && data.airCon === true);
    this._climateRunning = climateRunning;
    const canLock = data.locked !== null;
    const unlockArmed = this._unlockArmed && data.locked === true;
    const canClimate = this.hasService(climateRunning ? 'stop_climate' : 'start_climate');
    const canQuickActions = this.hasService('start_hazard_lights_and_horn')
      && this.hasService('start_hazard_lights') && !NO_HAZARD_COMMANDS.has(this.manufacturer);
    const canSetValet = this.hasService('start_valet_mode') && this.hasService('stop_valet_mode')
      && !NO_VALET_COMMANDS.test(this.manufacturer);
    const temperatureUnit = this.temperatureUnit;
    const canUpdate = this.hasService('force_update');
    const controlCount = [canLock, canClimate, canQuickActions, canUpdate].filter(Boolean).length;

    // Image handling
    let vehicleImage = this._config.image;
    if (!vehicleImage) {
      vehicleImage = this.attrOf('data', 'vehicle_image');
    }

    const vehicleImageHtml = vehicleImage
      ? `<img class="vehicle-image" src="${escapeHtml(vehicleImage)}" alt="Vehicle" />`
      : this.getCarSvg(data);

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --card-bg: #202124;
          --card-surface: #2d2e31;
          --card-surface-light: #3c4043;
          --text-primary: #e8eaed;
          --text-secondary: #9aa0a6;
          --accent: #3B82F6;
          --accent-dim: rgba(59, 130, 246, 0.15);
          --success: #10B981;
          --warning: #F59E0B;
          --danger: #EF4444;
          --cool: #06B6D4;
          --warm: #F97316;
          --accent-yellow: #FBBF24;
          --spacing-xs: 4px;
          --spacing-sm: 8px;
          --spacing-md: 16px;
          --spacing-lg: 24px;
          --radius: 12px;
          --radius-sm: 8px;
        }

        ha-card {
          background: var(--card-bg);
          color: var(--text-primary);
          border-radius: var(--radius);
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        ha-icon {
          --mdc-icon-size: 20px;
        }

        /* Header */
        .header {
          padding: var(--spacing-md) var(--spacing-lg);
          background: var(--card-surface);
          border-bottom: 1px solid var(--card-surface-light);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .vehicle-name {
          font-size: 1.1rem;
          font-weight: 600;
        }

        .status-badge {
          font-size: 0.7rem;
          padding: 5px 12px;
          border-radius: 20px;
          background: var(--card-surface-light);
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 6px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .status-badge.locked {
          background: rgba(16, 185, 129, 0.12);
          color: var(--success);
        }

        .status-badge.unlocked {
          background: rgba(239, 68, 68, 0.12);
          color: var(--danger);
        }

        .status-badge.running {
          background: rgba(59, 130, 246, 0.12);
          color: var(--accent);
        }

        /* Main Content */
        .main-content {
          padding: var(--spacing-lg);
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--spacing-lg);
          align-items: start;
        }

        /* Stats */
        .stats-column {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }

        .stats-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--spacing-md);
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .stat-label {
          font-size: 0.7rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 600;
          display: flex;
          align-items: baseline;
          gap: 2px;
        }

        .stat-unit {
          font-size: 0.85rem;
          color: var(--text-secondary);
          font-weight: 400;
        }

        /* Progress Bars */
        .bars-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .bar-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .bar-header {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .progress-track {
          height: 6px;
          background: var(--card-surface-light);
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.5s ease;
        }

        .progress-fill.fuel {
          background: linear-gradient(90deg, var(--warning) 0%, var(--success) 100%);
        }

        .progress-fill.battery {
          background: linear-gradient(90deg, var(--danger) 0%, var(--success) 100%);
        }

        /* Visual Column */
        .visual-column {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .vehicle-image {
          max-width: 100%;
          max-height: 160px;
          object-fit: contain;
        }

        .vehicle-image-container {
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .weather-badge {
          position: absolute;
          top: 0;
          right: 0;
          background: var(--card-surface);
          border: 1px solid var(--card-surface-light);
          border-radius: 50%;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent-yellow);
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }

        .weather-badge ha-icon {
          --mdc-icon-size: 20px;
        }

        .heading-badge {
          position: absolute;
          top: 0;
          left: 0;
          background: var(--card-surface);
          border: 1px solid var(--card-surface-light);
          border-radius: 50%;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent);
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          cursor: help;
        }

        .heading-badge ha-icon {
          --mdc-icon-size: 20px;
          transition: transform 0.3s ease;
        }

        .heading-badge .direction-label {
          position: absolute;
          bottom: -18px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 0.6rem;
          font-weight: 600;
          color: var(--text-secondary);
          white-space: nowrap;
          background: var(--card-surface);
          padding: 1px 4px;
          border-radius: 4px;
        }

        .car-svg {
          width: 120px;
          height: auto;
        }

        /* Vehicle Info Section (under car image) */
        .vehicle-info {
          width: 100%;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--card-surface-light);
        }

        .info-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: var(--card-surface);
          border-radius: 16px;
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .info-chip ha-icon {
          --mdc-icon-size: 16px;
        }

        .info-chip.highlight {
          background: var(--accent-dim);
          color: var(--accent);
        }

        .info-chip.warning {
          background: rgba(245, 158, 11, 0.15);
          color: var(--warning);
        }

        .info-chip.success {
          color: var(--success);
        }

        .info-chip.danger {
          background: rgba(239, 68, 68, 0.15);
          color: var(--danger);
        }

        .info-chip.full-width {
          grid-column: span 2;
          justify-content: center;
        }

        .weather-display {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: var(--card-surface);
          border-radius: var(--radius-sm);
          grid-column: span 2;
        }

        .weather-temp {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .weather-desc {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .weather-icon {
          font-size: 1.5rem;
        }

        /* Controls - Grid layout */
        .controls-section {
          padding: var(--spacing-sm) var(--spacing-lg) var(--spacing-md);
        }

        .controls-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: var(--spacing-sm);
        }

        .control-btn {
          background: var(--card-surface);
          border: 1px solid var(--card-surface-light);
          border-radius: var(--radius);
          padding: 14px 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          color: var(--text-primary);
        }

        .control-btn:hover {
          background: var(--card-surface-light);
          border-color: var(--accent);
        }

        .control-btn:active {
          transform: scale(0.97);
        }

        .control-btn.active {
          background: var(--accent-dim);
          border-color: var(--accent);
          color: var(--accent);
        }

        .control-btn.confirm {
          background: rgba(245, 158, 11, 0.15);
          border-color: var(--warning);
          color: var(--warning);
        }

        .control-btn.climate-start {
          border-color: var(--success);
        }

        .control-btn.climate-start:hover {
          background: rgba(16, 185, 129, 0.1);
          border-color: var(--success);
        }

        .control-btn.climate-stop {
          border-color: var(--danger);
          color: var(--danger);
        }

        .control-btn.climate-stop:hover {
          background: rgba(239, 68, 68, 0.1);
          border-color: var(--danger);
        }

        .control-btn ha-icon {
          --mdc-icon-size: 24px;
        }

        .control-label {
          font-size: 0.7rem;
          font-weight: 500;
          text-align: center;
        }

        /* Status Rows (Vehicle Status, Health, Valet) */
        .status-rows {
          border-top: 1px solid var(--card-surface-light);
        }

        .status-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px var(--spacing-lg);
          border-bottom: 1px solid var(--card-surface-light);
        }

        .status-row:last-child {
          border-bottom: none;
        }

        .status-row.clickable {
          cursor: pointer;
          transition: background 0.2s;
        }

        .status-row.clickable:hover {
          background: var(--card-surface);
        }

        .status-row-left {
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--text-primary);
          font-size: 0.9rem;
        }

        .status-row-left ha-icon {
          --mdc-icon-size: 20px;
          color: var(--text-secondary);
        }

        .status-row-right {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .status-row-right.parked {
          color: var(--success);
        }

        .status-row-right.driving {
          color: var(--accent);
        }

        .status-row-right.warning {
          color: var(--warning);
        }

        .status-row-right.danger {
          color: var(--danger);
        }

        .status-row-right ha-icon {
          --mdc-icon-size: 16px;
        }

        /* Toggle Switch for Valet Mode */
        .toggle-switch {
          position: relative;
          width: 44px;
          height: 24px;
          background: var(--card-surface-light);
          border-radius: 12px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .toggle-switch.active {
          background: var(--warning);
        }

        .toggle-switch::after {
          content: '';
          position: absolute;
          top: 2px;
          left: 2px;
          width: 20px;
          height: 20px;
          background: white;
          border-radius: 50%;
          transition: transform 0.2s;
        }

        .toggle-switch.active::after {
          transform: translateX(20px);
        }

        /* Expandable Health Panel */
        .health-details {
          padding: var(--spacing-sm) var(--spacing-lg);
          padding-left: 56px;
          background: var(--card-surface);
          border-bottom: 1px solid var(--card-surface-light);
        }

        .health-details-item {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text-secondary);
          font-size: 0.8rem;
          padding: 4px 0;
        }

        .health-details-item ha-icon {
          --mdc-icon-size: 16px;
          color: var(--warning);
        }

        .health-details-item.ok ha-icon {
          color: var(--success);
        }

        /* Tire Pressure Display */
        .tire-pressure-row {
          border-bottom: 1px solid var(--card-surface-light);
        }

        .tire-pressure-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px var(--spacing-lg);
          cursor: pointer;
          transition: background 0.2s;
        }

        .tire-pressure-header:hover {
          background: var(--card-surface);
        }

        .tire-pressure-title {
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--text-primary);
          font-size: 0.9rem;
        }

        .tire-pressure-title ha-icon {
          --mdc-icon-size: 20px;
          color: var(--text-secondary);
        }

        .tire-pressure-status {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.85rem;
        }

        .tire-pressure-status ha-icon {
          --mdc-icon-size: 16px;
        }

        .tire-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          padding: 0 var(--spacing-lg) var(--spacing-md);
          max-width: 320px;
          margin: 0 auto;
        }

        .tire {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          background: var(--card-surface);
          border-radius: var(--radius-sm);
          border: 1px solid var(--card-surface-light);
        }

        .tire.warning {
          border-color: var(--warning);
          background: rgba(245, 158, 11, 0.05);
        }

        .tire-icon {
          width: 32px;
          height: 44px;
          border: 2px solid var(--success);
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .tire.warning .tire-icon {
          border-color: var(--warning);
        }

        .tire-icon ha-icon {
          --mdc-icon-size: 16px;
          color: var(--success);
        }

        .tire.warning .tire-icon ha-icon {
          color: var(--warning);
        }

        .tire-label {
          font-size: 0.75rem;
          color: var(--text-secondary);
          line-height: 1.3;
        }

        .tire-label strong {
          display: block;
          color: var(--text-primary);
          font-size: 0.8rem;
        }

        /* Clickable Location */
        .footer-item.clickable {
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
          transition: background 0.2s;
        }

        .footer-item.clickable:hover {
          background: var(--card-surface-light);
        }

        .footer-item.clickable ha-icon {
          color: var(--accent);
        }

        /* Climate Panel */
        .climate-panel {
          padding: var(--spacing-md) var(--spacing-lg);
          background: var(--card-surface);
          border-top: 1px solid var(--card-surface-light);
        }

        .climate-title {
          font-size: 0.8rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: var(--spacing-md);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .climate-presets {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--spacing-sm);
          margin-bottom: var(--spacing-md);
        }

        .climate-preset {
          background: var(--card-surface-light);
          border: 2px solid transparent;
          border-radius: var(--radius);
          padding: 14px 10px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          color: var(--text-primary);
        }

        .climate-preset:hover {
          background: #45464a;
        }

        .climate-preset.cool.selected {
          border-color: var(--cool);
          background: rgba(6, 182, 212, 0.1);
        }

        .climate-preset.warm.selected {
          border-color: var(--warm);
          background: rgba(249, 115, 22, 0.1);
        }

        .climate-preset.custom.selected {
          border-color: var(--accent);
          background: var(--accent-dim);
        }

        .preset-icon {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--card-surface);
        }

        .climate-preset.cool .preset-icon {
          background: rgba(6, 182, 212, 0.2);
          color: var(--cool);
        }

        .climate-preset.warm .preset-icon {
          background: rgba(249, 115, 22, 0.2);
          color: var(--warm);
        }

        .climate-preset.custom .preset-icon {
          background: var(--accent-dim);
          color: var(--accent);
        }

        .preset-icon ha-icon {
          --mdc-icon-size: 22px;
        }

        .preset-title {
          font-size: 0.8rem;
          font-weight: 600;
        }

        .preset-subtitle {
          font-size: 0.65rem;
          color: var(--text-secondary);
        }

        /* Start Button in Climate Panel */
        .climate-start-btn {
          width: 100%;
          padding: 12px;
          border: none;
          border-radius: var(--radius);
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s ease;
          background: linear-gradient(135deg, var(--success) 0%, #059669 100%);
          color: white;
        }

        .climate-start-btn:hover:not(:disabled) {
          box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
          transform: translateY(-1px);
        }

        .climate-start-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Quick Actions Menu */
        .quick-actions-menu {
          padding: 0 var(--spacing-lg) var(--spacing-md);
          animation: slideDown 0.2s ease-out;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .quick-actions-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--spacing-sm);
        }

        .quick-action-btn {
          background: var(--card-surface);
          border: 1px solid var(--card-surface-light);
          border-radius: var(--radius);
          padding: 14px 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          color: var(--text-primary);
        }

        .quick-action-btn:hover {
          background: var(--card-surface-light);
          border-color: var(--accent);
        }

        .quick-action-btn:active {
          transform: scale(0.97);
        }

        .quick-action-btn ha-icon {
          --mdc-icon-size: 24px;
        }

        .quick-action-label {
          font-size: 0.75rem;
          text-align: center;
        }

        /* Footer */
        .footer {
          padding: 12px var(--spacing-lg);
          background: #1a1a1c;
          border-top: 1px solid var(--card-surface-light);
          font-size: 0.75rem;
          color: var(--text-secondary);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .footer-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .footer ha-icon {
          --mdc-icon-size: 14px;
        }

        /* Animations */
        @keyframes blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0.2; }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        @keyframes charging-pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.05);
          }
        }

        /* Animation classes */
        .animate-blink {
          animation: blink 1s ease-in-out infinite;
        }

        .animate-pulse {
          animation: pulse 4s ease-in-out infinite;
        }

        .animate-charging {
          animation: charging-pulse 1.5s ease-in-out infinite;
        }

        /* Sections with nothing known to show */
        .vehicle-info:not(:has(.info-chip)),
        .stats-column:not(:has(.stat-item, .bar-group)),
        .status-rows:not(:has(.status-row, .tire-pressure-row)),
        .footer:not(:has(.footer-item)) {
          display: none;
        }

        .main-content:not(:has(.stat-item, .bar-group)) {
          grid-template-columns: 1fr;
        }

        .tire-icon.neutral {
          border-color: var(--text-secondary);
        }

        .tire-icon.neutral ha-icon {
          color: var(--text-secondary);
        }

        /* Responsive */
        @media (max-width: 450px) {
          .main-content {
            grid-template-columns: 1fr;
          }
          .visual-column {
            order: -1;
            margin-bottom: var(--spacing-sm);
          }
          .climate-presets {
            grid-template-columns: 1fr;
          }
        }
      </style>

      <ha-card>
        <!-- Header -->
        <div class="header">
          <div class="vehicle-name">${escapeHtml(this._config.name)}</div>
          ${engineRunning ? `<div class="status-badge running animate-pulse">Running</div>`
            : data.locked === null ? ''
            : `<div class="status-badge ${data.locked ? 'locked' : 'unlocked'}">${data.locked ? 'Locked' : 'Unlocked'}</div>`}
        </div>

        <!-- Main Content -->
        <div class="main-content">
          <!-- Stats Column -->
          <div class="stats-column">
            <div class="stats-row">
              ${data.fuel !== null ? `
              <div class="stat-item">
                <div class="stat-label">Fuel</div>
                <div class="stat-value">${data.fuel}<span class="stat-unit">%</span></div>
              </div>
              ` : ''}
              ${isFullEV ? `
              <div class="stat-item">
                <div class="stat-label">Battery</div>
                <div class="stat-value">${escapeHtml(data.evBattery)}<span class="stat-unit">%</span></div>
              </div>
              ` : ''}
              ${data.range !== null ? `
              <div class="stat-item">
                <div class="stat-label">Est. Range</div>
                <div class="stat-value">${this.formatNumber(data.range)}<span class="stat-unit">${escapeHtml(data.rangeUnit)}</span></div>
              </div>
              ` : ''}
            </div>

            <div class="bars-container">
              ${data.fuel !== null ? `
              <div class="bar-group">
                <div class="bar-header">
                  <span>Fuel</span>
                  <span>${data.fuel}%</span>
                </div>
                <div class="progress-track">
                  <div class="progress-fill fuel" style="width: ${fuelPercent}%"></div>
                </div>
              </div>
              ` : ''}
              ${isEV ? `
              <div class="bar-group">
                <div class="bar-header">
                  <span>EV Battery</span>
                  <span>${escapeHtml(data.evBattery)}%</span>
                </div>
                <div class="progress-track">
                  <div class="progress-fill battery ${data.evCharging ? 'animate-charging' : ''}" style="width: ${evBatteryPercent}%"></div>
                </div>
              </div>
              ` : ''}
              ${data.battery !== null ? `
              <div class="bar-group">
                <div class="bar-header">
                  <span>12V Battery</span>
                  <span>${data.battery}%</span>
                </div>
                <div class="progress-track">
                  <div class="progress-fill battery" style="width: ${batteryPercent}%"></div>
                </div>
              </div>
              ` : ''}
            </div>
          </div>

          <!-- Visual Column -->
          <div class="visual-column">
            <div class="vehicle-image-container">
              ${vehicleImageHtml}
              ${data.heading !== null ? `
              <div class="heading-badge" title="Heading: ${Math.round(data.heading)}° (${this.getCardinalDirection(data.heading)})">
                <ha-icon icon="mdi:navigation" style="transform: rotate(${data.heading}deg);"></ha-icon>
                <span class="direction-label">${this.getCardinalDirection(data.heading)}</span>
              </div>
              ` : ''}
              ${data.weatherType !== null ? `
              <div class="weather-badge" title="${escapeHtml(data.weatherLabel ?? data.weatherType)}">
                <ha-icon icon="mdi:${this.getWeatherIcon(data.weatherType)}"></ha-icon>
              </div>
              ` : ''}
            </div>
            
            <!-- Vehicle Info Section -->
            <div class="vehicle-info">
              <!-- Odometer -->
              ${data.odometer !== null ? `
              <div class="info-chip">
                <ha-icon icon="mdi:counter"></ha-icon>
                <span>${this.formatNumber(data.odometer)} ${escapeHtml(data.odometerUnit)}</span>
              </div>
              ` : ''}

              <!-- Next Service with enhanced visual -->
              ${this.renderServiceChip(data.nextService, data.nextServiceUnit)}

              <!-- Speed (when driving) -->
              ${data.vehicleStatus === 'Driving' && data.speed !== null && parseFloat(data.speed) > 0 ? `
              <div class="info-chip highlight">
                <ha-icon icon="mdi:speedometer"></ha-icon>
                <span>${this.formatNumber(data.speed)} ${escapeHtml(data.speedUnit)}</span>
              </div>
              ` : ''}

              <!-- Drive mode & gear - only meaningful with the ignition on -->
              ${data.engine === true && data.driveMode !== null ? `
              <div class="info-chip">
                <ha-icon icon="mdi:car-cog"></ha-icon>
                <span>${escapeHtml(data.driveMode)}</span>
              </div>
              ` : ''}
              ${data.engine === true && data.gearPosition !== null ? `
              <div class="info-chip">
                <ha-icon icon="mdi:car-shift-pattern"></ha-icon>
                <span>Gear ${escapeHtml(data.gearPosition)}</span>
              </div>
              ` : ''}

              <!-- Average fuel economy -->
              ${data.averageFuelEconomy !== null ? `
              <div class="info-chip" title="Average Fuel Economy">
                <ha-icon icon="mdi:gas-station"></ha-icon>
                <span>${escapeHtml(data.averageFuelEconomy)}</span>
              </div>
              ` : ''}

              <!-- Doors Status -->
              ${hasDoors ? `
              <div class="info-chip ${anyDoorOpen ? 'warning' : 'success'}">
                <ha-icon icon="mdi:${anyDoorOpen ? 'car-door' : 'car-door-lock'}"></ha-icon>
                <span>${anyDoorOpen ? `${openDoors} Open` : 'All Closed'}</span>
              </div>
              ` : ''}

              <!-- Windows Status -->
              ${hasWindows ? `
              <div class="info-chip ${anyWindowOpen ? 'warning' : 'success'}">
                <ha-icon icon="mdi:${anyWindowOpen ? 'window-open-variant' : 'window-closed-variant'}"></ha-icon>
                <span>${anyWindowOpen ? `${openWindows} Open` : 'All Closed'}</span>
              </div>
              ` : ''}

              <!-- Outside temperature -->
              ${data.weatherTemp !== null ? `
              <div class="info-chip" title="Outside Temperature">
                <ha-icon icon="mdi:thermometer"></ha-icon>
                <span>${escapeHtml(data.weatherTemp)}</span>
              </div>
              ` : ''}

              <!-- Climate set temperature -->
              ${data.setTemp !== null ? `
              <div class="info-chip" title="Set Temperature">
                <ha-icon icon="mdi:thermostat"></ha-icon>
                <span>${escapeHtml(data.setTemp)}</span>
              </div>
              ` : ''}

              <!-- Warnings row - show any active alerts -->
              ${data.washerFluidWarning ? `
              <div class="info-chip warning full-width">
                <ha-icon icon="mdi:wiper-wash-alert"></ha-icon>
                <span>Low Washer Fluid</span>
              </div>
              ` : ''}
              ${data.lowFuel ? `
              <div class="info-chip warning full-width">
                <ha-icon icon="mdi:gas-station-off"></ha-icon>
                <span>Low Fuel</span>
              </div>
              ` : ''}
              ${data.smartKeyBattery ? `
              <div class="info-chip warning full-width">
                <ha-icon icon="mdi:key-alert"></ha-icon>
                <span>Key Fob Battery Low</span>
              </div>
              ` : ''}
              ${data.auxBatteryFault ? `
              <div class="info-chip warning full-width">
                <ha-icon icon="mdi:car-battery"></ha-icon>
                <span>12V Battery Fault</span>
              </div>
              ` : ''}
              ${data.brakeFluidWarning ? `
              <div class="info-chip warning full-width">
                <ha-icon icon="mdi:car-brake-fluid-level"></ha-icon>
                <span>Check Brake Fluid</span>
              </div>
              ` : ''}
              ${data.engineOilWarning ? `
              <div class="info-chip warning full-width">
                <ha-icon icon="mdi:oil-level"></ha-icon>
                <span>Check Engine Oil</span>
              </div>
              ` : ''}
              ${data.headlightFault ? `
              <div class="info-chip warning full-width">
                <ha-icon icon="mdi:car-light-alert"></ha-icon>
                <span>Headlight Fault</span>
              </div>
              ` : ''}
              ${data.headlampLeftFault ? `
              <div class="info-chip warning full-width">
                <ha-icon icon="mdi:car-light-alert"></ha-icon>
                <span>Left Low Beam Fault</span>
              </div>
              ` : ''}
              ${data.headlampRightFault ? `
              <div class="info-chip warning full-width">
                <ha-icon icon="mdi:car-light-alert"></ha-icon>
                <span>Right Low Beam Fault</span>
              </div>
              ` : ''}
              ${data.headlampLeftHighFault ? `
              <div class="info-chip warning full-width">
                <ha-icon icon="mdi:car-light-alert"></ha-icon>
                <span>Left High Beam Fault</span>
              </div>
              ` : ''}
              ${data.headlampRightHighFault ? `
              <div class="info-chip warning full-width">
                <ha-icon icon="mdi:car-light-alert"></ha-icon>
                <span>Right High Beam Fault</span>
              </div>
              ` : ''}
              ${data.headlampLeftBifuncFault ? `
              <div class="info-chip warning full-width">
                <ha-icon icon="mdi:car-light-alert"></ha-icon>
                <span>Left Bi-Function Headlamp Fault</span>
              </div>
              ` : ''}
              ${data.headlampRightBifuncFault ? `
              <div class="info-chip warning full-width">
                <ha-icon icon="mdi:car-light-alert"></ha-icon>
                <span>Right Bi-Function Headlamp Fault</span>
              </div>
              ` : ''}
              ${data.stopLampLeftFault ? `
              <div class="info-chip warning full-width">
                <ha-icon icon="mdi:car-brake-alert"></ha-icon>
                <span>Left Brake Light Fault</span>
              </div>
              ` : ''}
              ${data.stopLampRightFault ? `
              <div class="info-chip warning full-width">
                <ha-icon icon="mdi:car-brake-alert"></ha-icon>
                <span>Right Brake Light Fault</span>
              </div>
              ` : ''}
              ${data.turnSignalLeftFrontFault ? `
              <div class="info-chip warning full-width">
                <ha-icon icon="mdi:arrow-left-bold"></ha-icon>
                <span>Left Front Turn Signal Fault</span>
              </div>
              ` : ''}
              ${data.turnSignalRightFrontFault ? `
              <div class="info-chip warning full-width">
                <ha-icon icon="mdi:arrow-right-bold"></ha-icon>
                <span>Right Front Turn Signal Fault</span>
              </div>
              ` : ''}
              ${data.turnSignalLeftRearFault ? `
              <div class="info-chip warning full-width">
                <ha-icon icon="mdi:arrow-left-bold"></ha-icon>
                <span>Left Rear Turn Signal Fault</span>
              </div>
              ` : ''}
              ${data.turnSignalRightRearFault ? `
              <div class="info-chip warning full-width">
                <ha-icon icon="mdi:arrow-right-bold"></ha-icon>
                <span>Right Rear Turn Signal Fault</span>
              </div>
              ` : ''}
              ${data.tailLampFault ? `
              <div class="info-chip warning full-width">
                <ha-icon icon="mdi:car-light-alert"></ha-icon>
                <span>Tail Lamp Fault</span>
              </div>
              ` : ''}
              ${data.stopLampFault ? `
              <div class="info-chip warning full-width">
                <ha-icon icon="mdi:car-brake-alert"></ha-icon>
                <span>Stop Lamp Fault</span>
              </div>
              ` : ''}
              ${data.hazardLights ? `
              <div class="info-chip highlight full-width animate-blink">
                <ha-icon icon="mdi:hazard-lights"></ha-icon>
                <span>Hazard Lights Active</span>
              </div>
              ` : ''}

              <!-- EV state. A full EV shows charge and range in the stats instead. -->
              ${isEV && (!isFullEV || data.evCharging || data.evPluggedIn) ? `
              <div class="info-chip ${data.evCharging ? 'highlight animate-charging' : ''} full-width">
                <ha-icon icon="mdi:${data.evCharging ? 'battery-charging' : 'battery'}"></ha-icon>
                <span>${isFullEV ? '' : `EV: ${escapeHtml(data.evBattery)}%${data.evRange !== null ? ` · ${escapeHtml(data.evRange)}` : ''} `}${data.evCharging ? '⚡ Charging' : ''}${data.evPluggedIn && !data.evCharging ? '🔌 Plugged In' : ''}</span>
              </div>
              ` : ''}
              ${data.evCharging && (data.evChargeDuration !== null || data.evChargingPower !== null) ? `
              <div class="info-chip full-width">
                <ha-icon icon="mdi:ev-station"></ha-icon>
                <span>${escapeHtml([
                  data.evChargingPower,
                  data.evChargeDuration !== null ? `${this.formatNumber(data.evChargeDuration)} min to full` : null,
                ].filter(Boolean).join(' · '))}</span>
              </div>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Controls Row (4 buttons like v2.0) -->
        ${this._config.show_controls && controlCount > 0 ? `
        <div class="controls-section">
          <div class="controls-grid" style="grid-template-columns: repeat(${controlCount}, 1fr);">
            ${canLock ? `
            <div class="control-btn ${unlockArmed ? 'confirm' : data.locked ? '' : 'active'}" id="btn-lock">
              <ha-icon icon="mdi:${unlockArmed ? 'alert' : data.locked ? 'lock-open' : 'lock'}"></ha-icon>
              <span class="control-label">${unlockArmed ? 'Tap to Confirm' : data.locked ? 'Unlock' : 'Lock'}</span>
            </div>
            ` : ''}
            ${canClimate ? `
            <div class="control-btn ${climateRunning ? 'climate-stop' : 'climate-start'}" id="btn-climate">
              <ha-icon icon="mdi:${climateRunning ? 'stop-circle-outline' : 'power'}"></ha-icon>
              <span class="control-label">${climateRunning ? 'Climate Stop' : 'Climate Start'}</span>
            </div>
            ` : ''}
            ${canQuickActions ? `
            <div class="control-btn ${this._showQuickActions ? 'active' : ''}" id="btn-more">
              <ha-icon icon="mdi:dots-horizontal"></ha-icon>
              <span class="control-label">More</span>
            </div>
            ` : ''}
            ${canUpdate ? `
            <div class="control-btn" id="btn-refresh">
              <ha-icon icon="mdi:refresh"></ha-icon>
              <span class="control-label">Update</span>
            </div>
            ` : ''}
          </div>
        </div>
        ` : ''}

        <!-- Quick Actions Menu (shown when More button is clicked) -->
        ${this._showQuickActions && canQuickActions ? `
        <div class="quick-actions-menu">
          <div class="quick-actions-grid">
            <div class="quick-action-btn" id="qa-find-car">
              <ha-icon icon="mdi:car-search"></ha-icon>
              <span class="quick-action-label">Find My Car</span>
            </div>
            <div class="quick-action-btn" id="qa-horn">
              <ha-icon icon="mdi:bullhorn"></ha-icon>
              <span class="quick-action-label">Horn + Lights</span>
            </div>
            <div class="quick-action-btn" id="qa-lights">
              <ha-icon icon="mdi:car-light-high"></ha-icon>
              <span class="quick-action-label">Flash Lights</span>
            </div>
          </div>
        </div>
        ` : ''}

        <!-- Climate Panel (shown when Climate Start is clicked) -->
        ${this._showClimatePanel ? `
        <div class="climate-panel">
          <div class="climate-title">
            <ha-icon icon="mdi:fan"></ha-icon>
            Climate Settings
          </div>
          <div class="climate-presets">
            <div class="climate-preset cool ${this._climateMode === 'cool' ? 'selected' : ''}" id="preset-cool">
              <div class="preset-icon">
                <ha-icon icon="mdi:snowflake"></ha-icon>
              </div>
              <div class="preset-title">Start Cool</div>
              <div class="preset-subtitle">${this.temperatureFor('cool')}${temperatureUnit}</div>
            </div>
            <div class="climate-preset warm ${this._climateMode === 'warm' ? 'selected' : ''}" id="preset-warm">
              <div class="preset-icon">
                <ha-icon icon="mdi:white-balance-sunny"></ha-icon>
              </div>
              <div class="preset-title">Start Warm</div>
              <div class="preset-subtitle">${this.temperatureFor('warm')}${temperatureUnit} + Accessories</div>
            </div>
            <div class="climate-preset custom ${this._climateMode === 'custom' ? 'selected' : ''}" id="preset-custom">
              <div class="preset-icon">
                <ha-icon icon="mdi:tune-variant"></ha-icon>
              </div>
              <div class="preset-title">Start Custom</div>
              <div class="preset-subtitle">${this.temperatureFor('custom')}${temperatureUnit}</div>
            </div>
          </div>
          <button class="climate-start-btn" id="btn-start-climate" ${!this._climateMode ? 'disabled' : ''}>
            <ha-icon icon="mdi:power"></ha-icon>
            ${this._climateMode ? `Start ${this._climateMode.charAt(0).toUpperCase() + this._climateMode.slice(1)} (${this._config.duration} min)` : 'Select an option above'}
          </button>
        </div>
        ` : ''}

        <!-- Status Rows (improved UX) -->
        ${this._config.show_status_row !== false ? `
        <div class="status-rows">
          <!-- Vehicle Status - no arrow, just status -->
          ${data.vehicleStatus !== null ? `
          <div class="status-row">
            <div class="status-row-left">
              <ha-icon icon="mdi:car"></ha-icon>
              <span>Vehicle Status</span>
            </div>
            <div class="status-row-right ${engineRunning ? 'driving' : 'parked'}">
              <ha-icon icon="mdi:${{ Driving: 'steering', 'Remote Start': 'remote', 'Engine On': 'engine' }[data.vehicleStatus] ?? 'parking'}"></ha-icon>
              <span>${escapeHtml(data.vehicleStatus)}</span>
            </div>
          </div>
          ` : ''}

          <!-- Vehicle Health - expandable when issues -->
          ${data.dtcCount !== null ? `
          <div class="status-row ${hasHealthIssue ? 'clickable' : ''}" id="health-row">
            <div class="status-row-left">
              <ha-icon icon="mdi:car-wrench"></ha-icon>
              <span>Vehicle Health</span>
            </div>
            <div class="status-row-right ${hasHealthIssue ? 'warning' : ''}">
              ${hasHealthIssue
          ? `<span>${escapeHtml(data.dtcCount)} Issue${parseInt(data.dtcCount) > 1 ? 's' : ''}</span>
                   <ha-icon icon="mdi:chevron-${this._showHealthDetails ? 'up' : 'down'}"></ha-icon>`
          : `<ha-icon icon="mdi:check-circle" style="color: var(--success)"></ha-icon>
                   <span style="color: var(--success)">All Good</span>`
        }
            </div>
          </div>
          ` : ''}
          ${this._showHealthDetails && hasHealthIssue ? `
          <div class="health-details">
            <div class="health-details-item">
              <ha-icon icon="mdi:alert-circle"></ha-icon>
              <span>${escapeHtml(data.dtcCount)} Diagnostic Trouble Code(s) detected. Check your vehicle or visit a dealer.</span>
            </div>
          </div>
          ` : ''}

          <!-- Tire Pressure Status (Accordion) -->
          ${hasTireStatus || tires.length ? `
          <div class="tire-pressure-row">
            <div class="tire-pressure-header" ${tires.length ? 'id="tire-pressure-toggle"' : ''}>
              <div class="tire-pressure-title">
                <ha-icon icon="mdi:car-tire-alert"></ha-icon>
                <span>Tire Pressure</span>
              </div>
              <div class="tire-pressure-status ${tireWarning ? 'warning' : ''}">
                ${!hasTireStatus ? ''
          : tireWarning
          ? `<ha-icon icon="mdi:alert-circle" style="color: var(--warning)"></ha-icon>
                     <span style="color: var(--warning)">Check Tires</span>`
          : `<ha-icon icon="mdi:check-circle" style="color: var(--success)"></ha-icon>
                     <span style="color: var(--success)">All OK</span>`
        }
                ${tires.length ? `<ha-icon icon="mdi:chevron-${this._showTirePressure ? 'up' : 'down'}" style="color: var(--text-secondary); margin-left: 4px;"></ha-icon>` : ''}
              </div>
            </div>
            ${this._showTirePressure && tires.length ? `
            <div class="tire-grid">
              ${tires.map((tire) => `
              <div class="tire ${tire.warning ? 'warning' : ''}">
                <div class="tire-icon ${tire.warning === null ? 'neutral' : ''}">
                  <ha-icon icon="mdi:${tire.warning === null ? 'gauge' : tire.warning ? 'alert' : 'check'}"></ha-icon>
                </div>
                <span class="tire-label"><strong>${tire.axle}</strong>${tire.side}${tire.pressure !== null ? `<br>${escapeHtml(tire.pressure)}` : ''}</span>
              </div>
              `).join('')}
            </div>
            ` : ''}
          </div>
          ` : ''}

          <!-- Comfort Status Row - Only show when climate/defrost is actually running -->
          ${(() => {
            // Helper to check if seat is actually active (both level and type must be non-zero)
            const isSeatActive = (seat) => seat && seat.heatVentLevel > 0 && seat.heatVentType > 0;
            const driverActive = isSeatActive(data.seatStatus?.driver);
            const passengerActive = isSeatActive(data.seatStatus?.passenger);

            // Only show if climate is on AND something is active
            const hasActiveComfort = data.steeringWheelHeater || data.sideMirrorHeater || data.rearWindowHeater || driverActive || passengerActive;
            return (data.airCon || data.defrost) && hasActiveComfort ? `
          <div class="status-row animate-pulse">
            <div class="status-row-left">
              <ha-icon icon="mdi:car-seat-heater"></ha-icon>
              <span>Climate Active</span>
            </div>
            <div class="status-row-right" style="gap: 8px;">
              ${data.steeringWheelHeater ? `<ha-icon icon="mdi:steering" style="color: var(--warm);" title="Heated Steering Wheel"></ha-icon>` : ''}
              ${data.sideMirrorHeater ? `<ha-icon icon="mdi:car-side" style="color: var(--warm);" title="Heated Mirrors"></ha-icon>` : ''}
              ${data.rearWindowHeater ? `<ha-icon icon="mdi:car-defrost-rear" style="color: var(--warm);" title="Rear Defrost"></ha-icon>` : ''}

              ${/* Driver Seat */ ''}
              ${driverActive ? `
                <ha-icon
                  icon="mdi:car-seat"
                  style="color: ${data.seatStatus.driver.heatVentType === 2 ? 'var(--cool)' : 'var(--warm)'};"
                  title="Driver Seat Level ${data.seatStatus.driver.heatVentLevel}">
                </ha-icon>` : ''}

              ${/* Passenger Seat */ ''}
              ${passengerActive ? `
                <ha-icon
                  icon="mdi:car-seat"
                  style="color: ${data.seatStatus.passenger.heatVentType === 2 ? 'var(--cool)' : 'var(--warm)'};"
                  title="Passenger Seat Level ${data.seatStatus.passenger.heatVentLevel}">
                </ha-icon>` : ''}
            </div>
          </div>
          ` : '';
          })()}

          <!-- Diagnostics. Raw values: their meanings aren't documented by Kia. -->
          ${[['mdi:car-battery', '12V Warning Level', data.carBatteryWarningLevel],
             ['mdi:link-variant', 'Link Status', data.linkStatus],
             ['mdi:tow-truck', 'Roadside Assistance', data.rsaStatus]]
            .filter(([, , value]) => value !== null)
            .map(([icon, label, value]) => `
          <div class="status-row">
            <div class="status-row-left">
              <ha-icon icon="${icon}"></ha-icon>
              <span>${label}</span>
            </div>
            <div class="status-row-right">
              <span>${escapeHtml(value)}</span>
            </div>
          </div>
          `).join('')}

          <!-- Valet Mode - toggle switch -->
          ${data.valetMode !== null ? `
          <div class="status-row">
            <div class="status-row-left">
              <ha-icon icon="mdi:shield-car"></ha-icon>
              <span>Valet Mode</span>
            </div>
            <div class="status-row-right">
              <span style="margin-right: 8px; color: ${data.valetMode ? 'var(--warning)' : 'var(--text-secondary)'}">
                ${data.valetMode ? 'Active' : 'Inactive'}
              </span>
              ${canSetValet ? `<div class="toggle-switch ${data.valetMode ? 'active' : ''}" id="valet-toggle"></div>` : ''}
            </div>
          </div>
          ` : ''}
        </div>
        ` : ''}

        <!-- Footer with clickable location -->
        <div class="footer">
          ${this.formatTime(data.lastUpdated) ? `
          <div class="footer-item">
            <ha-icon icon="mdi:clock-outline"></ha-icon>
            <span id="updated-time">Updated ${escapeHtml(this.formatTime(data.lastUpdated))}</span>
          </div>
          ` : ''}
          ${data.location !== null || (data.latitude && data.longitude) ? `
          <div class="footer-item ${data.latitude && data.longitude ? 'clickable' : ''}" id="location-link"
               ${data.latitude && data.longitude ? `data-lat="${escapeHtml(data.latitude)}" data-lon="${escapeHtml(data.longitude)}"` : ''}>
            <ha-icon icon="mdi:map-marker"></ha-icon>
            <span>${escapeHtml(data.location ?? 'View on map')}</span>
            ${data.latitude && data.longitude ? '<ha-icon icon="mdi:open-in-new" style="--mdc-icon-size: 14px; margin-left: 4px;"></ha-icon>' : ''}
          </div>
          ` : ''}
        </div>
      </ha-card>
    `;

    this.addEventListeners();

    const { latitude, longitude } = data;
    this._carPosition = Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
    this.refreshCarWeather();
  }

  // Only says Driving when something proves it: a running engine alone could
  // just as easily be a remote start in the driveway
  getVehicleStatus() {
    const reported = this.stateOf('vehicleStatus') ?? this.stateOf('drivingStatus');
    const engine = this.boolOf('engine');
    if (!engine) return reported ?? (engine === false ? 'Parked' : null);
    if (this.boolOf('remoteIgnition')) return 'Remote Start';
    if (parseFloat(this.stateOf('speed')) > 0) return 'Driving';
    return reported ?? 'Engine On';
  }

  renderServiceChip(nextService, unit) {
    // Enhanced service countdown with color coding
    // Assumes 8000 mile service intervals (common for Kia/Hyundai)
    const SERVICE_INTERVAL = 8000;

    const remaining = parseFloat(nextService);
    if (isNaN(remaining)) return '';
    const milesRemaining = unit === 'km' ? remaining * KM_TO_MILES : remaining;

    // Determine color class based on miles remaining
    let colorClass = 'success'; // Green: >3000 mi
    let iconColor = 'var(--success)';

    if (milesRemaining < 1000) {
      colorClass = 'danger'; // Red: <1000 mi
      iconColor = 'var(--danger)';
    } else if (milesRemaining < 3000) {
      colorClass = 'warning'; // Yellow: 1000-3000 mi
      iconColor = 'var(--warning)';
    }

    // Calculate percentage complete in service interval
    const percentRemaining = Math.max(0, Math.min(100, (milesRemaining / SERVICE_INTERVAL) * 100));

    return `
      <div class="info-chip service-chip ${colorClass}" style="position: relative; overflow: visible;">
        <ha-icon icon="mdi:car-wrench" style="color: ${iconColor};"></ha-icon>
        <span>${this.formatNumber(remaining)} ${escapeHtml(unit)}</span>
        <div class="service-progress-mini" style="
          position: absolute;
          bottom: 2px;
          left: 10px;
          right: 10px;
          height: 2px;
          background: var(--card-surface-light);
          border-radius: 1px;
          overflow: hidden;
        ">
          <div style="
            height: 100%;
            width: ${percentRemaining}%;
            background: ${iconColor};
            transition: width 0.3s ease;
          "></div>
        </div>
      </div>
    `;
  }

  getCarSvg(data) {
    // Grey means unknown: only colour what we actually have data for
    const color = (value, yes, no) => (value === null ? '#6b7280' : value ? yes : no);
    const lockColor = color(data.locked, '#10B981', '#EF4444');
    const doorFL = color(data.frontLeftDoor, '#F59E0B', '#10B981');
    const doorFR = color(data.frontRightDoor, '#F59E0B', '#10B981');
    const doorBL = color(data.backLeftDoor, '#F59E0B', '#10B981');
    const doorBR = color(data.backRightDoor, '#F59E0B', '#10B981');

    return `
      <svg viewBox="0 0 120 200" class="car-svg">
        <path d="M25,40 C25,25 40,15 60,15 C80,15 95,25 95,40 L95,160 C95,175 80,185 60,185 C40,185 25,175 25,160 Z" 
              fill="none" stroke="#4a5568" stroke-width="2" opacity="0.6"/>
        <path d="M32,50 L88,50 L85,70 L35,70 Z" fill="none" stroke="#4a5568" stroke-width="1.5" opacity="0.4"/>
        <path d="M35,145 L85,145 L88,160 L32,160 Z" fill="none" stroke="#4a5568" stroke-width="1.5" opacity="0.4"/>
        <rect x="35" y="75" width="50" height="65" rx="6" fill="none" stroke="#4a5568" stroke-width="1.5" opacity="0.3"/>
        <rect x="12" y="45" width="8" height="25" rx="3" fill="#4a5568" opacity="0.5"/>
        <rect x="100" y="45" width="8" height="25" rx="3" fill="#4a5568" opacity="0.5"/>
        <rect x="12" y="135" width="8" height="25" rx="3" fill="#4a5568" opacity="0.5"/>
        <rect x="100" y="135" width="8" height="25" rx="3" fill="#4a5568" opacity="0.5"/>
        <circle cx="30" cy="60" r="5" fill="${doorFL}" opacity="0.9"/>
        <circle cx="90" cy="60" r="5" fill="${doorFR}" opacity="0.9"/>
        <circle cx="30" cy="140" r="5" fill="${doorBL}" opacity="0.9"/>
        <circle cx="90" cy="140" r="5" fill="${doorBR}" opacity="0.9"/>
        <circle cx="60" cy="107" r="16" fill="${lockColor}" opacity="0.15"/>
        <path d="M54,110 L54,104 C54,100.7 56.7,98 60,98 C63.3,98 66,100.7 66,104 L66,110" 
              fill="none" stroke="${lockColor}" stroke-width="2" stroke-linecap="round"/>
        <rect x="52" y="108" width="16" height="12" rx="2" fill="${lockColor}"/>
      </svg>
    `;
  }

  getCardinalDirection(heading) {
    if (heading === null || heading === undefined) return '—';
    // Normalize heading to 0-360
    const h = ((heading % 360) + 360) % 360;
    // 16-point compass for more precision
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(h / 22.5) % 16;
    return directions[index];
  }

  getWeatherIcon(weatherType) {
    // Check if it's nighttime (between 7pm and 6am)
    const hour = new Date().getHours();
    const isNight = hour >= 19 || hour < 6;

    // Map weather types to MDI icons
    const weatherIcons = {
      'clear': isNight ? 'weather-night' : 'weather-sunny',
      'sunny': isNight ? 'weather-night' : 'weather-sunny',
      'cloudy': 'weather-cloudy',
      'partly_cloudy': isNight ? 'weather-night-partly-cloudy' : 'weather-partly-cloudy',
      'partlycloudy': isNight ? 'weather-night-partly-cloudy' : 'weather-partly-cloudy',
      'overcast': 'weather-cloudy',
      'rain': 'weather-rainy',
      'rainy': 'weather-rainy',
      'showers': 'weather-pouring',
      'thunderstorm': 'weather-lightning-rainy',
      'lightning': 'weather-lightning',
      'snow': 'weather-snowy',
      'snowy': 'weather-snowy',
      'sleet': 'weather-snowy-rainy',
      'hail': 'weather-hail',
      'fog': 'weather-fog',
      'foggy': 'weather-fog',
      'mist': 'weather-fog',
      'windy': 'weather-windy',
      'wind': 'weather-windy',
      'night': 'weather-night',
      'clear_night': 'weather-night',
    };

    if (!weatherType) return 'thermometer';
    const normalizedType = weatherType.toLowerCase().replace(/[- ]/g, '_');
    return weatherIcons[normalizedType] || 'weather-partly-cloudy';
  }

  formatTime(dateStr) {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      if (isNaN(date)) return null;
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins} min ago`;
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hr ago`;
      return date.toLocaleDateString();
    } catch {
      return dateStr;
    }
  }

  addEventListeners() {
    // Lock toggle button
    this.shadowRoot.getElementById('btn-lock')?.addEventListener('click', () => {
      const entity_id = this.entityId('lock');
      if (this.stateOf('lock') !== 'locked') {
        this.callService('lock', 'lock', { entity_id });
        return;
      }
      if (!this._unlockArmed) {
        this.armUnlock();
        return;
      }
      this.disarmUnlock();
      this.callService('lock', 'unlock', { entity_id });
      this.render();
    });

    // Climate toggle button - opens panel when off, stops climate when on
    this.shadowRoot.getElementById('btn-climate')?.addEventListener('click', () => {
      if (this._climateRunning) {
        // Stop climate
        if (!this.deviceId) {
          this.showNotification('Please select your vehicle in the card editor');
          return;
        }
        this.callService('kia_uvo', 'stop_climate', { device_id: this.deviceId });
      } else {
        // Open climate panel
        this._showClimatePanel = !this._showClimatePanel;
        this.render();
      }
    });

    // More button (toggle Quick Actions menu)
    this.shadowRoot.getElementById('btn-more')?.addEventListener('click', () => {
      this._showQuickActions = !this._showQuickActions;
      this.render();
    });

    // Quick Actions - Find My Car (hazard lights + horn)
    this.shadowRoot.getElementById('qa-find-car')?.addEventListener('click', () => {
      if (!this.deviceId) {
        this.showNotification('Please select your vehicle in the card editor');
        return;
      }
      this.callService('kia_uvo', 'start_hazard_lights_and_horn', { device_id: this.deviceId });
      this._showQuickActions = false;
      this.render();
    });

    // Quick Actions - Horn (the API has no horn-only command)
    this.shadowRoot.getElementById('qa-horn')?.addEventListener('click', () => {
      if (!this.deviceId) {
        this.showNotification('Please select your vehicle in the card editor');
        return;
      }
      this.callService('kia_uvo', 'start_hazard_lights_and_horn', { device_id: this.deviceId });
      this._showQuickActions = false;
      this.render();
    });

    // Quick Actions - Flash Lights
    this.shadowRoot.getElementById('qa-lights')?.addEventListener('click', () => {
      if (!this.deviceId) {
        this.showNotification('Please select your vehicle in the card editor');
        return;
      }
      this.callService('kia_uvo', 'start_hazard_lights', { device_id: this.deviceId });
      this._showQuickActions = false;
      this.render();
    });

    // Refresh button
    this.shadowRoot.getElementById('btn-refresh')?.addEventListener('click', () => {
      if (!this.deviceId) {
        this.showNotification('Please select your vehicle in the card editor');
        return;
      }
      this.callService('kia_uvo', 'force_update', { device_id: this.deviceId });
    });

    // Climate presets
    this.shadowRoot.getElementById('preset-cool')?.addEventListener('click', () => {
      this._climateMode = 'cool';
      this.render();
    });

    this.shadowRoot.getElementById('preset-warm')?.addEventListener('click', () => {
      this._climateMode = 'warm';
      this.render();
    });

    this.shadowRoot.getElementById('preset-custom')?.addEventListener('click', () => {
      this._climateMode = 'custom';
      this.render();
    });

    // Start Climate button (in panel)
    this.shadowRoot.getElementById('btn-start-climate')?.addEventListener('click', () => {
      if (!this.deviceId) {
        this.showNotification('Please select your vehicle in the card editor');
        return;
      }
      if (!this._climateMode) return;

      const climateData = {
        device_id: this.deviceId,
        climate: true,
        temperature: this.temperatureFor(this._climateMode),  // Note: service uses 'temperature' not 'set_temp'
        duration: this._config.duration,
        defrost: this._climateMode === 'warm',
        heating: this._climateMode === 'warm' ? 1 : 0
      };

      // Add heated accessories for warm start (configurable)
      if (this._climateMode === 'warm') {
        if (this._config.warm_steering_wheel) {
          climateData.steering_wheel = this._config.warm_steering_level;
        }
        if (this._config.warm_front_left_seat) {
          climateData.flseat = this._config.warm_seat_level;
        }
        if (this._config.warm_front_right_seat) {
          climateData.frseat = this._config.warm_seat_level;
        }
        if (this._config.warm_rear_left_seat) {
          climateData.rlseat = this._config.warm_seat_level;
        }
        if (this._config.warm_rear_right_seat) {
          climateData.rrseat = this._config.warm_seat_level;
        }
      }

      this.callService('kia_uvo', 'start_climate', climateData);
      this._showClimatePanel = false;
      this._climateMode = null;
      this.render();
    });

    // Health row toggle (expandable when there are issues)
    this.shadowRoot.getElementById('health-row')?.addEventListener('click', () => {
      const dtcCount = parseInt(this.stateOf('dtcCount')) || 0;
      if (dtcCount > 0) {
        this._showHealthDetails = !this._showHealthDetails;
        this.render();
      }
    });

    // Tire pressure accordion toggle
    this.shadowRoot.getElementById('tire-pressure-toggle')?.addEventListener('click', () => {
      this._showTirePressure = !this._showTirePressure;
      this.render();
    });

    // Valet mode toggle
    this.shadowRoot.getElementById('valet-toggle')?.addEventListener('click', () => {
      if (!this.deviceId) {
        this.showNotification('Please select your vehicle in the card editor');
        return;
      }
      const service = this.boolOf('valetMode') ? 'stop_valet_mode' : 'start_valet_mode';
      this.callService('kia_uvo', service, { device_id: this.deviceId });
    });

    // Location link - open in Google Maps
    this.shadowRoot.getElementById('location-link')?.addEventListener('click', (e) => {
      const lat = e.currentTarget.dataset.lat;
      const lon = e.currentTarget.dataset.lon;
      if (lat && lon) {
        window.open(`https://www.google.com/maps?q=${lat},${lon}`, '_blank');
      }
    });
  }

  showNotification(message) {
    this.dispatchEvent(new CustomEvent('hass-notification', {
      detail: { message },
      bubbles: true,
      composed: true,
    }));
  }

  getCardSize() {
    return 7;
  }

  static getConfigElement() {
    return document.createElement('kia-vehicle-card-editor');
  }

  static getStubConfig(hass) {
    const vehicle = findVehicleDevices(hass)[0];
    return {
      device_id: vehicle?.id ?? '',
      name: vehicle?.name ?? 'My Kia',
      show_controls: true,
      show_status_row: true,
      duration: 10
    };
  }
}

// Editor
class KiaVehicleCardEditor extends HTMLElement {
  constructor() {
    super();
    this._config = {};
  }

  setConfig(config) {
    const next = config || {};
    const changed = JSON.stringify(next) !== JSON.stringify(this._config);
    this._config = next;
    // Home Assistant echoes our own edits back here, and rebuilding the form
    // would drop focus from the field being typed in
    if (changed && this._hass) this.render();
  }

  set hass(hass) {
    this._hass = hass;
    // hass changes constantly, so rebuild only when the vehicle list does
    const vehicles = JSON.stringify(findVehicleDevices(hass));
    if (vehicles !== this._vehicles) {
      this._vehicles = vehicles;
      this.render();
    }
  }

  renderVehiclePicker() {
    const vehicles = findVehicleDevices(this._hass);
    const current = this._config.device_id || '';
    if (!vehicles.length) {
      return `
        <div class="editor-row">
          <label>Device ID (required for controls)</label>
          <input type="text" id="device_id" value="${escapeHtml(current)}" placeholder="abc123...">
          <small>Developer Tools → Actions → ${INTEGRATION_DOMAIN} → Device dropdown</small>
        </div>
      `;
    }
    // Keep a saved device visible even if it's no longer found
    const options = current && !vehicles.some((vehicle) => vehicle.id === current)
      ? [...vehicles, { id: current, name: `${current} (not found)` }]
      : vehicles;
    return `
      <div class="editor-row">
        <label>Vehicle *</label>
        <select id="device_id">
          <option value="" ${current ? '' : 'selected'}>Select a vehicle...</option>
          ${options.map((vehicle) => `
          <option value="${escapeHtml(vehicle.id)}" ${vehicle.id === current ? 'selected' : ''}>${escapeHtml(vehicle.name)}</option>
          `).join('')}
        </select>
      </div>
    `;
  }

  render() {
    this.innerHTML = `
      <style>
        .editor { padding: 16px; }
        .editor-row { margin-bottom: 16px; }
        .editor-row label { display: block; margin-bottom: 4px; font-weight: 500; }
        .editor-row input, .editor-row select { 
          width: 100%; padding: 8px; border: 1px solid var(--divider-color, #ccc); 
          border-radius: 4px; background: var(--card-background-color, #fff);
          color: var(--primary-text-color, #333); box-sizing: border-box;
        }
        .editor-row small { color: var(--secondary-text-color, #666); font-size: 0.8em; display: block; margin-top: 4px; }
        .editor-section { font-weight: 600; margin: 20px 0 12px; padding-bottom: 6px; border-bottom: 1px solid var(--divider-color, #ccc); }
        .editor-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      </style>
      <div class="editor">
        ${this.renderVehiclePicker()}
        <div class="editor-row">
          <label>Entity Prefix (optional)</label>
          <input type="text" id="vehicle_id" value="${escapeHtml(this._config.vehicle_id)}" placeholder="my_car">
          <small>Only needed if your vehicle isn't found automatically, e.g. "my_car" from sensor.my_car_fuel_level</small>
        </div>
        <div class="editor-row">
          <label>Display Name</label>
          <input type="text" id="name" value="${escapeHtml(this._config.name || 'My Kia')}">
        </div>
        <div class="editor-row">
          <label>Vehicle Image URL</label>
          <input type="text" id="image" value="${escapeHtml(this._config.image)}" placeholder="https://owners.kia.com/...">
        </div>

        <div class="editor-section">Climate Presets</div>
        <div class="editor-grid">
          ${['Cool', 'Warm', 'Custom'].map((label) => {
            const preset = label.toLowerCase();
            const unit = climateUnit(this._hass, this._config.device_id);
            return `
          <div class="editor-row">
            <label>${label} Temp (${unit})</label>
            <input type="number" id="${preset}_temp" value="${presetTemp(this._config, preset, unit)}" step="${unit === '°C' ? 0.5 : 1}">
          </div>`;
          }).join('')}
          <div class="editor-row">
            <label>Duration (min)</label>
            <input type="number" id="duration" value="${this._config.duration || 10}" min="5" max="20">
          </div>
        </div>

        <div class="editor-section">Climate Preset Accessories</div>
        <small style="color: var(--secondary-text-color, #666); margin-bottom: 12px; display: block;">
          Customize which accessories activate with climate presets
        </small>
        <div class="editor-row">
          <label>
            <input type="checkbox" id="warm_steering_wheel" ${this._config.warm_steering_wheel !== false ? 'checked' : ''}>
            Steering Wheel (Heating only)
          </label>
        </div>
        <div class="editor-row">
          <label>
            <input type="checkbox" id="warm_front_left_seat" ${this._config.warm_front_left_seat !== false ? 'checked' : ''}>
            Driver Seat
          </label>
        </div>
        <div class="editor-row">
          <label>
            <input type="checkbox" id="warm_front_right_seat" ${this._config.warm_front_right_seat !== false ? 'checked' : ''}>
            Passenger Seat
          </label>
        </div>
        <div class="editor-row">
          <label>
            <input type="checkbox" id="warm_rear_left_seat" ${this._config.warm_rear_left_seat === true ? 'checked' : ''}>
            Rear Left Seat
          </label>
        </div>
        <div class="editor-row">
          <label>
            <input type="checkbox" id="warm_rear_right_seat" ${this._config.warm_rear_right_seat === true ? 'checked' : ''}>
            Rear Right Seat
          </label>
        </div>
        <div class="editor-grid">
          <div class="editor-row">
            <label>Seat Level</label>
            <select id="warm_seat_level">
              <option value="6" ${(this._config.warm_seat_level || 6) === 6 ? 'selected' : ''}>Low</option>
              <option value="7" ${this._config.warm_seat_level === 7 ? 'selected' : ''}>Medium</option>
              <option value="8" ${this._config.warm_seat_level === 8 ? 'selected' : ''}>High</option>
            </select>
          </div>
          <div class="editor-row">
            <label>Steering Wheel Level (Heat only)</label>
            <select id="warm_steering_level">
              <option value="1" ${this._config.warm_steering_level === 1 ? 'selected' : ''}>Low</option>
              <option value="2" ${(this._config.warm_steering_level || 2) === 2 ? 'selected' : ''}>High</option>
            </select>
          </div>
        </div>

        <div class="editor-section">Display Options</div>
        <div class="editor-row">
          <label>
            <input type="checkbox" id="show_controls" ${this._config.show_controls !== false ? 'checked' : ''}>
            Show Controls Row
          </label>
        </div>
        <div class="editor-row">
          <label>
            <input type="checkbox" id="show_status_row" ${this._config.show_status_row !== false ? 'checked' : ''}>
            Show Status Rows (Vehicle Status, Health, Valet)
          </label>
        </div>
        <div class="editor-row">
          <label>
            <input type="checkbox" id="car_weather" ${this._config.car_weather === true ? 'checked' : ''}>
            Show weather at the car's location
          </label>
          <small>Sends the car's approximate location to Open-Meteo</small>
        </div>
      </div>
    `;

    // Text/number inputs
    ['vehicle_id', 'name', 'device_id', 'image', 'cool_temp', 'warm_temp', 'custom_temp', 'duration'].forEach(field => {
      const el = this.querySelector(`#${field}`);
      if (el) {
        const handler = (e) => {
          let value = e.target.value;
          if (['cool_temp', 'warm_temp', 'custom_temp', 'duration'].includes(field)) {
            value = parseFloat(value) || 0;
          }
          this._config = { ...this._config, [field]: value };
          this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
        };
        el.addEventListener('input', handler);
        el.addEventListener('change', handler);
      }
    });

    // Checkbox inputs
    ['show_controls', 'show_status_row', 'car_weather', 'warm_steering_wheel', 'warm_front_left_seat', 'warm_front_right_seat', 'warm_rear_left_seat', 'warm_rear_right_seat'].forEach(field => {
      const el = this.querySelector(`#${field}`);
      if (el) {
        el.addEventListener('change', (e) => {
          this._config = { ...this._config, [field]: e.target.checked };
          this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
        });
      }
    });

    // Select dropdowns
    ['warm_seat_level', 'warm_steering_level'].forEach(field => {
      const el = this.querySelector(`#${field}`);
      if (el) {
        el.addEventListener('change', (e) => {
          this._config = { ...this._config, [field]: parseInt(e.target.value) };
          this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
        });
      }
    });
  }
}

customElements.define('kia-vehicle-card', KiaVehicleCard);
customElements.define('kia-vehicle-card-editor', KiaVehicleCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'kia-vehicle-card',
  name: 'Kia Vehicle Card',
  description: 'A comprehensive card for Kia/Hyundai vehicles with climate controls',
  preview: true
});

console.info('%c KIA-VEHICLE-CARD %c v2.13.0-beta.4 ', 'background: #3B82F6; color: white; font-weight: bold; border-radius: 4px 0 0 4px;', 'background: #1f2937; color: white; border-radius: 0 4px 4px 0;');

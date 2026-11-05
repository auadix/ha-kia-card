// Runs the real card against a stub DOM and a fake hass. Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const fixtures = require('./fixtures/entities.json');

const timers = [];

function loadCard() {
  const elements = {};
  class HTMLElement {
    dispatchEvent(event) { (this.events ??= []).push(event); }

    attachShadow() {
      const listeners = {};
      this.shadowRoot = {
        innerHTML: '',
        listeners,
        getElementById: (id) => ({
          addEventListener: (type, fn) => { listeners[id] = fn; },
        }),
      };
      return this.shadowRoot;
    }
  }
  const sandbox = {
    HTMLElement,
    console: { info() {} },
    CustomEvent: class { constructor(type, init) { this.type = type; Object.assign(this, init); } },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    window: {},
    document: {},
    customElements: { define: (name, cls) => { elements[name] = cls; } },
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'kia-vehicle-card.js'), 'utf8'), sandbox);
  return elements;
}

const elements = loadCard();
const SERVICES = ['start_climate', 'stop_climate', 'force_update', 'start_hazard_lights_and_horn'];
const services = { kia_uvo: Object.fromEntries(SERVICES.map((name) => [name, {}])) };

const ALL_SERVICES = [...SERVICES, 'start_hazard_lights', 'start_valet_mode', 'stop_valet_mode'];
const allServices = { kia_uvo: Object.fromEntries(ALL_SERVICES.map((name) => [name, {}])) };
const entity = (state, attributes = {}) => ({ state, attributes });

const visibleText = (card) => card.shadowRoot.innerHTML
  .replace(/<style[\s\S]*?<\/style>/g, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function mount(config, hass) {
  const card = new elements['kia-vehicle-card']();
  card.setConfig(config);
  card.hass = { callService() {}, services, ...hass };
  return card;
}

// Builds a hass from fixture entries, every one in the given state.
function install(list, { prefix, deviceId, state = 'off' }) {
  const states = {};
  const entities = {};
  for (const { domain, suffix, translation_key: tk } of list) {
    const id = `${domain}.${prefix}_${suffix}`;
    states[id] = entity(state);
    entities[id] = { entity_id: id, platform: 'kia_uvo', device_id: deviceId, translation_key: tk };
  }
  return { states, entities, devices: { [deviceId]: { name: 'Family Car' } } };
}

test('no entities at all claims nothing about the car', () => {
  const text = visibleText(mount({ vehicle_id: 'car' }, { states: {} }));
  assert.match(text, /No vehicle entities found/);
  for (const claim of ['Unlocked', 'Locked', 'All Closed', 'All Good', 'All OK', 'Parked', 'Inactive', '—']) {
    assert.ok(!text.includes(claim), `should not show "${claim}": ${text}`);
  }
});

test('unavailable entities are treated as unknown, not as closed or fine', () => {
  const hass = install(fixtures.upstream, { prefix: 'car', deviceId: 'd1', state: 'unavailable' });
  const text = visibleText(mount({ device_id: 'd1', name: 'Reloading' }, hass));
  assert.match(text, /Reloading/);
  for (const claim of ['Unlocked', 'All Closed', 'All Good', 'All OK', 'Parked', '—', 'Updated']) {
    assert.ok(!text.includes(claim), `should not show "${claim}": ${text}`);
  }
});

test('one known entity shows only that value', () => {
  const text = visibleText(mount({ vehicle_id: 'car' }, { states: { 'sensor.car_odometer': entity('12000') } }));
  assert.match(text, /12,000 mi/);
  for (const claim of ['Fuel', 'Tire Pressure', 'Vehicle Health', 'Valet', 'Doors', 'Link Status']) {
    assert.ok(!text.includes(claim), `should not show "${claim}": ${text}`);
  }
});

test('every ENTITIES entry resolves on the fork and on upstream where it exists', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'kia-vehicle-card.js'), 'utf8');
  const keys = [...src.slice(src.indexOf('const ENTITIES'), src.indexOf('const escapeHtml')).matchAll(/^ {2}(\w+): ent\(/gm)].map((m) => m[1]);
  assert.ok(keys.length > 70);

  const forkOnly = new Set(['tailLampFault', 'stopLampFault', 'carBatteryWarningLevel', 'linkStatus', 'roadsideStatus',
    'speed', 'heading', 'weatherType', 'valetMode']);
  const absentFromFork = new Set(['geocodedLocation']);
  const neither = new Set(['vehicleStatus', 'drivingStatus', 'weatherTemperature', 'locationSensor',
    'headlampLeftHigh', 'headlampRightHigh', 'headlampLeftBifunc', 'headlampRightBifunc',
    'tirePressureFrontLeft', 'tirePressureFrontRight', 'tirePressureRearLeft', 'tirePressureRearRight']);

  const upstream = mount({ device_id: 'u1' }, install(fixtures.upstream, { prefix: 'renamed_car', deviceId: 'u1' }));
  const fork = mount({ vehicle_id: 'kikia' }, { states: install(fixtures.fork, { prefix: 'kikia', deviceId: 'f1' }).states });

  const missing = { upstream: [], fork: [] };
  for (const key of keys) {
    if (!forkOnly.has(key) && !['vehicleStatus', 'drivingStatus', 'weatherTemperature', 'locationSensor'].includes(key)
      && !upstream.entityId(key)) missing.upstream.push(key);
    if (!neither.has(key) && !absentFromFork.has(key) && !fork.entityId(key)) missing.fork.push(key);
  }
  assert.deepEqual(missing, { upstream: [], fork: [] });
});

test('picking a device finds entities by translation key, whatever they are called', () => {
  const hass = {
    states: { 'sensor.weird_name': entity('55'), 'lock.other_thing': entity('locked') },
    entities: {
      'sensor.weird_name': { entity_id: 'sensor.weird_name', platform: 'kia_uvo', device_id: 'd1', translation_key: 'fuel_level' },
      'lock.other_thing': { entity_id: 'lock.other_thing', platform: 'kia_uvo', device_id: 'd1', translation_key: 'door_lock' },
    },
  };
  const text = visibleText(mount({ device_id: 'd1' }, hass));
  assert.match(text, /55/);
  assert.match(text, /Locked/);
});

test('an old vehicle_id config still works and gains the device id', async () => {
  const hass = install(fixtures.upstream, { prefix: 'kikia', deviceId: 'd9' });
  hass.states['lock.kikia_door_lock'] = entity('locked');
  const calls = [];
  hass.callService = (...args) => calls.push(args);
  const card = mount({ vehicle_id: 'kikia' }, hass);
  assert.equal(card.deviceId, 'd9');
  card.shadowRoot.listeners['btn-refresh']();
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [['kia_uvo', 'force_update', { device_id: 'd9' }]]);
});

test('a second vehicle does not leak into the first', () => {
  const a = install(fixtures.upstream, { prefix: 'car_a', deviceId: 'a' });
  const b = install(fixtures.upstream, { prefix: 'car_b', deviceId: 'b' });
  const hass = { states: { ...a.states, ...b.states }, entities: { ...a.entities, ...b.entities } };
  hass.states['sensor.car_b_fuel_level'] = entity('11');
  hass.states['sensor.car_a_fuel_level'] = entity('77');
  assert.equal(mount({ device_id: 'b' }, hass).stateOf('fuelLevel'), '11');
  assert.equal(mount({ vehicle_id: 'car_a' }, hass).stateOf('fuelLevel'), '77');
});

test('renamed lamp and oil warnings fire on stock upstream names', () => {
  const hass = install(fixtures.upstream, { prefix: 'car', deviceId: 'd1' });
  hass.states['binary_sensor.car_rear_left_lamp_fault'] = entity('on');
  hass.states['binary_sensor.car_oil_level_warning'] = entity('on');
  hass.states['binary_sensor.car_headlamp_left_high_fault'] = entity('on');
  const text = visibleText(mount({ device_id: 'd1' }, hass));
  assert.match(text, /Left Brake Light Fault/);
  assert.match(text, /Check Engine Oil/);
  assert.match(text, /Left High Beam Fault/);
});

test('fork diagnostics show when present and stay hidden otherwise', () => {
  const states = {
    'sensor.kikia_car_battery_warning_level': entity('100'),
    'sensor.kikia_link_status': entity('0'),
    'sensor.kikia_roadside_assistance_status': entity('0'),
  };
  const text = visibleText(mount({ vehicle_id: 'kikia' }, { states }));
  assert.match(text, /12V Warning Level 100/);
  assert.match(text, /Link Status 0/);
  assert.match(text, /Roadside Assistance 0/);
});

test('location prefers an address and never shows not_home', () => {
  const tracker = entity('not_home', { latitude: 1, longitude: 2 });
  const withAddress = visibleText(mount({ vehicle_id: 'car' }, {
    states: { 'device_tracker.car_location': tracker, 'sensor.car_geocoded_location': entity('12 Main St') },
  }));
  assert.match(withAddress, /12 Main St/);
  const withoutAddress = visibleText(mount({ vehicle_id: 'car' }, { states: { 'device_tracker.car_location': tracker } }));
  assert.match(withoutAddress, /View on map/);
  assert.ok(!withoutAddress.includes('not_home'));
});

test('heading falls back to the raw payload when the sensor has no number', () => {
  const states = {
    'sensor.car_heading': entity('unknown'),
    'sensor.car_data': entity('on', { vehicle_data: { lastVehicleInfo: { location: { head: 162 } } } }),
  };
  assert.match(mount({ vehicle_id: 'car' }, { states }).shadowRoot.innerHTML, /Heading: 162°/);
  states['sensor.car_heading'] = entity('90');
  assert.match(mount({ vehicle_id: 'car' }, { states }).shadowRoot.innerHTML, /Heading: 90°/);
});

test('a full EV leads with battery and range, with no fuel stat', () => {
  const states = {
    'sensor.car_ev_battery_level': entity('80'),
    'sensor.car_ev_range': entity('250', { unit_of_measurement: 'km' }),
    'binary_sensor.car_ev_battery_charge': entity('on'),
  };
  const text = visibleText(mount({ vehicle_id: 'car' }, { states }));
  assert.match(text, /Battery 80 % Est\. Range 250 km/);
  assert.match(text, /EV Battery 80%/);
  assert.match(text, /Charging/);
  assert.ok(!text.includes('Fuel'));
});

test('a plug-in hybrid keeps fuel and adds the EV details', () => {
  const states = {
    'sensor.car_fuel_level': entity('50'),
    'sensor.car_ev_battery_level': entity('80'),
    'sensor.car_ev_range': entity('30', { unit_of_measurement: 'mi' }),
  };
  const text = visibleText(mount({ vehicle_id: 'car' }, { states }));
  assert.match(text, /Fuel 50 %/);
  assert.match(text, /EV: 80% · 30 mi/);
});

test('an EV running climate offers stop, a parked gas car with stale AC does not', () => {
  const ev = { 'sensor.car_ev_battery_level': entity('80'), 'binary_sensor.car_air_conditioner': entity('on') };
  assert.match(visibleText(mount({ vehicle_id: 'car' }, { states: ev })), /Climate Stop/);
  const gas = { 'sensor.car_fuel_level': entity('50'), 'binary_sensor.car_air_conditioner': entity('on') };
  assert.match(visibleText(mount({ vehicle_id: 'car' }, { states: gas })), /Climate Start/);
});

test('units come from each entity, and service colors stay correct in km', () => {
  const states = {
    'sensor.car_fuel_driving_range': entity('500', { unit_of_measurement: 'km' }),
    'sensor.car_odometer': entity('12000', { unit_of_measurement: 'km' }),
    'sensor.car_next_service': entity('2000', { unit_of_measurement: 'km' }),
  };
  const card = mount({ vehicle_id: 'car' }, { states });
  const text = visibleText(card);
  assert.match(text, /500 km/);
  assert.match(text, /12,000 km/);
  assert.match(text, /2,000 km/);
  assert.ok(!text.includes(' mi'));
  // 2000 km is about 1243 mi: the 1000-3000 mi warning band, not the green one
  assert.match(card.shadowRoot.innerHTML, /service-chip warning/);
  const noUnit = { 'sensor.car_odometer': entity('100') };
  const metric = { config: { unit_system: { length: 'km' } } };
  assert.match(visibleText(mount({ vehicle_id: 'car' }, { states: noUnit, ...metric })), /100 km/);
});

function climateCard(manufacturer, config = {}) {
  const calls = [];
  const hass = {
    states: { 'sensor.car_odometer': entity('1') },
    entities: { 'sensor.car_odometer': { entity_id: 'sensor.car_odometer', platform: 'kia_uvo', device_id: 'd1', translation_key: 'odometer' } },
    devices: { d1: { manufacturer } },
    callService: (...args) => { calls.push(args); },
  };
  const card = mount({ device_id: 'd1', ...config }, hass);
  return { card, calls };
}

function startClimate(card, calls, preset) {
  card._showClimatePanel = true;
  card._climateMode = preset;
  card.render();
  card.shadowRoot.listeners['btn-start-climate']();
  return calls.at(-1)[2].temperature;
}

test('climate sends the unit the region expects', () => {
  const usa = climateCard('Kia USA');
  assert.equal(startClimate(usa.card, usa.calls, 'cool'), 68);
  const canada = climateCard('Kia Canada');
  assert.equal(startClimate(canada.card, canada.calls, 'cool'), 19);
  usa.card._showClimatePanel = true;
  usa.card.render();
  assert.match(usa.card.shadowRoot.innerHTML, /68°F/);
  canada.card._showClimatePanel = true;
  canada.card.render();
  assert.match(canada.card.shadowRoot.innerHTML, /19°C/);
});

test('default climate temperatures are accepted by every region', () => {
  // KiaUvoApiAU.temperature_range is the narrowest: 17-26.5 in 0.5 steps
  for (const preset of ['cool', 'warm', 'custom']) {
    const { card, calls } = climateCard('Hyundai Australia');
    const value = startClimate(card, calls, preset);
    assert.ok(value >= 17 && value <= 26.5 && value * 2 === Math.round(value * 2), `${preset}: ${value}`);
  }
});

test('temperatures saved in the wrong unit by older versions are converted', () => {
  const metric = climateCard('Kia Europe', { cool_temp: 68, warm_temp: 80 });
  assert.equal(startClimate(metric.card, metric.calls, 'cool'), 20);
  assert.equal(startClimate(metric.card, metric.calls, 'warm'), 26.5);
  const usa = climateCard('Kia USA', { custom_temp: 72 });
  assert.equal(startClimate(usa.card, usa.calls, 'custom'), 72);
  const kept = climateCard('Kia Europe', { custom_temp: 21.5 });
  assert.equal(startClimate(kept.card, kept.calls, 'custom'), 21.5);
});

function lockCard(state = 'locked') {
  const calls = [];
  const card = mount({ vehicle_id: 'car' }, {
    states: { 'lock.car_door_lock': entity(state) },
    callService: (...args) => { calls.push(args.slice(0, 2)); },
  });
  return { card, calls, tap: () => card.shadowRoot.listeners['btn-lock']() };
}

test('unlock takes a second tap, and the first tap sends nothing', () => {
  const { card, calls, tap } = lockCard();
  tap();
  assert.deepEqual(calls, []);
  assert.match(visibleText(card), /Tap to Confirm/);
  tap();
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [['lock', 'unlock']]);
  assert.ok(!visibleText(card).includes('Tap to Confirm'));
});

test('the unlock confirmation expires', () => {
  const { card, calls, tap } = lockCard();
  tap();
  const timer = timers.at(-1);
  assert.ok(timer.ms >= 3000 && timer.ms <= 6000);
  timer.fn();
  assert.ok(!visibleText(card).includes('Tap to Confirm'));
  tap();
  assert.deepEqual(calls, [], 'a tap after expiry starts over');
});

test('locking still takes one tap', () => {
  const { calls, tap } = lockCard('unlocked');
  tap();
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [['lock', 'lock']]);
});

test('vehicle status needs proof before saying Driving', () => {
  const status = (states) => mount({ vehicle_id: 'car' }, { states }).getVehicleStatus();
  const on = { 'binary_sensor.car_engine': entity('on') };
  assert.equal(status(on), 'Engine On');
  assert.equal(status({ ...on, 'sensor.car_speed': entity('0') }), 'Engine On');
  assert.equal(status({ ...on, 'sensor.car_speed': entity('35') }), 'Driving');
  assert.equal(status({ ...on, 'sensor.car_speed': entity('0'), 'binary_sensor.car_remote_ignition': entity('on') }), 'Remote Start');
  assert.equal(status({ 'binary_sensor.car_engine': entity('off') }), 'Parked');
  assert.equal(status({ 'sensor.car_odometer': entity('1') }), null);
});

test('each quick action calls the command it names', () => {
  const calls = [];
  const card = mount({ device_id: 'd1', vehicle_id: 'car' }, {
    states: { 'sensor.car_odometer': entity('1') },
    services: allServices,
    callService: (...args) => { calls.push(args[1]); },
  });
  card._index = { deviceId: 'd1', byTranslationKey: new Map(), prefixes: ['car'] };
  card._showQuickActions = true;
  card.render();
  card.shadowRoot.listeners['qa-lights']();
  assert.deepEqual(calls, ['start_hazard_lights']);
  card._showQuickActions = true;
  card.render();
  assert.match(visibleText(card), /Horn \+ Lights/);
});

function regionCard(manufacturer) {
  return mount({ device_id: 'd1' }, {
    services: allServices,
    states: { 'binary_sensor.car_valet_mode': entity('off'), 'sensor.car_odometer': entity('1') },
    entities: {
      'binary_sensor.car_valet_mode': { entity_id: 'binary_sensor.car_valet_mode', platform: 'kia_uvo', device_id: 'd1' },
      'sensor.car_odometer': { entity_id: 'sensor.car_odometer', platform: 'kia_uvo', device_id: 'd1' },
    },
    devices: { d1: { manufacturer } },
  });
}

test('commands the library cannot send are hidden, status stays', () => {
  const kiaUsa = regionCard('Kia USA');
  assert.ok(!visibleText(kiaUsa).includes('More'));
  assert.match(visibleText(kiaUsa), /Valet Mode Inactive/);
  assert.ok(!kiaUsa.shadowRoot.innerHTML.includes('valet-toggle'));

  const hyundaiUsa = regionCard('Hyundai USA');
  assert.match(visibleText(hyundaiUsa), /More/);
  assert.ok(!hyundaiUsa.shadowRoot.innerHTML.includes('valet-toggle'));

  const europe = regionCard('Kia Europe');
  assert.match(visibleText(europe), /More/);
  assert.ok(europe.shadowRoot.innerHTML.includes('valet-toggle'));
});

test('only changes to the card\'s own entities redraw it', () => {
  const states = { 'sensor.car_odometer': entity('1'), 'light.kitchen': entity('off') };
  const base = { callService() {}, services };
  const card = mount({ vehicle_id: 'car' }, { ...base, states });
  let renders = 0;
  const render = card.render.bind(card);
  card.render = () => { renders += 1; render(); };

  card.hass = { ...base, states };
  renders = 0;
  for (let i = 0; i < 100; i += 1) {
    card.hass = { ...base, states: { ...states, 'light.kitchen': entity(String(i)) } };
  }
  assert.equal(renders, 0);

  card.hass = { ...base, states: { ...states, 'sensor.car_odometer': entity('2') } };
  assert.equal(renders, 1);
  assert.match(visibleText(card), /2 mi/);
});

test('a failed command does not cause an unhandled rejection', async () => {
  const failures = [];
  const onFailure = (error) => failures.push(error);
  process.on('unhandledRejection', onFailure);
  const { card } = lockCard('unlocked');
  card._hass = { ...card._hass, callService: () => Promise.reject(new Error('not supported')) };
  card.shadowRoot.listeners['btn-lock']();
  await new Promise((resolve) => { setImmediate(resolve); });
  process.off('unhandledRejection', onFailure);
  assert.deepEqual(failures, []);
});

test('tires: unknown is neither OK nor a warning, an open warning still shows', () => {
  const only = { 'binary_sensor.car_tire_pressure_front_left': entity('on') };
  const card = mount({ vehicle_id: 'car' }, { states: only });
  assert.match(visibleText(card), /Check Tires/);
  card._showTirePressure = true;
  card.render();
  assert.equal((card.shadowRoot.innerHTML.match(/class="tire /g) || []).length, 1);
});

test('controls appear only when they can work', () => {
  const states = { 'sensor.car_odometer': entity('1') };
  const none = visibleText(mount({ vehicle_id: 'car' }, { states, services: {} }));
  for (const label of ['Lock', 'Climate Start', 'More', 'Update']) assert.ok(!none.includes(label));
  const some = mount({ vehicle_id: 'car' }, { states, services });
  assert.match(visibleText(some), /Climate Start/);
  assert.match(some.shadowRoot.innerHTML, /repeat\(3, 1fr\)/);
});

test('no config shows the setup message; text from entities is escaped', () => {
  assert.match(visibleText(mount({}, { states: {} })), /Select your vehicle/);
  const card = mount({ vehicle_id: 'car', name: '<b>x</b>' }, {
    states: { 'sensor.car_geocoded_location': entity('<img src=x onerror=alert(1)>') },
  });
  assert.ok(!card.shadowRoot.innerHTML.includes('<img src=x'));
  assert.ok(!card.shadowRoot.innerHTML.includes('<b>x</b>'));
});

test('default config picks a real vehicle and never ships a personal prefix', () => {
  const hass = install(fixtures.upstream, { prefix: 'car', deviceId: 'd1' });
  const stub = elements['kia-vehicle-card'].getStubConfig(hass);
  assert.equal(stub.device_id, 'd1');
  assert.equal(stub.name, 'Family Car');
  assert.equal(stub.vehicle_id, undefined);
  assert.ok(!fs.readFileSync(path.join(__dirname, '..', 'kia-vehicle-card.js'), 'utf8').includes("'kikia'"));
});

test('editor offers vehicles and does not rebuild on unrelated hass updates', () => {
  const hass = install(fixtures.upstream, { prefix: 'car', deviceId: 'd1' });
  const editor = new elements['kia-vehicle-card-editor']();
  editor.querySelector = () => null;
  let renders = 0;
  const render = editor.render.bind(editor);
  editor.render = () => { renders += 1; render(); };
  editor.setConfig({ device_id: 'd1' });
  editor.hass = hass;
  assert.match(editor.innerHTML, /<option value="d1" selected>Family Car/);
  editor.hass = { ...hass, states: { ...hass.states } };
  editor.setConfig({ device_id: 'd1' });
  assert.equal(renders, 1);
});

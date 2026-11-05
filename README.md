# Kia Vehicle Card for Home Assistant

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![Release](https://img.shields.io/github/v/release/auadix/ha-kia-card)](https://github.com/auadix/ha-kia-card/releases)
![License](https://img.shields.io/badge/license-MIT-green)

A modern Lovelace card for Kia and Hyundai vehicles that use the [Kia UVO / Hyundai Bluelink integration](https://github.com/Hyundai-Kia-Connect/kia_uvo).

The card shows whatever your vehicle actually reports. Anything it doesn't report — a sensor your car lacks, a value that's temporarily unavailable, or a control your region can't perform — is simply hidden, so you never see a fake "all closed" or a button that does nothing. What you see therefore depends on your car, your region, and your integration version.

## Features

- **Vehicle monitoring** — fuel, 12V and EV battery, range, odometer, doors, windows and location (tap to open Google Maps)
- **At-a-glance status** — locked/unlocked, parked/driving, and a heading compass when the car reports it
- **Service countdown** — colour-coded as service approaches
- **Warnings** — washer fluid, low fuel, key-fob battery, brake fluid, engine oil, and lamp faults, shown only when active
- **Tire pressure** — an expandable panel with per-tire status and, where available, the measured pressure
- **Climate control** — start/stop plus Cool / Warm / Custom presets, with configurable heated/ventilated accessories; temperatures follow your region's units
- **Vehicle controls** — lock/unlock (unlocking asks for a second tap to confirm), climate, force update, and a "More" menu for horn and lights where the integration supports them
- **Optional weather at the car's location** — off by default; see the `car_weather` option
- Responsive layout for phone and desktop, with subtle animations for running, charging and active states

## Installation

### HACS (recommended)

1. In HACS, open the three-dot menu → **Custom repositories**.
2. Add `https://github.com/auadix/ha-kia-card` with category **Dashboard** (formerly "Lovelace").
3. Find **Kia Vehicle Card**, download it, and restart Home Assistant.
4. Hard-refresh your browser (Ctrl/Cmd+Shift+R).

### Manual

1. Download `kia-vehicle-card.js` from the [latest release](https://github.com/auadix/ha-kia-card/releases/latest).
2. Copy it to `<config>/www/kia-vehicle-card.js`.
3. Add it under **Settings → Dashboards → Resources** as a JavaScript module with URL `/local/kia-vehicle-card.js`.
4. Restart Home Assistant and hard-refresh your browser.

## Configuration

The easiest way is the visual editor: add the card, then pick your vehicle from the **Vehicle** dropdown. Everything else is detected automatically, including the device needed for controls.

A minimal YAML config:

```yaml
type: custom:kia-vehicle-card
device_id: abc123def456   # pick your vehicle in the editor to fill this in
name: My Kia
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `device_id` | string | — | Your vehicle's device. Pick it in the editor and everything else is found automatically. |
| `vehicle_id` | string | — | Entity prefix (e.g. `my_car` from `sensor.my_car_fuel_level`). Only needed if your car isn't detected automatically; can be used instead of `device_id`. |
| `name` | string | `My Kia` | Display name shown in the header. |
| `image` | string | — | URL to a vehicle image. Falls back to a built-in SVG. |
| `show_controls` | boolean | `true` | Show the control buttons. |
| `show_status_row` | boolean | `true` | Show the status rows (vehicle status, health, tire pressure, valet). |
| `car_weather` | boolean | `false` | Show the weather at the car's location. Sends its approximate location (rounded to ~1 km) to [Open-Meteo](https://open-meteo.com). |
| `cool_temp` | number | 68°F / 19°C | "Cool" preset temperature. Units follow the region (°F in the USA, °C elsewhere). |
| `warm_temp` | number | 80°F / 26°C | "Warm" preset temperature. |
| `custom_temp` | number | 72°F / 22°C | "Custom" preset temperature. |
| `duration` | number | `10` | Climate run time in minutes (1–30). |
| `warm_steering_wheel` | boolean | `true` | Warm preset: activate the steering-wheel heater. |
| `warm_front_left_seat` | boolean | `true` | Warm preset: activate the driver seat. |
| `warm_front_right_seat` | boolean | `true` | Warm preset: activate the passenger seat. |
| `warm_rear_left_seat` | boolean | `false` | Warm preset: activate the rear-left seat. |
| `warm_rear_right_seat` | boolean | `false` | Warm preset: activate the rear-right seat. |
| `warm_seat_level` | number | `6` | Seat level: 6=Low, 7=Medium, 8=High. |
| `warm_steering_level` | number | `2` | Steering level: 1=Low, 2=High. |

## Requirements

The [Kia UVO / Hyundai Bluelink integration](https://github.com/Hyundai-Kia-Connect/kia_uvo), installed and configured. A reasonably recent version is recommended so entity names match, but the card degrades gracefully on older ones — it just shows less.

Both EV and non-EV Kia and Hyundai vehicles are supported, in every region the integration covers.

## Troubleshooting

**The card doesn't appear.** Hard-refresh the browser, confirm the resource is loaded, and check the browser console (F12) for errors.

**A section is missing.** The card only shows what your vehicle reports, so a missing section usually means your car, region or integration version doesn't provide that data. Try forcing an update from the integration and wait for the next refresh.

**Controls don't do anything.** Make sure a vehicle is selected in the editor, that the same control works from the integration directly, and that the car isn't in valet mode. Buttons that your region's integration can't perform are hidden rather than shown as broken.

## Contributing

Issues and pull requests are welcome. Tests run with `node --test tests/`. See the [changelog](CHANGELOG.md) for release history.

## Credits

- Built for the [Kia UVO / Hyundai Bluelink integration](https://github.com/Hyundai-Kia-Connect/kia_uvo)
- Icons by [Material Design Icons](https://materialdesignicons.com/)
- Weather by [Open-Meteo](https://open-meteo.com)

## License

MIT — see [LICENSE](LICENSE).

# Kia Vehicle Card for Home Assistant

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![Release](https://img.shields.io/github/v/release/auadix/ha-kia-card)](https://github.com/auadix/ha-kia-card/releases)
![License](https://img.shields.io/badge/license-MIT-green)

A dashboard card for Kia, Hyundai and Genesis vehicles that use the [Kia UVO / Hyundai Bluelink integration](https://github.com/Hyundai-Kia-Connect/kia_uvo).

The card only shows what your vehicle actually reports. If a sensor doesn't exist on your car, is temporarily unavailable, or a command can't be sent in your region, that part of the card is hidden. You never see a made-up "All Closed" or a button that does nothing.

| Overview | Climate presets |
| :---: | :---: |
| ![Overview of a parked, locked car](docs/images/overview.png) | ![Climate panel with the Warm preset selected](docs/images/climate.png) |
| **Alerts** | **EV charging** |
| ![Unlocked car with an open door, an open window and warnings](docs/images/alerts.png) | ![EV charging, with charging power and time to full](docs/images/ev-charging.png) |

<sub>Screenshots use demo data.</sub>

## Features

**At a glance**
- Fuel, EV battery and 12V battery, with estimated range
- Locked, unlocked or running badge
- Doors and windows, plus a car diagram that colours each door
- Odometer and a colour-coded service countdown
- Heading compass and the car's location, which opens in Google Maps
- Average fuel economy, where the car reports it

**Status**
- Vehicle status: Parked, Driving (only when a road speed proves it), Remote Start or Engine On
- Speed while driving, and drive mode and gear while the ignition is on, where the car reports them
- Vehicle health from diagnostic trouble codes
- Tire pressure warnings and, where available, each tire's pressure
- Valet mode

**Alerts**, shown only while active
- Low washer fluid, low fuel, key fob battery, brake fluid, engine oil and 12V battery fault
- Headlamp, brake light, turn signal and tail lamp faults
- Hazard lights on

**Electric and plug-in hybrid vehicles**
- Full EVs lead with battery and range; plug-in hybrids show both fuel and EV battery
- Charging and plugged-in status, with charging power and time to full while charging

**Climate**
- Cool, Warm and Custom presets, with heated or ventilated seats and steering wheel for Warm
- Temperatures follow your region: °F in the USA, °C elsewhere
- A "Climate Active" row showing which heaters and seats are on

**Controls**
- Lock and unlock. Unlocking asks for a second tap to confirm
- Start and stop climate, and request a fresh update from the car
- A **More** menu with Find My Car, Horn + Lights and Flash Lights

**Optional weather at the car's location**, from [Open-Meteo](https://open-meteo.com). It's off by default; see `car_weather` below.

## What you'll see depends on your car

Each region's API reports different data and supports different commands. A few examples:

- **Kia USA** doesn't report drive mode, gear or fuel economy, and the integration can't send horn, lights or valet commands there, so those are hidden. Kia USA also always reports the same weather, so the weather badge only appears with `car_weather` turned on.
- **Valet mode** can only be switched from the card outside the USA. Elsewhere its status is still shown.
- **Rows like 12V warning level, link status and roadside assistance** appear only with integration builds that provide them.

## Installation

### HACS (recommended)

1. Open HACS (shown as **Marketplace** in recent Home Assistant versions).
2. Open the three-dot menu and choose **Custom repositories**.
3. Add `https://github.com/auadix/ha-kia-card` with the category **Dashboard**.
4. Find **Kia Vehicle Card**, download it, then hard-refresh your browser (Ctrl/Cmd+Shift+R).

### Manual

1. Download `kia-vehicle-card.js` from the [latest release](https://github.com/auadix/ha-kia-card/releases/latest).
2. Copy it to `<config>/www/kia-vehicle-card.js`.
3. Under **Settings → Dashboards → Resources**, add `/local/kia-vehicle-card.js` as a JavaScript module.
4. Hard-refresh your browser.

## Configuration

Add the card to a dashboard, open its editor and pick your vehicle from the **Vehicle** list. Everything else, including the device the controls need, is found automatically.

In YAML, the minimum is:

```yaml
type: custom:kia-vehicle-card
device_id: abc123def456   # easiest to fill in by picking the vehicle in the editor
```

A fuller example:

```yaml
type: custom:kia-vehicle-card
device_id: abc123def456
name: Kia Sorento
image: https://example.com/my-car.png
car_weather: true
cool_temp: 68
warm_temp: 80
duration: 10
warm_seat_level: 7
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `device_id` | string | — | Your vehicle's device. Picking the vehicle in the editor fills this in. |
| `vehicle_id` | string | — | Entity prefix, e.g. `my_car` from `sensor.my_car_fuel_level`. Only needed if your vehicle isn't found automatically; can be used instead of `device_id`. |
| `name` | string | `My Kia` | Name shown in the header. |
| `image` | string | — | URL of a vehicle image. Without one, the card draws its own car diagram. |
| `show_controls` | boolean | `true` | Show the control buttons. |
| `show_status_row` | boolean | `true` | Show the status rows (vehicle status, health, tire pressure, valet). |
| `car_weather` | boolean | `false` | Show the weather at the car's location. Sends the car's approximate location, rounded to about 1 km, to Open-Meteo. |
| `cool_temp` | number | 68°F / 19°C | Temperature for the Cool preset, in your region's unit. |
| `warm_temp` | number | 80°F / 26°C | Temperature for the Warm preset. |
| `custom_temp` | number | 72°F / 22°C | Temperature for the Custom preset. |
| `duration` | number | `10` | How long climate runs, in minutes (1–30). |
| `warm_steering_wheel` | boolean | `true` | Warm preset: heat the steering wheel. |
| `warm_front_left_seat` | boolean | `true` | Warm preset: driver's seat. |
| `warm_front_right_seat` | boolean | `true` | Warm preset: front passenger seat. |
| `warm_rear_left_seat` | boolean | `false` | Warm preset: rear left seat. |
| `warm_rear_right_seat` | boolean | `false` | Warm preset: rear right seat. |
| `warm_seat_level` | number | `6` | Seat level for the Warm preset: 6 = Low, 7 = Medium, 8 = High. |
| `warm_steering_level` | number | `2` | Steering wheel level for the Warm preset: 1 = Low, 2 = High. |

## Requirements

The [Kia UVO / Hyundai Bluelink integration](https://github.com/Hyundai-Kia-Connect/kia_uvo), installed and set up. Newer integration versions name more entities consistently, but the card works with older ones too; it just shows less.

## Troubleshooting

**The card doesn't appear.** Hard-refresh the browser and check that the resource is listed under **Settings → Dashboards → Resources**. The browser console (F12) shows any loading errors.

**A section is missing.** The card only shows what your car reports, so check that the matching entity exists and isn't unavailable. Forcing an update from the integration often helps after a restart.

**A button is missing.** Controls only appear when the integration can perform them for your vehicle and region. If a control also fails from the integration's own actions, the problem is with the integration or the car's subscription.

**Unlock didn't happen.** Unlocking needs a second tap within 4 seconds. The button turns amber and reads "Tap to Confirm" in between.

## Privacy

The card talks only to your Home Assistant, with one exception: with `car_weather` on, it asks Open-Meteo for the weather at the car's approximate location, about every 30 minutes. Opening the location link sends the coordinates to Google Maps.

## Contributing

Issues and pull requests are welcome. Run the tests with `node --test tests/`. See the [changelog](CHANGELOG.md) for release history.

## Credits

- Built for the [Kia UVO / Hyundai Bluelink integration](https://github.com/Hyundai-Kia-Connect/kia_uvo)
- Icons by [Material Design Icons](https://pictogrammers.com/library/mdi/)
- Weather by [Open-Meteo](https://open-meteo.com)

## License

MIT. See [LICENSE](LICENSE).

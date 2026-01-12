# Kia Vehicle Card for Home Assistant

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/custom-components/hacs)
![Version](https://img.shields.io/badge/version-2.11.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

A beautiful, modern, and comprehensive Lovelace card for Kia and Hyundai vehicles using the [Kia UVO / Hyundai Bluelink integration](https://github.com/Hyundai-Kia-Connect/kia_uvo).

![Kia Vehicle Card Preview](https://via.placeholder.com/600x400?text=Add+Screenshot+Here)

## Features

### 🚗 Complete Vehicle Monitoring
- **Fuel & Battery Status** - Visual progress bars with real-time percentages
- **Range Information** - Estimated driving range
- **Door & Window Status** - See all doors and windows at a glance
- **Location Tracking** - Clickable location that opens Google Maps
- **Heading/Direction** - Compass badge showing vehicle orientation
- **Speed Indicator** - Real-time speed when driving (v2.7.0)
- **Animated Status Indicators** (v2.10.0)
  - Blinking hazard lights when active
  - Pulsing "Running" badge when engine is on
  - Pulsing "Climate Active" when climate control is running
  - Charging animation for EV batteries while charging

### 🔧 Service & Maintenance
- **Enhanced Service Countdown** - Color-coded progress bar (v2.7.0)
  - 🟢 Green: > 3,000 miles remaining
  - 🟡 Yellow: 1,000-3,000 miles (service soon)
  - 🔴 Red: < 1,000 miles (critical!)
- **Odometer Reading**
- **Tire Pressure Monitoring** - Expandable accordion with individual tire status

### ⚠️ Comprehensive Warnings
Displays alerts for:
- Low Washer Fluid
- Low Fuel
- Key Fob Battery Low
- Brake Fluid Warning
- Engine Oil Warning
- All Lamp Faults (headlamps, brake lights, turn signals, tail lamps)
- **NEW (v2.7.0):** Tail Lamp Fault, Stop Lamp Fault, Hazard Lights Active

### 🌡️ Climate Control
- **Smart Presets**
  - Cool (68°F) - AC with standard settings
  - Warm (80°F) - Heat with accessories (steering wheel, seats, defrost)
  - Custom - Your preferred temperature
- **One-Touch Start/Stop** - Climate controls from the card
- **Active Status** - Shows heated seats, steering wheel, mirrors when active

### 📊 Advanced Sensors (v2.7.0)
- Car Battery Warning Level (numeric)
- Link Status (connectivity)
- RSA (Roadside Assistance) Status
- Current vehicle speed with units

### 🎨 Modern Design
- Clean, minimal interface
- Dark theme optimized
- MDI icons throughout
- Weather badge (day/night aware)
- Smooth animations
- Responsive layout (mobile & desktop)

### 🎮 Vehicle Controls
- Lock/Unlock doors
- Start/Stop climate
- **Quick Actions Menu** (v2.11.0) - Collapsible "More" menu with:
  - Find My Car (hazard lights + horn)
  - Horn only
  - Flash lights only
- Force update vehicle data
- Valet mode toggle

## Installation

### HACS (Recommended)

1. Open HACS in Home Assistant
2. Click on "Frontend"
3. Click the 3 dots in the top right corner
4. Select "Custom repositories"
5. Add this repository URL: `https://github.com/auadix/ha-kia-card`
6. Select category: "Lovelace"
7. Click "Add"
8. Find "Kia Vehicle Card" in the list and click "Install"
9. Restart Home Assistant

### Manual Installation

1. Download `kia-vehicle-card.js` from the [latest release](https://github.com/auadix/ha-kia-card/releases)
2. Copy it to `<config>/www/kia-vehicle-card.js`
3. Add the resource in your Lovelace configuration:

```yaml
resources:
  - url: /local/kia-vehicle-card.js
    type: module
```

4. Restart Home Assistant

## Configuration

### Prerequisites

You must have the [Kia UVO / Hyundai Bluelink integration](https://github.com/Hyundai-Kia-Connect/kia_uvo) installed and configured.

**Required Versions:**
- `hyundai_kia_connect_api` >= v3.54.0
- `kia_uvo` integration >= v2.49.0

### Basic Configuration

Add the card to your Lovelace dashboard:

```yaml
type: custom:kia-vehicle-card
vehicle_id: kikia  # Your vehicle entity prefix
name: 2025 Kia Sorento
device_id: abc123...  # Required for controls (see below)
```

### Finding Your Device ID

1. Go to **Developer Tools** → **Services**
2. Select service: `kia_uvo.start_climate`
3. Click on the **Device** dropdown
4. Select your vehicle
5. Copy the device ID from the YAML (looks like: `abc123def456...`)

### Full Configuration Example

```yaml
type: custom:kia-vehicle-card
vehicle_id: kikia
name: 2025 Kia Sorento X-LINE SX-Prestige
image: https://owners.kia.com/content/dam/kia/us/owners/image/vehicle/2025/sorento/x-line_sx-prestige/M2Y.png
device_id: abc123def456ghi789
show_controls: true
show_status_row: true
# Climate presets
cool_temp: 68
warm_temp: 80
custom_temp: 72
duration: 10
# Climate preset accessories (Warm preset only - customize what activates)
warm_steering_wheel: true       # Steering wheel heating
warm_front_left_seat: true      # Driver seat
warm_front_right_seat: true     # Passenger seat
warm_rear_left_seat: false      # Rear left seat
warm_rear_right_seat: false     # Rear right seat
warm_seat_level: 6              # 6=Low, 7=Medium, 8=High
warm_steering_level: 2          # 1=Low, 2=High (heating only)
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `vehicle_id` | string | **Required** | Entity prefix for your vehicle (e.g., "kikia" from `sensor.kikia_fuel_level`) |
| `name` | string | "My Kia" | Display name for your vehicle |
| `device_id` | string | - | Device ID for remote controls (required for lock, climate, horn) |
| `image` | string | - | URL to vehicle image (optional, will use SVG fallback) |
| `show_controls` | boolean | true | Show control buttons (lock, climate, horn, update) |
| `show_status_row` | boolean | true | Show status rows (vehicle status, health, tire pressure, valet) |
| **Climate Presets** | | | |
| `cool_temp` | number | 68 | Temperature for "Cool" preset (°F) |
| `warm_temp` | number | 80 | Temperature for "Warm" preset (°F) |
| `custom_temp` | number | 72 | Temperature for "Custom" preset (°F) |
| `duration` | number | 10 | Climate duration in minutes (1-30) |
| **Climate Preset Accessories** | | | *Warm preset only - seats can heat/cool* |
| `warm_steering_wheel` | boolean | true | Steering wheel (heating only) |
| `warm_front_left_seat` | boolean | true | Driver seat |
| `warm_front_right_seat` | boolean | true | Passenger seat |
| `warm_rear_left_seat` | boolean | false | Rear left seat |
| `warm_rear_right_seat` | boolean | false | Rear right seat |
| `warm_seat_level` | number | 6 | Seat level: 6=Low, 7=Medium, 8=High |
| `warm_steering_level` | number | 2 | Steering level: 1=Low, 2=High (heat only) |

## Screenshots

### Main View
*(Add screenshot here)*

### Climate Panel
*(Add screenshot here)*

### Warning Alerts
*(Add screenshot here)*

### Service Countdown
*(Add screenshot here)*

## Supported Vehicles

This card works with all Kia and Hyundai vehicles supported by the [Kia UVO / Hyundai Bluelink integration](https://github.com/Hyundai-Kia-Connect/kia_uvo), including:

- Kia (USA, Canada, Europe): EV6, Niro EV, Sorento, Telluride, Sportage, etc.
- Hyundai (USA, Canada, Europe): Ioniq 5, Ioniq 6, Tucson, Palisade, Santa Fe, etc.

Both EV and non-EV vehicles are fully supported!

## Changelog

### v2.7.0 (2026-01-09)
- ✨ Added 7 new sensors (tail lamp, stop lamp, hazard lights, battery warning level, RSA status, link status)
- ✨ Real-time speed indicator when driving
- ✨ Enhanced service countdown with color-coded progress bar
- 🎨 Improved visual hierarchy
- 📊 Better sensor coverage

### v2.6.0
- Initial comprehensive redesign
- Climate control panel with presets
- Weather badge
- Heading/direction indicator
- Full lamp fault monitoring

## Troubleshooting

### Card doesn't appear
1. Clear browser cache (Ctrl+F5 or Cmd+Shift+R)
2. Check browser console (F12) for errors
3. Verify the resource is loaded in Lovelace resources
4. Restart Home Assistant

### Controls don't work
1. Verify you have set the `device_id` in configuration
2. Check that your integration is working (try controls from the integration directly)
3. Ensure you're not in valet mode (disables remote controls)

### Sensors show "—" or "Unknown"
1. Verify integration is installed and working
2. Check that you have the required versions (API v3.54.0+, Integration v2.49.0+)
3. Try forcing an update from the integration
4. Wait for the next automatic refresh cycle

### Speed not showing when driving
1. Verify you have the `sensor.{vehicle}_speed` entity
2. Check that vehicle status is "Driving" (`sensor.{vehicle}_vehicle_status` or `binary_sensor.{vehicle}_engine`)
3. Ensure speed value is > 0

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Setup

1. Clone the repository
2. Make your changes to `kia-vehicle-card.js`
3. Test thoroughly with your vehicle
4. Submit a PR with a clear description

## Support

- **Issues**: [GitHub Issues](https://github.com/auadix/ha-kia-card/issues)
- **Discussions**: [GitHub Discussions](https://github.com/auadix/ha-kia-card/discussions)
- **Integration Support**: [Kia UVO Integration](https://github.com/Hyundai-Kia-Connect/kia_uvo)

## Credits

- Built for the [Kia UVO / Hyundai Bluelink integration](https://github.com/Hyundai-Kia-Connect/kia_uvo)
- Icons by [Material Design Icons](https://materialdesignicons.com/)
- Inspired by the Tesla and Porsche Connect cards

## License

MIT License - see LICENSE file for details

---

**Enjoying this card?** Give it a ⭐ on GitHub!

**Want more features?** Check out the [TODO list](https://github.com/auadix/ha-kia-card/blob/main/TODO.md) or suggest new ones in [Discussions](https://github.com/auadix/ha-kia-card/discussions)!

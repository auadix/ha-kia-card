# Kia Vehicle Card

A beautiful, modern Lovelace card for Kia and Hyundai vehicles.

## Features

- 🚗 Complete vehicle monitoring (fuel, battery, range)
- 🔧 Smart service countdown with color-coded warnings
- ⚡ Real-time speed when driving
- ⚠️ Comprehensive fault detection (lamps, fluids, tires)
- 🌡️ Climate control with smart presets
- 📍 Location tracking with Google Maps integration
- 🎮 Vehicle controls (lock, climate, horn, update)
- 🎨 Modern dark-themed design

## Quick Start

1. Install via HACS
2. Configure your vehicle ID
3. Get your device ID from Developer Tools → Services
4. Add the card to your dashboard

```yaml
type: custom:kia-vehicle-card
vehicle_id: your_vehicle_id
name: My Vehicle
device_id: your_device_id
```

## Requirements

- The [Kia UVO / Hyundai Bluelink integration](https://github.com/Hyundai-Kia-Connect/kia_uvo) installed and configured

The card shows whatever your vehicle reports; anything it does not report is simply hidden.

## Documentation

Full documentation available in the [README](https://github.com/auadix/ha-kia-card#readme)

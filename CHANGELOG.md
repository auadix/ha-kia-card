# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.12.0] - 2026-11-05

### Added
- Vehicle picker in the card editor. Choose your car and the card finds its entities, even if they were renamed
- 12V warning level, link status and roadside assistance rows (shown as raw values)
- Outside temperature, set temperature and EV range
- Tire pressure readings, plus high beam and bi-function headlamp faults

### Changed
- Sensors that are missing or unavailable are now hidden. The card no longer shows "Unlocked", "All Closed", "All Good" or "All OK" without data to back them up
- Controls only appear when they can work on your install
- `device_id` is filled in automatically, and `vehicle_id` is now optional
- The location shows an address, a zone name or "View on map" instead of `not_home`

### Fixed
- Lamp fault and oil warnings on current `kia_uvo` installs, where those entities have new names
- EV range never appearing
- The card staying blank when no vehicle was configured
- The editor losing focus while typing

## [2.7.0] - 2026-01-09

### Added
- Real-time speed indicator when vehicle is driving
- Enhanced service countdown with color-coded progress bars
  - Green color for > 3,000 miles remaining
  - Yellow color for 1,000-3,000 miles remaining
  - Red color for < 1,000 miles remaining
- Mini progress bar under service chip showing percentage remaining
- 7 new sensor integrations:
  - Tail Lamp Fault detection (`binary_sensor.tail_lamp_fault`)
  - Stop Lamp Fault detection (`binary_sensor.stop_lamp_fault`)
  - Hazard Lights active indicator (`binary_sensor.hazard_lights`)
  - Car Battery Warning Level numeric sensor (`sensor.car_battery_warning_level`)
  - Link Status indicator (`sensor.link_status`)
  - RSA (Roadside Assistance) Status (`sensor.roadside_assistance_status`)
  - Current Speed sensor integration (`sensor.speed`)
- Support for both mph and km/h speed units
- Danger CSS class for critical warnings

### Changed
- Service chip now uses `renderServiceChip()` method for enhanced display
- Improved visual hierarchy in warning chips
- Updated version display in console to v2.7.0

### Fixed
- None in this release

### Requirements
- `hyundai_kia_connect_api` >= v3.54.0
- `kia_uvo` integration >= v2.49.0
- Home Assistant >= 2023.1.0 (recommended)

## [2.6.0] - 2025-XX-XX

### Added
- Initial comprehensive redesign
- Climate control panel with smart presets (Cool, Warm, Custom)
- Weather badge on car image (day/night aware)
- Heading/Direction compass badge
- Full lamp fault monitoring (headlamps, brake lights, turn signals)
- Vehicle health expandable panel
- Tire pressure accordion with individual tire sensors
- Valet mode toggle
- Clickable location opens Google Maps
- Lock/Unlock controls
- Horn/lights controls
- Force update controls
- Modern dark theme optimized design

### Changed
- Complete UI redesign with modern styling
- Improved responsive layout for mobile and desktop
- Better icon usage throughout

## [2.5.0] - 2025-XX-XX

### Added
- Initial release
- Basic vehicle monitoring
- Door and window status
- Battery and fuel levels
- Simple controls

---

## Upgrade Guide

### From v2.6.0 to v2.7.0

No configuration changes required! Simply update the card file and clear your browser cache.

**New Features Available:**
- Speed will automatically show when driving
- Service countdown will now show color-coded warnings
- New warning chips will appear if corresponding faults are detected

**Optional:** Update your integration to v2.49.0+ to see all new sensors.

---

## Future Releases

See [TODO.md](TODO.md) for planned features in upcoming releases.

### Planned for v2.8.0 (Phase 2)
- Animated status indicators (blinking hazard lights, pulsing engine)
- Trip statistics panel
- Fuel economy tracking

### Under Consideration
- Swipe gestures for mobile
- Compact mode toggle
- Geofence status indicators
- Multi-vehicle support
- 3D car visualization

---

[2.12.0]: https://github.com/auadix/ha-kia-card/releases/tag/v2.12.0
[2.7.0]: https://github.com/auadix/ha-kia-card/releases/tag/v2.7.0
[2.6.0]: https://github.com/auadix/ha-kia-card/releases/tag/v2.6.0
[2.5.0]: https://github.com/auadix/ha-kia-card/releases/tag/v2.5.0

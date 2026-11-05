# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.13.0] - 2026-11-05

### Added
- Optional weather at the car's location (`car_weather`), using [Open-Meteo](https://open-meteo.com). Off by default because it sends the car's approximate position to a third party.
- Tire pressure readings on Kia USA, read from the raw vehicle data; other regions use the integration's pressure sensors where present.
- A second tap to confirm unlocking. Locking still takes one tap.

### Changed
- Distances follow each sensor's own unit, and climate sends the unit the region's API expects (°F in the USA, °C elsewhere). Temperatures saved in the wrong unit by older versions are converted.
- Full EVs lead with battery and range, and can stop climate without an engine running; plug-in hybrids show both fuel and EV battery.
- Controls only appear when the integration can actually perform them. "Horn" is now "Horn + Lights", since the API has no horn-only command.
- Vehicle Status only reads "Driving" when a road speed proves it; otherwise "Remote Start" (where reported) or "Engine On".
- The card now redraws only when one of its own entities changes.
- The weather badge is hidden on Kia USA unless `car_weather` is on, because Kia returns the same weather there regardless of conditions.

### Fixed
- Flash Lights no longer sounds the horn.
- The valet toggle now sends a real command in regions that support it.

## [2.12.0] - 2026-11-05

### Added
- Vehicle picker in the card editor. Choose your car and the card finds its entities, even if they were renamed.
- 12V warning level, link status and roadside assistance rows (shown as raw values).
- Outside temperature, set temperature and EV range.
- Tire pressure readings, plus high-beam and bi-function headlamp faults.

### Changed
- Sensors that are missing or unavailable are now hidden. The card no longer shows "Unlocked", "All Closed", "All Good" or "All OK" without data to back them up.
- Controls only appear when they can work on your install.
- `device_id` is filled in automatically, and `vehicle_id` is now optional.
- The location shows an address, a zone name or "View on map" instead of `not_home`.

### Fixed
- Lamp fault and oil warnings on current `kia_uvo` installs, where those entities have new names.
- EV range never appearing.
- The card staying blank when no vehicle was configured.
- The editor losing focus while typing.

## [2.11.0] - 2026-01-12
- Added a collapsible "More" menu with Find My Car, horn and flash-lights actions.

## [2.10.1] - 2026-01-12
- Slowed the "Running" and "Climate Active" pulse to 4 seconds for a subtler effect.

## [2.10.0] - 2026-01-12
- Added animated status indicators: blinking hazard lights, a pulsing "Running" badge, a pulsing "Climate Active" row, and an EV charging animation.

## [2.9.3] - 2026-01-12
- Neutral seat-level dropdown labels (Low/Medium/High), since seats both heat and cool.

## [2.9.2] - 2026-01-12
- Neutral language throughout the climate accessory options.

## [2.9.0] - 2026-01-12
- Configurable Warm-preset accessories, with checkboxes and levels in the visual editor (2.9.0–2.9.1).

## [2.8.2] - 2026-01-12
- Read the steering-wheel, side-mirror and rear-window heaters from the raw API data instead of binary sensors.

## [2.8.1] - 2026-01-12
- Show seat heat/cool icons only when a seat is actually active (both level and type non-zero).

## [2.8.0] - 2026-01-12
- Show the "Climate Active" row only when the air conditioner or defrost is actually running.

## [2.7.0] - 2026-01-09

### Added
- Real-time speed indicator when driving.
- Service countdown with a colour-coded progress bar.
- Additional sensors: tail lamp fault, stop lamp fault, hazard lights, 12V battery warning level, link status and roadside assistance status.

### Changed
- Service chip rewritten for the enhanced display.

## [2.6.0] - 2026-01

### Added
- Comprehensive redesign: climate panel with presets, weather badge, heading compass, lamp-fault monitoring, tire-pressure accordion, valet toggle and Google Maps location.

## [2.5.0] - 2026-01

### Added
- Initial release: basic vehicle monitoring, door/window status, battery and fuel levels, and simple controls.

[2.13.0]: https://github.com/auadix/ha-kia-card/releases/tag/v2.13.0
[2.12.0]: https://github.com/auadix/ha-kia-card/releases/tag/v2.12.0
[2.11.0]: https://github.com/auadix/ha-kia-card/releases/tag/v2.11.0
[2.10.1]: https://github.com/auadix/ha-kia-card/releases/tag/v2.10.1
[2.10.0]: https://github.com/auadix/ha-kia-card/releases/tag/v2.10.0
[2.9.3]: https://github.com/auadix/ha-kia-card/releases/tag/v2.9.3
[2.9.2]: https://github.com/auadix/ha-kia-card/releases/tag/v2.9.2
[2.9.0]: https://github.com/auadix/ha-kia-card/releases/tag/v2.9.0
[2.8.2]: https://github.com/auadix/ha-kia-card/releases/tag/v2.8.2
[2.8.1]: https://github.com/auadix/ha-kia-card/releases/tag/v2.8.1
[2.8.0]: https://github.com/auadix/ha-kia-card/releases/tag/v2.8.0
[2.7.0]: https://github.com/auadix/ha-kia-card/releases/tag/v2.7.0
[2.6.0]: https://github.com/auadix/ha-kia-card/releases/tag/v2.6.0
[2.5.0]: https://github.com/auadix/ha-kia-card/releases/tag/v2.5.0

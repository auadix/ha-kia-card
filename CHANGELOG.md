# Changelog

All notable changes to this card are listed here, newest first.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

Planned as 2.13.0. Available for testing as the `v2.13.0-beta` pre-releases.

### Added
- Drive mode and gear while the ignition is on, on integrations that report them (not Kia USA).
- Average fuel economy.
- A 12V battery fault warning.
- Charging power and time to full while an EV is charging.
- Tire pressure readings on Kia USA, read from the vehicle data the integration already provides.
- Optional weather at the car's location, from Open-Meteo. Turn it on in the card's editor. Off by default because it shares the car's approximate location.
- A second tap to confirm unlocking. Locking still takes one tap.
- Seat heater sensors now feed the "Climate Active" row on vehicles that don't send the detailed climate data.
- Kia's picture of your exact model, trim and colour, when no image URL is set and the integration provides one (Kia USA). If it fails to load, the card draws its diagram instead.
- Screenshots in the README, including the card editor.

### Changed
- Distances use each sensor's own unit, and the service colours still work in kilometres.
- Climate temperatures use your region's unit (°F in the USA, °C elsewhere). Values saved in the wrong unit by older versions are converted.
- Full EVs lead with battery and range, and can stop climate without an engine running. Plug-in hybrids show both fuel and EV battery.
- Vehicle status reads "Driving" only when a road speed proves it. Otherwise it shows "Remote Start" or "Engine On".
- Controls only appear when the integration can perform them. On Kia USA, Find My Car, Flash Lights and the valet toggle are hidden because those commands aren't available.
- "Horn" is now "Horn + Lights", since there's no horn-only command.
- The card only redraws when its own entities change, and "Updated … ago" refreshes on its own.
- The weather badge is hidden on Kia USA unless weather at the car's location is turned on, because Kia reports the same weather there regardless of conditions.
- Temperatures are written the way Home Assistant writes them, with a space before the unit (68 °F).
- Rewrote the documentation. Setup is described through the card's editor.

### Fixed
- Checkboxes in the card editor sat on their own line, away from their labels.
- Flash Lights no longer sounds the horn.
- The valet toggle now sends a real command where the integration supports it.

### Removed
- The `theme` option, which never had any effect. The card has always been dark.

## [2.12.0] - 2026-11-05

### Added
- A vehicle picker in the card editor. Choose your car and the card finds its entities, even if they were renamed.
- 12V warning level, link status and roadside assistance rows, shown as raw values.
- Outside temperature, set temperature and EV range.
- Tire pressure readings, plus high-beam and bi-function headlamp faults.

### Changed
- Missing or unavailable sensors are now hidden. The card no longer shows "Unlocked", "All Closed", "All Good" or "All OK" without data to back them up.
- Controls only appear when they can work on your install.
- `device_id` is filled in automatically, and `vehicle_id` is now optional.
- The location shows an address, a zone name or "View on map" instead of `not_home`.

### Fixed
- Lamp fault and oil warnings on current `kia_uvo` installs, where those entities have new names.
- EV range never appearing.
- The card staying blank when no vehicle was configured.
- The editor losing focus while typing.

## [2.11.0] - 2026-01-11

### Added
- A "More" menu with Find My Car, Horn and Flash Lights quick actions.

## [2.10.1] - 2026-01-11

### Changed
- Slowed the "Running" badge and "Climate Active" pulse to 4 seconds.

## [2.10.0] - 2026-01-11

### Added
- Animated status: blinking hazard lights, a pulsing "Running" badge and "Climate Active" row, and a charging animation for EV batteries.

## [2.9.3] - 2026-01-11

### Changed
- Seat level options now read Low, Medium and High, since seats can heat or cool.

## [2.9.2] - 2026-01-11

### Changed
- Neutral wording for climate accessories, which can heat or cool.

## [2.9.1] - 2026-01-11

### Added
- Card editor controls for the Warm preset's seats and steering wheel.

## [2.9.0] - 2026-01-11

### Added
- Configurable Warm preset accessories: steering wheel, each seat, and their levels.

## [2.8.2] - 2026-01-11

### Changed
- The heated steering wheel, mirrors and rear window are read from the vehicle's own climate data.

## [2.8.1] - 2026-01-11

### Fixed
- Seat icons only show when a seat is actually heating or cooling.

## [2.8.0] - 2026-01-11

### Fixed
- The "Climate Active" row only shows while climate or defrost is running.

## [2.7.0] - 2026-01-10

First release in this repository.

### Added
- Speed while driving.
- A colour-coded service countdown.
- Tail lamp, stop lamp and hazard light status, plus 12V warning level, roadside assistance and link status.

## Earlier versions

Versions 2.5.0 and 2.6.0 came before this repository and were never tagged. 2.6.0 introduced the climate presets, weather badge, heading compass, lamp faults, tire pressure panel, valet mode and map link. 2.5.0 was the first version, with basic monitoring and controls.

[Unreleased]: https://github.com/auadix/ha-kia-card/compare/v2.12.0...HEAD
[2.12.0]: https://github.com/auadix/ha-kia-card/releases/tag/v2.12.0
[2.11.0]: https://github.com/auadix/ha-kia-card/releases/tag/v2.11.0
[2.10.1]: https://github.com/auadix/ha-kia-card/releases/tag/v2.10.1
[2.10.0]: https://github.com/auadix/ha-kia-card/releases/tag/v2.10.0
[2.9.3]: https://github.com/auadix/ha-kia-card/releases/tag/v2.9.3
[2.9.2]: https://github.com/auadix/ha-kia-card/releases/tag/v2.9.2
[2.9.1]: https://github.com/auadix/ha-kia-card/releases/tag/v2.9.1
[2.9.0]: https://github.com/auadix/ha-kia-card/releases/tag/v2.9.0
[2.8.2]: https://github.com/auadix/ha-kia-card/releases/tag/v2.8.2
[2.8.1]: https://github.com/auadix/ha-kia-card/releases/tag/v2.8.1
[2.8.0]: https://github.com/auadix/ha-kia-card/releases/tag/v2.8.0
[2.7.0]: https://github.com/auadix/ha-kia-card/releases/tag/v2.7.0

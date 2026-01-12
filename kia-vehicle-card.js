/**
 * Kia Vehicle Card for Home Assistant
 * A modern, comprehensive card for Kia/Hyundai vehicles
 * Version: 2.8.1
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
      theme: 'dark',
      device_id: '',
      // Climate presets
      cool_temp: 68,
      warm_temp: 80,
      custom_temp: 72,
      duration: 10
    };
    this._climateMode = null;
    this._showClimatePanel = false;
    this._showHealthDetails = false;
    this._showTirePressure = false;
  }

  setConfig(config) {
    if (!config || typeof config !== 'object') return;
    this._config = { ...this._config, ...config };
  }

  get config() {
    return this._config;
  }

  set hass(hass) {
    this._hass = hass;
    if (this._config.vehicle_id) {
      this.render();
    }
  }

  getState(entityId) {
    if (!this._hass?.states) return 'unavailable';
    const entity = this._hass.states[entityId];
    return entity ? entity.state : 'unavailable';
  }

  getAttr(entityId, attr) {
    if (!this._hass?.states) return null;
    const entity = this._hass.states[entityId];
    return entity?.attributes?.[attr] ?? null;
  }

  formatNumber(num) {
    if (num === 'unavailable' || num === null || num === undefined || num === '—') return '—';
    const n = parseFloat(num);
    return isNaN(n) ? '—' : n.toLocaleString();
  }

  callService(domain, service, data) {
    if (this._hass) {
      this._hass.callService(domain, service, data);
    }
  }

  render() {
    if (!this._hass || !this._config?.vehicle_id) {
      this.shadowRoot.innerHTML = `
        <ha-card>
          <div style="padding: 24px; text-align: center; color: var(--secondary-text-color);">
            Please configure <code>vehicle_id</code> in the card editor.
          </div>
        </ha-card>
      `;
      return;
    }

    const vid = this._config.vehicle_id;
    const getVal = (s) => (s && s !== 'unavailable' && s !== '--' && s !== 'unknown') ? s : '—';
    const getNum = (s) => { const n = parseFloat(s); return isNaN(n) ? 0 : n; };
    const getBool = (entityId) => this.getState(entityId) === 'on';

    // Gather data
    const data = {
      // Main stats
      range: getVal(this.getState(`sensor.${vid}_fuel_driving_range`) || this.getState(`sensor.${vid}_ev_driving_range`)),
      fuel: getVal(this.getState(`sensor.${vid}_fuel_level`)),
      battery: getVal(this.getState(`sensor.${vid}_car_battery_level`)),
      evBattery: getVal(this.getState(`sensor.${vid}_ev_battery_level`)),
      odometer: getVal(this.getState(`sensor.${vid}_odometer`)),

      // Status - use lock entity directly (most reliable)
      locked: this.getState(`lock.${vid}_door_lock`) === 'locked',
      engine: getBool(`binary_sensor.${vid}_engine`),
      airCon: getBool(`binary_sensor.${vid}_air_conditioner`),
      defrost: getBool(`binary_sensor.${vid}_defrost`),
      charging: getBool(`binary_sensor.${vid}_ev_battery_charge`),

      // Vehicle status (Parked/Driving) - from various possible entities
      vehicleStatus: this.getVehicleStatus(vid),

      // Doors
      frontLeftDoor: getBool(`binary_sensor.${vid}_front_left_door`),
      frontRightDoor: getBool(`binary_sensor.${vid}_front_right_door`),
      backLeftDoor: getBool(`binary_sensor.${vid}_back_left_door`),
      backRightDoor: getBool(`binary_sensor.${vid}_back_right_door`),
      trunk: getBool(`binary_sensor.${vid}_trunk`),
      hood: getBool(`binary_sensor.${vid}_hood`),

      // Additional status
      valetMode: getBool(`binary_sensor.${vid}_valet_mode`),
      dtcCount: getVal(this.getState(`sensor.${vid}_dtc_count`)),

      // Tire pressure warnings - use individual sensors
      tirePressureWarning: getBool(`binary_sensor.${vid}_tire_pressure_all`),
      tireFrontLeft: !getBool(`binary_sensor.${vid}_tire_pressure_front_left`),
      tireFrontRight: !getBool(`binary_sensor.${vid}_tire_pressure_front_right`),
      tireRearLeft: !getBool(`binary_sensor.${vid}_tire_pressure_rear_left`),
      tireRearRight: !getBool(`binary_sensor.${vid}_tire_pressure_rear_right`),

      // Location & time
      location: getVal(this.getState(`device_tracker.${vid}_location`) || this.getState(`sensor.${vid}_geocoded_location`) || this.getState(`sensor.${vid}_location`)),
      lastUpdated: getVal(this.getState(`sensor.${vid}_last_updated_at`)),

      // Lat/Long for map link
      latitude: this._hass.states[`device_tracker.${vid}_location`]?.attributes?.latitude,
      longitude: this._hass.states[`device_tracker.${vid}_location`]?.attributes?.longitude,

      // Heading/Direction - try sensor first, then data attribute
      heading: (() => {
        const tryHeading = (id) => {
          const s = this.getState(`sensor.${id}_heading`);
          return (s && s !== 'unavailable' && s !== 'unknown') ? parseFloat(s) : null;
        };

        // Try exact ID match first, then lowercase ID
        const val = tryHeading(vid) ?? tryHeading(vid.toLowerCase());
        if (val !== null && !isNaN(val)) return val;

        // Fallback to data attribute
        const dataHeading = this._hass.states[`sensor.${vid}_data`]?.attributes?.vehicle_data?.lastVehicleInfo?.location?.head;
        return (dataHeading !== undefined && dataHeading !== null) ? parseFloat(dataHeading) : null;
      })(),

      // Weather at vehicle location - read from data sensor attributes
      weatherTemp: (() => {
        const tempSensor = this.getState(`sensor.${vid}_weather_temperature`);
        if (tempSensor && tempSensor !== 'unavailable' && tempSensor !== 'unknown') return tempSensor;
        const outsideTemp = this.getState(`sensor.${vid}_outside_temperature`);
        if (outsideTemp && outsideTemp !== 'unavailable' && outsideTemp !== 'unknown') return outsideTemp;
        // Fallback to data attribute
        const dataTemp = this._hass.states[`sensor.${vid}_data`]?.attributes?.vehicle_data?.lastVehicleInfo?.weather?.outsideTemp?.[1]?.value;
        return (dataTemp && dataTemp !== '--') ? dataTemp : '—';
      })(),
      weatherType: (() => {
        const typeSensor = this.getState(`sensor.${vid}_weather_type`);
        if (typeSensor && typeSensor !== 'unavailable' && typeSensor !== 'unknown') return typeSensor;
        // Fallback to data attribute
        const dataType = this._hass.states[`sensor.${vid}_data`]?.attributes?.vehicle_data?.lastVehicleInfo?.weather?.weatherType;
        return dataType || '—';
      })(),

      // Service info
      nextService: getVal(this.getState(`sensor.${vid}_next_service`) || this.getState(`sensor.${vid}_next_service_distance`)),

      // NEW SENSORS (v2.7.0) - Speed and diagnostic numeric sensors
      speed: getVal(this.getState(`sensor.${vid}_speed`)),
      speedUnit: this.getAttr(`sensor.${vid}_speed`, 'unit_of_measurement') || 'km/h',
      carBatteryWarningLevel: getVal(this.getState(`sensor.${vid}_car_battery_warning_level`)),
      linkStatus: getVal(this.getState(`sensor.${vid}_link_status`)),
      rsaStatus: getVal(this.getState(`sensor.${vid}_roadside_assistance_status`)),

      // Warnings / Alerts - use sensors with fallback to data attributes
      washerFluidWarning: getBool(`binary_sensor.${vid}_washer_fluid_warning`),
      lowFuel: getBool(`binary_sensor.${vid}_fuel_low_level`),
      smartKeyBattery: getBool(`binary_sensor.${vid}_smart_key_battery_warning`),
      // Brake/Engine oil - use sensors if available, fallback to data attributes
      brakeFluidWarning: getBool(`binary_sensor.${vid}_brake_fluid_warning`) ||
        this._hass.states[`sensor.${vid}_data`]?.attributes?.vehicle_data?.lastVehicleInfo?.vehicleStatusRpt?.vehicleStatus?.brakeOilStatus === true,
      engineOilWarning: getBool(`binary_sensor.${vid}_engine_oil_warning`) ||
        this._hass.states[`sensor.${vid}_data`]?.attributes?.vehicle_data?.lastVehicleInfo?.vehicleStatusRpt?.vehicleStatus?.engineOilStatus === true,
      // Lamp faults - all individual sensors
      headlightFault: getBool(`binary_sensor.${vid}_headlight_fault`),
      headlampLeftFault: getBool(`binary_sensor.${vid}_headlamp_left_low_fault`),
      headlampRightFault: getBool(`binary_sensor.${vid}_headlamp_right_low_fault`),
      stopLampLeftFault: getBool(`binary_sensor.${vid}_stop_lamp_left_fault`),
      stopLampRightFault: getBool(`binary_sensor.${vid}_stop_lamp_right_fault`),
      turnSignalLeftFrontFault: getBool(`binary_sensor.${vid}_turn_signal_left_front_fault`),
      turnSignalRightFrontFault: getBool(`binary_sensor.${vid}_turn_signal_right_front_fault`),
      turnSignalLeftRearFault: getBool(`binary_sensor.${vid}_turn_signal_left_rear_fault`),
      turnSignalRightRearFault: getBool(`binary_sensor.${vid}_turn_signal_right_rear_fault`),

      // NEW SENSORS (v2.7.0) - Tail lamp and stop lamp faults
      tailLampFault: getBool(`binary_sensor.${vid}_tail_lamp_fault`),
      stopLampFault: getBool(`binary_sensor.${vid}_stop_lamp_fault`),
      hazardLights: getBool(`binary_sensor.${vid}_hazard_lights`),

      // Windows
      frontLeftWindow: getBool(`binary_sensor.${vid}_front_left_window`),
      frontRightWindow: getBool(`binary_sensor.${vid}_front_right_window`),
      backLeftWindow: getBool(`binary_sensor.${vid}_back_left_window`),
      backRightWindow: getBool(`binary_sensor.${vid}_back_right_window`),
      sunroof: getBool(`binary_sensor.${vid}_sunroof`),

      // EV specific
      evCharging: getBool(`binary_sensor.${vid}_ev_battery_charge`),
      evPluggedIn: getBool(`binary_sensor.${vid}_ev_battery_plug`),
      evRange: getVal(this.getState(`sensor.${vid}_ev_driving_range`)),

      // Climate
      setTemp: getVal(this.getState(`sensor.${vid}_set_temperature`)),

      // Comfort / Heating - read from raw API data (more accurate than binary sensors)
      ...(() => {
        const heatingData = this._hass.states[`sensor.${vid}_data`]?.attributes?.vehicle_data?.lastVehicleInfo?.vehicleStatusRpt?.vehicleStatus?.climate?.heatingAccessory;
        return {
          steeringWheelHeater: heatingData?.steeringWheel > 0,
          sideMirrorHeater: heatingData?.sideMirror > 0,
          rearWindowHeater: heatingData?.rearWindow > 0,
        };
      })(),
      // Seats (from data attribute as they are complex objects)
      seatStatus: (() => {
        const data = this._hass.states[`sensor.${vid}_data`]?.attributes?.vehicle_data?.lastVehicleInfo?.vehicleStatusRpt?.vehicleStatus?.climate?.heatVentSeat;
        if (!data) return null;
        // heatVentType: 0=Off, 1=Heat, 2=Cool/Vent
        // heatVentLevel: 0=Off, 1-3=Level
        return {
          driver: data.driverSeat,
          passenger: data.passengerSeat,
          rearLeft: data.rearLeftSeat,
          rearRight: data.rearRightSeat
        };
      })(),
    };

    const fuelPercent = getNum(data.fuel);
    const batteryPercent = getNum(data.battery);
    const evBatteryPercent = getNum(data.evBattery);
    const anyDoorOpen = data.frontLeftDoor || data.frontRightDoor || data.backLeftDoor || data.backRightDoor || data.trunk || data.hood;
    const anyWindowOpen = data.frontLeftWindow || data.frontRightWindow || data.backLeftWindow || data.backRightWindow || data.sunroof;
    const hasHealthIssue = parseInt(data.dtcCount) > 0;
    const isEV = data.evBattery !== '—' && data.evBattery !== '0';

    // Count open doors/windows for summary
    const openDoors = [data.frontLeftDoor, data.frontRightDoor, data.backLeftDoor, data.backRightDoor, data.trunk, data.hood].filter(Boolean).length;
    const openWindows = [data.frontLeftWindow, data.frontRightWindow, data.backLeftWindow, data.backRightWindow, data.sunroof].filter(Boolean).length;

    // Image handling
    let vehicleImage = this._config.image;
    if (!vehicleImage) {
      const potentialEntities = [`sensor.${vid}_data`, `sensor.${vid}_all_data`];
      for (const entityId of potentialEntities) {
        const attrs = this._hass.states[entityId]?.attributes;
        if (attrs?.vehicle_image) {
          vehicleImage = attrs.vehicle_image;
          break;
        }
      }
    }

    const vehicleImageHtml = vehicleImage
      ? `<img class="vehicle-image" src="${vehicleImage}" alt="Vehicle" />`
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
          <div class="vehicle-name">${this._config.name}</div>
          <div class="status-badge ${data.engine ? 'running' : (data.locked ? 'locked' : 'unlocked')}">
            ${data.engine ? 'Running' : (data.locked ? 'Locked' : 'Unlocked')}
          </div>
        </div>

        <!-- Main Content -->
        <div class="main-content">
          <!-- Stats Column -->
          <div class="stats-column">
            <div class="stats-row">
              <div class="stat-item">
                <div class="stat-label">Fuel</div>
                <div class="stat-value">${data.fuel}<span class="stat-unit">%</span></div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Est. Range</div>
                <div class="stat-value">${this.formatNumber(data.range)}<span class="stat-unit">mi</span></div>
              </div>
            </div>

            <div class="bars-container">
              <div class="bar-group">
                <div class="bar-header">
                  <span>Fuel</span>
                  <span>${data.fuel}%</span>
                </div>
                <div class="progress-track">
                  <div class="progress-fill fuel" style="width: ${fuelPercent}%"></div>
                </div>
              </div>
              <div class="bar-group">
                <div class="bar-header">
                  <span>12V Battery</span>
                  <span>${data.battery}%</span>
                </div>
                <div class="progress-track">
                  <div class="progress-fill battery" style="width: ${batteryPercent}%"></div>
                </div>
              </div>
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
              ${data.weatherType !== '—' ? `
              <div class="weather-badge" title="${data.weatherType}">
                <ha-icon icon="mdi:${this.getWeatherIcon(data.weatherType)}"></ha-icon>
              </div>
              ` : ''}
            </div>
            
            <!-- Vehicle Info Section -->
            <div class="vehicle-info">
              <!-- Odometer -->
              <div class="info-chip">
                <ha-icon icon="mdi:counter"></ha-icon>
                <span>${this.formatNumber(data.odometer)} mi</span>
              </div>

              <!-- Next Service with enhanced visual -->
              ${this.renderServiceChip(data.nextService)}

              <!-- Speed (when driving) -->
              ${data.vehicleStatus === 'Driving' && data.speed !== '—' && parseFloat(data.speed) > 0 ? `
              <div class="info-chip highlight">
                <ha-icon icon="mdi:speedometer"></ha-icon>
                <span>${this.formatNumber(data.speed)} ${data.speedUnit}</span>
              </div>
              ` : ''}

              <!-- Doors Status -->
              <div class="info-chip ${anyDoorOpen ? 'warning' : 'success'}">
                <ha-icon icon="mdi:${anyDoorOpen ? 'car-door' : 'car-door-lock'}"></ha-icon>
                <span>${anyDoorOpen ? `${openDoors} Open` : 'All Closed'}</span>
              </div>
              
              <!-- Windows Status -->
              <div class="info-chip ${anyWindowOpen ? 'warning' : 'success'}">
                <ha-icon icon="mdi:${anyWindowOpen ? 'window-open-variant' : 'window-closed-variant'}"></ha-icon>
                <span>${anyWindowOpen ? `${openWindows} Open` : 'All Closed'}</span>
              </div>
              
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
              <div class="info-chip highlight full-width">
                <ha-icon icon="mdi:hazard-lights"></ha-icon>
                <span>Hazard Lights Active</span>
              </div>
              ` : ''}

              ${isEV ? `
              <!-- EV Battery (for EVs) -->
              <div class="info-chip ${data.evCharging ? 'highlight' : ''} full-width">
                <ha-icon icon="mdi:${data.evCharging ? 'battery-charging' : 'battery'}"></ha-icon>
                <span>EV: ${data.evBattery}% ${data.evCharging ? '⚡ Charging' : ''} ${data.evPluggedIn && !data.evCharging ? '🔌 Plugged In' : ''}</span>
              </div>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Controls Row (4 buttons like v2.0) -->
        ${this._config.show_controls ? `
        <div class="controls-section">
          <div class="controls-grid">
            <div class="control-btn ${data.locked ? '' : 'active'}" id="btn-lock">
              <ha-icon icon="mdi:${data.locked ? 'lock-open' : 'lock'}"></ha-icon>
              <span class="control-label">${data.locked ? 'Unlock' : 'Lock'}</span>
            </div>
            <div class="control-btn ${data.engine ? 'climate-stop' : 'climate-start'}" id="btn-climate">
              <ha-icon icon="mdi:${data.engine ? 'stop-circle-outline' : 'power'}"></ha-icon>
              <span class="control-label">${data.engine ? 'Climate Stop' : 'Climate Start'}</span>
            </div>
            <div class="control-btn" id="btn-horn">
              <ha-icon icon="mdi:bullhorn"></ha-icon>
              <span class="control-label">Horn</span>
            </div>
            <div class="control-btn" id="btn-refresh">
              <ha-icon icon="mdi:refresh"></ha-icon>
              <span class="control-label">Update</span>
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
              <div class="preset-subtitle">${this._config.cool_temp}°F</div>
            </div>
            <div class="climate-preset warm ${this._climateMode === 'warm' ? 'selected' : ''}" id="preset-warm">
              <div class="preset-icon">
                <ha-icon icon="mdi:white-balance-sunny"></ha-icon>
              </div>
              <div class="preset-title">Start Warm</div>
              <div class="preset-subtitle">${this._config.warm_temp}°F + Accessories</div>
            </div>
            <div class="climate-preset custom ${this._climateMode === 'custom' ? 'selected' : ''}" id="preset-custom">
              <div class="preset-icon">
                <ha-icon icon="mdi:tune-variant"></ha-icon>
              </div>
              <div class="preset-title">Start Custom</div>
              <div class="preset-subtitle">${this._config.custom_temp}°F</div>
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
          <div class="status-row">
            <div class="status-row-left">
              <ha-icon icon="mdi:car"></ha-icon>
              <span>Vehicle Status</span>
            </div>
            <div class="status-row-right ${data.vehicleStatus === 'Driving' ? 'driving' : 'parked'}">
              <ha-icon icon="mdi:${data.vehicleStatus === 'Driving' ? 'steering' : 'parking'}"></ha-icon>
              <span>${data.vehicleStatus}</span>
            </div>
          </div>
          
          <!-- Vehicle Health - expandable when issues -->
          <div class="status-row ${hasHealthIssue ? 'clickable' : ''}" id="health-row">
            <div class="status-row-left">
              <ha-icon icon="mdi:car-wrench"></ha-icon>
              <span>Vehicle Health</span>
            </div>
            <div class="status-row-right ${hasHealthIssue ? 'warning' : ''}">
              ${hasHealthIssue
          ? `<span>${data.dtcCount} Issue${parseInt(data.dtcCount) > 1 ? 's' : ''}</span>
                   <ha-icon icon="mdi:chevron-${this._showHealthDetails ? 'up' : 'down'}"></ha-icon>`
          : `<ha-icon icon="mdi:check-circle" style="color: var(--success)"></ha-icon>
                   <span style="color: var(--success)">All Good</span>`
        }
            </div>
          </div>
          ${this._showHealthDetails && hasHealthIssue ? `
          <div class="health-details">
            <div class="health-details-item">
              <ha-icon icon="mdi:alert-circle"></ha-icon>
              <span>${data.dtcCount} Diagnostic Trouble Code(s) detected. Check your vehicle or visit a dealer.</span>
            </div>
          </div>
          ` : ''}
          
          <!-- Tire Pressure Status (Accordion) -->
          <div class="tire-pressure-row">
            <div class="tire-pressure-header" id="tire-pressure-toggle">
              <div class="tire-pressure-title">
                <ha-icon icon="mdi:car-tire-alert"></ha-icon>
                <span>Tire Pressure</span>
              </div>
              <div class="tire-pressure-status ${data.tirePressureWarning ? 'warning' : ''}">
                ${data.tirePressureWarning
          ? `<ha-icon icon="mdi:alert-circle" style="color: var(--warning)"></ha-icon>
                     <span style="color: var(--warning)">Check Tires</span>`
          : `<ha-icon icon="mdi:check-circle" style="color: var(--success)"></ha-icon>
                     <span style="color: var(--success)">All OK</span>`
        }
                <ha-icon icon="mdi:chevron-${this._showTirePressure ? 'up' : 'down'}" style="color: var(--text-secondary); margin-left: 4px;"></ha-icon>
              </div>
            </div>
            ${this._showTirePressure ? `
            <div class="tire-grid">
              <div class="tire ${data.tireFrontLeft ? '' : 'warning'}">
                <div class="tire-icon">
                  <ha-icon icon="mdi:${data.tireFrontLeft ? 'check' : 'alert'}"></ha-icon>
                </div>
                <span class="tire-label"><strong>Front</strong>Left</span>
              </div>
              <div class="tire ${data.tireFrontRight ? '' : 'warning'}">
                <div class="tire-icon">
                  <ha-icon icon="mdi:${data.tireFrontRight ? 'check' : 'alert'}"></ha-icon>
                </div>
                <span class="tire-label"><strong>Front</strong>Right</span>
              </div>
              <div class="tire ${data.tireRearLeft ? '' : 'warning'}">
                <div class="tire-icon">
                  <ha-icon icon="mdi:${data.tireRearLeft ? 'check' : 'alert'}"></ha-icon>
                </div>
                <span class="tire-label"><strong>Rear</strong>Left</span>
              </div>
              <div class="tire ${data.tireRearRight ? '' : 'warning'}">
                <div class="tire-icon">
                  <ha-icon icon="mdi:${data.tireRearRight ? 'check' : 'alert'}"></ha-icon>
                </div>
                <span class="tire-label"><strong>Rear</strong>Right</span>
              </div>
            </div>
            ` : ''}
          </div>
          
          <!-- Comfort Status Row - Only show when climate/defrost is actually running -->
          ${(() => {
            // Helper to check if seat is actually active (both level and type must be non-zero)
            const isSeatActive = (seat) => seat && seat.heatVentLevel > 0 && seat.heatVentType > 0;
            const driverActive = isSeatActive(data.seatStatus?.driver);
            const passengerActive = isSeatActive(data.seatStatus?.passenger);

            // Only show if climate is on AND something is active
            const hasActiveComfort = data.steeringWheelHeater || data.sideMirrorHeater || data.rearWindowHeater || driverActive || passengerActive;
            return (data.airCon || data.defrost) && hasActiveComfort ? `
          <div class="status-row">
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

          <!-- Valet Mode - toggle switch -->
          <div class="status-row">
            <div class="status-row-left">
              <ha-icon icon="mdi:shield-car"></ha-icon>
              <span>Valet Mode</span>
            </div>
            <div class="status-row-right">
              <span style="margin-right: 8px; color: ${data.valetMode ? 'var(--warning)' : 'var(--text-secondary)'}">
                ${data.valetMode ? 'Active' : 'Inactive'}
              </span>
              <div class="toggle-switch ${data.valetMode ? 'active' : ''}" id="valet-toggle"></div>
            </div>
          </div>
        </div>
        ` : ''}

        <!-- Footer with clickable location -->
        <div class="footer">
          <div class="footer-item">
            <ha-icon icon="mdi:clock-outline"></ha-icon>
            <span>Updated ${this.formatTime(data.lastUpdated)}</span>
          </div>
          <div class="footer-item ${data.latitude && data.longitude ? 'clickable' : ''}" id="location-link" 
               ${data.latitude && data.longitude ? `data-lat="${data.latitude}" data-lon="${data.longitude}"` : ''}>
            <ha-icon icon="mdi:map-marker"></ha-icon>
            <span>${data.location}</span>
            ${data.latitude && data.longitude ? '<ha-icon icon="mdi:open-in-new" style="--mdc-icon-size: 14px; margin-left: 4px;"></ha-icon>' : ''}
          </div>
        </div>
      </ha-card>
    `;

    this.addEventListeners();
  }

  getVehicleStatus(vid) {
    // Try multiple possible entity names for vehicle status
    const possibleEntities = [
      `sensor.${vid}_vehicle_status`,
      `binary_sensor.${vid}_engine`,
      `sensor.${vid}_driving_status`,
    ];

    // Check engine first - if running, likely driving
    const engineOn = this.getState(`binary_sensor.${vid}_engine`) === 'on';
    if (engineOn) return 'Driving';

    // Check for explicit status sensor
    const statusSensor = this.getState(`sensor.${vid}_vehicle_status`);
    if (statusSensor && statusSensor !== 'unavailable') {
      return statusSensor;
    }

    // Default to Parked
    return 'Parked';
  }

  renderServiceChip(nextServiceMiles) {
    // Enhanced service countdown with color coding
    // Assumes 8000 mile service intervals (common for Kia/Hyundai)
    const SERVICE_INTERVAL = 8000;

    if (nextServiceMiles === '—' || !nextServiceMiles) {
      return `
        <div class="info-chip">
          <ha-icon icon="mdi:car-wrench"></ha-icon>
          <span>—</span>
        </div>
      `;
    }

    const milesRemaining = parseFloat(nextServiceMiles);
    if (isNaN(milesRemaining)) {
      return `
        <div class="info-chip">
          <ha-icon icon="mdi:car-wrench"></ha-icon>
          <span>—</span>
        </div>
      `;
    }

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
        <span>${this.formatNumber(milesRemaining)} mi</span>
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
    const lockColor = data.locked ? '#10B981' : '#EF4444';
    const doorFL = data.frontLeftDoor ? '#F59E0B' : '#10B981';
    const doorFR = data.frontRightDoor ? '#F59E0B' : '#10B981';
    const doorBL = data.backLeftDoor ? '#F59E0B' : '#10B981';
    const doorBR = data.backRightDoor ? '#F59E0B' : '#10B981';

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

    if (!weatherType || weatherType === '—') return 'thermometer';
    const normalizedType = weatherType.toLowerCase().replace(/[- ]/g, '_');
    return weatherIcons[normalizedType] || 'weather-partly-cloudy';
  }

  formatTime(dateStr) {
    if (!dateStr || dateStr === 'unavailable' || dateStr === '—') return 'Unknown';
    try {
      const date = new Date(dateStr);
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
    const vid = this._config.vehicle_id;

    // Lock toggle button
    this.shadowRoot.getElementById('btn-lock')?.addEventListener('click', () => {
      const lockEntity = `lock.${vid}_door_lock`;
      const isLocked = this.getState(lockEntity) === 'locked';
      this.callService('lock', isLocked ? 'unlock' : 'lock', { entity_id: lockEntity });
    });

    // Climate toggle button - opens panel when off, stops climate when on
    this.shadowRoot.getElementById('btn-climate')?.addEventListener('click', () => {
      const engineOn = this.getState(`binary_sensor.${vid}_engine`) === 'on';

      if (engineOn) {
        // Stop climate
        if (!this._config.device_id) {
          this.showNotification('Please configure device_id');
          return;
        }
        this.callService('kia_uvo', 'stop_climate', { device_id: this._config.device_id });
      } else {
        // Open climate panel
        this._showClimatePanel = !this._showClimatePanel;
        this.render();
      }
    });

    // Horn button
    this.shadowRoot.getElementById('btn-horn')?.addEventListener('click', () => {
      if (!this._config.device_id) {
        this.showNotification('Please configure device_id');
        return;
      }
      this.callService('kia_uvo', 'start_hazard_lights_and_horn', { device_id: this._config.device_id });
    });

    // Refresh button
    this.shadowRoot.getElementById('btn-refresh')?.addEventListener('click', () => {
      if (!this._config.device_id) {
        this.showNotification('Please configure device_id');
        return;
      }
      this.callService('kia_uvo', 'force_update', { device_id: this._config.device_id });
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
      if (!this._config.device_id) {
        this.showNotification('Please configure device_id');
        return;
      }
      if (!this._climateMode) return;

      const temps = {
        cool: this._config.cool_temp,
        warm: this._config.warm_temp,
        custom: this._config.custom_temp
      };

      const climateData = {
        device_id: this._config.device_id,
        climate: true,
        set_temp: temps[this._climateMode],
        duration: this._config.duration,
        defrost: this._climateMode === 'warm',
        heating: this._climateMode === 'warm' ? 1 : 0
      };

      // Add heated accessories for warm start
      if (this._climateMode === 'warm') {
        climateData.steering_wheel = 2;
        climateData.front_left_seat = 6;
        climateData.front_right_seat = 6;
      }

      this.callService('kia_uvo', 'start_climate', climateData);
      this._showClimatePanel = false;
      this._climateMode = null;
      this.render();
    });

    // Health row toggle (expandable when there are issues)
    this.shadowRoot.getElementById('health-row')?.addEventListener('click', () => {
      const dtcCount = parseInt(this.getState(`sensor.${vid}_dtc_count`)) || 0;
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
      // Note: Valet mode toggle may not be supported by all vehicles via API
      // This is a placeholder - actual implementation depends on API support
      this.showNotification('Valet mode toggle is not available via remote command. Please use the vehicle controls.');
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
    if (this._hass) {
      this._hass.callService('persistent_notification', 'create', {
        message: message,
        title: 'Kia Vehicle Card'
      });
    }
  }

  getCardSize() {
    return 7;
  }

  static getConfigElement() {
    return document.createElement('kia-vehicle-card-editor');
  }

  static getStubConfig() {
    return {
      vehicle_id: 'kikia',
      name: 'My Kia',
      theme: 'dark',
      show_controls: true,
      show_status_row: true,
      cool_temp: 68,
      warm_temp: 80,
      custom_temp: 72,
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
    this._config = config || {};
  }

  set hass(hass) {
    this._hass = hass;
    this.render();
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
        <div class="editor-row">
          <label>Vehicle ID *</label>
          <input type="text" id="vehicle_id" value="${this._config.vehicle_id || ''}" placeholder="kikia">
          <small>Entity prefix (e.g., "kikia" from sensor.kikia_fuel_level)</small>
        </div>
        <div class="editor-row">
          <label>Display Name</label>
          <input type="text" id="name" value="${this._config.name || 'My Kia'}">
        </div>
        <div class="editor-row">
          <label>Device ID (required for controls)</label>
          <input type="text" id="device_id" value="${this._config.device_id || ''}" placeholder="abc123...">
          <small>Developer Tools → Services → kia_uvo → Device dropdown</small>
        </div>
        <div class="editor-row">
          <label>Vehicle Image URL</label>
          <input type="text" id="image" value="${this._config.image || ''}" placeholder="https://owners.kia.com/...">
        </div>

        <div class="editor-section">Climate Presets</div>
        <div class="editor-grid">
          <div class="editor-row">
            <label>Cool Temp (°F)</label>
            <input type="number" id="cool_temp" value="${this._config.cool_temp || 68}" min="60" max="80">
          </div>
          <div class="editor-row">
            <label>Warm Temp (°F)</label>
            <input type="number" id="warm_temp" value="${this._config.warm_temp || 80}" min="65" max="85">
          </div>
          <div class="editor-row">
            <label>Custom Temp (°F)</label>
            <input type="number" id="custom_temp" value="${this._config.custom_temp || 72}" min="60" max="85">
          </div>
          <div class="editor-row">
            <label>Duration (min)</label>
            <input type="number" id="duration" value="${this._config.duration || 10}" min="5" max="20">
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
      </div>
    `;

    // Text/number inputs
    ['vehicle_id', 'name', 'device_id', 'image', 'cool_temp', 'warm_temp', 'custom_temp', 'duration'].forEach(field => {
      const el = this.querySelector(`#${field}`);
      if (el) {
        const handler = (e) => {
          let value = e.target.value;
          if (['cool_temp', 'warm_temp', 'custom_temp', 'duration'].includes(field)) {
            value = parseInt(value) || 0;
          }
          this._config = { ...this._config, [field]: value };
          this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
        };
        el.addEventListener('input', handler);
        el.addEventListener('change', handler);
      }
    });

    // Checkbox inputs
    ['show_controls', 'show_status_row'].forEach(field => {
      const el = this.querySelector(`#${field}`);
      if (el) {
        el.addEventListener('change', (e) => {
          this._config = { ...this._config, [field]: e.target.checked };
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

console.info('%c KIA-VEHICLE-CARD %c v2.7.0 ', 'background: #3B82F6; color: white; font-weight: bold; border-radius: 4px 0 0 4px;', 'background: #1f2937; color: white; border-radius: 0 4px 4px 0;');

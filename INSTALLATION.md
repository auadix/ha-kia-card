# Installation Guide

## Method 1: HACS (Recommended)

### Prerequisites
- [HACS](https://hacs.xyz/) installed in Home Assistant
- [Kia UVO / Hyundai Bluelink integration](https://github.com/Hyundai-Kia-Connect/kia_uvo) configured

### Steps

1. **Open HACS**
   - Navigate to HACS in your Home Assistant sidebar
   - Click on "Frontend"

2. **Add Custom Repository**
   - Click the 3 dots menu (⋮) in the top right
   - Select "Custom repositories"
   - Add repository URL: `https://github.com/auadix/ha-kia-card`
   - Select category: "Lovelace"
   - Click "Add"

3. **Install the Card**
   - Search for "Kia Vehicle Card" in HACS
   - Click on it
   - Click "Download"
   - Select the latest version
   - Click "Download" again

4. **Restart Home Assistant**
   - Go to Developer Tools → YAML
   - Click "Restart" (or Settings → System → Restart)

5. **Clear Browser Cache**
   - Hard refresh your browser (Ctrl+F5 or Cmd+Shift+R)

---

## Method 2: Manual Installation

### Steps

1. **Download the File**
   - Go to the [latest release](https://github.com/auadix/ha-kia-card/releases/latest)
   - Download `kia-vehicle-card.js`

2. **Copy to Home Assistant**
   ```bash
   # If using SSH/Terminal
   cp kia-vehicle-card.js /config/www/

   # Or use Samba/File Editor addon to copy to:
   # /config/www/kia-vehicle-card.js
   ```

3. **Add Resource**
   - Go to Settings → Dashboards → Resources (top right menu)
   - Click "+ Add Resource"
   - URL: `/local/kia-vehicle-card.js`
   - Resource type: "JavaScript Module"
   - Click "Create"

4. **Restart Home Assistant**
   - Settings → System → Restart

5. **Clear Browser Cache**
   - Hard refresh (Ctrl+F5 or Cmd+Shift+R)

---

## Verification

After installation, verify the card loaded:

1. Open browser console (F12 → Console)
2. Look for: `KIA-VEHICLE-CARD v2.7.0`
3. Check for any error messages

---

## Configuration

### Find Your Vehicle ID

Your vehicle ID is the prefix used in your entity names.

**Example:**
If you have entities like:
- `sensor.kikia_fuel_level`
- `binary_sensor.kikia_engine`
- `lock.kikia_door_lock`

Your `vehicle_id` is: **kikia**

### Find Your Device ID

1. Go to **Developer Tools** → **Services**
2. Select service: `kia_uvo.start_climate`
3. Click on **Device** dropdown
4. Select your vehicle
5. Switch to **YAML mode** (top right)
6. Copy the `device_id` value (looks like: `abc123def456...`)

### Basic Card Configuration

```yaml
type: custom:kia-vehicle-card
vehicle_id: kikia  # Replace with your vehicle ID
name: 2025 Kia Sorento
device_id: abc123def456  # Replace with your device ID
```

### Full Configuration Example

```yaml
type: custom:kia-vehicle-card
vehicle_id: kikia
name: 2025 Kia Sorento X-LINE SX-Prestige
image: https://owners.kia.com/path/to/your/vehicle/image.png
device_id: abc123def456ghi789
show_controls: true
show_status_row: true
cool_temp: 68
warm_temp: 80
custom_temp: 72
duration: 10
```

---

## Troubleshooting

### Card Doesn't Appear

**Problem:** Card shows as "Custom element doesn't exist: kia-vehicle-card"

**Solutions:**
1. Clear browser cache completely (Ctrl+Shift+Delete)
2. Verify resource is added in Lovelace resources
3. Check browser console for loading errors
4. Restart Home Assistant
5. Try a different browser

### Entities Show "—" or "Unknown"

**Problem:** Sensors display dashes or unknown values

**Solutions:**
1. Verify Kia UVO integration is working
2. Check you have the correct API version (>= 3.54.0)
3. Force update from the integration
4. Wait for next automatic refresh (every 30 min)
5. Check entity names match your vehicle_id

### Controls Don't Work

**Problem:** Lock, climate, horn buttons don't respond

**Solutions:**
1. Verify `device_id` is configured correctly
2. Test controls work from the integration directly
3. Check you're not in valet mode
4. Verify vehicle has active subscription
5. Check Home Assistant logs for errors

### Speed Not Showing

**Problem:** Speed indicator doesn't appear when driving

**Solutions:**
1. Verify `sensor.{vehicle}_speed` entity exists
2. Check vehicle status is "Driving" (engine on)
3. Ensure speed value > 0
4. Update to integration v2.49.0 or later

### Service Countdown Wrong Color

**Problem:** Service chip shows wrong color

**Solutions:**
1. Verify `sensor.{vehicle}_next_service` has correct value
2. Colors are based on miles remaining:
   - Green: > 3,000 mi
   - Yellow: 1,000-3,000 mi
   - Red: < 1,000 mi
3. Progress assumes 8,000 mile intervals

---

## Updating

### Via HACS

1. Go to HACS → Frontend
2. Find "Kia Vehicle Card"
3. Click "Update" if available
4. Clear browser cache
5. Refresh page

### Manual Update

1. Download new `kia-vehicle-card.js`
2. Replace file in `/config/www/`
3. Clear browser cache
4. Refresh page

---

## Need Help?

- **Documentation**: [README](https://github.com/auadix/ha-kia-card#readme)
- **Issues**: [GitHub Issues](https://github.com/auadix/ha-kia-card/issues)
- **Discussions**: [GitHub Discussions](https://github.com/auadix/ha-kia-card/discussions)
- **Integration Support**: [Kia UVO](https://github.com/Hyundai-Kia-Connect/kia_uvo)

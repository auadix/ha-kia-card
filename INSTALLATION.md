# Installing and updating

You need the [Kia UVO / Hyundai Bluelink integration](https://github.com/Hyundai-Kia-Connect/kia_uvo) set up first.

## Install with HACS

1. Open HACS (shown as **Marketplace** in recent Home Assistant versions).
2. Open the three-dot menu and choose **Custom repositories**.
3. Add `https://github.com/auadix/ha-kia-card` with the category **Dashboard**.
4. Find **Kia Vehicle Card** and download it.
5. Hard-refresh your browser (Ctrl/Cmd+Shift+R). A restart isn't needed.

## Install manually

1. Download `kia-vehicle-card.js` from the [latest release](https://github.com/auadix/ha-kia-card/releases/latest).
2. Copy it to `<config>/www/kia-vehicle-card.js`.
3. Under **Settings → Dashboards → Resources**, add `/local/kia-vehicle-card.js` as a **JavaScript module**.
4. Hard-refresh your browser.

## Add the card

Edit a dashboard, add **Kia Vehicle Card**, and pick your vehicle from the **Vehicle** list. See the [README](README.md#configuration) for what each setting does.

## Check that it loaded

Open the browser console (F12). You should see `KIA-VEHICLE-CARD` followed by the version number.

## Update

- **HACS:** open **Kia Vehicle Card**, install the update when it's offered, then hard-refresh your browser.
- **Manual:** replace `<config>/www/kia-vehicle-card.js` with the new file, then hard-refresh.

## Try a beta

Beta versions are published as pre-releases and aren't offered to everyone.

1. In HACS, open **Kia Vehicle Card**, then the three-dot menu, and choose **Redownload**.
2. Turn on beta versions, pick the beta you want, and download it.
3. Hard-refresh your browser.

To go back, redownload the latest regular version the same way.

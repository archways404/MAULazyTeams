<p align="center">
  <img src="https://raw.githubusercontent.com/archways404/MAULazyTeams/master/extension/icons/icon256.png" width="180" />
</p>

<h1 align="center">MAULazyTeams</h1>

**MAULazyTeams** is a lightweight browser extension that simplifies
shift management in MAU Primula.

It automates repetitive steps, fetches your shifts, and makes your
workflow faster --- so you don't have to.

## Demo
[Demo]()

## Features

- Secure authentication with MFA support
- Fetch and display your shifts
- Fast background sync
- Local storage support
- Works with production and local API environments

## Why MAULazyTeams?

Managing shifts manually can be repetitive and time-consuming.

MAULazyTeams automates the boring parts so you can: - Save time - Avoid
mistakes - Stay organized

Built for Malmö University workflows.

## 🔧 Installation (Development)

### Chrome / Edge

1.  Go to `chrome://extensions`
2.  Enable **Developer mode**
3.  Click **Load unpacked**
4.  Select the `dist/` folder

### Firefox

1.  Go to `about:debugging`
2.  Click **This Firefox**
3.  Click **Load Temporary Add-on**
4.  Select `manifest.json` inside `dist/`

## Required Permissions

MAULazyTeams requires:

-   `storage`
-   `tabs`
-   `activeTab`
-   Access to:
    -   `https://mau.hr.evry.se/*`
    -   `https://mlt.k14net.org/*`
    -   `http://localhost/*` (development)

Permissions are used strictly for extension functionality.

## Privacy

-   No tracking
-   No analytics
-   No data collection
-   No external sharing of your information

All data stays in your browser or your configured backend.

## Backend

This extension connects to the MAULazyTeams API backend for
authentication and shift retrieval.

Backend repository: https://github.com/archways404/MAULazyTeams

## Tech Stack

-   Manifest V3
-   Vanilla JS (ES Modules)
-   Service Worker background script
-   Node.js backend
-   Puppeteer (secure token automation)

## 📦 Version

Current Version: 0.0.1

## License

See [LICENSE](LICENSE)

## Credits

Built by [archways404](https://github.com/archways404)

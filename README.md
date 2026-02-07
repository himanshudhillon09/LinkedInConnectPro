# LinkConnect Lite

A bare-minimum Chrome Extension for sending targeted LinkedIn connection requests with daily limits.

## Features
- **Targeting**: Visual MATCH/NO MATCH indicator on profiles based on your Company and Role keywords.
- **Daily Limit**: Enforce a user-defined max invite limit (default 10/day).
- **Smart Notes**: Auto-fill connection requests with a personalized message template using the user's name, company, and role.
- **Manual Control**: It doesn't send automatically. It sets everything up for you to click "Send", keeping you in control.

## Installation
1. Download this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable "Developer mode" (top right).
4. Click "Load unpacked" and select the folder containing these files.

## Usage
1. Click the extension icon to configure:
   - Set **Company Keywords** (e.g., "Google, Microsoft") and **Role Keywords** (e.g., "Recruiter, HR").
   - Set **Daily Limit**.
   - specific **Note Template**.
2. Visit any LinkedIn Profile (e.g., `https://www.linkedin.com/in/some-user`).
3. You will see a widget on the right.
4. If "MATCH", click **"Start Connect"**.
   - The extension will click "Connect" (or "More -> Connect").
   - If enabled, it will open the note dialog and fill it.
5. Review the note and click "Send".
6. Click **"Mark Sent"** on the widget to increment your daily count.

## Files
- `manifest.json`: Extension configuration.
- `popup.html/.js/.css`: Settings UI.
- `content.js/.css`: The main logic injected into LinkedIn pages.
- `background.js`: Handles initialization and date checking.

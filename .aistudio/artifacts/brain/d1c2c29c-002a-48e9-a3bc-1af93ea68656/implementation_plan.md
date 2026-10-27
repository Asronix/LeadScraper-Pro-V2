# Implementation Plan: Google Sheets Auto-Sync, Bulk Follow-Up, Sequencer & Extension Parity

LeadScrape Pro has been updated with full feature parity across both the Web Application Dashboard and the Downloaded Chrome Extension (`leadscrape-pro-extension.zip`):

1. **Google Sheets Live Auto-Sync & Hub**:
   - OAuth integration with `spreadsheets` and `drive.file` scopes.
   - Automatic background push to Google Sheets whenever new leads are scraped or saved.
   - Live mirror banner with direct link to open the spreadsheet and manual push controls.
   - Dedicated "Auto-Sync Hub" modal (`SyncCenterModal.tsx`) visualizing the 3-layer sync architecture.
2. **Bulk Selection & Actions Toolbar**:
   - Multi-row selection checkboxes with indeterminate master checkbox.
   - Filtered selection shortcuts: "Select all", "Uncontacted only", "Outreached only", and "Deselect".
   - Bulk actions: "⚡ Bulk Quick Follow-up", "⚡ Bulk Sequencer", "✓ Mark Outreached", and "🗑️ Bulk Delete".
   - Bulk delete confirmation modal preventing accidental deletions.
3. **Compound Quick Follow-up Button**:
   - Outreached leads display an amber compound button: "⚡ Quick Follow-up ↗" (opens Gmail with the follow-up template in a new tab) alongside a preview/edit "✏️" button.
   - Uncontacted leads display a red "✉️ Gmail ↗" button that opens Gmail and automatically marks the lead as outreached.
4. **3-Tab Outreach & CRM Settings**:
   - **Tab 1: Initial Pitch**: Configure Jerry's collaboration pitch subject, body, and personalization tags (`[Site Name]`, `{{website}}`, `{{url}}`, `{{domain}}`).
   - **Tab 2: Quick Follow-up**: Configure follow-up pitch subject, body, and default delay in days (e.g., 4 days).
   - **Tab 3: Google Sheets Sync**: Configure Google Sheet URL / ID, tab name, and toggle auto-sync.
5. **100% Chrome Extension Generator (`src/utils/extensionGenerator.ts`) Parity**:
   - `dashboard.html`, `dashboard.js`, and `dashboard.css` bundled in the `.zip` contain the complete updated UI, Google Sheets sync banner, bulk action toolbar, compound follow-up button, sequencer, and 3-tab settings modal.
   - `content.js` includes a real-time `window.postMessage` bridge that synchronizes leads between the Chrome extension and the web dashboard.

---

## Verification
- `npm run lint` (`tsc --noEmit`): PASSED (0 errors).
- `npm run build` (`compile_applet`): PASSED.
- Extension generation test via `getExtensionSourceFiles()`: All components, scripts, styles, and modals verified.


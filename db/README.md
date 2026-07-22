# Google Sheets Database Setup

Diese Anwendung kann Auszahlungen in Google Sheets speichern.

## Zielstruktur in Google Sheets

Die Apps-Script-Datei legt automatisch folgende Tabellenblaetter an:

- Infanterie
- Human Resource
- Military Police
- Special Force
- Air Force
- General

## Setup

1. Erstelle ein neues Google Sheet.
2. Oeffne `Erweiterungen -> Apps Script`.
3. Ersetze den Inhalt mit [googleAppsScript.gs](googleAppsScript.gs).
4. Speichern und als Web-App deployen:
   - `Deploy -> New deployment`
   - Typ: `Web app`
   - Execute as: `Me`
   - Who has access: `Anyone`
5. Kopiere die Web-App-URL.
6. Trage die URL in [googleSheetsConfig.js](googleSheetsConfig.js) ein:
   - `enabled: true`
   - `endpoint: 'DEINE_WEB_APP_URL'`

## Hinweise

- Bei jedem Erstellen/Statuswechsel/Loeschen wird das jeweilige Abteilungsblatt synchronisiert.
- Der General-Bereich bekommt Protokolleintraege in das Blatt `General`.
- Der bisherige Local-State bleibt als Fallback aktiv, falls die API nicht erreichbar ist.

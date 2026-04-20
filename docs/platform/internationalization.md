# Internationalization

Command Center now uses `i18next` with `react-i18next` for runtime translations in the React shell.

## Why this choice

For a plain React app, `react-i18next` is the practical default:

- it connects `i18next` to React cleanly
- it exposes `useTranslation()` inside components
- it lets the UI switch locales with `i18n.changeLanguage(...)`
- it keeps translation resources and language state outside component logic

## Current implementation

The app initializes i18n in:

```text
src/i18n/index.ts
```

Supported languages:

- English
- Spanish
- German
- French
- Italian

English is the default fallback language.

The active language is persisted in local storage so the selected locale survives page reloads.

## User-facing behavior

- the user settings modal includes a language selector
- switching the selector calls `i18n.changeLanguage(...)`
- the shell settings, user menus, search surface, and navigation labels react to the active locale

## Notes

- This repo currently translates the shell and settings surfaces first, not every feature page.
- If the project later needs richer ICU-style formatting for dates, plurals, and messages, that can be layered on top of the existing `i18next` foundation.

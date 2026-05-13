# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start Expo dev server (prompts for platform choice)
npm start

# Start on specific platform
npm run android
npm run ios
npm run web
```

No lint or test scripts are configured. There is no ESLint, Babel config, or test infrastructure.

To type-check:
```bash
npx tsc --noEmit
```

## Architecture

### Routing (Expo Router v6)
File-based routing under `app/`. Two route groups:
- `(auth)/` — unauthenticated screens (login, register); accessible without a Firebase user
- `(app)/` — authenticated screens gated by `app/_layout.tsx` which redirects to login when `authStore.initialized && !authStore.user`

The root `app/_layout.tsx` bootstraps everything: loads settings from AsyncStorage, initializes auth, sets up React Native Paper theme, and manages the splash screen.

### State Management (Zustand v5)
Three stores with distinct responsibilities:
- `store/authStore.ts` — Firebase user + UserProfile; handles email/Google/Apple auth flows
- `store/loansStore.ts` — Real-time loans and payments via Firestore subscriptions; call `subscribe(userId)` on login and `unsubscribe()` on logout. Computes `DashboardStats` on every update.
- `store/settingsStore.ts` — Language/theme/overdueAlertDays persisted to AsyncStorage under key `lendtrack_settings`

### Business Logic (lib/)
All interest calculations are pure functions in `lib/calculations.ts`. Key concepts:
- Interest is monthly by default; `cycleType` can be 'monthly' or 'annually'
- `compoundEnabled` flag: when true, deferred interest adds to principal next month; when false, it accumulates as pending without affecting principal
- `getLoanMonthStatus()` returns badge states: `paid | deferred | pending | overdue`
- `computeDashboardStats()` aggregates portfolio KPIs from loans + payments arrays

Firestore operations live in `lib/firestore/` — each file exports CRUD functions and a subscription that returns an `unsubscribe` callback.

### Theming
`constants/Colors.ts` defines two full palettes: dark (earthy greens) and light (blue). `hooks/useTheme.ts` resolves the active palette by combining the stored preference (light/dark/system) with the device color scheme. Components should use `useTheme()` rather than accessing `Colors` directly.

### i18n
`lib/i18n/index.ts` initializes i18next with `en.json` and `ta.json`. Language is stored in `settingsStore` and persisted. Tamil text on Android requires `includeFontPadding: false` (already applied globally in `app/_layout.tsx`).

## Data Model
```
users/{userId}           — UserProfile (language, theme, overdueAlertDays)
loans/{loanId}           — Loan (userId, borrowerName, principal, rate, cycleType, compoundEnabled, status)
payments/{paymentId}     — Payment (loanId, month as 'YYYY-MM', type, status, amount)
```

`loansStore` filters payments client-side to only those belonging to active loans. Month keys are always `'YYYY-MM'` strings — use `toMonthKey()` / `currentMonthKey()` from `lib/calculations.ts`.

## Path Aliases
`@/*` maps to the repo root (configured in `tsconfig.json`). Use `@/lib/...`, `@/store/...`, etc. for imports.

## Firebase
Config is in `lib/firebase.ts`. Firestore uses memory-based local cache (`persistentLocalCache` with `memoryLocalCache`). Auth state is persisted via AsyncStorage through `getReactNativePersistence`.

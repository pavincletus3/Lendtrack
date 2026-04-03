# LendTrack 💰

A personal private lending management mobile app built with React Native + Expo. Helps track loans, monthly interest payments, principal repayments, and lending portfolio stats — with Tamil/English language support and dark/light mode.

## Screenshots

| Login | Dashboard | Add Loan |
|-------|-----------|----------|
| ![Login](screenshots/WhatsApp%20Image%202026-04-03%20at%2010.23.32%20PM.jpeg) | ![Dashboard](screenshots/WhatsApp%20Image%202026-04-03%20at%2010.23.31%20PM%20(1).jpeg) | ![Add Loan](screenshots/WhatsApp%20Image%202026-04-03%20at%2010.23.31%20PM.jpeg) |

## Features

- **Dashboard** — Total principal in rotation, all-time interest received, total accrued (incl. deferred), and expected income this month
- **Borrowers** — Add and manage borrowers with principal amount, interest rate, payment cycle, and optional tenure
- **Monthly View** — Timeline of monthly payment statuses: paid (green), pending (amber), deferred (blue), overdue (red)
- **Principal Repayment** — Partial or full repayment; full repayment closes the loan
- **Compound Interest** — Optional: deferred interest accumulates as pending or adds to principal next month
- **Payment Cycles** — Calendar month or anniversary date
- **PDF Export** — Per-borrower statement and monthly summary
- **Notifications** — Local push reminders for upcoming/overdue payments
- **Auth** — Email/password + Google Sign-in via Firebase
- **Bilingual** — English and Tamil (தமிழ்)
- **Theming** — Dark and light mode

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native + Expo (SDK 54, managed workflow) |
| Routing | Expo Router v3 (file-based) |
| Backend | Firebase (Firestore + Auth) |
| State | Zustand v5 |
| UI | React Native Paper v5 |
| i18n | react-i18next + i18next |
| Notifications | expo-notifications |
| PDF | expo-print + expo-sharing |
| Date utils | date-fns |

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app on your device, or Android/iOS emulator

### 1. Clone & Install

```bash
git clone https://github.com/your-username/lendtrack.git
cd lendtrack
npm install
```

### 2. Configure Firebase

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a new project
2. Enable **Email/Password** authentication
3. Enable **Firestore Database**
4. Register an Android/iOS app and download the config
5. Open `lib/firebase.ts` and replace the placeholder config:

```ts
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
};
```

6. Set Firestore security rules (example):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    match /loans/{loanId} {
      allow read, write: if request.auth != null &&
        resource.data.userId == request.auth.uid;
      allow create: if request.auth != null;
    }
    match /payments/{paymentId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 3. Run

```bash
npm start
# then press 'a' for Android, 'i' for iOS
```

## Project Structure

```
app/
  _layout.tsx           # Root: auth gate, PaperProvider, i18n init
  (auth)/
    login.tsx
    register.tsx
  (app)/
    _layout.tsx          # Tab navigator (Dashboard, Borrowers, Monthly, Settings)
    dashboard.tsx
    monthly.tsx
    settings.tsx
    borrowers/
      index.tsx          # Borrowers list
      add.tsx            # Add loan form
      [id]/
        index.tsx        # Borrower detail + monthly payment timeline
        repay.tsx        # Principal repayment

lib/
  firebase.ts            # Firebase init (update config here)
  calculations.ts        # Interest math (pure functions)
  firestore/
    loans.ts             # Loan CRUD + real-time subscription
    payments.ts          # Payment CRUD
    users.ts             # User profile CRUD
  notifications.ts       # Local push notification scheduling
  pdf.ts                 # PDF generation
  i18n/
    en.json              # English strings
    ta.json              # Tamil strings

store/
  authStore.ts           # Auth state
  loansStore.ts          # Loans + payments real-time state
  settingsStore.ts       # Language/theme/alert days (persisted)

types/index.ts           # All TypeScript types
constants/Colors.ts      # Full color palette (dark + light)
hooks/useTheme.ts        # Theme hook
```

## Business Logic

- **Deferred + Compound ON** → deferred interest is added to principal the next month
- **Deferred + Compound OFF** → deferred interest accumulates as pending (not added to principal)
- **Partial repayment** → recalculates future interest on reduced principal
- **Full repayment** → marks loan as closed

## License

Private — personal use only.

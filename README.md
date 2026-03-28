# BillSplit

A household bill tracking and splitting app built for families sharing utilities. Track bills, split costs, manage payments (tapal), and review trends from your phone.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.2-06B6D4?logo=tailwindcss&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?logo=firebase&logoColor=black)
![Supabase](https://img.shields.io/badge/Supabase-Storage-3ECF8E?logo=supabase&logoColor=white)

---

## Features

**Bill Management**
- Add monthly bills for VECO (electricity), PLDT (WiFi), and MCWD (water)
- Upload photos of bills as proof via Supabase Storage
- Adjustable split amounts — override the defaults before saving

**Tapal (Pay-on-Behalf) System**
- Record who paid the full bill to the provider
- Enter how much each family actually contributed
- Automatically tracks who owes whom and how much

**Smart Splitting**
- VECO & PLDT: Ocanada pays a fixed amount, remainder split between Bacarisas & Patino
- MCWD: Equal three-way split
- Fully adjustable per bill

**Dashboard & Analytics**
- Monthly overview of all bills and payment status
- Visual charts powered by Recharts
- Outstanding balance tracker across all time

**Optional SMS**
- SMS integration is feature-flagged and disabled by default
- Set `VITE_ENABLE_SMS=true` when you want to re-enable provider integration

**Household Selection**
- Choose your household on launch
- Color-coded family indicators throughout the app

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript |
| Routing | React Router 7 |
| Styling | Tailwind CSS 4 |
| Database | Firebase Firestore |
| File Storage | Supabase Storage |
| Charts | Recharts |
| Icons | Lucide React |
| SMS | Semaphore API (optional, feature-flagged) |
| Build | Vite |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Firebase project with Firestore enabled
- A Supabase project with a **public** storage bucket named `bill-images`

### Setup

```bash
# Clone the repo
git clone https://github.com/eemseybey/BillSplit.git
cd BillSplit

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
```

Fill in your `.env`:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id

VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_ENABLE_SMS=false
```

### Run

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build

```bash
npm run build
npm run preview
```

---

## Project Structure

```
src/
├── components/     # Reusable UI (Layout, BillCard, MonthPicker, StatusBadge)
├── context/        # HouseholdContext for active family state
├── hooks/          # Firestore data hooks
├── lib/            # Firebase, Supabase, SMS, bill calculator, constants
├── pages/          # Dashboard, Bills, Tapal, Analytics, Settings
└── types/          # TypeScript interfaces
```

---

## License

MIT

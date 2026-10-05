# StyleSphere — AI Fashion Social Network & Digital Wardrobe

![StyleSphere](https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=80)

**StyleSphere** is an AI-powered daily fashion recommendation and social networking application. It solves morning decision fatigue by combining a digital capsule wardrobe, weather intelligence, and personal taste factors with an editorial Pinterest/Instagram-style fashion community.

---

## 🌟 Key Features

### 1. Dedicated AI Stylist ("Daily Fit")
- **Multi-Factor Outfit Synthesis**: Generates daily outfit combinations pairing tops, bottoms, shoes, outerwear, and accessories.
- **Compatibility Scoring Matrix**:
  - *Overall Score* (e.g., 98% Match)
  - *Weather Compatibility* (calibrated against local temperature, rain, wind, and humidity)
  - *Style Compatibility* (calibrated to user taste: Minimal, Streetwear, Smart Casual, Quiet Luxury, etc.)
  - *Occasion Compatibility* (Casual Daily, Work & Office, Date Night, Travel, etc.)
- **"Why This Outfit?"**: Transparent AI explanation modal breaking down thermal comfort, capsule rotation, and aesthetic synergy.
- **Interactive Actions**:
  - **Wear This Today**: Confetti celebration + logs wear count directly to garment metadata in local storage.
  - **Try Another**: Cycles alternative algorithmic outfit variations.
  - **Recommendation History**: Tracks and displays past worn outfits.

### 2. Digital Wardrobe Management
- **Capsule Analytics**: Real-time breakdown of Tops, Bottoms, Shoes, Outerwear, Dresses, and Accessories.
- **Categorization & Filters**: Search by garment name, brand, color, season, and style vibe.
- **Add Clothing Modal**:
  - Photo upload or one-click luxury capsule presets (Totême, Lemaire, The Row, Prada, etc.).
  - Detailed metadata (Category, Color, Pattern, Style, Season, Brand, Notes).
  - Immediately updates wardrobe state and user profile metrics.
- **Garment Detail Page (`/wardrobe/:id`)**:
  - Inspect item details, materials, and wear counts.
  - **"Outfits using this item"**: Synthesizes and showcases styled outfits incorporating that specific piece.

### 3. Editorial Social Fashion Feed
- Instagram / Pinterest style outfit cards with double-tap heart animations.
- **Garment Tagging Drawer**: Tap on posts to inspect the exact digital wardrobe items styled by the creator.
- **Local Interactive State**:
  - Like / Unlike toggle with counter animation.
  - Save / Unsave bookmark to personal moodboards.
  - Creator Follow / Unfollow toggles.
  - Comments modal with real-time comment submission.
  - Share modal with native Web Share API, Twitter/X share, and one-click URL copy.

### 4. Fashion Discovery & Explore
- Live search across outfits, tags, and creator usernames.
- Aesthetic filter chips: *Trending, Casual, Streetwear, Work, Party, Travel, Date Night, Minimal, Vintage, Summer*.
- Color and Season filters.
- Verified style curator directory with direct follow buttons.

### 5. Multi-Step Onboarding Wizard
- **Step 1**: Multi-select aesthetic vibes (Minimal, Casual, Streetwear, Formal, Vintage, etc.).
- **Step 2**: Primary wardrobe staples selection.
- **Step 3**: Lifestyle calibration (Professional, Student, Freelancer, Entrepreneur).
- **Step 4**: Initial wardrobe building with one-click capsule presets.
- Finishes with celebratory confetti and saves your tailored style profile.

### 6. Curated Collections & Bookmarks
- Dedicated `/saved` route grouping **All Saved**, **Outfits**, **Clothing**, and **Creators**.
- Folder moodboards (e.g. *Summer Warm Neutrals*, *Studio Workwear*, *Evening Looks*).
- New Collection creation modal.

### 7. User Profiles & Social Graph
- Current user profile with bio, follower stats, and **Recharts Capsule Visualizer** (interactive donut chart of wardrobe distribution).
- Public creator profile route (`/profile/:username`) with dynamic follow toggle and lookbook.

### 8. Settings & Customization
- Account management (Name, Username, Email, Bio, Location).
- Preference tuning (Aesthetic vibes, preferred colors, clothing sizes).
- Notification controls (Likes, Comments, Followers, Morning Daily Fit alerts).
- Theme selector (Warm Cream, Charcoal Dark, System).
- Privacy & account visibility settings.

---

## 🎨 Visual Design System

- **Palette**: Warm editorial neutrals:
  - Cream & Off-White backgrounds (`#FAF7F2`, `#FEFCF9`)
  - Warm cognac & leather accents (`#8C5E37`, `#A8764B`)
  - Soft sand card borders (`#EDE3D5`, `#DFCDB8`)
  - Deep charcoal text (`#181615`, `#121110`)
- **Typography**: Google Fonts pairing *Playfair Display* / *Cormorant Garamond* (editorial serif) and *Plus Jakarta Sans* (modern sans).
- **Mobile-First Layout**:
  - **Desktop**: Left luxury sidebar + center feed + right contextual weather & creators sidebar.
  - **Tablet**: Collapsible navigation + center content.
  - **Mobile**: Top brand bar + floating create action button + bottom navigation bar.

---

## 🛠️ Tech Stack

- **React 18** + **TypeScript**
- **Vite**
- **Tailwind CSS**
- **React Router v6**
- **Lucide React** (icons)
- **Framer Motion** (page and modal transitions)
- **Recharts** (capsule wardrobe analytics)
- **Canvas Confetti** (outfit logging celebrations)

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- npm or yarn

### Installation

```bash
# Navigate to project directory
cd ai-wardrobe

# Install dependencies
npm install

# Start local development server
npm run dev
```

Visit `http://localhost:5173` in your browser.

### Production Build

```bash
npm run build
npm run preview
```

---

## 🗺️ Route Overview

| Route | Description |
|---|---|
| `/` | Editorial landing page with hero, features, and CTA |
| `/login` | Authentication sign-in |
| `/signup` | User registration |
| `/onboarding` | 4-step interactive style profile onboarding |
| `/home` | Main social fashion feed & Daily Fit preview |
| `/daily-fit` | Dedicated AI stylist experience & weather calibration |
| `/explore` | Fashion discovery, category search, and tastemakers |
| `/wardrobe` | Digital capsule wardrobe catalog & analytics |
| `/wardrobe/:id` | Garment detail page & outfits using this piece |
| `/create` | Post publisher with wardrobe piece tagging & preview |
| `/saved` | Saved looks, favorite staples, and collections |
| `/notifications`| Activity center grouped by Today, Yesterday, Earlier |
| `/profile` | Current user profile with Recharts capsule chart |
| `/profile/:username` | Creator public profile with Follow / Unfollow |
| `/settings` | Comprehensive account, preference, and privacy settings |

---

## 🔌 Backend Integration Blueprint (FastAPI + PostgreSQL)

The application includes an abstracted service layer in `src/services/` designed for seamless swap from local state to a REST/GraphQL backend:

- `src/services/recommendation.ts` ➡️ Connects to Python FastAPI endpoint `POST /api/v1/recommendations/daily-fit`
- `src/services/weather.ts` ➡️ Connects to OpenWeatherMap / Weather API via `GET /api/v1/weather?city={city}`
- `src/services/storage.ts` ➡️ Maps to PostgreSQL tables: `users`, `clothing_items`, `outfits`, `posts`, `collections`, `notifications`.

---

© 2026 StyleSphere Inc. Crafted for modern fashion lovers.

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';

// Pages
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Onboarding } from './pages/Onboarding';
import { Home } from './pages/Home';
import { DailyFit } from './pages/DailyFit';
import { Explore } from './pages/Explore';
import { Wardrobe } from './pages/Wardrobe';
import { ClothingDetail } from './pages/ClothingDetail';
import { CreatePost } from './pages/CreatePost';
import { Saved } from './pages/Saved';
import { Notifications } from './pages/Notifications';
import { Profile } from './pages/Profile';
import { UserProfile } from './pages/UserProfile';
import { Settings } from './pages/Settings';

export const App: React.FC = () => {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          {/* Public / Auth routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/onboarding" element={<Onboarding />} />

          {/* Core Application routes */}
          <Route path="/home" element={<Home />} />
          <Route path="/daily-fit" element={<DailyFit />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/wardrobe" element={<Wardrobe />} />
          <Route path="/wardrobe/:id" element={<ClothingDetail />} />
          <Route path="/create" element={<CreatePost />} />
          <Route path="/saved" element={<Saved />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/:username" element={<UserProfile />} />
          <Route path="/settings" element={<Settings />} />

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
};

export default App;


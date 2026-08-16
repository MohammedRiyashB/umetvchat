import React, { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Home from './components/Home';
import Chat from './components/Chat';
import PrivacyPolicy from './components/PrivacyPolicy';
import About from './components/About';
import Blog from './components/Blog';
import Terms from './components/Terms';
import Rules from './components/Rules';
import NotFound from './components/NotFound';

export default function App() {
  const navigate = useNavigate();
  return (
    <Routes>
      <Route path="/" element={
        <Home 
          onStart={() => navigate('/chat')} 
          onNavigate={(page) => {}} 
          currentPage={'home'} 
        />
      } />
      <Route path="/chat" element={<Chat onBack={() => navigate('/')} />} />
      <Route path="/privacypolicy" element={<PrivacyPolicy />} />
      <Route path="/about" element={<About />} />
      <Route path="/blog" element={<Blog />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/rules" element={<Rules />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

import React from 'react';
import { Link } from 'react-router-dom';
import SEO from './SEO';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-slate-50 text-slate-900 p-6">
      <SEO 
        title="Page Not Found - UmeTV" 
        description="The page you are looking for does not exist on UmeTV."
        url="https://umetvchat.web.app/404"
      />
      <h1 className="text-6xl font-black text-sky-500 mb-4">404</h1>
      <h2 className="text-2xl font-bold mb-6 text-center">Oops! Page Not Found</h2>
      <p className="text-slate-600 mb-8 text-center max-w-md">
        We couldn't find the page you were looking for. It might have been removed, renamed, or didn't exist in the first place.
      </p>
      <Link 
        to="/" 
        className="px-8 py-3 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl shadow-md transition-colors"
      >
        Go back to Home
      </Link>
    </div>
  );
}

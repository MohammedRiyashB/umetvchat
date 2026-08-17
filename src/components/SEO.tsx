import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

interface SEOProps {
  title?: string;
  description?: string;
  url?: string;
  image?: string;
}

export default function SEO({
  title = 'UmeTV - Random Video & Text Chat',
  description = 'UmeTV is the premier random video and text chat platform. Connect instantly with strangers worldwide safely and securely.',
  url = 'https://umetvchat.web.app/',
  image = 'https://umetvchat.web.app/icon.png',
}: SEOProps) {
  const location = useLocation();

  // Homepage metadata is provided by Vite's index.html.
  // Prevent React Helmet from creating duplicate homepage metadata.
  if (location.pathname === '/') {
    return null;
  }

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:image" content={image} />
      <link rel="canonical" href={url} />
    </Helmet>
  );
}

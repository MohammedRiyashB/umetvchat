import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  url?: string;
  image?: string;
}

export default function SEO({ 
  title = "UmeTV - Random Video & Text Chat",
  description = "UmeTV is a random video and text chat platform with WebRTC video, real-time messaging and multiplayer games.",
  url = "https://umetvchat.web.app/",
  image = "https://umetvchat.web.app/icon.png"
}: SEOProps) {
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:type" content="website" />
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:title" content={title} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:url" content={url} />
      <meta property="twitter:image" content={image} />
      <link rel="canonical" href={url} />
    </Helmet>
  );
}

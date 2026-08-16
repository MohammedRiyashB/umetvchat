import React, { useEffect, useRef } from 'react';

export default function NativeBannerAd() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const script = document.createElement('script');
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    script.src = 'https://pl30869495.effectivecpmnetwork.com/87106db52e0e59eee0b724e9ae7679fb/invoke.js';
    
    // Append to document head or body to ensure it runs correctly and finds the container by ID.
    document.body.appendChild(script);

    return () => {
      // We don't remove the script or container to prevent breakage on hot reloads, 
      // but the container will be destroyed by React unmount.
    };
  }, []);

  return (
    <div className="w-full flex justify-center items-center overflow-hidden min-h-[90px]">
      <div id="container-87106db52e0e59eee0b724e9ae7679fb"></div>
    </div>
  );
}

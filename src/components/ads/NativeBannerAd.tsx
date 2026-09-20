import React, { useEffect, useRef } from 'react';

export default function NativeBannerAd() {
  const initialized = useRef(false);
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const script = document.createElement('script');
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    script.src = 'https://pl30869495.effectivecpmnetwork.com/87106db52e0e59eee0b724e9ae7679fb/invoke.js';
    
    // Append to document head or body to ensure it runs correctly and finds the container by ID.
    document.body.appendChild(script);
    scriptRef.current = script;

    return () => {
      scriptRef.current?.remove();
      scriptRef.current = null;
      document.getElementById('container-87106db52e0e59eee0b724e9ae7679fb')?.replaceChildren();
      initialized.current = false;
    };
  }, []);

  return (
    <div className="w-full flex justify-center items-center overflow-hidden min-h-[90px]">
      <div id="container-87106db52e0e59eee0b724e9ae7679fb"></div>
    </div>
  );
}

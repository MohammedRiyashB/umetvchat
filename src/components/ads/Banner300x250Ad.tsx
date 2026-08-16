import React, { useEffect, useRef } from 'react';

export default function Banner300x250Ad() {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!containerRef.current || initialized.current) return;
    initialized.current = true;

    // Create configuration script
    const confScript = document.createElement('script');
    confScript.type = 'text/javascript';
    confScript.text = `
      atOptions = {
        'key' : 'e951f6b6e449b473356ba3ae76325cfb',
        'format' : 'iframe',
        'height' : 250,
        'width' : 300,
        'params' : {}
      };
    `;
    
    // Create invoke script
    const invokeScript = document.createElement('script');
    invokeScript.type = 'text/javascript';
    invokeScript.src = 'https://www.highperformanceformat.com/e951f6b6e449b473356ba3ae76325cfb/invoke.js';
    
    containerRef.current.appendChild(confScript);
    containerRef.current.appendChild(invokeScript);

    return () => {
      // Clean up safely
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      initialized.current = false;
    };
  }, []);

  return (
    <div className="flex justify-center items-center w-[300px] h-[250px] mx-auto overflow-hidden">
      <div ref={containerRef} className="w-[300px] h-[250px]"></div>
    </div>
  );
}

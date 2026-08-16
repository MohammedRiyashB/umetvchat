import React, { useEffect, useRef } from 'react';

export default function Banner320x50Ad() {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!containerRef.current || initialized.current) return;
    initialized.current = true;

    const confScript = document.createElement('script');
    confScript.type = 'text/javascript';
    confScript.text = `
      atOptions = {
        'key' : '57b9a41312c9ba7c20e4dc8b2024700b',
        'format' : 'iframe',
        'height' : 50,
        'width' : 320,
        'params' : {}
      };
    `;
    
    const invokeScript = document.createElement('script');
    invokeScript.type = 'text/javascript';
    invokeScript.src = 'https://www.highperformanceformat.com/57b9a41312c9ba7c20e4dc8b2024700b/invoke.js';
    
    containerRef.current.appendChild(confScript);
    containerRef.current.appendChild(invokeScript);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      initialized.current = false;
    };
  }, []);

  return (
    <div className="flex justify-center items-center w-full overflow-hidden min-h-[50px] sm:w-[320px] mx-auto">
      <div ref={containerRef} className="w-[320px] h-[50px]"></div>
    </div>
  );
}

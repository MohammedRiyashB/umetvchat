import { GestureRecognizer, FilesetResolver } from '@mediapipe/tasks-vision';
import React, { useEffect, useRef, useState } from 'react';


export function useHandGesture(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  onSwipe: () => void,
  enabled: boolean
) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [recognizedAction, setRecognizedAction] = useState<string | null>(null);
  
  const recognizerRef = useRef<GestureRecognizer | null>(null);
  const requestRef = useRef<number>(0);
  const lastVideoTimeRef = useRef(-1);
  
  // Tracking state for movement
  const trackingHandRef = useRef<{
    startX: number;
    startY: number;
    startTime: number;
    lastUpdateTime: number;
  } | null>(null);

  const cooldownRef = useRef<number>(0);

  const onSwipeRef = useRef(onSwipe);
  useEffect(() => {
    onSwipeRef.current = onSwipe;
  }, [onSwipe]);

  useEffect(() => {
    let active = true;

    async function init() {
      try {
        const { FilesetResolver, GestureRecognizer } = await import('@mediapipe/tasks-vision');

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );
        
        if (!active) return;

        let recognizer;
        try {
          recognizer = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
              delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 1
          });
        } catch (e) {
          console.warn("GPU delegate failed, falling back to CPU", e);
          recognizer = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
              delegate: "CPU"
            },
            runningMode: "VIDEO",
            numHands: 1
          });
        }
        
        if (!active) return;
        
        recognizerRef.current = recognizer;
        setIsLoaded(true);
      } catch (err) {
        console.error("Error initializing MediaPipe:", err);
      }
    }

    init();

    return () => {
      active = false;
      if (recognizerRef.current) {
        recognizerRef.current.close();
      }
      cancelAnimationFrame(requestRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isLoaded || !videoRef.current || !enabled) {
        setRecognizedAction(null);
        trackingHandRef.current = null;
        return;
    }

    const video = videoRef.current;

    const detect = () => {
      if (video.readyState >= 2 && recognizerRef.current) {
        if (video.currentTime !== lastVideoTimeRef.current) {
          lastVideoTimeRef.current = video.currentTime;
          
          if (Date.now() < cooldownRef.current) {
            if (Date.now() > cooldownRef.current - 1000) {
              setRecognizedAction(null);
            }
          } else {
            try {
              const results = recognizerRef.current.recognizeForVideo(video, Date.now());
              
              if (results.gestures && results.gestures.length > 0 && results.landmarks && results.landmarks.length > 0) {
                const gesture = results.gestures[0][0].categoryName;
                const score = results.gestures[0][0].score;
                
                // Recognize deliberate gesture (ignoring None or low confidence)
                if (gesture !== 'None' && score > 0.5) {
                  const wrist = results.landmarks[0][0]; // wrist landmark
                  const x = wrist.x;
                  const y = wrist.y;
                  
                  if (!trackingHandRef.current) {
                    trackingHandRef.current = {
                      startX: x,
                      startY: y,
                      startTime: Date.now(),
                      lastUpdateTime: Date.now()
                    };
                  } else {
                    const t = trackingHandRef.current;
                    t.lastUpdateTime = Date.now();
                    
                    const dx = x - t.startX;
                    const dy = y - t.startY;
                    const dt = Date.now() - t.startTime;
                    
                    // Deliberate hold/movement
                    if (dt > 150) {
                      // Horizontal swipe LEFT or RIGHT (dx > 0.15)
                      if (Math.abs(dx) > 0.15 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                        setRecognizedAction("👋 NEXT");
                        onSwipeRef.current();
                        cooldownRef.current = Date.now() + 2000;
                        trackingHandRef.current = null;
                      } else if (dt > 1500) {
                        // Reset if held too long
                        trackingHandRef.current = null;
                      }
                    }
                  }
                } else {
                   if (trackingHandRef.current && Date.now() - trackingHandRef.current.lastUpdateTime > 200) {
                     trackingHandRef.current = null;
                   }
                }
              } else {
                if (trackingHandRef.current && Date.now() - trackingHandRef.current.lastUpdateTime > 200) {
                  trackingHandRef.current = null;
                }
              }
            } catch(e) {}
          }
        }
      }
      requestRef.current = requestAnimationFrame(detect);
    };

    requestRef.current = requestAnimationFrame(detect);

    return () => {
      cancelAnimationFrame(requestRef.current);
    };
  }, [isLoaded, videoRef, enabled]);

  return { isLoaded, recognizedAction };
}

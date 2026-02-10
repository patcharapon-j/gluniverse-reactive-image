"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import type { OverlayState } from "@/lib/types";

export default function OverlayPage() {
  const params = useParams<{ slotId: string }>();
  const searchParams = useSearchParams();
  const slotId = params.slotId;

  const width = Number(searchParams.get("w")) || 300;
  const height = Number(searchParams.get("h")) || 400;

  const [state, setState] = useState<OverlayState | null>(null);
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [frontVisible, setFrontVisible] = useState(true);

  const retryDelay = useRef(500);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`/api/events/${slotId}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data: OverlayState = JSON.parse(event.data);
        setState(data);
        retryDelay.current = 500;
      } catch {
        // Ignore parse errors (keepalive comments)
      }
    };

    es.onopen = () => {
      retryDelay.current = 500;
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      const delay = retryDelay.current;
      retryDelay.current = Math.min(retryDelay.current * 2, 5000);
      reconnectTimer.current = setTimeout(connect, delay);
    };
  }, [slotId]);

  useEffect(() => {
    connect();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
    };
  }, [connect]);

  // Handle image crossfade when currentImage changes
  useEffect(() => {
    if (!state?.currentImage) return;

    const newImage = state.currentImage;

    if (!frontImage && !backImage) {
      setFrontImage(newImage);
      setFrontVisible(true);
      return;
    }

    const visibleImage = frontVisible ? frontImage : backImage;
    if (newImage === visibleImage) return;

    if (frontVisible) {
      setBackImage(newImage);
      setFrontVisible(false);
    } else {
      setFrontImage(newImage);
      setFrontVisible(true);
    }
  }, [state?.currentImage]); // eslint-disable-line react-hooks/exhaustive-deps

  const speaking = state?.speaking ?? false;
  const speakingClass = speaking ? "speaking" : "idle";

  return (
    <>
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }

        .overlay-root {
          width: ${width}px;
          height: ${height}px;
          position: relative;
          margin: 0 auto;
        }

        /* Crossfade wrapper controls layer visibility */
        .layer {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          transition: opacity 500ms ease;
        }
        .layer.layer-visible { opacity: 1; }
        .layer.layer-hidden  { opacity: 0; }
        .layer-front { z-index: 2; }
        .layer-back  { z-index: 1; }

        /* Portrait image handles speaking/idle visuals */
        .portrait {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
        }

        .portrait.idle {
          filter: brightness(0.6);
          opacity: 0.7;
          transition: filter 300ms ease, opacity 300ms ease;
          animation: none;
        }

        .portrait.speaking {
          filter: brightness(1.0);
          opacity: 1.0;
          transition: filter 150ms ease, opacity 150ms ease;
          animation: bounce 0.6s ease-in-out infinite;
        }
      `}</style>

      <div className="overlay-root">
        {frontImage && (
          <div className={`layer layer-front ${frontVisible ? "layer-visible" : "layer-hidden"}`}>
            <img
              src={frontImage}
              alt=""
              className={`portrait ${speakingClass}`}
              draggable={false}
            />
          </div>
        )}
        {backImage && (
          <div className={`layer layer-back ${frontVisible ? "layer-hidden" : "layer-visible"}`}>
            <img
              src={backImage}
              alt=""
              className={`portrait ${speakingClass}`}
              draggable={false}
            />
          </div>
        )}
      </div>
    </>
  );
}

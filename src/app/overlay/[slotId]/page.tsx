"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import type { OverlayState, OverlaySettings, AnimationType } from "@/lib/types";
import { DEFAULT_OVERLAY_SETTINGS } from "@/lib/types";

function generateKeyframes(type: AnimationType, intensity: number): string {
  switch (type) {
    case "none":
      return "";
    case "bounce":
      return `@keyframes ov-anim {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-${intensity}px); }
      }`;
    case "pulse":
      return `@keyframes ov-anim {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(${1 + intensity * 0.025}); }
      }`;
    case "shake":
      return `@keyframes ov-anim {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-${intensity}px); }
        75% { transform: translateX(${intensity}px); }
      }`;
    case "float":
      return `@keyframes ov-anim {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-${intensity * 1.5}px); }
      }`;
    case "breathe":
      return `@keyframes ov-anim {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(${1 + intensity * 0.015}); }
      }`;
    case "wiggle":
      return `@keyframes ov-anim {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(-${intensity}deg); }
        75% { transform: rotate(${intensity}deg); }
      }`;
    case "rock":
      return `@keyframes ov-anim {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(-${intensity * 0.5}deg); }
        75% { transform: rotate(${intensity * 0.5}deg); }
      }`;
    case "jello":
      return `@keyframes ov-anim {
        0%, 100% { transform: skewX(0deg) skewY(0deg); }
        30% { transform: skewX(-${intensity}deg) skewY(-${intensity * 0.5}deg); }
        40% { transform: skewX(${intensity * 0.7}deg) skewY(${intensity * 0.35}deg); }
        50% { transform: skewX(-${intensity * 0.4}deg) skewY(-${intensity * 0.2}deg); }
        65% { transform: skewX(${intensity * 0.2}deg) skewY(${intensity * 0.1}deg); }
        75% { transform: skewX(-${intensity * 0.1}deg) skewY(-${intensity * 0.05}deg); }
      }`;
    case "flip":
      return `@keyframes ov-anim {
        0% { transform: perspective(400px) rotateY(0deg); }
        40% { transform: perspective(400px) rotateY(${intensity * 9}deg); }
        60% { transform: perspective(400px) rotateY(${intensity * 9}deg); }
        100% { transform: perspective(400px) rotateY(0deg); }
      }`;
    case "spin":
      return `@keyframes ov-anim {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }`;
    case "rubberband":
      return `@keyframes ov-anim {
        0% { transform: scaleX(1) scaleY(1); }
        30% { transform: scaleX(${1 + intensity * 0.025}) scaleY(${1 - intensity * 0.0125}); }
        40% { transform: scaleX(${1 - intensity * 0.0125}) scaleY(${1 + intensity * 0.0125}); }
        50% { transform: scaleX(${1 + intensity * 0.015}) scaleY(${1 - intensity * 0.0075}); }
        65% { transform: scaleX(${1 - intensity * 0.005}) scaleY(${1 + intensity * 0.0025}); }
        75% { transform: scaleX(${1 + intensity * 0.0025}) scaleY(${1 - intensity * 0.00125}); }
        100% { transform: scaleX(1) scaleY(1); }
      }`;
  }
}

function getClipPath(shape: string): string {
  switch (shape) {
    case "hexagon":
      return "polygon(50% 0%, 93.3% 25%, 93.3% 75%, 50% 100%, 6.7% 75%, 6.7% 25%)";
    case "diamond":
      return "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)";
    default:
      return "none";
  }
}

function getBorderRadius(shape: string, customRadius: number): string {
  switch (shape) {
    case "circle":
      return "50%";
    case "rounded":
      return "12px";
    default:
      return `${customRadius}px`;
  }
}

function getObjectPosition(vAlign: string, hAlign: string): string {
  const h = hAlign === "left" ? "left" : hAlign === "right" ? "right" : "center";
  const v = vAlign === "top" ? "top" : vAlign === "bottom" ? "bottom" : "center";
  return `${h} ${v}`;
}

function buildOverlayCSS(s: OverlaySettings, width: number, height: number): string {
  const clipPath = getClipPath(s.visualStyle.shape);
  const borderRadius = getBorderRadius(s.visualStyle.shape, s.visualStyle.borderRadius);
  const objPos = getObjectPosition(s.size.verticalAlign, s.size.horizontalAlign);
  const animKeyframes = generateKeyframes(s.animation.type, s.animation.intensity);
  const iterCount = s.animation.playMode === "one-shot" ? "1" : "infinite";
  const animRule = s.animation.type !== "none"
    ? `ov-anim ${s.animation.durationMs}ms ${s.animation.easing} ${s.animation.delayMs}ms ${iterCount} ${s.animation.direction}`
    : "none";

  const idleBrightness = s.idle.dim ? s.idle.brightness : 1.0;
  const idleOpacity = s.idle.dim ? s.idle.opacity : 1.0;
  const idleGrayscale = s.idle.dim ? s.idle.grayscale : 0;
  const idleBlur = s.idle.dim ? s.idle.blur : 0;

  const idleFilter = `brightness(${idleBrightness}) grayscale(${idleGrayscale}) blur(${idleBlur}px)`;
  const speakingFilter = `brightness(${s.speaking.brightness})`;

  const crossfadeDuration = s.crossfade.enabled ? s.crossfade.durationMs : 0;

  // Speaking border/glow
  const speakingBorder = s.visualStyle.speakingBorderEnabled
    ? `${s.visualStyle.speakingBorderWidth}px solid ${s.visualStyle.speakingBorderColor}`
    : "none";
  const speakingGlow = s.visualStyle.speakingGlowEnabled
    ? `0 0 ${s.visualStyle.speakingGlowSize}px ${s.visualStyle.speakingGlowColor}`
    : "none";

  // Bloodied effects
  const bld = s.bloodied;
  const bldRedAlpha = bld.redTint * bld.intensity;
  const bldVignetteSize = 40 + bld.vignetteIntensity * 60;
  const bldVignetteAlpha = bld.vignetteIntensity * bld.intensity;
  const bldSaturation = 1 + bld.saturationShift;

  return `
    ${animKeyframes}

    @keyframes bloodied-pulse {
      0%, 100% { opacity: ${bldRedAlpha}; }
      50% { opacity: ${Math.min(bldRedAlpha * 1.5, 1)}; }
    }

    .overlay-root {
      width: ${width}px;
      height: ${height}px;
      padding: ${s.size.padding}px;
      position: relative;
      margin: 0 auto;
      background: ${s.visualStyle.backgroundColor};
    }

    .layer {
      position: absolute;
      top: ${s.size.padding}px;
      left: ${s.size.padding}px;
      right: ${s.size.padding}px;
      bottom: ${s.size.padding}px;
      transition: opacity ${crossfadeDuration}ms ${s.crossfade.easing};
      clip-path: ${clipPath};
      border-radius: ${borderRadius};
      overflow: hidden;
    }
    .layer.layer-visible { opacity: 1; }
    .layer.layer-hidden  { opacity: 0; }
    .layer-front { z-index: 2; }
    .layer-back  { z-index: 1; }

    .portrait {
      width: 100%;
      height: 100%;
      object-fit: ${s.size.objectFit};
      object-position: ${objPos};
      display: block;
    }

    .portrait.idle {
      filter: ${idleFilter};
      opacity: ${idleOpacity};
      scale: ${s.idle.scale};
      transition: filter ${s.idle.transitionMs}ms ease, opacity ${s.idle.transitionMs}ms ease, scale ${s.idle.transitionMs}ms ease;
      animation: none;
    }

    .portrait.speaking {
      filter: ${speakingFilter};
      opacity: ${s.speaking.opacity};
      scale: ${s.speaking.scaleBoost};
      transition: filter ${s.speaking.transitionMs}ms ease, opacity ${s.speaking.transitionMs}ms ease, scale ${s.speaking.transitionMs}ms ease;
      animation: ${animRule};
    }

    .speaking-effects {
      position: absolute;
      top: ${s.size.padding}px;
      left: ${s.size.padding}px;
      right: ${s.size.padding}px;
      bottom: ${s.size.padding}px;
      pointer-events: none;
      z-index: 10;
      clip-path: ${clipPath};
      border-radius: ${borderRadius};
      border: ${speakingBorder};
      box-shadow: ${speakingGlow};
      opacity: 0;
      transition: opacity ${s.speaking.transitionMs}ms ease;
    }
    .speaking-effects.active { opacity: 1; }

    .shadow-wrapper {
      box-shadow: ${s.visualStyle.shadow !== "none" ? s.visualStyle.shadow : "none"};
      clip-path: ${clipPath};
      border-radius: ${borderRadius};
      position: absolute;
      top: ${s.size.padding}px;
      left: ${s.size.padding}px;
      right: ${s.size.padding}px;
      bottom: ${s.size.padding}px;
      pointer-events: none;
      z-index: 0;
    }

    .bloodied-tint {
      position: absolute;
      top: ${s.size.padding}px;
      left: ${s.size.padding}px;
      right: ${s.size.padding}px;
      bottom: ${s.size.padding}px;
      pointer-events: none;
      z-index: 11;
      clip-path: ${clipPath};
      border-radius: ${borderRadius};
      background: rgba(255, 0, 0, ${bldRedAlpha});
      filter: saturate(${bldSaturation});
      opacity: 0;
      transition: opacity 300ms ease;
    }
    .bloodied-tint.active {
      opacity: 1;
      ${bld.pulse ? `animation: bloodied-pulse ${bld.pulseDurationMs}ms ease-in-out infinite;` : ""}
    }

    .bloodied-vignette {
      position: absolute;
      top: ${s.size.padding}px;
      left: ${s.size.padding}px;
      right: ${s.size.padding}px;
      bottom: ${s.size.padding}px;
      pointer-events: none;
      z-index: 12;
      clip-path: ${clipPath};
      border-radius: ${borderRadius};
      box-shadow: inset 0 0 ${bldVignetteSize}px rgba(139, 0, 0, ${bldVignetteAlpha});
      opacity: 0;
      transition: opacity 300ms ease;
    }
    .bloodied-vignette.active { opacity: 1; }
  `;
}

export default function OverlayPage() {
  const params = useParams<{ slotId: string }>();
  const searchParams = useSearchParams();
  const slotId = params.slotId;

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

  const settings: OverlaySettings = state?.overlaySettings ?? DEFAULT_OVERLAY_SETTINGS;

  // Query params override size settings for backward compat
  const width = Number(searchParams.get("w")) || settings.size.width;
  const height = Number(searchParams.get("h")) || settings.size.height;

  const speaking = state?.speaking ?? false;
  const isBloodied = state?.hpState === "bloodied";
  const speakingClass = speaking ? "speaking" : "idle";

  const css = useMemo(() => buildOverlayCSS(settings, width, height), [settings, width, height]);

  const showBloodiedTint = isBloodied && settings.bloodied.redTint > 0;
  const showBloodiedVignette = isBloodied && settings.bloodied.vignette;
  const showSpeakingEffects = settings.visualStyle.speakingBorderEnabled || settings.visualStyle.speakingGlowEnabled;

  return (
    <>
      <style>{css}</style>

      <div className="overlay-root">
        {settings.visualStyle.shadow !== "none" && <div className="shadow-wrapper" />}

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

        {showSpeakingEffects && (
          <div className={`speaking-effects ${speaking ? "active" : ""}`} />
        )}

        {showBloodiedTint && (
          <div className={`bloodied-tint ${isBloodied ? "active" : ""}`} />
        )}
        {showBloodiedVignette && (
          <div className={`bloodied-vignette ${isBloodied ? "active" : ""}`} />
        )}
      </div>
    </>
  );
}

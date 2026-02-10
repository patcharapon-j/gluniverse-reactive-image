"use client";

import { useState } from "react";
import type {
  OverlaySettings,
  DeepPartial,
  AnimationType,
  AnimationDirection,
  AnimationPlayMode,
  OverlayObjectFit,
  VerticalAlign,
  HorizontalAlign,
  OverlayShape,
} from "@/lib/types";
import { resolveOverlaySettings } from "@/lib/types";

interface OverlaySettingsEditorProps {
  settings: DeepPartial<OverlaySettings>;
  onChange: (settings: DeepPartial<OverlaySettings>) => void;
}

const TABS = ["Size", "Idle", "Speaking", "Animation", "Crossfade", "Bloodied", "Visual"] as const;
type Tab = (typeof TABS)[number];

// ===== Inline control helpers =====

function Slider({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span className="text-gray-500">{value}{unit ?? ""}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-indigo-500" />
    </label>
  );
}

function Toggle({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-xs text-gray-400">{label}</span>
      <button type="button" onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition ${checked ? "bg-indigo-500" : "bg-gray-600"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </button>
    </label>
  );
}

function Select<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-gray-400">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}
        className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-gray-100 focus:border-indigo-500 focus:outline-none">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function ColorInput({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-xs text-gray-400">{label}</span>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
        className="h-6 w-8 cursor-pointer rounded border border-gray-700 bg-transparent" />
      <span className="text-xs text-gray-500">{value}</span>
    </label>
  );
}

function TextInput({ label, value, placeholder, onChange }: {
  label: string; value: string; placeholder?: string; onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-gray-400">{label}</span>
      <input type="text" value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-gray-100 placeholder-gray-600 focus:border-indigo-500 focus:outline-none" />
    </label>
  );
}

// ===== Animation type options =====

const ANIMATION_TYPES: { value: AnimationType; label: string }[] = [
  { value: "none", label: "None" },
  { value: "bounce", label: "Bounce" },
  { value: "pulse", label: "Pulse" },
  { value: "shake", label: "Shake" },
  { value: "float", label: "Float" },
  { value: "breathe", label: "Breathe" },
  { value: "wiggle", label: "Wiggle" },
  { value: "rock", label: "Rock" },
  { value: "jello", label: "Jello" },
  { value: "flip", label: "Flip" },
  { value: "spin", label: "Spin" },
  { value: "rubberband", label: "Rubberband" },
];

const ANIM_DIRECTIONS: { value: AnimationDirection; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "reverse", label: "Reverse" },
  { value: "alternate", label: "Alternate" },
  { value: "alternate-reverse", label: "Alt-Reverse" },
];

const ANIM_PLAY_MODES: { value: AnimationPlayMode; label: string }[] = [
  { value: "continuous", label: "Continuous" },
  { value: "one-shot", label: "One-Shot" },
];

const OBJECT_FIT_OPTIONS: { value: OverlayObjectFit; label: string }[] = [
  { value: "contain", label: "Contain" },
  { value: "cover", label: "Cover" },
  { value: "fill", label: "Fill" },
  { value: "none", label: "None" },
  { value: "scale-down", label: "Scale Down" },
];

const V_ALIGN_OPTIONS: { value: VerticalAlign; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "center", label: "Center" },
  { value: "bottom", label: "Bottom" },
];

const H_ALIGN_OPTIONS: { value: HorizontalAlign; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

const SHAPE_OPTIONS: { value: OverlayShape; label: string }[] = [
  { value: "square", label: "Square" },
  { value: "rounded", label: "Rounded" },
  { value: "circle", label: "Circle" },
  { value: "hexagon", label: "Hexagon" },
  { value: "diamond", label: "Diamond" },
];

// ===== Main component =====

export default function OverlaySettingsEditor({ settings, onChange }: OverlaySettingsEditorProps) {
  const [activeTab, setActiveTab] = useState<Tab>("Size");
  const resolved = resolveOverlaySettings(settings);

  function update<K extends keyof OverlaySettings>(
    category: K,
    updates: Partial<OverlaySettings[K]>,
  ) {
    onChange({
      ...settings,
      [category]: { ...((settings[category] as Record<string, unknown>) ?? {}), ...updates },
    });
  }

  return (
    <div>
      {/* Tab bar */}
      <div className="mb-3 flex gap-0.5 overflow-x-auto border-b border-gray-700">
        {TABS.map((tab) => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)}
            className={`whitespace-nowrap px-2.5 py-1.5 text-xs font-medium transition ${
              activeTab === tab
                ? "border-b-2 border-indigo-400 text-indigo-400"
                : "text-gray-500 hover:text-gray-300"
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="space-y-3">
        {activeTab === "Size" && (
          <>
            <Slider label="Width" value={resolved.size.width} min={50} max={1920} step={10} unit="px"
              onChange={(v) => update("size", { width: v })} />
            <Slider label="Height" value={resolved.size.height} min={50} max={1920} step={10} unit="px"
              onChange={(v) => update("size", { height: v })} />
            <Select label="Object Fit" value={resolved.size.objectFit} options={OBJECT_FIT_OPTIONS}
              onChange={(v) => update("size", { objectFit: v })} />
            <Slider label="Padding" value={resolved.size.padding} min={0} max={100} step={1} unit="px"
              onChange={(v) => update("size", { padding: v })} />
            <Select label="Vertical Align" value={resolved.size.verticalAlign} options={V_ALIGN_OPTIONS}
              onChange={(v) => update("size", { verticalAlign: v })} />
            <Select label="Horizontal Align" value={resolved.size.horizontalAlign} options={H_ALIGN_OPTIONS}
              onChange={(v) => update("size", { horizontalAlign: v })} />
          </>
        )}

        {activeTab === "Idle" && (
          <>
            <Toggle label="Dim when idle" checked={resolved.idle.dim}
              onChange={(v) => update("idle", { dim: v })} />
            <Slider label="Brightness" value={resolved.idle.brightness} min={0} max={1} step={0.05}
              onChange={(v) => update("idle", { brightness: v })} />
            <Slider label="Opacity" value={resolved.idle.opacity} min={0} max={1} step={0.05}
              onChange={(v) => update("idle", { opacity: v })} />
            <Slider label="Transition" value={resolved.idle.transitionMs} min={50} max={2000} step={25} unit="ms"
              onChange={(v) => update("idle", { transitionMs: v })} />
            <Slider label="Grayscale" value={resolved.idle.grayscale} min={0} max={1} step={0.05}
              onChange={(v) => update("idle", { grayscale: v })} />
            <Slider label="Scale" value={resolved.idle.scale} min={0.5} max={2} step={0.05}
              onChange={(v) => update("idle", { scale: v })} />
            <Slider label="Blur" value={resolved.idle.blur} min={0} max={20} step={0.5} unit="px"
              onChange={(v) => update("idle", { blur: v })} />
          </>
        )}

        {activeTab === "Speaking" && (
          <>
            <Slider label="Brightness" value={resolved.speaking.brightness} min={0} max={2} step={0.05}
              onChange={(v) => update("speaking", { brightness: v })} />
            <Slider label="Opacity" value={resolved.speaking.opacity} min={0} max={1} step={0.05}
              onChange={(v) => update("speaking", { opacity: v })} />
            <Slider label="Transition" value={resolved.speaking.transitionMs} min={50} max={2000} step={25} unit="ms"
              onChange={(v) => update("speaking", { transitionMs: v })} />
            <Slider label="Scale Boost" value={resolved.speaking.scaleBoost} min={0.5} max={2} step={0.05}
              onChange={(v) => update("speaking", { scaleBoost: v })} />
          </>
        )}

        {activeTab === "Animation" && (
          <>
            <Select label="Type" value={resolved.animation.type} options={ANIMATION_TYPES}
              onChange={(v) => update("animation", { type: v })} />
            <Slider label="Duration" value={resolved.animation.durationMs} min={100} max={5000} step={50} unit="ms"
              onChange={(v) => update("animation", { durationMs: v })} />
            <Slider label="Intensity" value={resolved.animation.intensity} min={1} max={20} step={1}
              onChange={(v) => update("animation", { intensity: v })} />
            <TextInput label="Easing" value={resolved.animation.easing} placeholder="ease-in-out"
              onChange={(v) => update("animation", { easing: v })} />
            <Select label="Direction" value={resolved.animation.direction} options={ANIM_DIRECTIONS}
              onChange={(v) => update("animation", { direction: v })} />
            <Select label="Play Mode" value={resolved.animation.playMode} options={ANIM_PLAY_MODES}
              onChange={(v) => update("animation", { playMode: v })} />
            <Slider label="Delay" value={resolved.animation.delayMs} min={0} max={2000} step={50} unit="ms"
              onChange={(v) => update("animation", { delayMs: v })} />
          </>
        )}

        {activeTab === "Crossfade" && (
          <>
            <Toggle label="Enable crossfade" checked={resolved.crossfade.enabled}
              onChange={(v) => update("crossfade", { enabled: v })} />
            <Slider label="Duration" value={resolved.crossfade.durationMs} min={0} max={2000} step={25} unit="ms"
              onChange={(v) => update("crossfade", { durationMs: v })} />
            <TextInput label="Easing" value={resolved.crossfade.easing} placeholder="ease"
              onChange={(v) => update("crossfade", { easing: v })} />
          </>
        )}

        {activeTab === "Bloodied" && (
          <>
            <Slider label="Red Tint" value={resolved.bloodied.redTint} min={0} max={1} step={0.05}
              onChange={(v) => update("bloodied", { redTint: v })} />
            <Toggle label="Pulse" checked={resolved.bloodied.pulse}
              onChange={(v) => update("bloodied", { pulse: v })} />
            <Slider label="Pulse Duration" value={resolved.bloodied.pulseDurationMs} min={500} max={5000} step={100} unit="ms"
              onChange={(v) => update("bloodied", { pulseDurationMs: v })} />
            <Toggle label="Vignette" checked={resolved.bloodied.vignette}
              onChange={(v) => update("bloodied", { vignette: v })} />
            <Slider label="Vignette Intensity" value={resolved.bloodied.vignetteIntensity} min={0} max={1} step={0.05}
              onChange={(v) => update("bloodied", { vignetteIntensity: v })} />
            <Slider label="Saturation Shift" value={resolved.bloodied.saturationShift} min={-1} max={1} step={0.05}
              onChange={(v) => update("bloodied", { saturationShift: v })} />
            <Slider label="Effect Intensity" value={resolved.bloodied.intensity} min={0} max={1} step={0.05}
              onChange={(v) => update("bloodied", { intensity: v })} />
          </>
        )}

        {activeTab === "Visual" && (
          <>
            <Select label="Shape" value={resolved.visualStyle.shape} options={SHAPE_OPTIONS}
              onChange={(v) => update("visualStyle", { shape: v })} />
            <Slider label="Border Radius" value={resolved.visualStyle.borderRadius} min={0} max={100} step={1} unit="px"
              onChange={(v) => update("visualStyle", { borderRadius: v })} />
            <ColorInput label="Background" value={resolved.visualStyle.backgroundColor === "transparent" ? "#000000" : resolved.visualStyle.backgroundColor}
              onChange={(v) => update("visualStyle", { backgroundColor: v })} />
            <TextInput label="Shadow" value={resolved.visualStyle.shadow} placeholder="none"
              onChange={(v) => update("visualStyle", { shadow: v })} />

            <div className="border-t border-gray-700 pt-2">
              <p className="mb-2 text-xs font-medium text-gray-400">Speaking Border</p>
              <Toggle label="Enable" checked={resolved.visualStyle.speakingBorderEnabled}
                onChange={(v) => update("visualStyle", { speakingBorderEnabled: v })} />
              {resolved.visualStyle.speakingBorderEnabled && (
                <div className="mt-2 space-y-2">
                  <ColorInput label="Color" value={resolved.visualStyle.speakingBorderColor}
                    onChange={(v) => update("visualStyle", { speakingBorderColor: v })} />
                  <Slider label="Width" value={resolved.visualStyle.speakingBorderWidth} min={1} max={10} step={1} unit="px"
                    onChange={(v) => update("visualStyle", { speakingBorderWidth: v })} />
                </div>
              )}
            </div>

            <div className="border-t border-gray-700 pt-2">
              <p className="mb-2 text-xs font-medium text-gray-400">Speaking Glow</p>
              <Toggle label="Enable" checked={resolved.visualStyle.speakingGlowEnabled}
                onChange={(v) => update("visualStyle", { speakingGlowEnabled: v })} />
              {resolved.visualStyle.speakingGlowEnabled && (
                <div className="mt-2 space-y-2">
                  <ColorInput label="Color" value={resolved.visualStyle.speakingGlowColor}
                    onChange={(v) => update("visualStyle", { speakingGlowColor: v })} />
                  <Slider label="Size" value={resolved.visualStyle.speakingGlowSize} min={1} max={50} step={1} unit="px"
                    onChange={(v) => update("visualStyle", { speakingGlowSize: v })} />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

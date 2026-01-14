import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePrivy } from "@privy-io/react-auth";
import { api, UserSettings } from "../lib/api";

const FONT_OPTIONS = [
  { value: "Inter", label: "Inter" },
  { value: "Georgia", label: "Georgia" },
  { value: "Menlo", label: "Menlo (Monospace)" },
  { value: "system-ui", label: "System Default" },
];

const COLOR_OPTIONS = [
  { value: "#a855f7", label: "Purple" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#10b981", label: "Green" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#ef4444", label: "Red" },
  { value: "#ec4899", label: "Pink" },
];

export default function Settings() {
  const navigate = useNavigate();
  const { authenticated } = usePrivy();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authenticated) {
      navigate("/");
      return;
    }
    loadSettings();
  }, [authenticated, navigate]);

  async function loadSettings() {
    try {
      const { user } = await api.getMe();
      if (user.settings) {
        setSettings(user.settings);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!settings) return;

    setSaving(true);
    try {
      await api.updateSettings(settings);
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted">Loading settings...</div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="text-muted">No settings found</div>
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 bg-primary text-white rounded-lg"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-8 pt-20">
      <h1 className="text-2xl font-bold mb-8">Settings</h1>

      <div className="space-y-8">
        {/* Font Family */}
        <div>
          <label className="block text-sm font-medium text-muted mb-2">
            Font Family
          </label>
          <select
            value={settings.fontFamily}
            onChange={(e) =>
              setSettings({ ...settings, fontFamily: e.target.value })
            }
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-fg outline-none focus:border-primary/50"
          >
            {FONT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Font Size */}
        <div>
          <label className="block text-sm font-medium text-muted mb-2">
            Font Size: {settings.fontSize}px
          </label>
          <input
            type="range"
            min="12"
            max="24"
            value={settings.fontSize}
            onChange={(e) =>
              setSettings({ ...settings, fontSize: parseInt(e.target.value) })
            }
            className="w-full accent-primary"
          />
        </div>

        {/* Primary Color */}
        <div>
          <label className="block text-sm font-medium text-muted mb-2">
            Accent Color
          </label>
          <div className="flex gap-3">
            {COLOR_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() =>
                  setSettings({ ...settings, primaryColor: opt.value })
                }
                className={`w-10 h-10 rounded-full transition-transform ${
                  settings.primaryColor === opt.value
                    ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-bg"
                    : ""
                }`}
                style={{ backgroundColor: opt.value }}
                title={opt.label}
              />
            ))}
          </div>
        </div>

        {/* Preview */}
        <div>
          <label className="block text-sm font-medium text-muted mb-2">
            Preview
          </label>
          <div
            className="p-6 rounded-xl border border-white/10"
            style={{
              fontFamily: settings.fontFamily,
              fontSize: `${settings.fontSize}px`,
            }}
          >
            <p className="mb-4">This is how your writing will look.</p>
            <p style={{ color: settings.primaryColor }}>
              And this is your accent color.
            </p>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 bg-white/5 text-fg rounded-xl font-medium hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

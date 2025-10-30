import React, { useEffect, useState } from "react";
import { getSettings, saveSettings, type ExtensionSettings } from "../utils/storage";

export const Popup: React.FC = () => {
  const [settings, setSettings] = useState<ExtensionSettings>({
    autoPreview: true,
    defaultZoom: 1.0,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load settings on mount
    getSettings().then(setSettings);
  }, []);

  const handleToggleAutoPreview = async () => {
    const newSettings = { ...settings, autoPreview: !settings.autoPreview };
    setSettings(newSettings);
    await saveSettings(newSettings);
    showSavedIndicator();
  };

  const handleZoomChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newSettings = { ...settings, defaultZoom: parseFloat(event.target.value) };
    setSettings(newSettings);
    await saveSettings(newSettings);
    showSavedIndicator();
  };

  const showSavedIndicator = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="popup-container">
      <header className="popup-header">
        <h1>Notion Export Preview</h1>
        <p>Settings</p>
      </header>

      <div className="popup-content">
        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={settings.autoPreview}
              onChange={handleToggleAutoPreview}
            />
            <span>Automatically preview PDFs</span>
          </label>
          <p className="setting-description">
            When enabled, PDF exports will open in preview instead of downloading
          </p>
        </div>

        <div className="setting-item">
          <label htmlFor="zoom-select">Default Zoom Level</label>
          <select id="zoom-select" value={settings.defaultZoom} onChange={handleZoomChange}>
            <option value="0.5">50%</option>
            <option value="0.75">75%</option>
            <option value="1.0">100%</option>
            <option value="1.25">125%</option>
            <option value="1.5">150%</option>
            <option value="2.0">200%</option>
          </select>
        </div>

        {saved && <div className="saved-indicator">Settings saved!</div>}
      </div>

      <footer className="popup-footer">
        <p>Version 0.1.0</p>
      </footer>
    </div>
  );
};

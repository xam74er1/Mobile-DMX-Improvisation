import { useRef, useState } from 'react';
import { DMXProvider } from './components/DMXProvider';
import { Visualizer2D } from './components/Visualizer2D';
import { Visualizer3D } from './components/Visualizer3D';
import { VisualizerFullscreen } from './components/VisualizerFullscreen';
import { useDMXStore, type Fixture } from './store/useDMXStore';
import { parseSLSFixtureFile, parseSLSSceneFile, looksLikeSLSFixture, looksLikeSLSScene } from './utils/slsImport';
import { Monitor, Box, Plus, Trash2, Maximize, Upload } from 'lucide-react';

function App() {
  const [mode, setMode] = useState<'2D' | '3D' | 'Fullscreen'>('3D');
  const { connected, fixtures, addFixture, setFixtures, removeFixture, updateFixture } = useDMXStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const handleAddFixture = () => {
    const nextAddress = fixtures.length > 0
      ? Math.max(...fixtures.map(f => f.address)) + 6
      : 1;

    addFixture({
      id: Math.random().toString(),
      name: `Light ${fixtures.length + 1}`,
      address: nextAddress,
      mode: 'RGBWA+UV',
      x: (Math.random() - 0.5) * 10,
      y: (Math.random() - 0.5) * 10,
      z: 5
    });
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file next time
    if (!file) return;
    const text = await file.text();

    if (looksLikeSLSScene(text)) {
      const devices = parseSLSSceneFile(text);
      if (devices.length === 0) { setImportMsg(`No devices found in "${file.name}".`); return; }
      const newFixtures: Fixture[] = devices.map((d, i) => ({
        id: Math.random().toString(36).slice(2, 10),
        name: d.name,
        address: d.address,
        mode: d.mode,
        customOffsets: d.offsets,
        sourceManufacturer: d.manufacturer,
        sourceModel: d.model,
        x: (i - (devices.length - 1) / 2) * 2,
        y: 0,
        z: 5,
        rotX: -Math.PI / 4,
      }));
      setFixtures(newFixtures);
      setImportMsg(`Imported ${newFixtures.length} fixture(s) from "${file.name}" — replaced the fixture list.`);
    } else if (looksLikeSLSFixture(text)) {
      const parsed = parseSLSFixtureFile(text);
      if (!parsed) { setImportMsg(`Could not parse "${file.name}" as an SLS_Fixture file.`); return; }
      const nextAddress = fixtures.length > 0
        ? Math.max(...fixtures.map((f) => f.address)) + (parsed.totalChannels || 6)
        : 1;
      addFixture({
        id: Math.random().toString(36).slice(2, 10),
        name: parsed.model || parsed.manufacturer || file.name.replace(/\.[^.]+$/, ''),
        address: nextAddress,
        mode: parsed.mode,
        customOffsets: parsed.offsets,
        sourceManufacturer: parsed.manufacturer,
        sourceModel: parsed.model,
        x: (Math.random() - 0.5) * 10,
        y: (Math.random() - 0.5) * 10,
        z: 5,
      });
      setImportMsg(`Imported fixture "${parsed.manufacturer} ${parsed.model}".`);
    } else {
      setImportMsg(`"${file.name}" doesn't look like an .SLS_Fixture or .SLS_Scene file.`);
    }
  };

  return (
    <DMXProvider>
      <div className="app-container">
        <header className="header">
          <div className="brand">
            <h1>DMX Visualizer</h1>
            <div className={`status-badge ${connected ? 'connected' : 'disconnected'}`}>
              {connected ? 'Connected' : 'Disconnected'}
            </div>
          </div>
          
          <div className="controls">
            <button 
              className={`mode-btn ${mode === '2D' ? 'active' : ''}`}
              onClick={() => setMode('2D')}
            >
              <Monitor size={18} /> 2D View
            </button>
            <button 
              className={`mode-btn ${mode === '3D' ? 'active' : ''}`}
              onClick={() => setMode('3D')}
            >
              <Box size={18} /> 3D Studio
            </button>
            <button 
              className={`mode-btn ${mode === 'Fullscreen' ? 'active' : ''}`}
              onClick={() => setMode('Fullscreen')}
            >
              <Maximize size={18} /> Fullscreen
            </button>
          </div>
        </header>

        <div className="main-content">
          {mode !== 'Fullscreen' && (
            <div className="sidebar">
              <div className="sidebar-header">
              <h2>Fixtures</h2>
              <div className="sidebar-header-actions">
                <button className="add-btn" onClick={handleImportClick} title="Import a SmartLightShow .SLS_Fixture or .SLS_Scene file">
                  <Upload size={16} /> Import SLS
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".SLS_Fixture,.SLS_Scene,.txt,text/plain"
                  style={{ display: 'none' }}
                  onChange={handleFileSelected}
                />
                <button className="add-btn" onClick={handleAddFixture}>
                  <Plus size={16} /> Add
                </button>
              </div>
            </div>

            {importMsg && (
              <div className="import-status" onClick={() => setImportMsg(null)}>
                {importMsg}
              </div>
            )}

            <div className="fixture-list">
              {fixtures.map(f => (
                <div key={f.id} className="fixture-item">
                  <div className="fixture-item-inputs">
                    <input 
                      type="text" 
                      value={f.name} 
                      onChange={(e) => updateFixture(f.id, { name: e.target.value })}
                      className="fixture-input"
                    />
                    <div className="fixture-row">
                      <span>CH:</span>
                      <input 
                        type="number" 
                        value={f.address} 
                        onChange={(e) => updateFixture(f.id, { address: Number(e.target.value) })}
                        min={1} 
                        max={512}
                        className="fixture-input small"
                      />
                    </div>
                    <select 
                      value={f.mode} 
                      onChange={(e) => updateFixture(f.id, { mode: e.target.value as any })}
                      className="fixture-select"
                    >
                      <option value="RGB">RGB (3ch)</option>
                      <option value="RGBW">RGBW (4ch)</option>
                      <option value="Dim+RGB">Dim+RGB (4ch)</option>
                      <option value="Dim+RGBW">Dim+RGBW (5ch)</option>
                      <option value="RGBA">RGBA (4ch)</option>
                      <option value="RGBWA">RGBWA (5ch)</option>
                      <option value="Dim+RGBA">Dim+RGBA (5ch)</option>
                      <option value="Dim+RGBWA">Dim+RGBWA (6ch)</option>
                      <option value="RGBWA+UV">RGBWA+UV (6ch) — Cameo ROOT PAR 6</option>
                      <option value="Dim+RGBWA+UV">Dim+RGBWA+UV (8ch) — Cameo ROOT PAR 6</option>
                      <option value="Dim16+RGBWA+UV">Dim16+RGBWA+UV (11ch) — Cameo ROOT PAR 6</option>
                    </select>
                  </div>
                  <button 
                    className="delete-btn"
                    onClick={() => removeFixture(f.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
          )}

          <div className="visualizer-container">
            {mode === '2D' && <Visualizer2D />}
            {mode === '3D' && <Visualizer3D />}
            {mode === 'Fullscreen' && <VisualizerFullscreen />}
          </div>
        </div>
      </div>
    </DMXProvider>
  );
}

export default App;

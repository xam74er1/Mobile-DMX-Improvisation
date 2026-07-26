import { useState } from 'react';
import { DMXProvider } from './components/DMXProvider';
import { Visualizer2D } from './components/Visualizer2D';
import { Visualizer3D } from './components/Visualizer3D';
import { VisualizerFullscreen } from './components/VisualizerFullscreen';
import { useDMXStore } from './store/useDMXStore';
import { Monitor, Box, Plus, Trash2, Maximize } from 'lucide-react';

function App() {
  const [mode, setMode] = useState<'2D' | '3D' | 'Fullscreen'>('3D');
  const { connected, fixtures, addFixture, removeFixture, updateFixture } = useDMXStore();

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
              <button className="add-btn" onClick={handleAddFixture}>
                <Plus size={16} /> Add
              </button>
            </div>
            
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

import React from 'react';
import { useDMXStore } from '../store/useDMXStore';
import { parseDMX } from '../utils/dmxParse';

export const VisualizerFullscreen: React.FC = () => {
  const { fixtures, universe } = useDMXStore();

  return (
    <div className="visualizer-fullscreen">
      <div className="fullscreen-grid">
        {fixtures.map((fixture) => {
          const { finalR, finalG, finalB, raw } = parseDMX(fixture.mode, universe, fixture.address - 1);

          return (
            <div
              key={fixture.id}
              className="fullscreen-cell"
              style={{
                backgroundColor: `rgb(${finalR}, ${finalG}, ${finalB})`,
                boxShadow: `0 0 ${Math.max(raw.r, raw.g, raw.b, raw.w, raw.a, raw.uv) / 2}px rgb(${finalR}, ${finalG}, ${finalB})`
              }}
            >
              <span className="fullscreen-label">{fixture.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

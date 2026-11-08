import React from 'react';
import { useDMXStore } from '../store/useDMXStore';
import { resolveFixtureColor } from '../utils/dmxParse';

export const VisualizerFullscreen: React.FC = () => {
  const { fixtures, universe } = useDMXStore();

  return (
    <div className="visualizer-fullscreen">
      <div className="fullscreen-grid">
        {fixtures.map((fixture) => {
          const { finalR, finalG, finalB, raw } = resolveFixtureColor(fixture, universe);

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

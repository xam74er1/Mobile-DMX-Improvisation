import React from 'react';
import { useDMXStore } from '../store/useDMXStore';
import { resolveFixtureColor } from '../utils/dmxParse';

export const Visualizer2D: React.FC = () => {
  const { fixtures, universe } = useDMXStore();

  return (
    <div className="visualizer-2d">
      <div className="grid">
        {fixtures.map((fixture) => {
          const { finalR, finalG, finalB, raw } = resolveFixtureColor(fixture, universe);

          return (
            <div key={fixture.id} className="fixture-card">
              <div
                className="fixture-light"
                style={{
                  backgroundColor: `rgb(${finalR}, ${finalG}, ${finalB})`,
                  boxShadow: `0 0 ${Math.max(raw.r, raw.g, raw.b, raw.w, raw.a, raw.uv) / 2}px rgb(${finalR}, ${finalG}, ${finalB})`
                }}
              />
              <div className="fixture-info">
                <h3>{fixture.name}</h3>
                <p>CH: {fixture.address}</p>
                <p>{fixture.mode}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

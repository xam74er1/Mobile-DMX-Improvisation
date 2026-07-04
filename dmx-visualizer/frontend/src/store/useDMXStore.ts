import { create } from 'zustand';

import type { FixtureMode } from '../utils/dmxParse';

interface Fixture {
  id: string;
  name: string;
  address: number; // 1-512
  mode: FixtureMode;
  x: number; // 2D/3D x position
  y: number; // 2D/3D y position
  z?: number; // 3D z position
  rotX?: number; // 3D rotation X
  rotY?: number; // 3D rotation Y
  rotZ?: number; // 3D rotation Z
}

interface Actor {
  id: string;
  x: number;
  y: number;
  z: number;
}

interface DMXState {
  universe: number[]; // 512 channels, 0-255
  fixtures: Fixture[];
  actors: Actor[];
  connected: boolean;
  setUniverse: (data: number[]) => void;
  setConnected: (status: boolean) => void;
  addFixture: (fixture: Fixture) => void;
  updateFixture: (id: string, updates: Partial<Fixture>) => void;
  updateFixturePosition: (id: string, x: number, y: number, z?: number) => void;
  updateFixtureRotation: (id: string, rotX: number, rotY: number, rotZ: number) => void;
  removeFixture: (id: string) => void;
  
  addActor: (actor: Actor) => void;
  updateActorPosition: (id: string, x: number, y: number, z: number) => void;
  removeActor: (id: string) => void;

  applyLayout: (layout: 'overhead' | 'side' | 'front' | 'floor' | 'circle') => void;
}

export const useDMXStore = create<DMXState>((set) => ({
  universe: new Array(512).fill(0),
  fixtures: [
    { id: '1', name: 'Light 1', address: 1, mode: 'RGBWA+UV', x: -2, y: 0, z: 5, rotX: -Math.PI/4, rotY: 0, rotZ: 0 },
    { id: '2', name: 'Light 2', address: 7, mode: 'RGBWA+UV', x: 2, y: 0, z: 5, rotX: -Math.PI/4, rotY: 0, rotZ: 0 },
  ],
  actors: [],
  connected: false,
  setUniverse: (data) => set({ universe: data }),
  setConnected: (status) => set({ connected: status }),
  addFixture: (fixture) => set((state) => ({ fixtures: [...state.fixtures, fixture] })),
  updateFixture: (id, updates) => set((state) => ({
    fixtures: state.fixtures.map(f => f.id === id ? { ...f, ...updates } : f)
  })),
  updateFixturePosition: (id, x, y, z) => set((state) => ({
    fixtures: state.fixtures.map(f => f.id === id ? { ...f, x, y, z: z ?? f.z } : f)
  })),
  updateFixtureRotation: (id, rotX, rotY, rotZ) => set((state) => ({
    fixtures: state.fixtures.map(f => f.id === id ? { ...f, rotX, rotY, rotZ } : f)
  })),
  removeFixture: (id) => set((state) => ({ fixtures: state.fixtures.filter(f => f.id !== id) })),

  addActor: (actor) => set((state) => ({ actors: [...state.actors, actor] })),
  updateActorPosition: (id, x, y, z) => set((state) => ({
    actors: state.actors.map(a => a.id === id ? { ...a, x, y, z } : a)
  })),
  removeActor: (id) => set((state) => ({ actors: state.actors.filter(a => a.id !== id) })),

  applyLayout: (layout) => set((state) => {
    const count = state.fixtures.length;
    if (count === 0) return state;

    const newFixtures = state.fixtures.map((f, i) => {
      let x = 0, y = 0, z = 0, rotX = 0, rotY = 0, rotZ = 0;
      
      switch (layout) {
        case 'overhead':
          // Straight down from above
          x = (i - (count - 1) / 2) * 2;
          z = 6;
          y = 0;
          rotX = -Math.PI / 2; // point straight down
          break;
        case 'side':
          // 50/50 on left and right wings
          const isLeft = i < count / 2;
          const sideIndex = isLeft ? i : i - Math.ceil(count / 2);
          const itemsOnSide = isLeft ? Math.ceil(count / 2) : Math.floor(count / 2);
          
          x = isLeft ? -8 : 8;
          z = 2 + (sideIndex * 1.5);
          y = (sideIndex - (itemsOnSide - 1) / 2) * 2;
          
          rotX = -Math.PI / 4;
          rotY = isLeft ? -Math.PI / 2 : Math.PI / 2; // Point inwards
          break;
        case 'front':
          // Audience front wash
          x = (i - (count - 1) / 2) * 2.5;
          z = 4;
          y = 10; // pushed back into audience
          rotX = Math.PI / 8; // pointing slightly down
          rotY = Math.PI; // Point towards stage origin
          break;
        case 'floor':
          // Back edge of stage pointing up
          x = (i - (count - 1) / 2) * 2;
          z = 0.5;
          y = -5; // back of stage
          rotX = Math.PI / 4; // pointing up and forward
          rotY = 0;
          break;
        case 'circle':
          // Semi-circle overhead
          const angle = Math.PI + (i / (count - 1 || 1)) * Math.PI;
          const radius = 6;
          x = Math.cos(angle) * radius;
          y = Math.sin(angle) * radius;
          z = 5;
          rotX = -Math.PI / 4;
          rotY = -angle - Math.PI / 2; // point to center
          break;
      }
      return { ...f, x, y, z, rotX, rotY, rotZ };
    });

    return { fixtures: newFixtures };
  }),
}));

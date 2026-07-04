import React, { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, TransformControls, SpotLight } from '@react-three/drei';
import * as THREE from 'three';
import { useDMXStore } from '../store/useDMXStore';
import { parseDMX } from '../utils/dmxParse';

const Actor3D = ({ actor, isSelected, onClick }: { actor: any, isSelected: boolean, onClick: () => void }) => {
  return (
    <group 
      position={[actor.x, actor.z, actor.y]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {/* Body */}
      <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.25, 0.25, 1.6, 16]} />
        <meshStandardMaterial color="#888" roughness={0.6} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.8, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#888" roughness={0.6} />
      </mesh>
    </group>
  );
};

const Fixture3D = ({ fixture, isSelected, onClick }: { fixture: any, isSelected: boolean, onClick: () => void }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.SpotLight>(null);
  const targetRef = useRef<THREE.Object3D>(new THREE.Object3D());
  const { updateFixturePosition, updateFixtureRotation } = useDMXStore();
  
  // DMX updating frame loop
  useFrame(() => {
    if (meshRef.current) {
      const universe = useDMXStore.getState().universe;
      const { finalR: fr, finalG: fg, finalB: fb } = parseDMX(fixture.mode, universe, fixture.address - 1);
      const finalR = fr / 255;
      const finalG = fg / 255;
      const finalB = fb / 255;

      const color = new THREE.Color(finalR, finalG, finalB);
      const intensity = Math.max(finalR, finalG, finalB);
      
      // Update mesh body
      if (meshRef.current.material) {
        (meshRef.current.material as THREE.MeshStandardMaterial).emissive = color;
        (meshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity;
      }
      
      // Update SpotLight
      if (lightRef.current) {
        lightRef.current.color = color;
        lightRef.current.intensity = intensity * 100; // Increased base intensity
        
        // Update the volumetric shader material which is a child of the SpotLight in Drei
        if (lightRef.current.children.length > 0) {
          const volMesh = lightRef.current.children[0] as any;
          if (volMesh.material && volMesh.material.uniforms && volMesh.material.uniforms.lightColor) {
            // The SpotLightMaterial uses the lightColor uniform for the beam color
            volMesh.material.uniforms.lightColor.value.copy(color);
          }
        }
      }
    }
  });

  return (
    <group 
      position={[fixture.x, fixture.z || 5, fixture.y]}
      rotation={[fixture.rotX || 0, fixture.rotY || 0, fixture.rotZ || 0]}
    >
      <mesh 
        ref={meshRef} 
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <cylinderGeometry args={[0.3, 0.3, 0.5, 16]} />
        <meshStandardMaterial color="#222" />
        
        <SpotLight
          ref={lightRef as any}
          position={[0, -0.25, 0]}
          angle={0.5}
          penumbra={0.5}
          decay={1}
          distance={50}
          castShadow
          volumetric={true}
          attenuation={20}
          anglePower={4}
          target={targetRef.current}
        />
        {/* SpotLight target pushes straight down in local space */}
        <primitive object={targetRef.current} position={[0, -10, 0]} />
      </mesh>
    </group>
  );
};

export const Visualizer3D: React.FC = () => {
  const { fixtures, actors, updateFixturePosition, updateFixtureRotation, addActor, updateActorPosition, applyLayout, removeActor } = useDMXStore();
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | null>(null);
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate'>('translate');

  const selectedFixture = fixtures.find(f => f.id === selectedFixtureId);
  const selectedActor = actors.find(a => a.id === selectedActorId);
  const transformTarget = selectedFixture || selectedActor;
  const isActorSelected = !!selectedActor;

  const handleAddActor = () => {
    addActor({
      id: Math.random().toString(),
      x: (Math.random() - 0.5) * 4,
      y: (Math.random() - 0.5) * 4,
      z: 0
    });
  };

  const handleDeselect = () => {
    setSelectedFixtureId(null);
    setSelectedActorId(null);
  };

  return (
    <div className="visualizer-3d" style={{ position: 'relative' }}>
      {/* Layout & Actors Controls */}
      <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 10, display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(0,0,0,0.5)', padding: '12px', borderRadius: '8px' }}>
        <h4 style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: '#aaa' }}>Stage Setup</h4>
        <button style={{ background: '#2ed573', color: '#000' }} onClick={handleAddActor}>+ Place Actor</button>
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
        <button onClick={() => applyLayout('overhead')}>Layout: Overhead</button>
        <button onClick={() => applyLayout('side')}>Layout: 50/50 Side</button>
        <button onClick={() => applyLayout('front')}>Layout: Front Wash</button>
        <button onClick={() => applyLayout('floor')}>Layout: Floor Up-light</button>
        <button onClick={() => applyLayout('circle')}>Layout: Circle</button>
      </div>

      {/* 3D UI Overlay */}
      {transformTarget && (
        <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10, display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.5)', padding: '8px', borderRadius: '8px' }}>
          <button 
            style={{ background: transformMode === 'translate' ? '#3742fa' : '#333' }}
            onClick={() => setTransformMode('translate')}
          >
            Move
          </button>
          {!isActorSelected && (
            <button 
              style={{ background: transformMode === 'rotate' ? '#3742fa' : '#333' }}
              onClick={() => setTransformMode('rotate')}
            >
              Rotate
            </button>
          )}
          <button style={{ background: '#ff4757' }} onClick={handleDeselect}>
            Deselect
          </button>
          {isActorSelected && (
            <button style={{ background: '#ff4757' }} onClick={() => { removeActor(selectedActorId!); handleDeselect(); }}>
              Remove Actor
            </button>
          )}
        </div>
      )}

      <Canvas shadows camera={{ position: [0, 8, 10], fov: 50 }} onPointerMissed={handleDeselect}>
        <color attach="background" args={['#020202']} />
        
        {/* Near pitch black stage */}
        <ambientLight intensity={0.02} />

        {/* Fixtures */}
        {fixtures.map(f => (
          <Fixture3D 
            key={f.id} 
            fixture={f} 
            isSelected={selectedFixtureId === f.id}
            onClick={() => { setSelectedActorId(null); setSelectedFixtureId(f.id); }}
          />
        ))}

        {/* Actors */}
        {actors.map(a => (
          <Actor3D 
            key={a.id} 
            actor={a} 
            isSelected={selectedActorId === a.id}
            onClick={() => { setSelectedFixtureId(null); setSelectedActorId(a.id); }}
          />
        ))}

        {transformTarget && (
          <TransformControls
            mode={isActorSelected ? 'translate' : transformMode}
            position={[transformTarget.x, transformTarget.z || 0, transformTarget.y]}
            rotation={isActorSelected ? [0,0,0] : [(transformTarget as any).rotX || 0, (transformTarget as any).rotY || 0, (transformTarget as any).rotZ || 0]}
            onObjectChange={(e) => {
              if (e?.target?.object) {
                const { position, rotation } = e.target.object;
                if (isActorSelected) {
                  updateActorPosition(selectedActorId!, position.x, position.z, position.y);
                } else {
                  if (transformMode === 'translate') {
                    updateFixturePosition(selectedFixtureId!, position.x, position.z, position.y);
                  } else {
                    updateFixtureRotation(selectedFixtureId!, rotation.x, rotation.y, rotation.z);
                  }
                }
              }
            }}
          />
        )}

        <mesh receiveShadow position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[50, 50]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.9} />
        </mesh>

        <Grid renderOrder={-1} position={[0, 0.01, 0]} infiniteGrid fadeDistance={30} fadeStrength={1} cellColor="#333" sectionColor="#111" />
        
        {/* Disable OrbitControls while transforming */}
        <OrbitControls makeDefault enabled={!transformTarget} />
      </Canvas>
    </div>
  );
};

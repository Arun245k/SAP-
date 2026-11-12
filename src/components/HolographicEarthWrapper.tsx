import React, { useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Html } from '@react-three/drei';
import * as THREE from 'three';

function HolographicEarth({ nodes }: { nodes: any[] }) {
  const earthRef = useRef<THREE.Mesh>(null);
  
  useFrame(({ clock }) => {
    if (earthRef.current) {
      earthRef.current.rotation.y = clock.elapsedTime * 0.1;
    }
  });

  return (
    <group>
      <mesh ref={earthRef}>
        <sphereGeometry args={[2.5, 32, 32]} />
        <meshBasicMaterial color="#020817" transparent opacity={0.8} wireframe wireframeLinewidth={0.5} />
        <mesh>
          <sphereGeometry args={[2.51, 16, 16]} />
          <meshBasicMaterial color="#06b6d4" transparent opacity={0.1} blending={THREE.AdditiveBlending} />
        </mesh>
        
        {/* Plotting points roughly on the sphere */}
        {nodes.map((n, idx) => {
          // simple spherical coordinates mapping for visual effect
          const phi = (90 - n.lat) * (Math.PI / 180);
          const theta = (n.lng + 180) * (Math.PI / 180);
          const r = 2.6;
          const x = -(r * Math.sin(phi) * Math.cos(theta));
          const y = r * Math.cos(phi);
          const z = r * Math.sin(phi) * Math.sin(theta);
          const color = n.status === 'critical' ? '#f43f5e' : n.status === 'warning' ? '#f59e0b' : '#10b981';
          return (
            <group key={idx} position={[x, y, z]}>
              <mesh>
                <sphereGeometry args={[0.08, 8, 8]} />
                <meshBasicMaterial color={color} />
              </mesh>
              <Html distanceFactor={15}>
                <div className="flex flex-col items-start translate-x-3 -translate-y-3 pointer-events-none">
                  <div className={`bg-black/60 border border-${n.status === 'critical' ? 'rose' : n.status === 'warning' ? 'amber' : 'emerald'}-500/50 p-1.5 rounded backdrop-blur-md min-w-max`}>
                    <div className="text-[9px] font-bold text-white uppercase tracking-wider">{n.city}</div>
                    <div className={`text-[7px] font-mono ${n.status === 'critical' ? 'text-rose-400' : n.status === 'warning' ? 'text-amber-400' : 'text-emerald-400'}`}>{n.nodeType}</div>
                  </div>
                </div>
              </Html>
            </group>
          );
        })}
      </mesh>
    </group>
  );
}

export function HolographicEarthWrapper() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const scrollParent = el.closest('.overflow-y-auto') as HTMLElement;
    if (!scrollParent) return;
    const handleWheel = (e: WheelEvent) => {
      scrollParent.scrollTop += e.deltaY;
    };
    el.addEventListener('wheel', handleWheel, { passive: true, capture: true });
    return () => {
      el.removeEventListener('wheel', handleWheel, { capture: true });
    };
  }, []);

  const mapNodes = useMemo(() => [
    { city: "Frankfurt", region: "EU-Central", nodeType: "EWM Hub / PP", status: "critical", lat: 50.1, lng: 8.6 },
    { city: "New York", region: "US-East", nodeType: "TM Consolidation", status: "nominal", lat: 40.7, lng: -74.0 },
    { city: "Singapore", region: "APJ-Core", nodeType: "MM / EWM", status: "warning", lat: 1.3, lng: 103.8 },
    { city: "São Paulo", region: "LATAM", nodeType: "SD / TM", status: "nominal", lat: -23.5, lng: -46.6 },
  ], []);

  return (
    <div ref={containerRef} className="w-full h-full">
      <Canvas dpr={[1, 1.5]} performance={{ min: 0.5 }} camera={{ position: [0, 0, 6], fov: 45 }} style={{ touchAction: 'pan-y' }}>
        <ambientLight intensity={0.5} />
        <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />
        <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={1} />
        <HolographicEarth nodes={mapNodes} />
      </Canvas>
    </div>
  );
}

export default HolographicEarthWrapper;

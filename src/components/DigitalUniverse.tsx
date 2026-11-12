import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Html, Line as DreiLine } from '@react-three/drei';
import * as THREE from 'three';

const GraphNode3D = React.forwardRef(({ id, label, sub, position, colorHex, pulse, selectedNode, onSelect }: any, ref: any) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const isSelected = selectedNode === id;
  const isFaded = selectedNode && selectedNode !== id;
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);
  
  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.position.y = Math.sin(clock.elapsedTime * 1.5 + phase) * 0.15;
      if (pulse || isSelected) {
        const scale = 1 + Math.sin(clock.elapsedTime * 3) * (isSelected ? 0.15 : 0.1);
        meshRef.current.scale.set(scale, scale, scale);
      }
    }
  });

  return (
    <group ref={ref} position={position} onClick={(e) => { e.stopPropagation(); onSelect(id); }}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[isSelected ? 0.4 : 0.3, 16, 16]} />
        <meshBasicMaterial color={colorHex} transparent opacity={isFaded ? 0.2 : 0.8} />
      </mesh>
      {(pulse || isSelected) && (
        <mesh position={[0, Math.sin(phase)*0.15, 0]}>
          <sphereGeometry args={[isSelected ? 0.5 : 0.4, 16, 16]} />
          <meshBasicMaterial color={colorHex} transparent opacity={isSelected ? 0.4 : 0.2} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
      <Html distanceFactor={25} center zIndexRange={isSelected ? [100, 50] : [49, 0]}>
        <div className={`flex flex-col items-center cursor-pointer mt-8 transition-all duration-300 ${isFaded ? 'opacity-30' : 'opacity-100'} ${isSelected ? 'scale-110' : 'scale-100'}`}>
          <div className={`glass-card px-3 py-2 rounded-lg border ${isSelected ? 'border-white/40 shadow-[0_0_20px_rgba(255,255,255,0.4)]' : 'border-white/10 shadow-2xl'} backdrop-blur-md flex flex-col items-center min-w-max transition-all`}>
            <span className="text-[11px] font-mono font-bold text-slate-200 uppercase tracking-widest">{label}</span>
            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">{sub}</span>
          </div>
        </div>
      </Html>
    </group>
  );
});
GraphNode3D.displayName = 'GraphNode3D';

const AnimatedLine = React.forwardRef(({ start, end, colorHex, isHighlighted, isFaded }: any, ref: any) => {
  const internalRef = useRef<any>(null);
  const initialPoints = useMemo(() => [new THREE.Vector3(...start), new THREE.Vector3(...end)], [start, end]);
  
  useFrame(() => {
    if (internalRef.current?.material) {
      internalRef.current.material.dashOffset -= isHighlighted ? 0.03 : 0.01;
    }
  });

  return (
    <DreiLine
      ref={(node) => {
        internalRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      }}
      points={initialPoints}
      color={colorHex}
      lineWidth={isHighlighted ? 3 : 1.5}
      transparent
      opacity={isFaded ? 0.1 : (isHighlighted ? 0.8 : 0.4)}
      dashed
      dashSize={0.2}
      dashScale={1}
      gapSize={0.1}
    />
  );
});
AnimatedLine.displayName = 'AnimatedLine';

function PhysicsScene({ nodes, edges, selectedNodeId, onSelect }: any) {
  const positionsRef = useRef<Record<string, THREE.Vector3>>({});
  const velocitiesRef = useRef<Record<string, THREE.Vector3>>({});
  const nodeRefs = useRef<Record<string, THREE.Group | null>>({});
  const lineRefs = useRef<Record<string, any>>({});

  useMemo(() => {
    nodes.forEach((n: any) => {
      if (!positionsRef.current[n.id]) {
        positionsRef.current[n.id] = new THREE.Vector3(...n.pos);
        velocitiesRef.current[n.id] = new THREE.Vector3();
      }
    });
  }, [nodes]);

  useFrame(() => {
    const positions = positionsRef.current;
    const velocities = velocitiesRef.current;
    const dt = 0.05;

    const forces: Record<string, THREE.Vector3> = {};
    const ids = Object.keys(positions);
    
    ids.forEach(id => {
        forces[id] = new THREE.Vector3();

        if (selectedNodeId) {
            if (id === selectedNodeId) {
                // Pull selected node to front center (shifted left to make room for the info card)
                const target = new THREE.Vector3(-1.5, 0, 3);
                forces[id].add(target.sub(positions[id]).multiplyScalar(2.0));
            } else {
                const isConnected = edges.some((e: any) => 
                    (e.source === selectedNodeId && e.target === id) || 
                    (e.target === selectedNodeId && e.source === id)
                );
                
                if (isConnected) {
                    // Pull connected nodes slightly forward but keep them around the selected node
                    const targetZ = 1.0;
                    const diffZ = targetZ - positions[id].z;
                    forces[id].z += diffZ * 0.8;
                    // Also pull gently to center to keep in view
                    forces[id].x += -positions[id].x * 0.2;
                    forces[id].y += -positions[id].y * 0.2;
                } else {
                    // Push disconnected nodes back and outward
                    const distToCenter = Math.sqrt(positions[id].x ** 2 + positions[id].y ** 2) || 1;
                    const dirX = positions[id].x / distToCenter;
                    const dirY = positions[id].y / distToCenter;
                    
                    const target = new THREE.Vector3(dirX * 4, dirY * 4, -3);
                    forces[id].add(target.sub(positions[id]).multiplyScalar(0.4));
                }
            }
        } else {
            // Original rest position pull to maintain the initial aesthetic shape when nothing is selected
            const originalPos = new THREE.Vector3(...nodes.find((n:any) => n.id === id).pos);
            forces[id].add(originalPos.sub(positions[id]).multiplyScalar(1.2));
        }
    });

    for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
            const idA = ids[i];
            const idB = ids[j];
            const ptA = positions[idA];
            const ptB = positions[idB];
            const distSq = ptA.distanceToSquared(ptB);
            if (distSq < 0.01) continue;
            const dist = Math.sqrt(distSq);
            const dir = new THREE.Vector3().subVectors(ptA, ptB).normalize();
            
            // Repulsion force
            let repStrength = selectedNodeId ? 3.0 : 1.5; // lower repulsion when returning to rest pos
            if (selectedNodeId && (idA === selectedNodeId || idB === selectedNodeId)) {
                repStrength = 10.0; // Selected node repels others strongly to keep clear
            }
            const forceMag = repStrength / distSq;
            forces[idA].addScaledVector(dir, forceMag);
            forces[idB].addScaledVector(dir, -forceMag);
        }
    }

    edges.forEach((edge: any) => {
        const idA = edge.source;
        const idB = edge.target;
        const ptA = positions[idA];
        const ptB = positions[idB];
        const dist = ptA.distanceTo(ptB);
        const dir = new THREE.Vector3().subVectors(ptB, ptA).normalize();
        
        // If unselected, rest positions take over
        let idealLen = selectedNodeId ? 4.0 : 0.0; 
        if (selectedNodeId === idA || selectedNodeId === idB) idealLen = 3.5; // Connected nodes closer to selected
        
        const stretch = dist - idealLen;
        const forceMag = stretch * (selectedNodeId ? 0.8 : 0.2);

        forces[idA].addScaledVector(dir, forceMag);
        forces[idB].addScaledVector(dir, -forceMag);
    });

    ids.forEach(id => {
        velocities[id].addScaledVector(forces[id], dt);
        velocities[id].multiplyScalar(0.85); 
        positions[id].addScaledVector(velocities[id], dt);

        if (nodeRefs.current[id]) {
            nodeRefs.current[id].position.copy(positions[id]);
        }
    });

    edges.forEach((edge: any, i: number) => {
        const line = lineRefs.current[`edge-${i}`];
        if (line && line.geometry) {
            const ptA = positions[edge.source];
            const ptB = positions[edge.target];
            line.geometry.setPositions([ptA.x, ptA.y, ptA.z, ptB.x, ptB.y, ptB.z]);
        }
    });
  });

  return (
    <group position={[0, -0.5, 0]}>
      {edges.map((edge: any, i: number) => {
        const isHighlighted = selectedNodeId === edge.source || selectedNodeId === edge.target;
        const isFaded = selectedNodeId && !isHighlighted;
        return (
          <AnimatedLine 
            key={`edge-${i}`} 
            ref={(el: any) => lineRefs.current[`edge-${i}`] = el}
            start={edge.start} 
            end={edge.end} 
            colorHex={edge.colorHex} 
            isHighlighted={isHighlighted} 
            isFaded={isFaded} 
          />
        );
      })}
      {nodes.map((node: any) => (
         <GraphNode3D 
            key={node.id} 
            ref={(el: any) => nodeRefs.current[node.id] = el}
            {...node} 
            selectedNode={selectedNodeId} 
            onSelect={onSelect} 
         />
      ))}
    </group>
  );
}

export function DigitalUniverse() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
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

  const nodes = useMemo(() => [
    { id: 'ERP', label: 'ERP Core', sub: 'S/4HANA Engine', colorHex: '#a855f7', pos: [0, 0, 0], status: 'ACTIVE', metrics: { latency: '12ms', ops: '890K/s', uptime: '99.9%' } },
    { id: 'QRFC', label: 'Middleware', sub: 'qRFC / IDoc Hub', colorHex: '#64748b', pos: [0, 2.5, 0], pulse: true, status: 'WARNING', metrics: { latency: '85ms', ops: '45K/s', queue: '12,403 msgs' } },
    { id: 'PO', label: 'Purchase Order', sub: 'MM Procurement', colorHex: '#3b82f6', pos: [-4.5, 1.5, -2], status: 'ACTIVE', metrics: { latency: '8ms', ops: '12K/s', volume: '14K units/hr' } },
    { id: 'SO', label: 'Sales Order', sub: 'SD Outbound', colorHex: '#f97316', pos: [-4.5, -1.5, 2], status: 'ACTIVE', metrics: { latency: '15ms', ops: '24K/s', volume: '32K units/hr' } },
    { id: 'PP', label: 'Production Supply', sub: 'PP Staging', colorHex: '#f43f5e', pos: [3.5, -2.5, -1], status: 'CRITICAL', metrics: { latency: '142ms', ops: '4.5M/s', errorRate: '2.4%' } },
    { id: 'EWM', label: 'Warehouse Node', sub: 'EWM Operations', colorHex: '#06b6d4', pos: [3.5, 0.5, 1.5], status: 'ACTIVE', metrics: { latency: '5ms', ops: '1.2M/s', tasks: '840 open' } },
    { id: 'TM', label: 'Freight Planning', sub: 'TM Operations', colorHex: '#10b981', pos: [4.5, 2.5, -1], status: 'ACTIVE', metrics: { latency: '18ms', ops: '450K/s', activeRoutes: '1,248' } },
  ], []);

  const edges = useMemo(() => [
    { source: 'PO', target: 'ERP', start: nodes[2].pos, end: nodes[0].pos, colorHex: '#3b82f6' },
    { source: 'SO', target: 'ERP', start: nodes[3].pos, end: nodes[0].pos, colorHex: '#f97316' },
    { source: 'ERP', target: 'QRFC', start: nodes[0].pos, end: nodes[1].pos, colorHex: '#a855f7' },
    { source: 'ERP', target: 'PP', start: nodes[0].pos, end: nodes[4].pos, colorHex: '#a855f7' },
    { source: 'QRFC', target: 'EWM', start: nodes[1].pos, end: nodes[5].pos, colorHex: '#06b6d4' },
    { source: 'PP', target: 'EWM', start: nodes[4].pos, end: nodes[5].pos, colorHex: '#f43f5e' },
    { source: 'SO', target: 'TM', start: nodes[3].pos, end: nodes[6].pos, colorHex: '#f97316' },
    { source: 'EWM', target: 'TM', start: nodes[5].pos, end: nodes[6].pos, colorHex: '#10b981' },
  ], [nodes]);

  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <Canvas dpr={[1, 1.5]} performance={{ min: 0.5 }} gl={{ powerPreference: "high-performance" }} camera={{ position: [0, 0, 8], fov: 60 }} onPointerMissed={() => setSelectedNodeId(null)} style={{ touchAction: 'pan-y' }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <Stars radius={100} depth={50} count={1500} factor={4} saturation={0} fade speed={1} />
        <OrbitControls enableZoom={false} enablePan={false} autoRotate={!selectedNodeId} autoRotateSpeed={0.5} maxPolarAngle={Math.PI / 2 + 0.2} minPolarAngle={Math.PI / 2 - 0.2} />
        <PhysicsScene nodes={nodes} edges={edges} selectedNodeId={selectedNodeId} onSelect={(id: string) => setSelectedNodeId(id === selectedNodeId ? null : id)} />
      </Canvas>

      {selectedNode && (
        <div 
          className="absolute top-6 right-6 glass-card p-5 rounded-xl border border-white/10 z-20 w-80 backdrop-blur-3xl bg-[#02040a]/90 shadow-[0_0_30px_rgba(0,0,0,0.8)] cyber-border group pointer-events-auto transition-all"
        >
          <div className="absolute top-0 right-0 w-32 h-32 rounded-bl-full filter blur-[30px] opacity-20 pointer-events-none transition-colors duration-500" style={{ backgroundColor: selectedNode.colorHex }}></div>
          
          <div className="flex justify-between items-start mb-4 relative z-10">
             <div>
               <h3 className="text-sm font-display font-bold text-white tracking-widest uppercase mb-1 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">{selectedNode.label}</h3>
               <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">{selectedNode.sub}</p>
             </div>
             <span className={`text-[9px] font-mono px-2 py-1 rounded border tracking-widest ${selectedNode.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : selectedNode.status === 'WARNING' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}`}>
               {selectedNode.status}
             </span>
          </div>

          <div className="space-y-3 relative z-10">
            {Object.entries(selectedNode.metrics).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">{key}</span>
                <span className="text-[11px] font-mono text-slate-300 font-bold">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default DigitalUniverse;

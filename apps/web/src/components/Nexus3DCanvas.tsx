'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface Nexus3DCanvasProps {
  className?: string;
  variant?: 'hero' | 'ambient' | 'compact';
}

export function Nexus3DCanvas({ className = '', variant = 'hero' }: Nexus3DCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Detect WebGL support
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || (variant === 'hero' ? 520 : 360);

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = variant === 'hero' ? 24 : 18;

    // 2. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // 3. Stellar Rail Torus (Cyan #00E5FF)
    const stellarCount = variant === 'compact' ? 600 : 1200;
    const stellarGeo = new THREE.BufferGeometry();
    const stellarPos = new Float32Array(stellarCount * 3);
    const stellarColors = new Float32Array(stellarCount * 3);
    const stellarColorObj = new THREE.Color('#00E5FF');
    const stellarColorAlt = new THREE.Color('#7FF8C6');

    const R1 = 7.5;
    const r1 = 2.4;
    for (let i = 0; i < stellarCount; i++) {
      const u = Math.random() * Math.PI * 2;
      const v = Math.random() * Math.PI * 2;
      const x = (R1 + r1 * Math.cos(v)) * Math.cos(u);
      const y = (R1 + r1 * Math.cos(v)) * Math.sin(u);
      const z = r1 * Math.sin(v);

      stellarPos[i * 3] = x;
      stellarPos[i * 3 + 1] = y;
      stellarPos[i * 3 + 2] = z;

      const mixC = Math.random() > 0.5 ? stellarColorObj : stellarColorAlt;
      stellarColors[i * 3] = mixC.r;
      stellarColors[i * 3 + 1] = mixC.g;
      stellarColors[i * 3 + 2] = mixC.b;
    }
    stellarGeo.setAttribute('position', new THREE.BufferAttribute(stellarPos, 3));
    stellarGeo.setAttribute('color', new THREE.BufferAttribute(stellarColors, 3));

    const stellarMat = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const stellarPoints = new THREE.Points(stellarGeo, stellarMat);
    stellarPoints.rotation.x = Math.PI / 3;
    stellarPoints.rotation.y = Math.PI / 6;
    scene.add(stellarPoints);

    // 4. XRPL Rail Torus (Pulsar Blue #0081F2 & Indigo)
    const xrplCount = variant === 'compact' ? 600 : 1200;
    const xrplGeo = new THREE.BufferGeometry();
    const xrplPos = new Float32Array(xrplCount * 3);
    const xrplColors = new Float32Array(xrplCount * 3);
    const xrplColorObj = new THREE.Color('#0081F2');
    const xrplColorAlt = new THREE.Color('#8B5CF6');

    const R2 = 7.5;
    const r2 = 2.4;
    for (let i = 0; i < xrplCount; i++) {
      const u = Math.random() * Math.PI * 2;
      const v = Math.random() * Math.PI * 2;
      const x = (R2 + r2 * Math.cos(v)) * Math.cos(u);
      const y = (R2 + r2 * Math.cos(v)) * Math.sin(u);
      const z = r2 * Math.sin(v);

      xrplPos[i * 3] = x;
      xrplPos[i * 3 + 1] = y;
      xrplPos[i * 3 + 2] = z;

      const mixC = Math.random() > 0.5 ? xrplColorObj : xrplColorAlt;
      xrplColors[i * 3] = mixC.r;
      xrplColors[i * 3 + 1] = mixC.g;
      xrplColors[i * 3 + 2] = mixC.b;
    }
    xrplGeo.setAttribute('position', new THREE.BufferAttribute(xrplPos, 3));
    xrplGeo.setAttribute('color', new THREE.BufferAttribute(xrplColors, 3));

    const xrplMat = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const xrplPoints = new THREE.Points(xrplGeo, xrplMat);
    xrplPoints.rotation.x = -Math.PI / 3;
    xrplPoints.rotation.y = -Math.PI / 4;
    scene.add(xrplPoints);

    // 5. Central Holographic Core (Interlocking Icosahedron Wireframe)
    const coreGeo = new THREE.IcosahedronGeometry(2.6, 1);
    const coreWireMat = new THREE.MeshBasicMaterial({
      color: 0x7FF8C6,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreWireMat);
    scene.add(coreMesh);

    // Inner Glowing Core Sphere
    const innerGeo = new THREE.SphereGeometry(1.2, 16, 16);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x00F5FF,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    scene.add(innerMesh);

    // 6. Interactive Cursor Parallax
    let targetRotX = 0;
    let targetRotY = 0;
    let currentRotX = 0;
    let currentRotY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      targetRotX = y * 0.35;
      targetRotY = x * 0.45;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // 7. Resize Observer
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight || (variant === 'hero' ? 520 : 360);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 8. Animation Loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Smooth cursor lerp
      currentRotX += (targetRotX - currentRotX) * 0.05;
      currentRotY += (targetRotY - currentRotY) * 0.05;

      // Rotate dual rails in counter-spin
      stellarPoints.rotation.z = elapsed * 0.12;
      stellarPoints.rotation.x = Math.PI / 3 + currentRotX * 0.5;
      stellarPoints.rotation.y = Math.PI / 6 + currentRotY * 0.5;

      xrplPoints.rotation.z = -elapsed * 0.10;
      xrplPoints.rotation.x = -Math.PI / 3 + currentRotX * 0.5;
      xrplPoints.rotation.y = -Math.PI / 4 + currentRotY * 0.5;

      // Core pulsating breathing
      const pulse = 1 + Math.sin(elapsed * 2.2) * 0.08;
      coreMesh.scale.set(pulse, pulse, pulse);
      coreMesh.rotation.x = elapsed * 0.35 + currentRotX;
      coreMesh.rotation.y = elapsed * 0.45 + currentRotY;

      innerMesh.rotation.x = -elapsed * 0.5;
      innerMesh.rotation.y = -elapsed * 0.6;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      stellarGeo.dispose();
      stellarMat.dispose();
      xrplGeo.dispose();
      xrplMat.dispose();
      coreGeo.dispose();
      coreWireMat.dispose();
      innerGeo.dispose();
      innerMat.dispose();
    };
  }, [variant]);

  return (
    <div
      ref={mountRef}
      className={`relative w-full overflow-hidden pointer-events-none select-none flex items-center justify-center ${className}`}
      style={{ minHeight: variant === 'hero' ? '460px' : '300px' }}
    />
  );
}

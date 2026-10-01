# 3D Interactive Character Avatar & Radial Orbit Menu Guide

## 1. What Is This Feature Called?

The feature shown in the image is a **3D Interactive Character Viewport with Radial Orbit Navigation**:

1. **3D Character Canvas**: A real-time WebGL 3D model (GLTF/GLB format) rendered using **Three.js** and **React Three Fiber (`@react-three/fiber`)**, featuring floating animations, mouse-tracking rotation, and lighting effects.
2. **Radial Orbit Menu**: A circular navigation bar positioned around the central 3D model using trigonometric layout coordinates ($x = r \cdot \cos\theta, y = r \cdot \sin\theta$).
3. **Immersive Atmosphere**: Ambient background image overlay + floating firefly particles + background sound toggle button.

---

## 2. Top 3 Ways to Build & Get 3D Models (100% Free)

### Option 1: Spline 3D (Recommended - Easiest & Most Visually Stunning)
* **Website:** [spline.design](https://spline.design)
* **How it works:** A free web-based 3D design tool (like Figma for 3D). You can pick 3D characters, wizards, robots, or custom objects, animate them with mouse hover, and export directly as a React component:
  ```tsx
  import Spline from '@splinetool/react-spline';

  export default function Avatar3D() {
    return <Spline scene="https://prod.spline.design/your-scene-id/scene.splinecode" />;
  }
  ```
* **Pros:** Zero 3D math required, built-in interactions, extremely fast setup.

---

### Option 2: Ready Player Me (Personalized 3D Avatar)
* **Website:** [readyplayer.me](https://readyplayer.me)
* **How it works:** Generate a customized 3D avatar that looks like **you** (upload a photo or customize clothes/glasses/hair). Export as a `.glb` 3D file and load it in React Three Fiber using Drei's `useGLTF`.
* **Pros:** Highly personal, free, professional quality.

---

### Option 3: Sketchfab / Poly Pizza (Free Low-Poly 3D Models)
* **Websites:** [sketchfab.com](https://sketchfab.com) | [poly.pizza](https://poly.pizza)
* **How it works:** Download free open-source `.glb` / `.gltf` 3D models (wizards, laptops, developer avatars, sci-fi pedestals) under Creative Commons.

---

## 3. Technical Implementation in React / Next.js

Since your project already has **`three`**, **`@react-three/fiber`**, and **`@react-three/drei`** installed, here is how the code is structured:

### 3.1 The 3D Character Model Component
```tsx
"use client";

import { Canvas } from "@react-three/fiber";
import { useGLTF, Float, OrbitControls, Environment } from "@react-three/drei";

function CharacterModel() {
  // Load free .glb 3D model
  const { scene } = useGLTF("/models/developer_avatar.glb");

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
      <primitive object={scene} scale={1.8} position={[0, -1, 0]} />
    </Float>
  );
}

export function AvatarScene() {
  return (
    <div className="h-[500px] w-full relative">
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} />
        <CharacterModel />
        <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={1} />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}
```

---

### 3.2 Trigonometric Circular Radial Orbit Menu
To arrange icons in a circle around the character:

```tsx
const MENU_ITEMS = [
  { label: "Home", href: "#" },
  { label: "About", href: "#about" },
  { label: "Work", href: "#work" },
  { label: "Projects", href: "#projects" },
  { label: "Skills", href: "#skills" },
  { label: "Contact", href: "#contact" },
  { label: "GitHub", href: "https://github.com/AtulPandey429" },
  { label: "LinkedIn", href: "https://linkedin.com/in/atul-pandey429" },
];

export function RadialOrbitMenu() {
  const radius = 180; // distance from center in pixels
  const total = MENU_ITEMS.length;

  return (
    <div className="relative flex items-center justify-center h-full w-full">
      {MENU_ITEMS.map((item, index) => {
        const angle = (index / total) * 2 * Math.PI;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        return (
          <a
            key={item.label}
            href={item.href}
            style={{
              transform: `translate(${x}px, ${y}px)`,
            }}
            className="absolute flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-neutral-900/80 backdrop-blur-md transition hover:scale-110 hover:border-accent hover:text-accent shadow-xl"
          >
            {item.label[0]}
          </a>
        );
      })}
    </div>
  );
}
```

---

## 4. Performance & Mobile Optimization Checklist

1. **Low-Power Mode & Mobile Fallbacks:** 3D WebGL canvases consume GPU power. On mobile devices, replace the heavy 3D canvas with an optimized 2D animated avatar or static image to ensure 60 FPS performance.
2. **Toggleable View Mode:** Provide a toggle switch (`"Standard Mode"` vs `"3D Fantasy Mode"`) so users on low-end devices can choose.

---

## 5. Summary & Recommendation

| Tool / Resource | Recommended Use Case | Official Link |
| :--- | :--- | :--- |
| **Spline 3D** | Easiest interactive 3D scenes & ready-made React models | [spline.design](https://spline.design) |
| **Ready Player Me** | Custom 3D avatar modeled after yourself | [readyplayer.me](https://readyplayer.me) |
| **Poly Pizza** | Free low-poly 3D GLB assets | [poly.pizza](https://poly.pizza) |
| **React Three Fiber (R3F)** | Native WebGL canvas rendering | [docs.pmnd.rs/react-three-fiber](https://docs.pmnd.rs/react-three-fiber) |

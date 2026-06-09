import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface RAGVisualizerProps {
  interactive?: boolean;
  density?: number;
  speed?: number;
  glowColor?: 'cyan' | 'blue' | 'teal';
}

export default function RAGVisualizer({
  interactive = true,
  density = 60,
  speed = 0.4,
  glowColor = 'cyan',
}: RAGVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // Dimensions
    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.z = 85;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Particles Setup
    const particlesCount = density;
    const positions = new Float32Array(particlesCount * 3);
    const velocities: { x: number; y: number; z: number }[] = [];
    
    // Create random positions and velocities
    for (let i = 0; i < particlesCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 120;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 120;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 120;

      velocities.push({
        x: (Math.random() - 0.5) * speed * 0.25,
        y: (Math.random() - 0.5) * speed * 0.25,
        z: (Math.random() - 0.5) * speed * 0.25,
      });
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Particle Color Theme
    let mainColor = 0x2563eb; // Blue default
    if (glowColor === 'cyan') mainColor = 0x06b6d4;
    if (glowColor === 'teal') mainColor = 0x0d9488;
    if (glowColor === 'blue') mainColor = 0x2563eb;

    const material = new THREE.PointsMaterial({
      color: mainColor,
      size: 1.8,
      transparent: true,
      opacity: 0.75,
      sizeAttenuation: true,
    });

    const particleSystem = new THREE.Points(geometry, material);
    scene.add(particleSystem);

    // Node mesh spheres for structural dots
    const spheres: THREE.Mesh[] = [];
    const sphereGeo = new THREE.SphereGeometry(0.5, 6, 6);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: mainColor,
      transparent: true,
      opacity: 0.5,
    });

    for (let i = 0; i < particlesCount; i++) {
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.position.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      scene.add(sphere);
      spheres.push(sphere);
    }

    // Connections Line setup
    const lineMaterial = new THREE.LineBasicMaterial({
      color: mainColor,
      transparent: true,
      opacity: 0.15,
    });
    
    let lineSegments: THREE.LineSegments | null = null;

    // Mouse Tracking
    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };

    const handleMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      mouse.targetX = (x / width) * 2 - 1;
      mouse.targetY = -(y / height) * 2 + 1;
    };

    if (interactive) {
      window.addEventListener('mousemove', handleMouseMove);
    }

    // Animation Loop
    let animationFrameId: number;
    
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Smooth mouse transition
      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;

      const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
      const posArr = posAttr.array as Float32Array;

      // Update positions
      for (let i = 0; i < particlesCount; i++) {
        // Move particle
        posArr[i * 3] += velocities[i].x;
        posArr[i * 3 + 1] += velocities[i].y;
        posArr[i * 3 + 2] += velocities[i].z;

        // Boundary checks
        if (Math.abs(posArr[i * 3]) > 60) velocities[i].x *= -1;
        if (Math.abs(posArr[i * 3 + 1]) > 60) velocities[i].y *= -1;
        if (Math.abs(posArr[i * 3 + 2]) > 60) velocities[i].z *= -1;

        // Gravity pull/push relative to mouse position mapped in 3D
        if (interactive) {
          const dx = posArr[i * 3] - mouse.x * 40;
          const dy = posArr[i * 3 + 1] - mouse.y * 40;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 18) {
            posArr[i * 3] += (dx / dist) * 0.12;
            posArr[i * 3 + 1] += (dy / dist) * 0.12;
          }
        }

        // Keep spheres in sync
        spheres[i].position.set(posArr[i * 3], posArr[i * 3 + 1], posArr[i * 3 + 2]);
      }

      posAttr.needsUpdate = true;

      // Draw connection lines between nearby particles
      const linePositions: number[] = [];
      const maxDistance = 20;

      for (let i = 0; i < particlesCount; i++) {
        for (let j = i + 1; j < particlesCount; j++) {
          const dx = posArr[i * 3] - posArr[j * 3];
          const dy = posArr[i * 3 + 1] - posArr[j * 3 + 1];
          const dz = posArr[i * 3 + 2] - posArr[j * 3 + 2];
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist < maxDistance) {
            linePositions.push(posArr[i * 3], posArr[i * 3 + 1], posArr[i * 3 + 2]);
            linePositions.push(posArr[j * 3], posArr[j * 3 + 1], posArr[j * 3 + 2]);
          }
        }
      }

      if (lineSegments) {
        scene.remove(lineSegments);
        lineSegments.geometry.dispose();
      }

      const lineGeometry = new THREE.BufferGeometry();
      lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
      lineSegments = new THREE.LineSegments(lineGeometry, lineMaterial);
      scene.add(lineSegments);

      // Rotate group slowly
      particleSystem.rotation.y += 0.0008;
      particleSystem.rotation.x += 0.0004;

      spheres.forEach(s => {
        s.rotation.y += 0.001;
      });

      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      width = container.clientWidth || window.innerWidth;
      height = container.clientHeight || window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (interactive) window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);

      renderer.dispose();
      geometry.dispose();
      material.dispose();
      sphereGeo.dispose();
      sphereMat.dispose();
      lineMaterial.dispose();
      if (lineSegments) {
        lineSegments.geometry.dispose();
      }

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [interactive, density, speed, glowColor]);

  return <div ref={containerRef} className="absolute inset-0 -z-10 overflow-hidden pointer-events-none opacity-40 dark:opacity-60" />;
}

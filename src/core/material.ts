import * as THREE from 'three';
import { MaterialProperties, ShadingMode, TexturePreset } from '../types';

// Cache generated procedural textures to avoid redundant canvas renders
const textureCache = new Map<TexturePreset, THREE.CanvasTexture>();

/**
 * Procedurally generates 2D canvas textures (Checkerboard, UV Grid, Stripes)
 */
export function getProceduralTexture(type: TexturePreset): THREE.Texture | null {
  if (type === 'none') return null;
  if (typeof document === 'undefined') return null;
  if (textureCache.has(type)) return textureCache.get(type)!;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  switch (type) {
    case 'checker': {
      const tileSize = 64;
      for (let y = 0; y < 512; y += tileSize) {
        for (let x = 0; x < 512; x += tileSize) {
          const isEven = (x / tileSize + y / tileSize) % 2 === 0;
          ctx.fillStyle = isEven ? '#e2e8f0' : '#1e293b';
          ctx.fillRect(x, y, tileSize, tileSize);
        }
      }
      break;
    }

    case 'uv_grid': {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 512, 512);

      const gridSize = 32;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;

      for (let i = 0; i <= 512; i += gridSize) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 512);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(512, i);
        ctx.stroke();
      }

      // Major grid lines & labels
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, 512, 512);
      ctx.font = 'bold 20px monospace';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText('U: [0..1]', 16, 36);
      ctx.fillText('V: [0..1]', 16, 64);
      break;
    }

    case 'stripes': {
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(0, 0, 512, 512);
      ctx.fillStyle = '#818cf8';
      const stripeWidth = 32;
      for (let x = 0; x < 512; x += stripeWidth * 2) {
        ctx.fillRect(x, 0, stripeWidth, 512);
      }
      break;
    }

    case 'bark': {
      // Procedural organic oak bark texture: deep longitudinal grooves & fibers
      ctx.fillStyle = '#3a2312';
      ctx.fillRect(0, 0, 512, 512);

      // Dark crevices and longitudinal grain
      for (let x = 0; x < 512; x += 4) {
        const furrowNoise = Math.sin(x * 0.12) * Math.cos(x * 0.05);
        const colVal = Math.floor(35 + furrowNoise * 20 + Math.random() * 30);
        const r = colVal + 20;
        const g = Math.floor(colVal * 0.7);
        const b = Math.floor(colVal * 0.4);
        ctx.strokeStyle = `rgb(${r},${g},${b})`;
        ctx.lineWidth = 2 + Math.random() * 3;
        ctx.beginPath();
        let curX = x;
        ctx.moveTo(curX, 0);
        for (let y = 0; y <= 512; y += 16) {
          curX += (Math.random() - 0.5) * 4;
          ctx.lineTo(curX, y);
        }
        ctx.stroke();
      }

      // Fine bark micro-fibers
      for (let i = 0; i < 600; i++) {
        const fx = Math.random() * 512;
        const fy = Math.random() * 512;
        const flen = 10 + Math.random() * 40;
        ctx.strokeStyle = Math.random() > 0.5 ? 'rgba(78, 52, 34, 0.4)' : 'rgba(20, 12, 8, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx + (Math.random() - 0.5) * 2, fy + flen);
        ctx.stroke();
      }
      break;
    }

    case 'foliage': {
      // Procedural leaf chlorophyll & venation texture
      ctx.fillStyle = '#2d5a27';
      ctx.fillRect(0, 0, 512, 512);

      // Vein network
      ctx.strokeStyle = '#4a8539';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(256, 512);
      ctx.quadraticCurveTo(256, 256, 256, 0);
      ctx.stroke();

      for (let y = 60; y < 480; y += 40) {
        ctx.lineWidth = 1.5;
        // Right side veins
        ctx.beginPath();
        ctx.moveTo(256, y);
        ctx.quadraticCurveTo(380, y - 30, 480, y - 50);
        ctx.stroke();
        // Left side veins
        ctx.beginPath();
        ctx.moveTo(256, y);
        ctx.quadraticCurveTo(132, y - 30, 32, y - 50);
        ctx.stroke();
      }
      break;
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  if (type === 'bark') {
    texture.repeat.set(1, 4);
  } else {
    texture.repeat.set(2, 2);
  }
  texture.needsUpdate = true;
  textureCache.set(type, texture);
  return texture;
}

/**
 * Creates a Three.js material configured for the selected shading mode & properties.
 */
export function createMaterial(
  props: MaterialProperties,
  shadingMode: ShadingMode = 'rendered'
): THREE.Material {
  const side = props.doubleSided ? THREE.DoubleSide : THREE.FrontSide;
  const vertexColors = !!props.vertexColors;

  switch (shadingMode) {
    case 'wireframe':
      return new THREE.MeshBasicMaterial({
        color: new THREE.Color(props.color),
        wireframe: true,
        side,
        vertexColors,
      });

    case 'normals':
      return new THREE.MeshNormalMaterial({
        wireframe: props.wireframe,
        side,
      });

    case 'solid':
      return new THREE.MeshLambertMaterial({
        color: new THREE.Color(props.color),
        wireframe: props.wireframe,
        side,
        vertexColors,
      });

    case 'rendered':
    default: {
      const texture = getProceduralTexture(props.texturePreset);
      const mat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(props.color),
        roughness: props.roughness,
        metalness: props.metalness,
        emissive: new THREE.Color(props.emissive),
        emissiveIntensity: props.emissiveIntensity,
        transmission: props.transmission,
        opacity: props.opacity,
        transparent: props.transparent || props.transmission > 0 || props.opacity < 1.0,
        wireframe: props.wireframe,
        map: texture,
        clearcoat: 0.1,
        clearcoatRoughness: 0.1,
        ior: 1.5,
        side,
        vertexColors,
      });
      return mat;
    }
  }
}

/**
 * Updates an existing Three.js material in-place to avoid rebuild overhead.
 */
export function updateMaterial(
  material: THREE.Material,
  props: MaterialProperties,
  shadingMode: ShadingMode = 'rendered'
): void {
  const side = props.doubleSided ? THREE.DoubleSide : THREE.FrontSide;
  material.side = side;

  if (material instanceof THREE.MeshPhysicalMaterial && shadingMode === 'rendered') {
    material.color.set(props.color);
    material.roughness = props.roughness;
    material.metalness = props.metalness;
    material.emissive.set(props.emissive);
    material.emissiveIntensity = props.emissiveIntensity;
    material.transmission = props.transmission;
    material.opacity = props.opacity;
    material.transparent = props.transparent || props.transmission > 0 || props.opacity < 1.0;
    material.wireframe = props.wireframe;
    material.map = getProceduralTexture(props.texturePreset);
    material.needsUpdate = true;
  } else if (material instanceof THREE.MeshStandardMaterial) {
    material.color.set(props.color);
    material.roughness = props.roughness;
    material.metalness = props.metalness;
    material.wireframe = props.wireframe;
    material.needsUpdate = true;
  }
}

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
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
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
  switch (shadingMode) {
    case 'wireframe':
      return new THREE.MeshBasicMaterial({
        color: new THREE.Color(props.color),
        wireframe: true,
      });

    case 'normals':
      return new THREE.MeshNormalMaterial({
        wireframe: props.wireframe,
      });

    case 'solid':
      return new THREE.MeshLambertMaterial({
        color: new THREE.Color(props.color),
        wireframe: props.wireframe,
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

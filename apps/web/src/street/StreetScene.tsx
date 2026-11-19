import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, MeshReflectorMaterial, OrbitControls, PerformanceMonitor, Sky } from "@react-three/drei";
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { along, buildingsGeometry, furnitureGeometry, greensGeometry, lakeShape, landmarkGeometry, pavingGeometry, roadsGeometry, TOUR, trees, vehicles, walkers, type Shot } from "./world.js";

export type Mode = "tour" | "walk" | "drone";
export type Light = "morning" | "noon" | "golden";
export interface SceneProps {
  mode: Mode; light: Light; quality: "high" | "low"; playing: boolean;
  /** cinematic tour progress 0..1, written by the scene every frame (the page reads it for the timeline and captions) */
  progress: MutableRefObject<number>;
  /** a request to jump the tour to a progress value (consumed once) */
  seek: MutableRefObject<number | null>;
  start?: [number, number];
  onReady?: () => void;
  onQuality?: (q: "high" | "low") => void;
}

const SUN: Record<Light, { pos: [number, number, number]; color: string; intensity: number; sky: { turbidity: number; rayleigh: number; mie: number }; fog: string; hemi: [string, string] }> = {
  morning: { pos: [-260, 120, 160], color: "#ffe2c4", intensity: 2.6, sky: { turbidity: 6, rayleigh: 1.4, mie: 0.006 }, fog: "#e9e2d6", hemi: ["#cfe0f0", "#b49a7a"] },
  noon: { pos: [80, 420, 140], color: "#fff8ee", intensity: 3.2, sky: { turbidity: 4, rayleigh: 0.9, mie: 0.004 }, fog: "#e6e9ea", hemi: ["#d8e7f5", "#b9a284"] },
  golden: { pos: [320, 70, 40], color: "#ffbf85", intensity: 2.9, sky: { turbidity: 5, rayleigh: 2, mie: 0.006 }, fog: "#e9d6c2", hemi: ["#f2cfb2", "#8d6c50"] },
};

// --- procedural textures (no image files, nothing fetched) --------------------------------------------------------------------
function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void, repeat = 1) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  draw(c.getContext("2d")!, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
const noise = (g: CanvasRenderingContext2D, s: number, base: string, spots: string[], n: number, max = 3) => {
  g.fillStyle = base; g.fillRect(0, 0, s, s);
  for (let i = 0; i < n; i++) { g.fillStyle = spots[i % spots.length]!; g.globalAlpha = Math.random() * 0.35; g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * max, 1 + Math.random() * max); }
  g.globalAlpha = 1;
};
/** Wall texture tiled in world metres: one floor (3.2 m) by one bay (3.2 m) with a window, sill and lintel. White, so the
 *  per-building plaster colour shows through. */
const windowsTexture = () => canvasTexture(128, (g, s) => {
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, s, s);
  noise(g, s, "#ffffff", ["#d8d0c4", "#efe8de"], 900, 2);
  g.fillStyle = "#e9e1d4"; g.fillRect(0, s * 0.92, s, s * 0.08);                 // floor band
  g.fillStyle = "#3b4a52"; g.fillRect(s * 0.28, s * 0.3, s * 0.44, s * 0.42);    // glass
  g.fillStyle = "#6b7f88"; g.fillRect(s * 0.28, s * 0.3, s * 0.44, s * 0.06);    // sky reflection
  g.fillStyle = "#b8ab98"; g.fillRect(s * 0.25, s * 0.72, s * 0.5, s * 0.04);    // sill
  g.fillStyle = "#cfc4b2"; g.fillRect(s * 0.25, s * 0.26, s * 0.5, s * 0.04);    // lintel
  g.fillStyle = "#4a3b2c"; g.fillRect(s * 0.495, s * 0.3, s * 0.01, s * 0.42);   // mullion
});

// --- scene parts ------------------------------------------------------------------------------------------------------------
function World({ quality }: { quality: "high" | "low" }) {
  const data = useMemo(() => {
    const b = buildingsGeometry(), l = landmarkGeometry(), r = roadsGeometry();
    return { b, l, r, greens: greensGeometry(), paving: pavingGeometry(), furniture: furnitureGeometry(), lake: new THREE.ShapeGeometry(lakeShape()), trees: trees() };
  }, []);
  const tex = useMemo(() => {
    const walls = windowsTexture(); walls.repeat.set(1 / 3.2, 1 / 3.2);
    const ground = canvasTexture(256, (g, s) => noise(g, s, "#d8c3a0", ["#cdb48c", "#e7d7b9", "#bfa47e", "#c9b08a"], 6000, 3), 260);
    const asphalt = canvasTexture(256, (g, s) => noise(g, s, "#4b4d4f", ["#5d5f61", "#3a3b3d", "#6a6458"], 7000, 2), 1);
    asphalt.repeat.set(1, 0.3);
    const roof = canvasTexture(128, (g, s) => noise(g, s, "#c7c0b4", ["#aaa296", "#d8d2c6", "#8f877c"], 2500, 3), 1);
    roof.repeat.set(1 / 6, 1 / 6);
    const stone = canvasTexture(128, (g, s) => { noise(g, s, "#ffffff", ["#e8d9c8", "#f6eee4"], 1400, 2); g.strokeStyle = "rgba(120,80,50,.18)"; for (let y = 0; y < s; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke(); } });
    stone.repeat.set(1 / 4, 1 / 4);
    return { walls, ground, asphalt, roof, stone };
  }, []);
  useEffect(() => () => { Object.values(tex).forEach((t) => t.dispose()); }, [tex]);
  const trunk = useRef<THREE.InstancedMesh>(null), crown = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const tones = [new THREE.Color("#5f7d3a"), new THREE.Color("#6f8f45"), new THREE.Color("#4d6b33")];
    data.trees.forEach((t, i) => {
      trunk.current?.setMatrixAt(i, m.compose(p.set(t.x, t.h * 0.3, t.z), q.identity(), s.set(1, t.h * 0.6, 1)));
      crown.current?.setMatrixAt(i, m.compose(p.set(t.x, t.h * 0.72, t.z), q.setFromEuler(new THREE.Euler(0, i, 0)), s.set(t.r, t.h * 0.42, t.r)));
      crown.current?.setColorAt(i, tones[t.tone % 3]!);
    });
    if (trunk.current) trunk.current.instanceMatrix.needsUpdate = true;
    if (crown.current) { crown.current.instanceMatrix.needsUpdate = true; if (crown.current.instanceColor) crown.current.instanceColor.needsUpdate = true; }
  }, [data]);
  const shadows = quality === "high";
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow position-y={0}>
        <planeGeometry args={[4000, 4000]} />
        <meshStandardMaterial map={tex.ground} roughness={1} />
      </mesh>
      <mesh geometry={data.greens} receiveShadow><meshStandardMaterial color="#7d9a52" roughness={1} /></mesh>
      <mesh geometry={data.paving} receiveShadow><meshStandardMaterial map={tex.stone} color="#d9c2a2" roughness={0.9} /></mesh>
      <mesh geometry={data.r.kerb} receiveShadow><meshStandardMaterial color="#b7ab96" roughness={0.95} /></mesh>
      <mesh geometry={data.r.asphalt} receiveShadow><meshStandardMaterial map={tex.asphalt} roughness={0.88} /></mesh>
      <mesh geometry={data.r.lines}><meshStandardMaterial color="#f2efe6" roughness={0.6} /></mesh>
      <mesh geometry={data.b.roofs} castShadow={shadows} receiveShadow><meshStandardMaterial map={tex.roof} vertexColors roughness={0.95} /></mesh>
      <mesh geometry={data.b.walls} castShadow={shadows} receiveShadow><meshStandardMaterial map={tex.walls} vertexColors roughness={0.85} /></mesh>
      <mesh geometry={data.l.geometry} castShadow={shadows} receiveShadow><meshStandardMaterial map={tex.stone} vertexColors roughness={0.8} /></mesh>
      {data.l.domes.map((d, i) => (
        <group key={i} position={[d.x, d.base, d.z]}>
          <mesh castShadow={shadows} scale={[d.r, Math.max(d.rise, d.r * 0.75), d.r]}>
            <sphereGeometry args={[1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#e8c29a" roughness={0.65} />
          </mesh>
          <mesh position-y={Math.max(d.rise, d.r * 0.75) + d.r * 0.12}><coneGeometry args={[d.r * 0.07, d.r * 0.35, 8]} /><meshStandardMaterial color="#b88a4a" metalness={0.4} roughness={0.4} /></mesh>
        </group>
      ))}
      <mesh geometry={data.furniture} castShadow={shadows} receiveShadow><meshStandardMaterial vertexColors roughness={0.7} /></mesh>
      <mesh geometry={data.lake} rotation-x={-Math.PI / 2} position-y={0.12}>
        {quality === "high"
          ? <MeshReflectorMaterial resolution={512} mirror={0.6} blur={[300, 80]} mixBlur={1} mixStrength={1.4} roughness={0.9} depthScale={0.6} minDepthThreshold={0.4} maxDepthThreshold={1.2} color="#5f8a93" metalness={0.3} />
          : <meshStandardMaterial color="#5f8a93" roughness={0.15} metalness={0.3} />}
      </mesh>
      <instancedMesh ref={trunk} frustumCulled={false} args={[undefined, undefined, data.trees.length]} castShadow={shadows}>
        <cylinderGeometry args={[0.18, 0.28, 1, 6]} /><meshStandardMaterial color="#5a4632" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={crown} frustumCulled={false} args={[undefined, undefined, data.trees.length]} castShadow={shadows}>
        <icosahedronGeometry args={[1, 2]} /><meshStandardMaterial roughness={0.9} flatShading />
      </instancedMesh>
    </group>
  );
}

/** Anonymous figures: a body and a head, coloured clothes; children loop and play, seated people sway, pedestrians walk. */
function People() {
  const list = useMemo(() => walkers(), []);
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => {
    const body = new THREE.CapsuleGeometry(0.21, 0.82, 4, 8); body.translate(0, 0.62, 0);
    const head = new THREE.SphereGeometry(0.13, 10, 8); head.translate(0, 1.38, 0);
    const b = body.toNonIndexed(), h = head.toNonIndexed();
    const g = new THREE.BufferGeometry();
    for (const k of ["position", "normal"] as const) {
      const a = b.getAttribute(k).array as Float32Array, c = h.getAttribute(k).array as Float32Array, out = new Float32Array(a.length + c.length);
      out.set(a); out.set(c, a.length); g.setAttribute(k, new THREE.BufferAttribute(out, 3));
    }
    return g;
  }, []);
  useEffect(() => { list.forEach((w, i) => ref.current?.setColorAt(i, new THREE.Color(w.color))); if (ref.current?.instanceColor) ref.current.instanceColor.needsUpdate = true; }, [list]);
  const m = useMemo(() => new THREE.Matrix4(), []), q = useMemo(() => new THREE.Quaternion(), []), e = useMemo(() => new THREE.Euler(), []);
  const p = useMemo(() => new THREE.Vector3(), []), s = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    list.forEach((w, i) => {
      if (w.mode === "sit" || w.speed === 0) {
        const [x, z] = w.path[0]!;
        p.set(x, w.mode === "sit" ? -0.38 : 0, z); s.set(w.scale, w.mode === "sit" ? w.scale * 0.72 : w.scale, w.scale);
        q.setFromEuler(e.set(Math.sin(t * 0.7 + w.offset * 9) * 0.04, w.offset * 6, 0));
      } else {
        const len = w.path.slice(1).reduce((a, b, k) => a + Math.hypot(b[0] - w.path[k]![0], b[1] - w.path[k]![1]), 0) || 1;
        let d = (t * w.speed + w.offset * len) % (2 * len);
        const back = d > len; if (back) d = 2 * len - d;
        const a = along(w.path, w.mode === "play" ? (t * w.speed + w.offset * len) % len : d);
        const bob = Math.abs(Math.sin(t * (w.mode === "play" ? 9 : 6) + w.offset * 10)) * (w.mode === "play" ? 0.12 : 0.04);
        p.set(a.x, bob, a.z); s.setScalar(w.scale);
        q.setFromEuler(e.set(0, a.heading + (back && w.mode !== "play" ? Math.PI : 0), 0));
      }
      ref.current?.setMatrixAt(i, m.compose(p, q, s));
    });
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} frustumCulled={false} args={[geo, undefined, list.length]} castShadow><meshStandardMaterial roughness={0.8} /></instancedMesh>;
}

function Traffic() {
  const list = useMemo(() => vehicles(), []);
  const kinds = useMemo(() => ({
    car: { body: [4.3, 1.1, 1.8], cabin: [2.3, 0.7, 1.6], items: list.filter((v) => v.kind === "car") },
    auto: { body: [2.6, 1.0, 1.35], cabin: [1.6, 0.8, 1.3], items: list.filter((v) => v.kind === "auto") },
    bus: { body: [11, 2.8, 2.5], cabin: [10.6, 0.4, 2.4], items: list.filter((v) => v.kind === "bus") },
  }), [list]);
  return <>{Object.entries(kinds).map(([k, v]) => <VehicleSet key={k} {...v} />)}</>;
}
function VehicleSet({ body, cabin, items }: { body: number[]; cabin: number[]; items: ReturnType<typeof vehicles> }) {
  const ref = useRef<THREE.InstancedMesh>(null), glass = useRef<THREE.InstancedMesh>(null);
  const m = useMemo(() => new THREE.Matrix4(), []), q = useMemo(() => new THREE.Quaternion(), []), p = useMemo(() => new THREE.Vector3(), []), one = useMemo(() => new THREE.Vector3(1, 1, 1), []), up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  useEffect(() => { items.forEach((v, i) => ref.current?.setColorAt(i, new THREE.Color(v.color))); if (ref.current?.instanceColor) ref.current.instanceColor.needsUpdate = true; }, [items]);
  useFrame(({ clock }) => {
    items.forEach((v, i) => {
      const dir = v.lane > 0 ? 1 : -1, d = ((clock.elapsedTime * v.speed + v.offset * v.length) % v.length);
      const a = along(v.path, dir > 0 ? d : v.length - d, v.lane);
      q.setFromAxisAngle(up, a.heading + (dir > 0 ? 0 : Math.PI) - Math.PI / 2);
      ref.current?.setMatrixAt(i, m.compose(p.set(a.x, body[1]! / 2 + 0.25, a.z), q, one));
      glass.current?.setMatrixAt(i, m.compose(p.set(a.x, body[1]! + 0.25 + cabin[1]! / 2, a.z), q, one));
    });
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
    if (glass.current) glass.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={ref} frustumCulled={false} args={[undefined, undefined, items.length]} castShadow><boxGeometry args={body as [number, number, number]} /><meshStandardMaterial roughness={0.35} metalness={0.5} /></instancedMesh>
      <instancedMesh ref={glass} frustumCulled={false} args={[undefined, undefined, items.length]}><boxGeometry args={cabin as [number, number, number]} /><meshStandardMaterial color="#1d2a33" roughness={0.1} metalness={0.8} /></instancedMesh>
    </>
  );
}

/** Sun with a shadow frustum that follows what the camera looks at, so shadows stay crisp from the drone height to eye level. */
function Sun({ light, quality }: { light: Light; quality: "high" | "low" }) {
  const ref = useRef<THREE.DirectionalLight>(null);
  const { camera } = useThree();
  const target = useMemo(() => new THREE.Object3D(), []), dir = useMemo(() => new THREE.Vector3(), []), focus = useMemo(() => new THREE.Vector3(), []);
  const s = SUN[light];
  useFrame(() => {
    if (!ref.current) return;
    camera.getWorldDirection(dir);
    const reach = Math.min(160, Math.max(25, camera.position.y * 1.2));
    focus.copy(camera.position).addScaledVector(dir, reach * 0.6).setY(0);
    target.position.copy(focus);
    ref.current.position.set(focus.x + s.pos[0], s.pos[1], focus.z + s.pos[2]);
    const cam = ref.current.shadow.camera as THREE.OrthographicCamera;
    if (cam.right !== reach) { cam.left = -reach; cam.right = reach; cam.top = reach; cam.bottom = -reach; cam.updateProjectionMatrix(); }
  });
  return (
    <>
      <primitive object={target} />
      <directionalLight ref={ref} target={target} color={s.color} intensity={s.intensity} castShadow={quality === "high"}
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.04} shadow-camera-near={1} shadow-camera-far={1200} />
      <hemisphereLight args={[s.hemi[0], s.hemi[1], 0.9]} />
    </>
  );
}

// --- cameras ----------------------------------------------------------------------------------------------------------------
const TOUR_SECONDS_PER_SHOT = 9;
function TourCamera({ playing, progress, seek }: { playing: boolean; progress: MutableRefObject<number>; seek: MutableRefObject<number | null> }) {
  const { camera } = useThree();
  const curves = useMemo(() => ({
    pos: new THREE.CatmullRomCurve3(TOUR.map((s: Shot) => new THREE.Vector3(...s.pos)), false, "centripetal", 0.5),
    look: new THREE.CatmullRomCurve3(TOUR.map((s: Shot) => new THREE.Vector3(...s.look)), false, "centripetal", 0.5),
  }), []);
  const look = useMemo(() => new THREE.Vector3(), []), smooth = useRef<THREE.Vector3 | null>(null);
  useFrame((_, dt) => {
    if (seek.current !== null) { progress.current = seek.current; seek.current = null; smooth.current = null; }
    if (playing) progress.current = Math.min(1, progress.current + Math.min(dt, 0.05) / (TOUR_SECONDS_PER_SHOT * (TOUR.length - 1)));
    // ease in and out of the whole flight, so it starts and lands gently
    const u = progress.current, e = u * u * (3 - 2 * u) * 0.12 + u * 0.88;
    camera.position.copy(curves.pos.getPoint(e));
    curves.look.getPoint(Math.min(1, e + 0.004), look);
    smooth.current = smooth.current ? smooth.current.lerp(look, 0.06) : look.clone();
    camera.lookAt(smooth.current);
  });
  return null;
}
/** Eye-level walking: drag to look, W A S D or arrow keys to move, Shift to hurry. */
function WalkCamera({ start }: { start?: [number, number] }) {
  const { camera, gl } = useThree();
  const state = useRef({ yaw: 0, pitch: 0.05, keys: new Set<string>(), drag: false, x: start?.[0] ?? 2, z: start?.[1] ?? 48, bob: 0 });
  useEffect(() => {
    const el = gl.domElement, s = state.current;
    const down = (e: PointerEvent) => { s.drag = true; el.setPointerCapture(e.pointerId); };
    const up = () => { s.drag = false; };
    const move = (e: PointerEvent) => { if (!s.drag) return; s.yaw -= e.movementX * 0.0032; s.pitch = Math.max(-1.1, Math.min(1.1, s.pitch - e.movementY * 0.0032)); };
    const kd = (e: KeyboardEvent) => { if (/^(Key[WASD]|Arrow|Shift)/.test(e.code)) { s.keys.add(e.code); if (e.code.startsWith("Arrow")) e.preventDefault(); } };
    const ku = (e: KeyboardEvent) => s.keys.delete(e.code);
    el.addEventListener("pointerdown", down); window.addEventListener("pointerup", up); window.addEventListener("pointermove", move);
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
    return () => { el.removeEventListener("pointerdown", down); window.removeEventListener("pointerup", up); window.removeEventListener("pointermove", move); window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, [gl]);
  useEffect(() => { (window as unknown as { __walk?: (f: number, r: number) => void }).__walk = (f, r) => { const s = state.current; s.x += (Math.sin(s.yaw) * f + Math.cos(s.yaw) * r); s.z += (Math.cos(s.yaw) * f - Math.sin(s.yaw) * r); }; }, []);
  useFrame((_, dt) => {
    const s = state.current, k = s.keys, speed = (k.has("ShiftLeft") || k.has("ShiftRight") ? 7 : 3.2) * Math.min(dt, 0.05);
    const f = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0);
    const r = (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0), turn = (k.has("ArrowLeft") ? 1 : 0) - (k.has("ArrowRight") ? 1 : 0);
    s.yaw += turn * 1.6 * Math.min(dt, 0.05);
    if (f || r) { s.x -= (Math.sin(s.yaw) * f - Math.cos(s.yaw) * r) * speed; s.z -= (Math.cos(s.yaw) * f + Math.sin(s.yaw) * r) * speed; s.bob += speed * 3.2; }
    camera.position.set(s.x, 1.68 + Math.sin(s.bob) * 0.035, s.z);
    camera.rotation.set(s.pitch, s.yaw, 0, "YXZ");
  });
  return null;
}

/** Drone mode always opens on the same framed view of the Roza and the tank. */
function DroneStart() {
  const { camera } = useThree();
  useEffect(() => { camera.position.set(-150, 95, 190); camera.lookAt(0, 8, 0); }, [camera]);
  return null;
}

function Effects({ quality }: { quality: "high" | "low" }) {
  if (quality === "low") return <EffectComposer multisampling={0}><ToneMapping mode={ToneMappingMode.ACES_FILMIC} /><Vignette offset={0.3} darkness={0.45} /></EffectComposer>;
  return (
    <EffectComposer multisampling={0}>
      <N8AO aoRadius={2.2} intensity={2.4} distanceFalloff={1.2} quality="medium" halfRes />
      <Bloom luminanceThreshold={0.95} luminanceSmoothing={0.15} intensity={0.3} mipmapBlur />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <SMAA />
      <Vignette offset={0.28} darkness={0.5} />
    </EffectComposer>
  );
}

function Ready({ onReady }: { onReady?: () => void }) {
  const done = useRef(false);
  useFrame(() => { if (!done.current) { done.current = true; requestAnimationFrame(() => onReady?.()); } });
  return null;
}

export default function StreetScene({ mode, light, quality, playing, progress, seek, start, onReady, onQuality }: SceneProps) {
  const s = SUN[light];
  return (
    <Canvas className="street-canvas" shadows={quality === "high"} dpr={quality === "high" ? [1, 1.75] : [0.75, 1]}
      gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
      camera={{ fov: mode === "walk" ? 70 : 52, near: 0.3, far: 5000, position: [-260, 170, 520] }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.NoToneMapping; }}>
      <PerformanceMonitor onDecline={() => onQuality?.("low")} />
      <color attach="background" args={[s.fog]} />
      <fog attach="fog" args={[s.fog, 650, 3200]} />
      <Sky distance={4500} sunPosition={s.pos} turbidity={s.sky.turbidity} rayleigh={s.sky.rayleigh} mieCoefficient={s.sky.mie} mieDirectionalG={0.85} />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={2} color={s.color} position={[s.pos[0] / 40, s.pos[1] / 40, s.pos[2] / 40]} scale={[10, 4, 1]} />
        <Lightformer form="rect" intensity={0.6} color={s.hemi[0]} position={[0, 8, -10]} scale={[30, 8, 1]} />
      </Environment>
      <Sun light={light} quality={quality} />
      <World quality={quality} />
      <People />
      <Traffic />
      {mode === "tour" && <TourCamera playing={playing} progress={progress} seek={seek} />}
      {mode === "walk" && <WalkCamera start={start} />}
      {mode === "drone" && <DroneStart />}
      {mode === "drone" && <OrbitControls makeDefault enableDamping dampingFactor={0.06} target={[0, 8, 0]} minDistance={18} maxDistance={900} maxPolarAngle={Math.PI * 0.47} autoRotate={playing} autoRotateSpeed={0.35} />}
      <Effects quality={quality} />
      <Ready onReady={onReady} />
    </Canvas>
  );
}

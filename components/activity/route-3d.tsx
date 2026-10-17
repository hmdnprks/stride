"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { RouteModel } from "@/lib/route-3d";
import { WALL_WIDTH } from "@/lib/route-3d";

/**
 * The route as a solid wall on the watch-face panel, like a circuit model.
 * three.js loads only here, after the page; until then (and without WebGL)
 * the flat drawing passed as `fallback` shows instead.
 */
export function Route3D({ model, fallback, caption }: { model: RouteModel; fallback: ReactNode; caption: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
      if (disposed) return;

      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      } catch {
        return; // No WebGL: keep the flat drawing.
      }
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
      renderer.domElement.className = "block h-full w-full touch-pan-y outline-none";
      renderer.domElement.setAttribute("aria-hidden", "true");
      el.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 200);

      // Light from above and in front; the hemisphere tints shaded walls with
      // the panel's blue so the model sits in the same palette.
      scene.add(new THREE.HemisphereLight(0xffffff, 0x1f47f5, 0.9));
      const sun = new THREE.DirectionalLight(0xffffff, 2.6);
      sun.position.set(-8, 16, 6);
      scene.add(sun);
      const rim = new THREE.DirectionalLight(0xb9c7ff, 0.8);
      rim.position.set(9, 4, -10);
      scene.add(rim);

      const model3d = buildWall(THREE, model);
      scene.add(model3d);

      const box = new THREE.Box3().setFromObject(model3d);
      const target = box.getCenter(new THREE.Vector3());
      // Look at the route side-on to its long axis, a quarter-turn off square,
      // from above; then pull in until it fills the panel.
      const view = new THREE.Spherical(1, THREE.MathUtils.degToRad(55), -model.axis + THREE.MathUtils.degToRad(22));
      // Fit to the wall itself (top and foot of every few points), not its
      // bounding box, whose corners stand far off a diagonal route.
      const corners = model.points
        .filter((_, i) => i % 4 === 0 || i === model.points.length - 1)
        .flatMap(([x, z], i) => [new THREE.Vector3(x, 0, z), new THREE.Vector3(x, model.heights[Math.min(i * 4, model.heights.length - 1)], z)]);
      const frame = () => {
        view.radius = box.getBoundingSphere(new THREE.Sphere()).radius * 4;
        for (let pass = 0; pass < 4; pass++) {
          camera.position.setFromSpherical(view).add(target);
          camera.lookAt(target);
          camera.updateMatrixWorld();
          const reach = Math.max(...corners.map((c) => {
            const p = c.clone().project(camera);
            return Math.max(Math.abs(p.x), Math.abs(p.y));
          }));
          view.radius *= reach / 0.86;
        }
        camera.position.setFromSpherical(view).add(target);
        camera.lookAt(target);
      };

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.copy(target);
      controls.enableZoom = false; // Page scroll stays page scroll.
      controls.enablePan = false;
      controls.enableDamping = true;
      controls.minPolarAngle = THREE.MathUtils.degToRad(12);
      controls.maxPolarAngle = THREE.MathUtils.degToRad(78); // Never from below the ground.
      controls.update();

      const resize = () => {
        const { width, height } = el.getBoundingClientRect();
        if (!width || !height) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      // Fit once at the panel's real size; resizes after that keep the view.
      resize();
      frame();
      controls.update();
      const ro = new ResizeObserver(resize);
      ro.observe(el);

      // One moment on arrival: the walls rise from the ground.
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const born = performance.now();
      const RISE_MS = 900;
      model3d.scale.y = reduce ? 1 : 0.001;

      // Only animate while the model is on screen.
      let visible = true;
      const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
      io.observe(el);
      renderer.setAnimationLoop((now) => {
        if (!visible) return;
        if (model3d.scale.y < 1) {
          const t = Math.min(1, (now - born) / RISE_MS);
          model3d.scale.y = Math.max(0.001, 1 - (1 - t) ** 3);
        }
        controls.update();
        renderer.render(scene, camera);
      });

      setReady(true);
      cleanup = () => {
        renderer.setAnimationLoop(null);
        io.disconnect();
        ro.disconnect();
        controls.dispose();
        model3d.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose();
            (o.material as InstanceType<typeof THREE.Material>).dispose();
          }
        });
        renderer.dispose();
        renderer.domElement.remove();
      };

      // Arrow keys turn the model (OrbitControls only pans with keys).
      const turn = (dTheta: number, dPhi: number) => {
        const s = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
        s.theta += dTheta;
        s.phi = THREE.MathUtils.clamp(s.phi + dPhi, controls.minPolarAngle, controls.maxPolarAngle);
        camera.position.setFromSpherical(s).add(controls.target);
        controls.update();
      };
      const onKey = (e: KeyboardEvent) => {
        const step = THREE.MathUtils.degToRad(10);
        if (e.key === "ArrowLeft") turn(-step, 0);
        else if (e.key === "ArrowRight") turn(step, 0);
        else if (e.key === "ArrowUp") turn(0, -step / 2);
        else if (e.key === "ArrowDown") turn(0, step / 2);
        else return;
        e.preventDefault();
      };
      el.addEventListener("keydown", onKey);
      const prevCleanup = cleanup;
      cleanup = () => {
        el.removeEventListener("keydown", onKey);
        prevCleanup();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [model]);

  return (
    <figure className="flex flex-col gap-2">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] bg-panel text-panel-foreground">
        <div
          ref={host}
          tabIndex={0}
          role="img"
          aria-label="The route as a 3D model. Use the arrow keys to turn it."
          className="absolute inset-0 cursor-grab rounded-[2rem] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:cursor-grabbing"
        />
        {!ready && <div className="absolute inset-0 p-4">{fallback}</div>}
      </div>
      <figcaption className="text-sm text-muted-foreground">{caption}</figcaption>
    </figure>
  );
}

type Three = typeof import("three");

/**
 * One mesh per face group (top, both walls, end caps), so edges stay crisp
 * while each face shades smoothly along the route.
 */
function buildWall(THREE: Three, model: RouteModel) {
  const { points, heights, loop } = model;
  const n = points.length;
  const half = WALL_WIDTH / 2;

  // Offsets either side, using the average direction at each point (a mitre,
  // capped so tight hairpins don't spike).
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const prev = points[i === 0 ? (loop ? n - 2 : 0) : i - 1];
    const next = points[i === n - 1 ? (loop ? 1 : n - 1) : i + 1];
    let dx = next[0] - prev[0];
    let dz = next[1] - prev[1];
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    const [nx, nz] = [-dz, dx];
    left.push([points[i][0] + nx * half, points[i][1] + nz * half]);
    right.push([points[i][0] - nx * half, points[i][1] - nz * half]);
  }

  const strip = (a: [number, number, number][], b: [number, number, number][]) => {
    const pos: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i < a.length; i++) pos.push(...a[i], ...b[i]);
    for (let i = 0; i < a.length - 1; i++) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };

  const at = (side: [number, number][], i: number, y: number) => [side[i][0], y, side[i][1]] as [number, number, number];
  const top = strip(
    left.map((_, i) => at(left, i, heights[i])),
    right.map((_, i) => at(right, i, heights[i])),
  );
  const wallL = strip(
    left.map((_, i) => at(left, i, 0)),
    left.map((_, i) => at(left, i, heights[i])),
  );
  const wallR = strip(
    right.map((_, i) => at(right, i, heights[i])),
    right.map((_, i) => at(right, i, 0)),
  );

  const surface = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0, side: THREE.DoubleSide });
  const group = new THREE.Group();
  for (const g of [top, wallL, wallR]) group.add(new THREE.Mesh(g, surface.clone()));

  if (!loop) {
    for (const i of [0, n - 1]) {
      const cap = strip([at(left, i, 0), at(left, i, heights[i])], [at(right, i, 0), at(right, i, heights[i])]);
      group.add(new THREE.Mesh(cap, surface.clone()));
    }
  }

  // The start: a navy block across the wall, a little taller, like a start gantry.
  const [sx, sz] = points[0];
  const [ax, az] = points[Math.min(3, n - 1)];
  const block = new THREE.Mesh(
    new THREE.BoxGeometry(WALL_WIDTH * 2.2, heights[0] * 1.35, WALL_WIDTH * 0.9),
    new THREE.MeshStandardMaterial({ color: 0x0a1b5c, roughness: 0.5 }),
  );
  block.position.set(sx, (heights[0] * 1.35) / 2, sz);
  block.rotation.y = Math.atan2(ax - sx, az - sz);
  group.add(block);

  return group;
}

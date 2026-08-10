import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

type AssetModelPreviewProps = {
  cameraPreset: string;
  renderMode?: "shaded" | "static" | "wireframe";
  resetToken?: number;
  url: string;
};

function disposeMaterial(material: THREE.Material): void {
  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture) {
      value.dispose();
    }
  }
  material.dispose();
}

function disposeObject(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      materials.forEach(disposeMaterial);
    }
  });
}

function setObjectWireframe(root: THREE.Object3D, wireframe: boolean): void {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    for (const material of materials) {
      if ("wireframe" in material) {
        (material as THREE.MeshBasicMaterial).wireframe = wireframe;
        material.needsUpdate = true;
      }
    }
  });
}

export function AssetModelPreview({
  cameraPreset,
  renderMode = "shaded",
  resetToken = 0,
  url,
}: AssetModelPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const radiusRef = useRef(1);
  const renderRef = useRef<(() => void) | null>(null);
  const [state, setState] = useState<"error" | "loading" | "ready">("loading");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    setState("loading");
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 10_000);
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.setAttribute("aria-label", "可旋轉的私人 GLB 模型");
    renderer.domElement.setAttribute("role", "img");
    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xdce9ff, 0x111827, 2.1));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.4);
    keyLight.position.set(4, 5, 3);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x53d9ff, 1.6);
    fillLight.position.set(-4, 1, -2);
    scene.add(fillLight);
    const grid = new THREE.GridHelper(10, 20, 0x24415c, 0x162334);
    grid.position.y = -0.01;
    scene.add(grid);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.screenSpacePanning = true;
    controls.minDistance = 0.05;
    controls.maxDistance = 5_000;

    const render = () => renderer.render(scene, camera);
    renderRef.current = render;
    cameraRef.current = camera;
    controlsRef.current = controls;
    controls.addEventListener("change", render);

    const resize = () => {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      render();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    let model: THREE.Object3D | null = null;
    let disposed = false;
    const loader = new GLTFLoader();
    void loader
      .loadAsync(url)
      .then((gltf) => {
        if (disposed) {
          disposeObject(gltf.scene);
          return;
        }
        model = gltf.scene;
        modelRef.current = model;
        const box = new THREE.Box3().setFromObject(model);
        if (box.isEmpty()) {
          throw new Error("GLB contains no renderable bounds.");
        }
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        model.position.sub(center);
        model.position.y += size.y / 2;
        scene.add(model);

        radiusRef.current = Math.max(size.length() / 2, 0.01);
        camera.near = Math.max(radiusRef.current / 100, 0.001);
        camera.far = Math.max(radiusRef.current * 100, 10);
        camera.updateProjectionMatrix();
        controls.target.set(0, size.y * 0.35, 0);
        setState("ready");
        render();
      })
      .catch(() => {
        if (!disposed) {
          setState("error");
        }
      });

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      controls.removeEventListener("change", render);
      controls.dispose();
      if (model) {
        disposeObject(model);
        scene.remove(model);
      }
      grid.geometry.dispose();
      disposeMaterial(grid.material);
      renderer.dispose();
      renderer.domElement.remove();
      cameraRef.current = null;
      controlsRef.current = null;
      modelRef.current = null;
      renderRef.current = null;
    };
  }, [url]);

  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls || state !== "ready") {
      return;
    }
    const distance = Math.max(radiusRef.current * 2.8, 0.1);
    switch (cameraPreset) {
      case "正面":
        camera.position.set(0, distance * 0.35, distance);
        break;
      case "左側":
        camera.position.set(-distance, distance * 0.35, 0);
        break;
      case "頂部":
        camera.position.set(0, distance, 0.001);
        break;
      default:
        camera.position.set(distance, distance * 0.75, distance);
        break;
    }
    camera.lookAt(controls.target);
    controls.update();
    renderRef.current?.();
  }, [cameraPreset, resetToken, state]);

  useEffect(() => {
    const controls = controlsRef.current;
    const model = modelRef.current;
    if (!controls || !model || state !== "ready") {
      return;
    }
    controls.enabled = renderMode !== "static";
    setObjectWireframe(model, renderMode === "wireframe");
    renderRef.current?.();
  }, [renderMode, state]);

  return (
    <div className="asset-model-preview" ref={containerRef}>
      {state !== "ready" ? (
        <span className={`asset-model-preview__state is-${state}`}>
          {state === "loading"
            ? "正在解碼私人 GLB…"
            : "無法顯示此 GLB；檔案仍維持私人。"}
        </span>
      ) : null}
    </div>
  );
}

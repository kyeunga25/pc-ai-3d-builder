import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import {
  assetModelPreviewCopy,
  assetModelPreviewLabel,
} from "./asset-model-preview-copy";

type AssetModelPreviewProps = {
  cameraPreset: string;
  layout?: "review-grid" | "single";
  models?: readonly AssetModelPreviewResource[];
  onLoadResult?: (result: AssetModelPreviewLoadResult) => void;
  renderMode?: "shaded" | "static" | "wireframe";
  resetToken?: number;
  url?: string;
};

export type AssetModelPreviewResource = {
  readonly key: string;
  readonly url: string;
};

export type AssetModelPreviewLoadResult = {
  readonly failedCount: number;
  readonly loadedCount: number;
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

function modelBounds(root: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) throw new Error("GLB contains no renderable bounds.");
  return box;
}

function centreSingleModel(root: THREE.Object3D): void {
  const box = modelBounds(root);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  root.position.sub(center);
  root.position.y += size.y / 2;
}

function reviewGridPosition(
  index: number,
  count: number,
): { x: number; z: number } {
  const columns = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(count))));
  const rows = Math.ceil(count / columns);
  const column = index % columns;
  const row = Math.floor(index / columns);
  const modelsInRow = Math.min(columns, count - row * columns);
  return {
    x: (column - (modelsInRow - 1) / 2) * 1.65,
    z: (row - (rows - 1) / 2) * 1.65,
  };
}

function prepareReviewModel(
  root: THREE.Object3D,
  index: number,
  count: number,
): THREE.Group {
  const initialBounds = modelBounds(root);
  const initialSize = initialBounds.getSize(new THREE.Vector3());
  const largestDimension = Math.max(
    initialSize.x,
    initialSize.y,
    initialSize.z,
  );
  if (!Number.isFinite(largestDimension) || largestDimension <= 0) {
    throw new Error("GLB contains invalid renderable bounds.");
  }
  root.scale.multiplyScalar(0.92 / largestDimension);
  root.updateMatrixWorld(true);
  const normalizedBounds = modelBounds(root);
  const center = normalizedBounds.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.y -= normalizedBounds.min.y;
  root.position.z -= center.z;

  const wrapper = new THREE.Group();
  const position = reviewGridPosition(index, count);
  wrapper.position.set(position.x, 0, position.z);
  wrapper.add(root);
  return wrapper;
}

export function AssetModelPreview({
  cameraPreset,
  layout = "single",
  models,
  onLoadResult,
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
  const sourceKey = url
    ? `single:${url}`
    : (models ?? [])
        .slice(0, 9)
        .map((model) => `${model.key}:${model.url}`)
        .join("|");
  const [loadState, setLoadState] = useState<{
    key: string;
    status: "error" | "loading" | "partial" | "ready";
  }>({ key: sourceKey, status: "loading" });
  const state =
    sourceKey.length === 0
      ? "error"
      : loadState.key === sourceKey
        ? loadState.status
        : "loading";

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const modelInputs = (
      url ? [{ key: "single-model", url }] : (models ?? [])
    ).slice(0, 9);
    if (modelInputs.length === 0) {
      return;
    }
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 10_000);
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.setAttribute(
      "aria-label",
      assetModelPreviewLabel(
        layout === "review-grid"
          ? assetModelPreviewCopy.reviewCanvasLabel
          : assetModelPreviewCopy.canvasLabel,
      ),
    );
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
    void Promise.allSettled(
      modelInputs.map((input) => loader.loadAsync(input.url)),
    ).then((results) => {
      const fulfilled = results.filter(
        (
          result,
        ): result is PromiseFulfilledResult<
          Awaited<ReturnType<GLTFLoader["loadAsync"]>>
        > => result.status === "fulfilled",
      );
      if (disposed) {
        for (const result of fulfilled) disposeObject(result.value.scene);
        return;
      }

      const group = new THREE.Group();
      let failedCount = results.length - fulfilled.length;
      for (const [index, result] of fulfilled.entries()) {
        try {
          if (layout === "review-grid") {
            group.add(
              prepareReviewModel(result.value.scene, index, fulfilled.length),
            );
          } else {
            centreSingleModel(result.value.scene);
            group.add(result.value.scene);
          }
        } catch {
          failedCount += 1;
          disposeObject(result.value.scene);
        }
      }

      try {
        if (disposed) {
          disposeObject(group);
          return;
        }
        if (group.children.length === 0) {
          onLoadResult?.({ failedCount: results.length, loadedCount: 0 });
          setLoadState({ key: sourceKey, status: "error" });
          return;
        }
        const box = new THREE.Box3().setFromObject(group);
        if (box.isEmpty()) {
          throw new Error("GLB contains no renderable bounds.");
        }
        const size = box.getSize(new THREE.Vector3());
        model = group;
        modelRef.current = model;
        scene.add(model);

        radiusRef.current = Math.max(size.length() / 2, 0.01);
        camera.near = Math.max(radiusRef.current / 100, 0.001);
        camera.far = Math.max(radiusRef.current * 100, 10);
        camera.updateProjectionMatrix();
        controls.target.set(0, size.y * 0.35, 0);
        onLoadResult?.({
          failedCount,
          loadedCount: group.children.length,
        });
        setLoadState({
          key: sourceKey,
          status: failedCount > 0 ? "partial" : "ready",
        });
        render();
      } catch {
        disposeObject(group);
        if (!disposed) {
          onLoadResult?.({ failedCount: results.length, loadedCount: 0 });
          setLoadState({ key: sourceKey, status: "error" });
        }
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
  }, [layout, models, onLoadResult, sourceKey, url]);

  const modelReady = state === "partial" || state === "ready";

  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls || !modelReady) {
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
  }, [cameraPreset, modelReady, resetToken]);

  useEffect(() => {
    const controls = controlsRef.current;
    const model = modelRef.current;
    if (!controls || !model || !modelReady) {
      return;
    }
    controls.enabled = renderMode !== "static";
    setObjectWireframe(model, renderMode === "wireframe");
    renderRef.current?.();
  }, [modelReady, renderMode]);

  return (
    <div className="asset-model-preview" ref={containerRef}>
      {state !== "ready" ? (
        <span className={`asset-model-preview__state is-${state}`}>
          <span>
            {state === "loading"
              ? assetModelPreviewCopy.loading.zhHant
              : state === "partial"
                ? assetModelPreviewCopy.partial.zhHant
                : assetModelPreviewCopy.error.zhHant}
          </span>
          <small lang="en">
            {state === "loading"
              ? assetModelPreviewCopy.loading.english
              : state === "partial"
                ? assetModelPreviewCopy.partial.english
                : assetModelPreviewCopy.error.english}
          </small>
        </span>
      ) : null}
    </div>
  );
}

import { posix } from "path";
import type { TSESTree } from "@typescript-eslint/utils";

export const LAYERS_ORDER = [
  "shared",
  "entities",
  "features",
  "widgets",
  "pages",
  "app",
] as const;

export const SLICELESS_LAYERS = ["shared", "app"] as const;

export type Layer = (typeof LAYERS_ORDER)[number];

export const normalizeAlias = (alias: string): string =>
  alias.replace(/\/+$/, "");

export const isRelative = (path: string): boolean =>
  path === "." || path.startsWith("./") || path.startsWith("../");

export const isLayer = (segment: string | undefined): segment is Layer =>
  segment !== undefined && (LAYERS_ORDER as readonly string[]).includes(segment);

export const isSlicelessLayer = (layer: string): boolean =>
  (SLICELESS_LAYERS as readonly string[]).includes(layer);

export const isTypeOnlyImport = (
  node: TSESTree.ImportDeclaration,
): boolean => {
  if (node.importKind === "type") {
    return true;
  }
  if (node.specifiers.length === 0) {
    return false;
  }
  return node.specifiers.every(
    (s) => s.type === "ImportSpecifier" && s.importKind === "type",
  );
};

export interface ImportTarget {
  layer: Layer;
  slice: string | undefined;
  segments: string[];
  cleanPath: string;
}

export const parseImportTarget = (
  importPath: string,
  alias: string,
): ImportTarget | null => {
  if (isRelative(importPath)) {
    return null;
  }
  const normalizedAlias = normalizeAlias(alias);
  let cleanPath: string;
  if (normalizedAlias) {
    const prefix = `${normalizedAlias}/`;
    if (!importPath.startsWith(prefix)) {
      return null;
    }
    cleanPath = importPath.slice(prefix.length);
  } else {
    cleanPath = importPath;
  }
  const segments = cleanPath.split("/").filter(Boolean);
  const layer = segments[0];
  if (!isLayer(layer)) {
    return null;
  }
  return { layer, slice: segments[1], segments, cleanPath };
};

export const getModuleKey = (layer: string, segments: string[]): string => {
  const depth = isSlicelessLayer(layer) ? 3 : 2;
  return segments.slice(0, depth).join("/");
};

export interface CurrentModule {
  layer: Layer;
  slice: string | undefined;
  moduleKey: string;
  dirSegments: string[];
}

export const getCurrentModule = (filePath: string): CurrentModule | null => {
  const normalized = filePath.replace(/\\/g, "/");
  const allSegments = normalized.split("/").filter(Boolean);
  const layerIndex = allSegments.findIndex((s) => isLayer(s));
  if (layerIndex === -1) {
    return null;
  }
  const layer = allSegments[layerIndex] as Layer;
  const fileSegments = allSegments.slice(layerIndex); // от слоя, включая имя файла
  const dirSegments = fileSegments.slice(0, -1); // без имени файла
  return {
    layer,
    slice: dirSegments[1],
    moduleKey: getModuleKey(layer, dirSegments),
    dirSegments,
  };
};

export interface ResolvedTarget {
  layer: Layer;
  slice: string | undefined;
  segments: string[];
}

export const resolveRelativeImport = (
  currentFilePath: string,
  importPath: string,
): ResolvedTarget | null => {
  const normalized = currentFilePath.replace(/\\/g, "/");
  const allSegments = normalized.split("/").filter(Boolean);
  const layerIndex = allSegments.findIndex((s) => isLayer(s));
  if (layerIndex === -1) {
    return null;
  }
  const fileSegments = allSegments.slice(layerIndex);
  const dirSegments = fileSegments.slice(0, -1);
  // Резолвим символически от фейкового root, чтобы не зависеть от cwd/ОС.
  const targetAbs = posix.resolve(`/${dirSegments.join("/")}`, importPath);
  const segments = targetAbs.split("/").filter(Boolean);
  const layer = segments[0];
  if (!isLayer(layer)) {
    return null;
  }
  return { layer, slice: segments[1], segments };
};

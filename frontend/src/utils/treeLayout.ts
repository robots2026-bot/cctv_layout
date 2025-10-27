import { CanvasConnection, CanvasElement } from '../types/canvas';
import { getDeviceCategory } from './deviceVisual';

interface TreeNodeInternal {
  element: CanvasElement;
  depth: number;
  parentId?: string;
}

export interface TreeLayoutNode {
  element: CanvasElement;
  depth: number;
  position: { x: number; y: number };
  parentId?: string;
}

export interface TreeLayoutEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  connection?: CanvasConnection;
}

export interface TreeLayoutResult {
  nodes: TreeLayoutNode[];
  edges: TreeLayoutEdge[];
}

const collectElementKeys = (element: CanvasElement): string[] => {
  const metadata = element.metadata as Record<string, unknown> | undefined;
  const sourceDeviceId = metadata?.sourceDeviceId as string | undefined;
  const sourceDeviceMac = metadata?.sourceDeviceMac as string | undefined;
  const keys = [
    element.deviceId,
    element.deviceMac,
    element.id,
    sourceDeviceId,
    sourceDeviceMac
  ].filter((value): value is string => Boolean(value));
  return Array.from(new Set(keys));
};

const buildKeyMap = (elements: CanvasElement[]) => {
  const map = new Map<string, CanvasElement>();
  elements.forEach((element) => {
    collectElementKeys(element).forEach((key) => map.set(key, element));
  });
  return map;
};

const makeEdgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

const isOFCSwitch = (element: CanvasElement) => {
  if (getDeviceCategory(element.type) !== 'switch') {
    return false;
  }
  const name = element.name?.toLowerCase() ?? '';
  const model = (element.metadata?.model as string | undefined)?.toLowerCase() ?? '';
  return name.includes('ofc') || model.includes('ofc');
};

export const buildTreeLayout = (
  elements: CanvasElement[],
  connections: CanvasConnection[]
): TreeLayoutResult => {
  if (elements.length === 0) {
    return { nodes: [], edges: [] };
  }

  const keyMap = buildKeyMap(elements);
  const elementById = new Map(elements.map((element) => [element.id, element]));
  const adjacency = new Map<string, Set<string>>();
  const edgeDetails = new Map<string, CanvasConnection>();

  const ensureNode = (elementId: string) => {
    if (!adjacency.has(elementId)) {
      adjacency.set(elementId, new Set());
    }
  };

  connections.forEach((connection) => {
    const fromElement = connection.fromDeviceId ? keyMap.get(connection.fromDeviceId) : undefined;
    const toElement = connection.toDeviceId ? keyMap.get(connection.toDeviceId) : undefined;
    if (!fromElement || !toElement) {
      return;
    }
    ensureNode(fromElement.id);
    ensureNode(toElement.id);
    adjacency.get(fromElement.id)?.add(toElement.id);
    adjacency.get(toElement.id)?.add(fromElement.id);
    edgeDetails.set(makeEdgeKey(fromElement.id, toElement.id), connection);
  });

  elements.forEach((element) => ensureNode(element.id));

  const roots = elements.filter(isOFCSwitch);
  if (roots.length === 0) {
    return { nodes: [], edges: [] };
  }

  const visited = new Set<string>();
  const queue: Array<{ element: CanvasElement; depth: number; parent?: string }> = [];
  const resultNodes: TreeNodeInternal[] = [];

  const enqueueRoot = (element: CanvasElement) => {
    if (visited.has(element.id)) return;
    queue.push({ element, depth: 0 });
    visited.add(element.id);
  };

  roots.forEach(enqueueRoot);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    resultNodes.push({
      element: current.element,
      depth: current.depth,
      parentId: current.parent
    });
    const neighbors = adjacency.get(current.element.id);
    if (!neighbors) continue;
    neighbors.forEach((neighborId) => {
      if (visited.has(neighborId)) {
        return;
      }
      visited.add(neighborId);
      const neighborElement = elementById.get(neighborId);
      if (neighborElement) {
        queue.push({
          element: neighborElement,
          depth: current.depth + 1,
          parent: current.element.id
        });
      }
    });
  }

  const childrenMap = new Map<string, TreeNodeInternal[]>();
  resultNodes.forEach((node) => {
    if (node.parentId) {
      const list = childrenMap.get(node.parentId) ?? [];
      list.push(node);
      childrenMap.set(node.parentId, list);
    }
  });

  const layoutRoots = resultNodes.filter((node) => !node.parentId);
  const positionedMap = new Map<string, TreeLayoutNode>();
  const horizontalSpacing = 220;
  const verticalSpacing = 150;
  let leafIndex = 0;

  const assignPosition = (node: TreeNodeInternal, depth: number): number => {
    const children = childrenMap.get(node.element.id) ?? [];
    let y: number;
    if (children.length === 0) {
      y = leafIndex * verticalSpacing;
      leafIndex += 1;
    } else {
      const childYs = children.map((child) => assignPosition(child, depth + 1));
      y = childYs.reduce((sum, value) => sum + value, 0) / childYs.length;
    }
    positionedMap.set(node.element.id, {
      element: node.element,
      depth,
      parentId: node.parentId,
      position: {
        x: depth * horizontalSpacing,
        y
      }
    });
    return y;
  };

  layoutRoots.forEach((root, index) => {
    if (index > 0) {
      leafIndex += 1;
    }
    assignPosition(root, 0);
  });

  const positionedNodes = Array.from(positionedMap.values());
  const minY = Math.min(...positionedNodes.map((node) => node.position.y));
  const normalizedNodes = positionedNodes.map((node) => ({
    ...node,
    position: {
      x: node.position.x,
      y: node.position.y - minY
    }
  }));

  const edges: TreeLayoutEdge[] = [];
  normalizedNodes.forEach((node) => {
    if (!node.parentId) {
      return;
    }
    const edgeKey = makeEdgeKey(node.element.id, node.parentId);
    const detail = edgeDetails.get(edgeKey);
    edges.push({
      id: detail?.id ?? edgeKey,
      fromNodeId: node.parentId,
      toNodeId: node.element.id,
      connection: detail
    });
  });

  return {
    nodes: normalizedNodes,
    edges
  };
};

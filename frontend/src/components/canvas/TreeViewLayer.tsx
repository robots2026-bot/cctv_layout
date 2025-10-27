import { Fragment, useMemo } from 'react';
import { Group, Label, Tag, Text } from 'react-konva';
import { useCanvasStore } from '../../stores/canvasStore';
import { buildTreeLayout } from '../../utils/treeLayout';
import { DeviceNodeVisual } from './DeviceNodeVisual';
import { KonvaEventObject } from 'konva/lib/Node';
import { shallow } from 'zustand/shallow';
import { TreeConnectionLine } from './TreeConnectionLine';
import { getStatusVisual } from '../../utils/deviceVisual';

export const TreeViewLayer = () => {
  const { elements, connections } = useCanvasStore(
    (state) => ({
      elements: state.elements,
      connections: state.connections
    }),
    shallow
  );
  const layout = useMemo(() => buildTreeLayout(elements, connections), [elements, connections]);
  const nodeMap = useMemo(
    () => new Map(layout.nodes.map((node) => [node.element.id, node])),
    [layout.nodes]
  );

  if (layout.nodes.length === 0) {
    return (
      <Group>
        <Label x={-120} y={-20}>
          <Tag fill="rgba(15,23,42,0.9)" cornerRadius={8} stroke="rgba(148, 163, 184, 0.4)" />
          <Text
            text="未检测到 OFC 交换机，无法生成树形图"
            fontSize={13}
            padding={12}
            fill="#e2e8f0"
            align="center"
            width={240}
          />
        </Label>
      </Group>
    );
  }

  const handleEnter = (event: KonvaEventObject<MouseEvent>, nodeId: string) => {
    const stage = event.target.getStage();
    if (stage) {
      stage.container().style.cursor = 'grab';
    }
    const store = useCanvasStore.getState();
    store.setHoveredElement(nodeId);
  };

  const handleLeave = (event: KonvaEventObject<MouseEvent>) => {
    const stage = event.target.getStage();
    if (stage) {
      stage.container().style.cursor = 'grab';
    }
    useCanvasStore.getState().setHoveredElement(null);
  };

  return (
    <Fragment>
      {layout.edges.map((edge) => {
        const fromNode = nodeMap.get(edge.fromNodeId);
        const toNode = nodeMap.get(edge.toNodeId);
        if (!fromNode || !toNode) {
          return null;
        }
        const fromSize = fromNode.element.size ?? { width: 150, height: 70 };
        const toSize = toNode.element.size ?? { width: 150, height: 70 };
        return (
          <TreeConnectionLine
            key={edge.id}
            connection={edge.connection}
            fromElement={fromNode.element}
            toElement={toNode.element}
            fromPosition={{
              x: fromNode.position.x + fromSize.width / 2,
              y: fromNode.position.y + fromSize.height / 2
            }}
            toPosition={{
              x: toNode.position.x + toSize.width / 2,
              y: toNode.position.y + toSize.height / 2
            }}
          />
        );
      })}
      {layout.nodes.map((node) => {
        return (
          <Group
            key={node.element.id}
            x={node.position.x}
            y={node.position.y}
            onMouseEnter={(event) => handleEnter(event, node.element.id)}
            onMouseLeave={handleLeave}
          >
            <DeviceNodeVisual element={node.element} />
          </Group>
        );
      })}
    </Fragment>
  );
};

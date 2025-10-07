import { Arrow } from 'react-konva';
import { CanvasConnection } from '../../types/canvas';

interface ConnectionLineProps {
  connection: CanvasConnection;
}

export const ConnectionLine = ({ connection }: ConnectionLineProps) => (
  <Arrow
    points={[connection.from.x, connection.from.y, connection.to.x, connection.to.y]}
    stroke={connection.kind === 'wireless' ? '#f97316' : '#38bdf8'}
    fill={connection.kind === 'wireless' ? '#f97316' : '#38bdf8'}
    strokeWidth={2}
    dash={connection.kind === 'wireless' ? [8, 6] : undefined}
    pointerWidth={8}
  />
);

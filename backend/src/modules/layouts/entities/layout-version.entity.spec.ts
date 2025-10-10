import { getMetadataArgsStorage } from 'typeorm';
import { LayoutVersionEntity } from './layout-version.entity';

const columnOptions = (property: keyof LayoutVersionEntity) =>
  getMetadataArgsStorage().columns.find(
    (column) => column.target === LayoutVersionEntity && column.propertyName === property
  )?.options ?? {};

describe('LayoutVersionEntity column metadata', () => {
  it('persists layout reference and audit fields as uuid columns', () => {
    const layoutId = columnOptions('layoutId');
    const createdBy = columnOptions('createdBy');

    expect(layoutId.type).toBe('uuid');
    expect(layoutId.nullable).toBeUndefined();

    expect(createdBy.type).toBe('uuid');
    expect(createdBy.nullable).toBe(true);
  });
});


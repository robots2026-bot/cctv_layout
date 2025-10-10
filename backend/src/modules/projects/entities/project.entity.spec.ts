import { getMetadataArgsStorage } from 'typeorm';
import { ProjectEntity } from './project.entity';

const columnOptions = (property: keyof ProjectEntity) =>
  getMetadataArgsStorage().columns.find(
    (column) => column.target === ProjectEntity && column.propertyName === property
  )?.options ?? {};

describe('ProjectEntity column metadata', () => {
  it('uses varchar for location details', () => {
    const location = columnOptions('location');

    expect(location.type).toBe('varchar');
    expect(location.length).toBe(255);
    expect(location.nullable).toBe(true);
  });

  it('uses uuid for default layout linkage', () => {
    const defaultLayoutId = columnOptions('defaultLayoutId');

    expect(defaultLayoutId.type).toBe('uuid');
    expect(defaultLayoutId.nullable).toBe(true);
  });
});


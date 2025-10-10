import { getMetadataArgsStorage } from 'typeorm';
import { LayoutEntity } from './layout.entity';

const getColumnOptions = (property: keyof LayoutEntity) =>
  getMetadataArgsStorage().columns.find(
    (column) => column.target === LayoutEntity && column.propertyName === property
  )?.options ?? {};

describe('LayoutEntity column metadata', () => {
  it('uses uuid columns for project and current version references', () => {
    const projectId = getColumnOptions('projectId');
    const currentVersionId = getColumnOptions('currentVersionId');

    expect(projectId.type).toBe('uuid');
    expect(projectId.nullable).toBeUndefined();

    expect(currentVersionId.type).toBe('uuid');
    expect(currentVersionId.nullable).toBe(true);
  });

  it('stores background image URL as text to avoid unsupported Object type', () => {
    const backgroundImageUrl = getColumnOptions('backgroundImageUrl');

    expect(backgroundImageUrl.type).toBe('text');
    expect(backgroundImageUrl.nullable).toBe(true);
  });
});


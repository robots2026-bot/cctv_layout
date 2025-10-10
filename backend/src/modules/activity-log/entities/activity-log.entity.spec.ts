import { getMetadataArgsStorage } from 'typeorm';
import { ActivityLogEntity } from './activity-log.entity';

const columnOptions = (property: keyof ActivityLogEntity) =>
  getMetadataArgsStorage().columns.find(
    (column) => column.target === ActivityLogEntity && column.propertyName === property
  )?.options ?? {};

describe('ActivityLogEntity column metadata', () => {
  it('stores project and user references as uuid columns', () => {
    const projectId = columnOptions('projectId');
    const userId = columnOptions('userId');

    expect(projectId.type).toBe('uuid');
    expect(projectId.nullable).toBeUndefined();

    expect(userId.type).toBe('uuid');
    expect(userId.nullable).toBe(true);
  });

  it('persists details payload using jsonb', () => {
    const details = columnOptions('details');

    expect(details.type).toBe('jsonb');
    expect(details.nullable).toBe(true);
  });
});


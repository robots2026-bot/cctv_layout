import { getMetadataArgsStorage } from 'typeorm';
import { DeviceEntity } from './device.entity';

const columnOptions = (property: keyof DeviceEntity) =>
  getMetadataArgsStorage().columns.find(
    (column) => column.target === DeviceEntity && column.propertyName === property
  )?.options ?? {};

describe('DeviceEntity column metadata', () => {
  it('keeps project references as uuid columns', () => {
    const projectId = columnOptions('projectId');

    expect(projectId.type).toBe('uuid');
    expect(projectId.nullable).toBeUndefined();
  });

  it('stores ip address and metadata with expected types', () => {
    const ipAddress = columnOptions('ipAddress');
    const metadata = columnOptions('metadata');

    expect(ipAddress.type).toBe('varchar');
    expect(ipAddress.length).toBe(45);
    expect(ipAddress.nullable).toBe(true);

    expect(metadata.type).toBe('jsonb');
    expect(metadata.nullable).toBe(true);
  });
});


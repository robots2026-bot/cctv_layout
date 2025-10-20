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
    const alias = columnOptions('alias');
    const macAddress = columnOptions('macAddress');
    const hiddenAt = columnOptions('hiddenAt');

    expect(ipAddress.type).toBe('varchar');
    expect(ipAddress.length).toBe(45);
    expect(ipAddress.nullable).toBe(true);

    expect(alias.type).toBe('varchar');
    expect(alias.length).toBe(120);
    expect(alias.nullable).toBe(true);

    expect(macAddress.type).toBe('varchar');
    expect(macAddress.length).toBe(32);
    expect(macAddress.nullable).toBe(true);

    expect(metadata.type).toBe('jsonb');
    expect(metadata.nullable).toBe(true);

    expect(hiddenAt.type).toBe('timestamptz');
    expect(hiddenAt.nullable).toBe(true);
  });
});

import 'reflect-metadata';
import AppDataSource from '../database/data-source';
import { DeviceEntity } from '../modules/devices/entities/device.entity';
import { IsNull, Not } from 'typeorm';

const main = async () => {
  await AppDataSource.initialize();
  const devicesRepository = AppDataSource.getRepository(DeviceEntity);

  const targets = await devicesRepository.find({
    where: {
      macAddress: IsNull(),
      type: Not('Switch')
    },
    order: { projectId: 'ASC', createdAt: 'ASC' }
  });

  if (targets.length === 0) {
    console.log('No devices without MAC (excluding switches) were found.');
    await AppDataSource.destroy();
    return;
  }

  const grouped = new Map<string, DeviceEntity[]>();
  for (const device of targets) {
    if (!grouped.has(device.projectId)) {
      grouped.set(device.projectId, []);
    }
    grouped.get(device.projectId)?.push(device);
  }

  let removed = 0;
  for (const [projectId, devices] of grouped) {
    const ids = devices.map((device) => device.id);
    await devicesRepository.delete(ids);
    removed += ids.length;
    console.log(
      `Project ${projectId} - removed ${ids.length} device(s) without MAC: ${ids.join(', ')}`
    );
  }

  console.log(`Done. Removed ${removed} device(s) lacking MAC (excluding switches).`);
  await AppDataSource.destroy();
};

main().catch((error) => {
  console.error('Failed to remove devices without MAC', error);
  AppDataSource.destroy()
    .catch(() => undefined)
    .finally(() => {
      process.exit(1);
    });
});


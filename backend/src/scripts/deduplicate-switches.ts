import 'reflect-metadata';
import AppDataSource from '../database/data-source';
import { DeviceEntity } from '../modules/devices/entities/device.entity';

const main = async () => {
  await AppDataSource.initialize();
  const devicesRepository = AppDataSource.getRepository(DeviceEntity);

  const switches = await devicesRepository.find({
    where: { type: 'Switch' },
    order: { projectId: 'ASC', name: 'ASC', createdAt: 'ASC' }
  });

  const groups = new Map<string, DeviceEntity[]>();
  for (const device of switches) {
    const key = `${device.projectId}__${device.name.trim().toLowerCase()}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)?.push(device);
  }

  let removed = 0;
  for (const [, items] of groups) {
    if (items.length <= 1) {
      continue;
    }
    const [keep, ...duplicates] = items;
    const duplicateIds = duplicates.map((item) => item.id);
    if (duplicateIds.length === 0) {
      continue;
    }
    await devicesRepository.delete(duplicateIds);
    removed += duplicateIds.length;
    console.log(
      `Project ${keep.projectId} - kept switch "${keep.name}" (${keep.id}), removed ${duplicateIds.length} duplicates: ${duplicateIds.join(
        ', '
      )}`
    );
  }

  console.log(`Done. Removed ${removed} duplicated switches.`);
  await AppDataSource.destroy();
};

main().catch((error) => {
  console.error('Failed to deduplicate switches', error);
  AppDataSource.destroy()
    .catch(() => undefined)
    .finally(() => {
      process.exit(1);
    });
});

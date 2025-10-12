import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { Client } from 'pg';
import * as bcrypt from 'bcryptjs';
import databaseConfig from '../config/database.config';
import { ProjectEntity } from '../modules/projects/entities/project.entity';
import { DeviceEntity } from '../modules/devices/entities/device.entity';
import { LayoutEntity } from '../modules/layouts/entities/layout.entity';
import { LayoutVersionEntity } from '../modules/layouts/entities/layout-version.entity';
import { UserEntity } from '../modules/auth/entities/user.entity';
import { ActivityLogEntity } from '../modules/activity-log/entities/activity-log.entity';

async function ensureDatabaseExists(options: DataSourceOptions) {
  if (options.type !== 'postgres') {
    return;
  }

  const databaseName = typeof options.database === 'string' ? options.database : null;

  if (!databaseName) {
    throw new Error('PostgreSQL database name is required for seeding');
  }

  const host = (options as { host?: string }).host ?? '127.0.0.1';
  const port = Number((options as { port?: number }).port ?? 5432);
  const user = (options as { username?: string }).username ?? 'postgres';
  const password = (options as { password?: string }).password ?? 'postgres';

  const adminClient = new Client({
    host,
    port,
    user,
    password,
    database: 'postgres'
  });

  await adminClient.connect();

  try {
    const result = await adminClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);

    if (result.rowCount === 0) {
      const escapedName = databaseName.replace(/"/g, '""');
      await adminClient.query(`CREATE DATABASE "${escapedName}" ENCODING 'UTF8'`);
      console.log(`Created database ${databaseName}.`);
    }
  } finally {
    await adminClient.end();
  }
}

async function createDataSource(): Promise<DataSource> {
  const rawConfig = databaseConfig() as DataSourceOptions;
  await ensureDatabaseExists(rawConfig);

  return new DataSource({
    ...rawConfig,
    entities: [
      ProjectEntity,
      DeviceEntity,
      LayoutEntity,
      LayoutVersionEntity,
      UserEntity,
      ActivityLogEntity
    ]
  });
}

async function seed() {
  const dataSource = await createDataSource();
  await dataSource.initialize();
  console.log('Synchronizing database schema...');
  await dataSource.synchronize();

  try {
    const userRepository = dataSource.getRepository(UserEntity);
    const existingSampleUser = await userRepository.findOne({
      where: { email: 'admin@demo.cctv' }
    });

    if (existingSampleUser) {
      console.log('Sample data already exists. Skipping seed.');
      return;
    }

    const passwordHash = await bcrypt.hash('Admin123!', 10);
    const engineerPasswordHash = await bcrypt.hash('Engineer123!', 10);

    await dataSource.transaction(async (manager) => {
      const adminUser = manager.create(UserEntity, {
        name: '平台管理员',
        email: 'admin@demo.cctv',
        passwordHash,
        role: 'admin'
      });
      await manager.save(adminUser);

      const engineerUser = manager.create(UserEntity, {
        name: '现场工程师',
        email: 'engineer@demo.cctv',
        passwordHash: engineerPasswordHash,
        role: 'engineer'
      });
      await manager.save(engineerUser);

      const projectOne = manager.create(ProjectEntity, {
        code: 0,
        name: '工地一期总控',
        locationText: '苏州 · 一号工地'
      });
      await manager.save(projectOne);

      const projectTwo = manager.create(ProjectEntity, {
        code: 1,
        name: '仓库联网规划',
        locationText: '上海 · 仓储中心'
      });
      await manager.save(projectTwo);

      const layoutOne = manager.create(LayoutEntity, {
        projectId: projectOne.id,
        name: '主控制室布局',
        backgroundImageUrl: 'https://dummyimage.com/1600x900/0f172a/1f4b99.png&text=Site+A',
        backgroundOpacity: 0.65
      });
      await manager.save(layoutOne);

      const layoutTwo = manager.create(LayoutEntity, {
        projectId: projectTwo.id,
        name: '仓库园区布局',
        backgroundImageUrl: 'https://dummyimage.com/1600x900/0f172a/1f4b99.png&text=Site+B',
        backgroundOpacity: 0.6
      });
      await manager.save(layoutTwo);

      const layoutOneVersion = manager.create(LayoutVersionEntity, {
        layoutId: layoutOne.id,
        versionNo: 1,
        createdBy: adminUser.id,
        elementsJson: {
          nodes: [
            {
              id: 'cam-east',
              type: 'camera-ptz',
              label: '东区塔吊',
              position: { x: 180, y: 260 },
              rotation: 30
            },
            {
              id: 'cam-west',
              type: 'camera-bullet',
              label: '西侧围栏',
              position: { x: 520, y: 340 },
              rotation: -15
            },
            {
              id: 'bridge-1',
              type: 'wireless-bridge',
              label: '楼顶网桥',
              position: { x: 380, y: 120 },
              rotation: 0
            }
          ],
          viewport: {
            scale: 1,
            offset: { x: 0, y: 0 }
          }
        },
        connectionsJson: {
          edges: [
            { id: 'edge-1', from: 'cam-east', to: 'bridge-1', type: 'wireless' },
            { id: 'edge-2', from: 'cam-west', to: 'bridge-1', type: 'wireless' }
          ]
        }
      });
      await manager.save(layoutOneVersion);

      const layoutTwoVersion = manager.create(LayoutVersionEntity, {
        layoutId: layoutTwo.id,
        versionNo: 1,
        createdBy: engineerUser.id,
        elementsJson: {
          nodes: [
            {
              id: 'dock-cam-1',
              type: 'camera-bullet',
              label: '装卸区摄像头',
              position: { x: 140, y: 220 },
              rotation: 12
            },
            {
              id: 'warehouse-cam-2',
              type: 'camera-ptz',
              label: '仓库南门',
              position: { x: 420, y: 180 },
              rotation: -20
            },
            {
              id: 'bridge-warehouse',
              type: 'wireless-bridge',
              label: '库房网桥',
              position: { x: 320, y: 80 },
              rotation: 0
            }
          ],
          viewport: {
            scale: 0.9,
            offset: { x: 20, y: -10 }
          }
        },
        connectionsJson: {
          edges: [
            { id: 'edge-warehouse-1', from: 'dock-cam-1', to: 'bridge-warehouse', type: 'wired' },
            { id: 'edge-warehouse-2', from: 'warehouse-cam-2', to: 'bridge-warehouse', type: 'wireless' }
          ]
        }
      });
      await manager.save(layoutTwoVersion);

      layoutOne.currentVersionId = layoutOneVersion.id;
      await manager.save(layoutOne);

      layoutTwo.currentVersionId = layoutTwoVersion.id;
      await manager.save(layoutTwo);

      projectOne.defaultLayoutId = layoutOne.id;
      await manager.save(projectOne);

      projectTwo.defaultLayoutId = layoutTwo.id;
      await manager.save(projectTwo);

      const now = new Date();

      await manager.save(DeviceEntity, [
        manager.create(DeviceEntity, {
          projectId: projectOne.id,
          name: '东塔吊摄像头',
          type: 'camera-ptz',
          ipAddress: '10.0.1.21',
          status: 'online',
          lastSeenAt: now,
          metadata: { model: 'Hikvision DS-2DE5430', fov: 120 }
        }),
        manager.create(DeviceEntity, {
          projectId: projectOne.id,
          name: '西侧围栏枪机',
          type: 'camera-bullet',
          ipAddress: '10.0.1.45',
          status: 'offline',
          lastSeenAt: null,
          metadata: { model: 'Dahua IPC-HFW1230', lastFault: '2025-01-12' }
        }),
        manager.create(DeviceEntity, {
          projectId: projectOne.id,
          name: '楼顶无线网桥',
          type: 'wireless-bridge',
          ipAddress: '10.0.1.80',
          status: 'online',
          lastSeenAt: now,
          metadata: { model: 'Ubiquiti NanoBeam', linkQuality: 0.93 }
        })
      ]);

      await manager.save(DeviceEntity, [
        manager.create(DeviceEntity, {
          projectId: projectTwo.id,
          name: '装卸区云台机',
          type: 'camera-ptz',
          ipAddress: '10.1.5.12',
          status: 'unknown',
          lastSeenAt: null,
          metadata: { model: 'Hikvision DS-2SE4C215', note: '等待标定' }
        }),
        manager.create(DeviceEntity, {
          projectId: projectTwo.id,
          name: '南仓库光纤交换机',
          type: 'core-switch',
          ipAddress: '10.1.5.2',
          status: 'online',
          lastSeenAt: now,
          metadata: { vendor: 'Cisco', ports: 24 }
        }),
        manager.create(DeviceEntity, {
          projectId: projectTwo.id,
          name: '库房无线网桥',
          type: 'wireless-bridge',
          ipAddress: '10.1.5.60',
          status: 'online',
          lastSeenAt: now,
          metadata: { model: 'TP-Link CPE710', linkQuality: 0.88 }
        })
      ]);

      await manager.save(ActivityLogEntity, [
        manager.create(ActivityLogEntity, {
          projectId: projectOne.id,
          userId: adminUser.id,
          action: 'layout.version.create',
          details: {
            layoutId: layoutOne.id,
            versionId: layoutOneVersion.id,
            description: '初始化主控制室布局版本 v1'
          }
        }),
        manager.create(ActivityLogEntity, {
          projectId: projectOne.id,
          userId: engineerUser.id,
          action: 'device.status.update',
          details: {
            deviceName: '西侧围栏枪机',
            status: 'offline',
            remark: '等待供电恢复'
          }
        }),
        manager.create(ActivityLogEntity, {
          projectId: projectTwo.id,
          userId: engineerUser.id,
          action: 'layout.version.create',
          details: {
            layoutId: layoutTwo.id,
            versionId: layoutTwoVersion.id,
            description: '导入仓库园区初始布局'
          }
        }),
        manager.create(ActivityLogEntity, {
          projectId: projectTwo.id,
          userId: adminUser.id,
          action: 'device.status.update',
          details: {
            deviceName: '南仓库光纤交换机',
            status: 'online',
            remark: '巡检确认链路正常'
          }
        })
      ]);
    });

    console.log('Sample data inserted successfully.');
  } finally {
    await dataSource.destroy();
  }
}

seed()
  .then(() => {
    console.log('Seeding completed.');
  })
  .catch((error) => {
    console.error('Failed to seed database:', error);
    process.exit(1);
  });

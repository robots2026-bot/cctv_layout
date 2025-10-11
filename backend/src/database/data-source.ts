import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import databaseConfig from '../config/database.config';

const options = databaseConfig() as DataSourceOptions;

const AppDataSource = new DataSource({
  ...options,
  migrations: ['src/database/migrations/*.ts']
});

export default AppDataSource;
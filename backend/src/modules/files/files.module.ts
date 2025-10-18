import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { ProjectFileEntity } from './entities/project-file.entity';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([ProjectFileEntity])],
  providers: [FilesService],
  controllers: [FilesController],
  exports: [FilesService]
})
export class FilesModule {}

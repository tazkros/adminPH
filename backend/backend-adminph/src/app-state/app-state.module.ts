import { Module } from '@nestjs/common';
import { AppStateController } from './app-state.controller';
import { AppStateService } from './app-state.service';

@Module({ controllers: [AppStateController], providers: [AppStateService] })
export class AppStateModule {}

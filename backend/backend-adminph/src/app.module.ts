import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { AssembliesModule } from './assemblies/assemblies.module';
import { VotingModule } from './voting/voting.module';
import { ProxyModule } from './proxy/proxy.module';
import { PropertiesModule } from './properties/properties.module';
import { AppStateModule } from './app-state/app-state.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.registerAsync({ global: true, inject:[ConfigService], useFactory:(c:ConfigService)=>({ secret:c.getOrThrow('JWT_SECRET'), signOptions:{ expiresIn: c.get('JWT_EXPIRES_IN') || '8h' } as any }) }),
    DatabaseModule, CommonModule, AuditModule, AuthModule, HealthModule, AssembliesModule, VotingModule, ProxyModule, PropertiesModule, AppStateModule, NotificationsModule,
  ],
})
export class AppModule {}

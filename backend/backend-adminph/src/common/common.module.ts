import { Global, Module } from '@nestjs/common';
import { AccessService } from './access.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { QrTokenService } from './qr-token.service';

@Global()
@Module({ providers: [AccessService, JwtAuthGuard, RolesGuard, QrTokenService], exports: [AccessService, JwtAuthGuard, RolesGuard, QrTokenService] })
export class CommonModule {}

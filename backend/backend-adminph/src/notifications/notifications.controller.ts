import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthUser } from '../common/auth-user.interface';
import { NotificationsService } from './notifications.service';

@ApiTags('Notificaciones (envío de QR)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('superadmin', 'admin', 'operador')
@Controller()
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get('notifications/status')
  status() { return this.service.status(); }

  @Post('assemblies/:assemblyId/qr-notify/email')
  email(@CurrentUser() u: AuthUser, @Param('assemblyId') id: string, @Body() body: any, @Req() req: any) {
    return this.service.sendQrEmails(u, id, body, { ip: req.ip, userAgent: req.headers['user-agent'] });
  }
}

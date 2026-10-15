import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthUser } from '../common/auth-user.interface';
import { ProxyService } from './proxy.service';

@ApiTags('Apoderados (un QR para varias unidades)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('superadmin', 'admin', 'operador')
@Controller('assemblies')
export class ProxyController {
  constructor(private readonly service: ProxyService) {}

  @Get(':assemblyId/proxy-groups')
  get(@CurrentUser() u: AuthUser, @Param('assemblyId') id: string) { return this.service.getGroups(u, id); }

  @Put(':assemblyId/proxy-groups')
  put(@CurrentUser() u: AuthUser, @Param('assemblyId') id: string, @Body() body: { groups: any[] }) { return this.service.putGroups(u, id, body?.groups); }
}

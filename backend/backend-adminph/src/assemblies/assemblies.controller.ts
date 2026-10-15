import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';

import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { AssembliesService } from './assemblies.service';

import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthUser } from '../common/auth-user.interface';

import { UpsertAttendanceDto } from './dto/upsert-attendance.dto';
import { CreateAssemblyDto } from './dto/create-assembly.dto';

@ApiTags('Assemblies / Attendance / QR')
@ApiBearerAuth()

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('superadmin','admin','operador')

@Controller('assemblies')
export class AssembliesController {

  constructor(private readonly service: AssembliesService) {}

  @Post()
  @Roles('superadmin','admin')
  createAssembly(
    @CurrentUser() u: AuthUser,
    @Body() dto: CreateAssemblyDto
  ) {
    return this.service.createAssembly(u, dto);
  }

  // PATCH V1: activar / cerrar la asamblea (necesario para el flujo público por QR)
  @Post(':assemblyId/start')
  @Roles('superadmin','admin')
  start(@CurrentUser() u: AuthUser, @Param('assemblyId') id: string, @Req() req: any) {
    return this.service.changeStatus(u, id, 'active', {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
  }

  @Post(':assemblyId/close')
  @Roles('superadmin','admin')
  closeAssembly(@CurrentUser() u: AuthUser, @Param('assemblyId') id: string, @Req() req: any) {
    return this.service.changeStatus(u, id, 'closed', {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
  }

  @Get('property/:propertyId')
  listForProperty(@CurrentUser() u: AuthUser, @Param('propertyId') propertyId: string) {
    return this.service.listForProperty(u, propertyId);
  }

  @Get('property/:propertyId/current')
  currentForProperty(@CurrentUser() u: AuthUser, @Param('propertyId') propertyId: string) {
    return this.service.currentForProperty(u, propertyId);
  }

  @Get(':assemblyId/attendance')
  attendance(@CurrentUser() u: AuthUser, @Param('assemblyId') id: string) {
    return this.service.attendance(u, id);
  }

  @Put(':assemblyId/attendance/:unitId')
  upsert(
    @CurrentUser() u: AuthUser,
    @Param('assemblyId') a: string,
    @Param('unitId') unit: string,
    @Body() dto: UpsertAttendanceDto,
    @Req() req: any
  ) {
    return this.service.upsertAttendance(u, a, unit, dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
  }

  @Post(':assemblyId/qr-tokens/provision')
  @Roles('superadmin','admin')
  provisionQr(@CurrentUser() u: AuthUser, @Param('assemblyId') id: string, @Req() req: any) {
    return this.service.provisionQrInventory(u, id, {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
  }

  @Get(':assemblyId/qr-tokens')
  qr(@CurrentUser() u: AuthUser, @Param('assemblyId') id: string) {
    return this.service.listQr(u, id);
  }

  @Post(':assemblyId/attendance/:unitId/qr/reissue')
  reissue(
    @CurrentUser() u: AuthUser,
    @Param('assemblyId') a: string,
    @Param('unitId') unit: string,
    @Req() req: any
  ) {
    return this.service.reissueQr(u, a, unit, {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
}

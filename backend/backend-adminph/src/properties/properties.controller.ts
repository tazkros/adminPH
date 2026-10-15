import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PropertiesService } from './properties.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthUser } from '../common/auth-user.interface';
import { UpdatePropertyConfigDto } from './dto/update-property-config.dto';
import { SyncPropertyUnitsDto } from './dto/sync-property-units.dto';
import { UpdatePropertyUnitDto } from './dto/update-property-unit.dto';
import { CreatePropertyDto } from './dto/create-property.dto';

@ApiTags('Properties / Configuration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('properties')
export class PropertiesController {
  constructor(private readonly service: PropertiesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user);
  }

  // PATCH V2: crear (o reutilizar por nombre) el conjunto real de la organización
  @Post()
  @Roles('superadmin', 'admin')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePropertyDto, @Req() req: any) {
    return this.service.create(user, dto, { ip: req.ip, userAgent: req.headers['user-agent'] });
  }

  @Get(':propertyId/config')
  config(@CurrentUser() user: AuthUser, @Param('propertyId') propertyId: string) {
    return this.service.getConfig(user, propertyId);
  }

  @Put(':propertyId/config')
  @Roles('superadmin', 'admin')
  updateConfig(
    @CurrentUser() user: AuthUser,
    @Param('propertyId') propertyId: string,
    @Body() dto: UpdatePropertyConfigDto,
    @Req() req: any,
  ) {
    return this.service.updateConfig(user, propertyId, dto.config, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get(':propertyId/units')
  listUnits(@CurrentUser() user: AuthUser, @Param('propertyId') propertyId: string) {
    return this.service.listUnits(user, propertyId);
  }

  @Put(':propertyId/units/sync')
  @Roles('superadmin', 'admin')
  syncUnits(
    @CurrentUser() user: AuthUser,
    @Param('propertyId') propertyId: string,
    @Body() dto: SyncPropertyUnitsDto,
    @Req() req: any,
  ) {
    return this.service.syncUnits(user, propertyId, dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Put(':propertyId/units/:unitId')
  @Roles('superadmin', 'admin')
  updateUnit(
    @CurrentUser() user: AuthUser,
    @Param('propertyId') propertyId: string,
    @Param('unitId') unitId: string,
    @Body() dto: UpdatePropertyUnitDto,
    @Req() req: any,
  ) {
    return this.service.updateUnit(user, propertyId, unitId, dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Delete(':propertyId/units/:unitId')
  @Roles('superadmin', 'admin')
  deactivateUnit(
    @CurrentUser() user: AuthUser,
    @Param('propertyId') propertyId: string,
    @Param('unitId') unitId: string,
    @Req() req: any,
  ) {
    return this.service.deactivateUnit(user, propertyId, unitId, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}

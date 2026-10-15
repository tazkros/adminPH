import { Body, Controller, Delete, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthUser } from '../common/auth-user.interface';
import { AppStateService } from './app-state.service';

@ApiTags('App state (copia de seguridad)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('app-state')
export class AppStateController {
  constructor(private readonly service: AppStateService) {}

  @Get('summary/all')
  @Roles('superadmin', 'admin', 'operador')
  summary(@CurrentUser() user: AuthUser) {
    return this.service.summary(user);
  }

  @Get(':propertyId/history')
  @Roles('superadmin', 'admin', 'operador')
  history(@CurrentUser() user: AuthUser, @Param('propertyId') propertyId: string) {
    return this.service.history(user, propertyId);
  }

  @Get(':propertyId/history/:id')
  @Roles('superadmin', 'admin', 'operador')
  historyItem(@CurrentUser() user: AuthUser, @Param('propertyId') propertyId: string, @Param('id') id: string) {
    return this.service.historyItem(user, propertyId, id);
  }

  @Delete(':propertyId/history/:id')
  @Roles('superadmin', 'admin')
  deleteHistoryItem(@CurrentUser() user: AuthUser, @Param('propertyId') propertyId: string, @Param('id') id: string) {
    return this.service.deleteHistoryItem(user, propertyId, id);
  }

  @Get(':propertyId/info')
  @Roles('superadmin', 'admin', 'operador')
  info(@CurrentUser() user: AuthUser, @Param('propertyId') propertyId: string) {
    return this.service.info(user, propertyId);
  }

  @Get(':propertyId')
  @Roles('superadmin', 'admin', 'operador')
  load(@CurrentUser() user: AuthUser, @Param('propertyId') propertyId: string, @Query('previous') previous?: string) {
    return this.service.load(user, propertyId, previous === '1');
  }

  @Put(':propertyId')
  @Roles('superadmin', 'admin', 'operador')
  save(@CurrentUser() user: AuthUser, @Param('propertyId') propertyId: string, @Body() body: { data: Record<string, any>; label?: string }) {
    return this.service.save(user, propertyId, body?.data, body?.label);
  }
}

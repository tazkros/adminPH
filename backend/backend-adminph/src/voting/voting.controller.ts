import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { VotingService } from './voting.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthUser } from '../common/auth-user.interface';
import { CreateVotingSessionDto } from './dto/create-voting-session.dto';
import { UpdateVotingSessionDto } from './dto/update-voting-session.dto';
import { AddOptionDto } from './dto/add-option.dto';
import { CastVoteDto } from './dto/cast-vote.dto';
import { ManualVoteDto } from './dto/manual-vote.dto';
import { SetWinnersDto } from './dto/set-winners.dto';

@ApiTags('Voting')
@Controller()
export class VotingController {
  constructor(private readonly service: VotingService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin', 'admin', 'operador')
  @Post('assemblies/:assemblyId/voting-sessions')
  create(
    @CurrentUser() u: AuthUser,
    @Param('assemblyId') a: string,
    @Body() dto: CreateVotingSessionDto,
  ) {
    return this.service.create(u, a, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin', 'admin', 'operador')
  @Get('assemblies/:assemblyId/voting-sessions')
  list(@CurrentUser() u: AuthUser, @Param('assemblyId') a: string) {
    return this.service.list(u, a);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin', 'admin')
  @Patch('voting-sessions/:sessionId')
  update(
    @CurrentUser() u: AuthUser,
    @Param('sessionId') id: string,
    @Body() dto: UpdateVotingSessionDto,
  ) {
    return this.service.update(u, id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin', 'admin')
  @Post('voting-sessions/:sessionId/options')
  option(
    @CurrentUser() u: AuthUser,
    @Param('sessionId') id: string,
    @Body() dto: AddOptionDto,
  ) {
    return this.service.addOption(u, id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin', 'admin', 'operador')
  @Post('voting-sessions/:sessionId/open')
  open(@CurrentUser() u: AuthUser, @Param('sessionId') id: string, @Req() req: any) {
    return this.service.open(u, id, { ip: req.ip, userAgent: req.headers['user-agent'] });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin', 'admin', 'operador')
  @Post('voting-sessions/:sessionId/close')
  close(@CurrentUser() u: AuthUser, @Param('sessionId') id: string, @Req() req: any) {
    return this.service.close(u, id, { ip: req.ip, userAgent: req.headers['user-agent'] });
  }

  // PATCH V1: archivar (ocultar) una votación sin borrar sus votos ni su auditoría
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin', 'admin')
  @Post('voting-sessions/:sessionId/archive')
  archive(@CurrentUser() u: AuthUser, @Param('sessionId') id: string, @Req() req: any) {
    return this.service.archive(u, id, { ip: req.ip, userAgent: req.headers['user-agent'] });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin', 'admin', 'operador')
  @Put('voting-sessions/:sessionId/winners')
  winners(
    @CurrentUser() u: AuthUser,
    @Param('sessionId') id: string,
    @Body() dto: SetWinnersDto,
    @Req() req: any,
  ) {
    return this.service.setWinners(u, id, dto.optionIds, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin', 'admin', 'operador')
  @Post('voting-sessions/:sessionId/manual-vote')
  manual(
    @CurrentUser() u: AuthUser,
    @Param('sessionId') id: string,
    @Body() dto: ManualVoteDto,
    @Req() req: any,
  ) {
    return this.service.castManual(u, id, dto.unitId, dto.optionId, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin', 'admin', 'operador')
  @Get('voting-sessions/:sessionId/results')
  results(
    @CurrentUser() u: AuthUser,
    @Param('sessionId') id: string,
    @Query('forMinutes') fm?: string,
  ) {
    return this.service.results(u, id, fm === 'true');
  }

  @Get('public/voting/access')
  access(@Query('token') token: string) {
    return this.service.publicAccess(token);
  }

  @Post('public/voting/sessions/:sessionId/vote')
  vote(
    @Param('sessionId') id: string,
    @Body() dto: CastVoteDto,
    @Req() req: any,
  ) {
    return this.service.castByQr(id, dto.token, dto.optionId, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}

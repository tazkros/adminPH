"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VotingController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const voting_service_1 = require("./voting.service");
const jwt_auth_guard_1 = require("../common/jwt-auth.guard");
const roles_guard_1 = require("../common/roles.guard");
const roles_decorator_1 = require("../common/roles.decorator");
const current_user_decorator_1 = require("../common/current-user.decorator");
const create_voting_session_dto_1 = require("./dto/create-voting-session.dto");
const update_voting_session_dto_1 = require("./dto/update-voting-session.dto");
const add_option_dto_1 = require("./dto/add-option.dto");
const cast_vote_dto_1 = require("./dto/cast-vote.dto");
const manual_vote_dto_1 = require("./dto/manual-vote.dto");
const set_winners_dto_1 = require("./dto/set-winners.dto");
let VotingController = class VotingController {
    service;
    constructor(service) {
        this.service = service;
    }
    create(u, a, dto) {
        return this.service.create(u, a, dto);
    }
    list(u, a) {
        return this.service.list(u, a);
    }
    update(u, id, dto) {
        return this.service.update(u, id, dto);
    }
    option(u, id, dto) {
        return this.service.addOption(u, id, dto);
    }
    open(u, id, req) {
        return this.service.open(u, id, { ip: req.ip, userAgent: req.headers['user-agent'] });
    }
    close(u, id, req) {
        return this.service.close(u, id, { ip: req.ip, userAgent: req.headers['user-agent'] });
    }
    archive(u, id, req) {
        return this.service.archive(u, id, { ip: req.ip, userAgent: req.headers['user-agent'] });
    }
    winners(u, id, dto, req) {
        return this.service.setWinners(u, id, dto.optionIds, {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
        });
    }
    manual(u, id, dto, req) {
        return this.service.castManual(u, id, dto.unitId, dto.optionId, {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
        });
    }
    results(u, id, fm) {
        return this.service.results(u, id, fm === 'true');
    }
    access(token) {
        return this.service.publicAccess(token);
    }
    vote(id, dto, req) {
        return this.service.castByQr(id, dto.token, dto.optionId, {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
        });
    }
};
exports.VotingController = VotingController;
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('superadmin', 'admin', 'operador'),
    (0, common_1.Post)('assemblies/:assemblyId/voting-sessions'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('assemblyId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, create_voting_session_dto_1.CreateVotingSessionDto]),
    __metadata("design:returntype", void 0)
], VotingController.prototype, "create", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('superadmin', 'admin', 'operador'),
    (0, common_1.Get)('assemblies/:assemblyId/voting-sessions'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('assemblyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], VotingController.prototype, "list", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('superadmin', 'admin'),
    (0, common_1.Patch)('voting-sessions/:sessionId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('sessionId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_voting_session_dto_1.UpdateVotingSessionDto]),
    __metadata("design:returntype", void 0)
], VotingController.prototype, "update", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('superadmin', 'admin'),
    (0, common_1.Post)('voting-sessions/:sessionId/options'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('sessionId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, add_option_dto_1.AddOptionDto]),
    __metadata("design:returntype", void 0)
], VotingController.prototype, "option", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('superadmin', 'admin', 'operador'),
    (0, common_1.Post)('voting-sessions/:sessionId/open'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('sessionId')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], VotingController.prototype, "open", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('superadmin', 'admin', 'operador'),
    (0, common_1.Post)('voting-sessions/:sessionId/close'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('sessionId')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], VotingController.prototype, "close", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('superadmin', 'admin'),
    (0, common_1.Post)('voting-sessions/:sessionId/archive'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('sessionId')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], VotingController.prototype, "archive", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('superadmin', 'admin', 'operador'),
    (0, common_1.Put)('voting-sessions/:sessionId/winners'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('sessionId')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, set_winners_dto_1.SetWinnersDto, Object]),
    __metadata("design:returntype", void 0)
], VotingController.prototype, "winners", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('superadmin', 'admin', 'operador'),
    (0, common_1.Post)('voting-sessions/:sessionId/manual-vote'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('sessionId')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, manual_vote_dto_1.ManualVoteDto, Object]),
    __metadata("design:returntype", void 0)
], VotingController.prototype, "manual", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('superadmin', 'admin', 'operador'),
    (0, common_1.Get)('voting-sessions/:sessionId/results'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('sessionId')),
    __param(2, (0, common_1.Query)('forMinutes')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], VotingController.prototype, "results", null);
__decorate([
    (0, common_1.Get)('public/voting/access'),
    __param(0, (0, common_1.Query)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], VotingController.prototype, "access", null);
__decorate([
    (0, common_1.Post)('public/voting/sessions/:sessionId/vote'),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, cast_vote_dto_1.CastVoteDto, Object]),
    __metadata("design:returntype", void 0)
], VotingController.prototype, "vote", null);
exports.VotingController = VotingController = __decorate([
    (0, swagger_1.ApiTags)('Voting'),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [voting_service_1.VotingService])
], VotingController);
//# sourceMappingURL=voting.controller.js.map
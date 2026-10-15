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
exports.AppStateController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../common/jwt-auth.guard");
const roles_guard_1 = require("../common/roles.guard");
const roles_decorator_1 = require("../common/roles.decorator");
const current_user_decorator_1 = require("../common/current-user.decorator");
const app_state_service_1 = require("./app-state.service");
let AppStateController = class AppStateController {
    service;
    constructor(service) {
        this.service = service;
    }
    summary(user) {
        return this.service.summary(user);
    }
    history(user, propertyId) {
        return this.service.history(user, propertyId);
    }
    historyItem(user, propertyId, id) {
        return this.service.historyItem(user, propertyId, id);
    }
    deleteHistoryItem(user, propertyId, id) {
        return this.service.deleteHistoryItem(user, propertyId, id);
    }
    info(user, propertyId) {
        return this.service.info(user, propertyId);
    }
    load(user, propertyId, previous) {
        return this.service.load(user, propertyId, previous === '1');
    }
    save(user, propertyId, body) {
        return this.service.save(user, propertyId, body?.data, body?.label);
    }
};
exports.AppStateController = AppStateController;
__decorate([
    (0, common_1.Get)('summary/all'),
    (0, roles_decorator_1.Roles)('superadmin', 'admin', 'operador'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AppStateController.prototype, "summary", null);
__decorate([
    (0, common_1.Get)(':propertyId/history'),
    (0, roles_decorator_1.Roles)('superadmin', 'admin', 'operador'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('propertyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AppStateController.prototype, "history", null);
__decorate([
    (0, common_1.Get)(':propertyId/history/:id'),
    (0, roles_decorator_1.Roles)('superadmin', 'admin', 'operador'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('propertyId')),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], AppStateController.prototype, "historyItem", null);
__decorate([
    (0, common_1.Delete)(':propertyId/history/:id'),
    (0, roles_decorator_1.Roles)('superadmin', 'admin'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('propertyId')),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], AppStateController.prototype, "deleteHistoryItem", null);
__decorate([
    (0, common_1.Get)(':propertyId/info'),
    (0, roles_decorator_1.Roles)('superadmin', 'admin', 'operador'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('propertyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AppStateController.prototype, "info", null);
__decorate([
    (0, common_1.Get)(':propertyId'),
    (0, roles_decorator_1.Roles)('superadmin', 'admin', 'operador'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('propertyId')),
    __param(2, (0, common_1.Query)('previous')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], AppStateController.prototype, "load", null);
__decorate([
    (0, common_1.Put)(':propertyId'),
    (0, roles_decorator_1.Roles)('superadmin', 'admin', 'operador'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('propertyId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], AppStateController.prototype, "save", null);
exports.AppStateController = AppStateController = __decorate([
    (0, swagger_1.ApiTags)('App state (copia de seguridad)'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('app-state'),
    __metadata("design:paramtypes", [app_state_service_1.AppStateService])
], AppStateController);
//# sourceMappingURL=app-state.controller.js.map
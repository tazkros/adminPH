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
exports.PropertiesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const properties_service_1 = require("./properties.service");
const jwt_auth_guard_1 = require("../common/jwt-auth.guard");
const roles_guard_1 = require("../common/roles.guard");
const roles_decorator_1 = require("../common/roles.decorator");
const current_user_decorator_1 = require("../common/current-user.decorator");
const update_property_config_dto_1 = require("./dto/update-property-config.dto");
const sync_property_units_dto_1 = require("./dto/sync-property-units.dto");
const update_property_unit_dto_1 = require("./dto/update-property-unit.dto");
const create_property_dto_1 = require("./dto/create-property.dto");
let PropertiesController = class PropertiesController {
    service;
    constructor(service) {
        this.service = service;
    }
    list(user) {
        return this.service.list(user);
    }
    create(user, dto, req) {
        return this.service.create(user, dto, { ip: req.ip, userAgent: req.headers['user-agent'] });
    }
    config(user, propertyId) {
        return this.service.getConfig(user, propertyId);
    }
    updateConfig(user, propertyId, dto, req) {
        return this.service.updateConfig(user, propertyId, dto.config, {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
        });
    }
    listUnits(user, propertyId) {
        return this.service.listUnits(user, propertyId);
    }
    syncUnits(user, propertyId, dto, req) {
        return this.service.syncUnits(user, propertyId, dto, {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
        });
    }
    updateUnit(user, propertyId, unitId, dto, req) {
        return this.service.updateUnit(user, propertyId, unitId, dto, {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
        });
    }
    deactivateUnit(user, propertyId, unitId, req) {
        return this.service.deactivateUnit(user, propertyId, unitId, {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
        });
    }
};
exports.PropertiesController = PropertiesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PropertiesController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)('superadmin', 'admin'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_property_dto_1.CreatePropertyDto, Object]),
    __metadata("design:returntype", void 0)
], PropertiesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':propertyId/config'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('propertyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PropertiesController.prototype, "config", null);
__decorate([
    (0, common_1.Put)(':propertyId/config'),
    (0, roles_decorator_1.Roles)('superadmin', 'admin'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('propertyId')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_property_config_dto_1.UpdatePropertyConfigDto, Object]),
    __metadata("design:returntype", void 0)
], PropertiesController.prototype, "updateConfig", null);
__decorate([
    (0, common_1.Get)(':propertyId/units'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('propertyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PropertiesController.prototype, "listUnits", null);
__decorate([
    (0, common_1.Put)(':propertyId/units/sync'),
    (0, roles_decorator_1.Roles)('superadmin', 'admin'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('propertyId')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, sync_property_units_dto_1.SyncPropertyUnitsDto, Object]),
    __metadata("design:returntype", void 0)
], PropertiesController.prototype, "syncUnits", null);
__decorate([
    (0, common_1.Put)(':propertyId/units/:unitId'),
    (0, roles_decorator_1.Roles)('superadmin', 'admin'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('propertyId')),
    __param(2, (0, common_1.Param)('unitId')),
    __param(3, (0, common_1.Body)()),
    __param(4, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, update_property_unit_dto_1.UpdatePropertyUnitDto, Object]),
    __metadata("design:returntype", void 0)
], PropertiesController.prototype, "updateUnit", null);
__decorate([
    (0, common_1.Delete)(':propertyId/units/:unitId'),
    (0, roles_decorator_1.Roles)('superadmin', 'admin'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('propertyId')),
    __param(2, (0, common_1.Param)('unitId')),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", void 0)
], PropertiesController.prototype, "deactivateUnit", null);
exports.PropertiesController = PropertiesController = __decorate([
    (0, swagger_1.ApiTags)('Properties / Configuration'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('properties'),
    __metadata("design:paramtypes", [properties_service_1.PropertiesService])
], PropertiesController);
//# sourceMappingURL=properties.controller.js.map
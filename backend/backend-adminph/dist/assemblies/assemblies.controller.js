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
exports.AssembliesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const assemblies_service_1 = require("./assemblies.service");
const jwt_auth_guard_1 = require("../common/jwt-auth.guard");
const roles_guard_1 = require("../common/roles.guard");
const roles_decorator_1 = require("../common/roles.decorator");
const current_user_decorator_1 = require("../common/current-user.decorator");
const upsert_attendance_dto_1 = require("./dto/upsert-attendance.dto");
const create_assembly_dto_1 = require("./dto/create-assembly.dto");
let AssembliesController = class AssembliesController {
    service;
    constructor(service) {
        this.service = service;
    }
    createAssembly(u, dto) {
        return this.service.createAssembly(u, dto);
    }
    start(u, id, req) {
        return this.service.changeStatus(u, id, 'active', {
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });
    }
    closeAssembly(u, id, req) {
        return this.service.changeStatus(u, id, 'closed', {
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });
    }
    listForProperty(u, propertyId) {
        return this.service.listForProperty(u, propertyId);
    }
    currentForProperty(u, propertyId) {
        return this.service.currentForProperty(u, propertyId);
    }
    attendance(u, id) {
        return this.service.attendance(u, id);
    }
    upsert(u, a, unit, dto, req) {
        return this.service.upsertAttendance(u, a, unit, dto, {
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });
    }
    provisionQr(u, id, req) {
        return this.service.provisionQrInventory(u, id, {
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });
    }
    qr(u, id) {
        return this.service.listQr(u, id);
    }
    reissue(u, a, unit, req) {
        return this.service.reissueQr(u, a, unit, {
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });
    }
};
exports.AssembliesController = AssembliesController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)('superadmin', 'admin'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_assembly_dto_1.CreateAssemblyDto]),
    __metadata("design:returntype", void 0)
], AssembliesController.prototype, "createAssembly", null);
__decorate([
    (0, common_1.Post)(':assemblyId/start'),
    (0, roles_decorator_1.Roles)('superadmin', 'admin'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('assemblyId')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], AssembliesController.prototype, "start", null);
__decorate([
    (0, common_1.Post)(':assemblyId/close'),
    (0, roles_decorator_1.Roles)('superadmin', 'admin'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('assemblyId')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], AssembliesController.prototype, "closeAssembly", null);
__decorate([
    (0, common_1.Get)('property/:propertyId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('propertyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AssembliesController.prototype, "listForProperty", null);
__decorate([
    (0, common_1.Get)('property/:propertyId/current'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('propertyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AssembliesController.prototype, "currentForProperty", null);
__decorate([
    (0, common_1.Get)(':assemblyId/attendance'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('assemblyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AssembliesController.prototype, "attendance", null);
__decorate([
    (0, common_1.Put)(':assemblyId/attendance/:unitId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('assemblyId')),
    __param(2, (0, common_1.Param)('unitId')),
    __param(3, (0, common_1.Body)()),
    __param(4, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, upsert_attendance_dto_1.UpsertAttendanceDto, Object]),
    __metadata("design:returntype", void 0)
], AssembliesController.prototype, "upsert", null);
__decorate([
    (0, common_1.Post)(':assemblyId/qr-tokens/provision'),
    (0, roles_decorator_1.Roles)('superadmin', 'admin'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('assemblyId')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], AssembliesController.prototype, "provisionQr", null);
__decorate([
    (0, common_1.Get)(':assemblyId/qr-tokens'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('assemblyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AssembliesController.prototype, "qr", null);
__decorate([
    (0, common_1.Post)(':assemblyId/attendance/:unitId/qr/reissue'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('assemblyId')),
    __param(2, (0, common_1.Param)('unitId')),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", void 0)
], AssembliesController.prototype, "reissue", null);
exports.AssembliesController = AssembliesController = __decorate([
    (0, swagger_1.ApiTags)('Assemblies / Attendance / QR'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('superadmin', 'admin', 'operador'),
    (0, common_1.Controller)('assemblies'),
    __metadata("design:paramtypes", [assemblies_service_1.AssembliesService])
], AssembliesController);
//# sourceMappingURL=assemblies.controller.js.map
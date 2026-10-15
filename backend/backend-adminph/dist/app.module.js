"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const database_module_1 = require("./database/database.module");
const common_module_1 = require("./common/common.module");
const audit_module_1 = require("./audit/audit.module");
const auth_module_1 = require("./auth/auth.module");
const health_module_1 = require("./health/health.module");
const assemblies_module_1 = require("./assemblies/assemblies.module");
const voting_module_1 = require("./voting/voting.module");
const proxy_module_1 = require("./proxy/proxy.module");
const properties_module_1 = require("./properties/properties.module");
const app_state_module_1 = require("./app-state/app-state.module");
const notifications_module_1 = require("./notifications/notifications.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            jwt_1.JwtModule.registerAsync({ global: true, inject: [config_1.ConfigService], useFactory: (c) => ({ secret: c.getOrThrow('JWT_SECRET'), signOptions: { expiresIn: c.get('JWT_EXPIRES_IN') || '8h' } }) }),
            database_module_1.DatabaseModule, common_module_1.CommonModule, audit_module_1.AuditModule, auth_module_1.AuthModule, health_module_1.HealthModule, assemblies_module_1.AssembliesModule, voting_module_1.VotingModule, proxy_module_1.ProxyModule, properties_module_1.PropertiesModule, app_state_module_1.AppStateModule, notifications_module_1.NotificationsModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map
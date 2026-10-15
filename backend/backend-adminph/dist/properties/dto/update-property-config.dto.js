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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdatePropertyConfigDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class UpdatePropertyConfigDto {
    config;
}
exports.UpdatePropertyConfigDto = UpdatePropertyConfigDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Configuración completa del conjunto usada por el frontend AdminPH',
        type: 'object',
        additionalProperties: true,
        example: {
            nombreConjunto: 'Mi Conjunto Residencial',
            nit: '900.123.456-7',
            ciudad: 'Bogotá D.C.',
            direccion: 'Cra 10 #20-30',
            administradorNombre: 'Administrador Demo',
            fechaReunion: '2026-09-18',
            horaReunion: '18:00',
            tipoReunion: 'ordinaria',
            convocatoriaActual: 1,
            quorumPrimeraPorcentaje: 50,
            quorumSegundaPorcentaje: 30,
            formatoUnidad: '{NIVEL}{UNIDAD}',
            niveles: []
        }
    }),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdatePropertyConfigDto.prototype, "config", void 0);
//# sourceMappingURL=update-property-config.dto.js.map
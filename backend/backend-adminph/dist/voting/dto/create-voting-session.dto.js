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
exports.CreateVotingSessionDto = void 0;
const class_validator_1 = require("class-validator");
class CreateVotingSessionDto {
    agendaItemId;
    title;
    countingMethod;
    inputMode;
    quorumType;
    quorumPercentage;
    winnersRequired;
    includeVoterDetailsInMinutes;
}
exports.CreateVotingSessionDto = CreateVotingSessionDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateVotingSessionDto.prototype, "agendaItemId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    __metadata("design:type", String)
], CreateVotingSessionDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['nominal', 'coefficient']),
    __metadata("design:type", String)
], CreateVotingSessionDto.prototype, "countingMethod", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['manual', 'qr', 'mixed']),
    __metadata("design:type", String)
], CreateVotingSessionDto.prototype, "inputMode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['deliberatory', 'decisory']),
    __metadata("design:type", String)
], CreateVotingSessionDto.prototype, "quorumType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.01),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], CreateVotingSessionDto.prototype, "quorumPercentage", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateVotingSessionDto.prototype, "winnersRequired", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateVotingSessionDto.prototype, "includeVoterDetailsInMinutes", void 0);
//# sourceMappingURL=create-voting-session.dto.js.map
import { DatabaseService } from '../database/database.service';
import { AccessService } from '../common/access.service';
import { QrTokenService } from '../common/qr-token.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/auth-user.interface';
import { CreateVotingSessionDto } from './dto/create-voting-session.dto';
import { UpdateVotingSessionDto } from './dto/update-voting-session.dto';
import { AddOptionDto } from './dto/add-option.dto';
import { ProxyService } from '../proxy/proxy.service';
export declare class VotingService {
    private readonly db;
    private readonly access;
    private readonly qr;
    private readonly audit;
    private readonly proxy;
    constructor(db: DatabaseService, access: AccessService, qr: QrTokenService, audit: AuditService, proxy: ProxyService);
    create(user: AuthUser, assemblyId: string, dto: CreateVotingSessionDto): Promise<any>;
    list(user: AuthUser, assemblyId: string): Promise<any[]>;
    update(user: AuthUser, sessionId: string, dto: UpdateVotingSessionDto): Promise<any>;
    addOption(user: AuthUser, sessionId: string, dto: AddOptionDto): Promise<any>;
    open(user: AuthUser, sessionId: string, meta: any): Promise<any>;
    close(user: AuthUser, sessionId: string, meta: any): Promise<any>;
    archive(user: AuthUser, sessionId: string, meta: any): Promise<any>;
    setWinners(user: AuthUser, sessionId: string, optionIds: string[], meta: any): Promise<{
        sessionId: string;
        winnersRequired: number;
        winnersConfirmed: boolean;
        options: any[];
    }>;
    publicAccess(token: string): Promise<{
        assemblyId: any;
        assemblyName: any;
        unitId: any;
        unitNumber: any;
        attendeeName: any;
        proxy: {
            units: {
                unitNumber: any;
                coefficient: number;
            }[];
        } | null;
        sessions: any[];
    }>;
    castByQr(sessionId: string, token: string, optionId: string, meta: any): Promise<any>;
    castManual(user: AuthUser, sessionId: string, unitId: string, optionId: string, meta: any): Promise<any>;
    private castForRepresented;
    private castBallot;
    results(user: AuthUser, sessionId: string, forMinutes?: boolean): Promise<{
        session: {
            id: any;
            title: any;
            countingMethod: any;
            status: any;
            winnersRequired: number | null;
            multipleWinners: boolean;
            includeVoterDetailsInMinutes: any;
        };
        eligibleUnitsPresent: any;
        ballotsCast: any;
        remainingUnits: number;
        invariant: string;
        winnersConfirmed: boolean;
        options: any[];
        voterDetailsIncluded: boolean;
    }>;
    private getSessionForStaff;
}

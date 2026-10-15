import { VotingService } from './voting.service';
import { AuthUser } from '../common/auth-user.interface';
import { CreateVotingSessionDto } from './dto/create-voting-session.dto';
import { UpdateVotingSessionDto } from './dto/update-voting-session.dto';
import { AddOptionDto } from './dto/add-option.dto';
import { CastVoteDto } from './dto/cast-vote.dto';
import { ManualVoteDto } from './dto/manual-vote.dto';
import { SetWinnersDto } from './dto/set-winners.dto';
export declare class VotingController {
    private readonly service;
    constructor(service: VotingService);
    create(u: AuthUser, a: string, dto: CreateVotingSessionDto): Promise<any>;
    list(u: AuthUser, a: string): Promise<any[]>;
    update(u: AuthUser, id: string, dto: UpdateVotingSessionDto): Promise<any>;
    option(u: AuthUser, id: string, dto: AddOptionDto): Promise<any>;
    open(u: AuthUser, id: string, req: any): Promise<any>;
    close(u: AuthUser, id: string, req: any): Promise<any>;
    archive(u: AuthUser, id: string, req: any): Promise<any>;
    winners(u: AuthUser, id: string, dto: SetWinnersDto, req: any): Promise<{
        sessionId: string;
        winnersRequired: number;
        winnersConfirmed: boolean;
        options: any[];
    }>;
    manual(u: AuthUser, id: string, dto: ManualVoteDto, req: any): Promise<any>;
    results(u: AuthUser, id: string, fm?: string): Promise<{
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
    access(token: string): Promise<{
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
    vote(id: string, dto: CastVoteDto, req: any): Promise<any>;
}

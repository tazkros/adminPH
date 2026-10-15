export declare class CreateVotingSessionDto {
    agendaItemId?: string;
    title: string;
    countingMethod?: 'nominal' | 'coefficient';
    inputMode?: 'manual' | 'qr' | 'mixed';
    quorumType?: string;
    quorumPercentage?: number;
    winnersRequired?: number;
    includeVoterDetailsInMinutes?: boolean;
}

export declare class UpsertAttendanceDto {
    attended: boolean;
    personId?: string;
    attendanceRole?: 'owner' | 'proxy';
    attendeeName?: string;
    attendeeDocument?: string;
    verificationMethod?: string;
    notes?: string;
}

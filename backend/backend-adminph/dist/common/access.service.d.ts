import { DatabaseService } from '../database/database.service';
import { AuthUser } from './auth-user.interface';
export declare class AccessService {
    private readonly db;
    constructor(db: DatabaseService);
    ensureProperty(user: AuthUser, propertyId: string): Promise<any>;
    ensureAssembly(user: AuthUser, assemblyId: string): Promise<any>;
}

import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service';
import { LoginDto } from './dto/login.dto';
export declare class AuthService {
    private readonly db;
    private readonly jwt;
    constructor(db: DatabaseService, jwt: JwtService);
    login(dto: LoginDto): Promise<{
        accessToken: string;
        user: {
            id: any;
            organizationId: any;
            username: any;
            fullName: any;
            roles: any;
        };
    }>;
}

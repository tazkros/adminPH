import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AuthUser } from '../common/auth-user.interface';
export declare class AuthController {
    private readonly auth;
    constructor(auth: AuthService);
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
    me(user: AuthUser): AuthUser;
}

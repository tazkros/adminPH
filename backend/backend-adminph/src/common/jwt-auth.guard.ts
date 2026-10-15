import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthUser } from './auth-user.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header = String(req.headers.authorization || '');
    const [type, token] = header.split(' ');
    if (type !== 'Bearer' || !token) throw new UnauthorizedException('Token requerido');
    try {
      const payload = await this.jwt.verifyAsync(token);
      req.user = {
        id: payload.sub,
        organizationId: payload.organizationId ?? null,
        username: payload.username,
        fullName: payload.fullName,
        roles: Array.isArray(payload.roles) ? payload.roles : [],
      } satisfies AuthUser;
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido o vencido');
    }
  }
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private readonly db: DatabaseService, private readonly jwt: JwtService) {}

  async login(dto: LoginDto) {
    const q = await this.db.query(
      `SELECT u.id,u.organization_id,u.username,u.password_hash,u.full_name,u.active,
              COALESCE(array_agg(r.code) FILTER (WHERE r.code IS NOT NULL), '{}') AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id=u.id
       LEFT JOIN roles r ON r.id=ur.role_id
       WHERE lower(u.username)=lower($1)
       GROUP BY u.id`, [dto.username.trim()],
    );
    const user = q.rows[0];
    if (!user || !user.active || !(await bcrypt.compare(dto.password, user.password_hash))) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }
    await this.db.query('UPDATE users SET last_login_at=NOW() WHERE id=$1', [user.id]);
    const payload = {
      sub: user.id,
      organizationId: user.organization_id,
      username: user.username,
      fullName: user.full_name,
      roles: user.roles,
    };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: { id: user.id, organizationId: user.organization_id, username: user.username, fullName: user.full_name, roles: user.roles },
    };
  }
}

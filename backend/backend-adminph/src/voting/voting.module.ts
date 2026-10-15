import { Module } from '@nestjs/common';
import { VotingController } from './voting.controller';
import { VotingService } from './voting.service';
import { ProxyModule } from '../proxy/proxy.module';
@Module({ imports:[ProxyModule], controllers:[VotingController], providers:[VotingService] })
export class VotingModule {}

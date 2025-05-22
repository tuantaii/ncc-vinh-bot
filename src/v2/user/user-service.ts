import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ChannelMessage } from 'mezon-sdk';
@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserBalance(data: ChannelMessage) {
    const user = await this.prisma.user_balance.findUnique({
      where: { user_id: data.sender_id },
    });
    return user;
  }
}

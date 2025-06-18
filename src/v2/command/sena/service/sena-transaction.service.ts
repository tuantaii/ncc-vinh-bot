import { Injectable } from '@nestjs/common';
import { ChannelMessage } from 'mezon-sdk';
import { PrismaService } from 'src/prisma/prisma.service';
import { MezonService } from 'src/v2/mezon/mezon.service';
import { EMessagePayloadType, EMessageType } from 'src/v2/mezon/types/mezon';
import { SenaCaculator } from '../ultis';

@Injectable()
export class SenaTransactionService {
  constructor(
    private readonly mezon: MezonService,
    private readonly prisma: PrismaService,
  ) {}

  async checkTransaction(data: ChannelMessage) {
    const m = data.content.t?.split(' ') || [];
    const transactionId = m[1];
    if (!transactionId) {
      await this.mezon.sendMessage({
        type: EMessageType.CHANNEL,
        reply_to_message_id: data.message_id,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content:
              'Vui lòng nhập transaction Id cần kiểm tra. Ví dụ: *logs <transaction Id>',
          },
        },
      });
      return;
    }

    try {
      const transaction = await this.prisma.transactionLogs.findFirst({
        where: { transactionId },
      });

      let content = ' ';
      if (transaction) {
        const user = await this.prisma.userBalance.findUnique({
          where: { userId: transaction.userId },
        });
        content = `TransactionLogs: 
        - User: ${user?.username || 'Không tìm thấy người dùng'}
        - Amount: ${SenaCaculator.formatVND(transaction.amount)}
        - Created At: ${transaction.createdAt.toLocaleDateString('vi-VN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })}
        - Type: ${transaction.type}`;
      } else {
        content = `Không tìm thấy transaction với ID: ${transactionId}`;
      }

      await this.mezon.sendMessage({
        type: EMessageType.CHANNEL,
        reply_to_message_id: data.message_id,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content,
          },
        },
      });
    } catch (error) {
      console.error('Error checking transaction:', error);
      await this.mezon.sendMessage({
        type: EMessageType.CHANNEL,
        reply_to_message_id: data.message_id,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content:
              'Đã xảy ra lỗi khi kiểm tra transaction. Vui lòng thử lại sau.',
          },
        },
      });
    }
  }

  async checkTransactionSend(data: ChannelMessage) {
    const m = data.content.t?.split(' ') || [];
    const transactionId = m[1];

    if (!transactionId) {
      await this.mezon.sendMessage({
        type: EMessageType.CHANNEL,
        reply_to_message_id: data.message_id,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content:
              'Vui lòng nhập transaction Id cần kiểm tra. Ví dụ: *lsend <transaction Id>',
          },
        },
      });
      return;
    }

    try {
      const transactionSend = await this.prisma.transactionSendLogs.findFirst({
        where: { id: Number(transactionId) },
      });

      let content = '';

      if (!transactionSend) {
        await this.mezon.sendMessage({
          type: EMessageType.CHANNEL,
          reply_to_message_id: data.message_id,
          payload: {
            channel_id: data.channel_id,
            message: {
              type: EMessagePayloadType.SYSTEM,
              content: `Không tìm thấy transaction send với ID: ${transactionId}`,
            },
          },
        });
        return;
      } else {
        const fromUser = await this.prisma.userBalance.findUnique({
          where: { userId: transactionSend.userId },
        });
        const toUser = await this.prisma.userBalance.findUnique({
          where: { userId: transactionSend.toUserId },
        });

        content = `TransactionSendLogs:
            - From: ${transactionSend.userId} (${fromUser?.username || 'unknown'})
            - To: ${transactionSend.toUserId} (${toUser?.username || 'unknown'})
            - Amount: ${SenaCaculator.formatVND(transactionSend.amount)}
            - Note: ${transactionSend.note}
            - Created At: ${transactionSend.createdAt.toLocaleDateString(
              'vi-VN',
              {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              },
            )}`;
      }

      if (!content) {
        content = `Không tìm thấy transaction với ID: ${transactionId}`;
      }

      await this.mezon.sendMessage({
        type: EMessageType.CHANNEL,
        reply_to_message_id: data.message_id,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content,
          },
        },
      });
    } catch (error) {
      console.error('Error checking transaction send:', error);
      await this.mezon.sendMessage({
        type: EMessageType.CHANNEL,
        reply_to_message_id: data.message_id,
        payload: {
          channel_id: data.channel_id,
          message: {
            type: EMessagePayloadType.SYSTEM,
            content:
              'Đã xảy ra lỗi khi kiểm tra transaction gửi. Vui lòng thử lại sau.',
          },
        },
      });
    }
  }
}

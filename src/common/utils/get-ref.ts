import { ChannelMessage } from 'mezon-sdk';

export function getRef(message: ChannelMessage) {
  return {
    message_id: message.message_id!,
    message_ref_id: message.message_id!,
    ref_type: 1,
    message_sender_id: message.sender_id,
    message_sender_username: message.username,
    mesages_sender_avatar: message.avatar,
    message_sender_clan_nick: message.clan_nick,
    message_sender_display_name: message.display_name,
    content: JSON.stringify(message.content),
    has_attachment: Number(message.attachments?.length) > 0,
    channel_id: message.channel_id,
    mode: message.mode,
    channel_label: message.channel_label,
  };
}

export const getGameRef = (game: any) => {
  return {
    message_ref_id: game[0].message_id,
    content: `{"t":"🎮Kéo búa bao giữa ${game[0].user_name_create} và ${game[0].only_for_user_name}\\n💰Cược ${game[0].cost} token","components":[{"components":[{"id":"keo","type":1,"component":{"label":"✂️KÉO","style":3}},{"id":"bua","type":1,"component":{"label":"👊BÚA","style":2}},{"id":"bao","type":1,"component":{"label":"👋BAO","style":1}},{"id":"che","type":1,"component":{"label":"❌TỪ CHỐI CHƠI","style":4}}]}]}`,
    message_sender_id: '1840678620591296512',
    message_sender_username: 'Sena',
    mesages_sender_avatar:
      'https://cdn.mezon.vn//0/0/1826107674538807300/1744126467011_undefinedimages.jpeg',
    message_sender_display_name: 'Sena',
  };
};

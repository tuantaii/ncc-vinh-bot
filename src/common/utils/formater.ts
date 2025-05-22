export const formatToken = (token?: number | null) => {
  if (!token) return '0';
  return token.toLocaleString('vi-VN') + ' token';
};

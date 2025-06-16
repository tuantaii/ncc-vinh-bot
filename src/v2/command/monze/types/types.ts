export interface Token {
  id: string;
  name: string;
  symbol: string;
  price_usd: number;
}

export interface FullToken {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number | null;
  platforms: {
    ethereum?: string;
    [key: string]: string | undefined;
  };
}

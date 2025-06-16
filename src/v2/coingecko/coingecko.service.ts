import { Injectable, NotFoundException } from '@nestjs/common';
import { FullToken, Token } from '../command/monze/types/types';
import axios from 'axios';
import { ethers } from 'ethers';

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

@Injectable()
export class CoingeckoService {
  private provider = new ethers.JsonRpcProvider(
    'https://mainnet.infura.io/v3/a633fc89100b43cba3fe9b9680669e26',
  );

  async getEthBalance(address: string): Promise<{ balance: string }> {
    const balance = await this.provider.getBalance(address);
    const formatted = ethers.formatEther(balance);
    return { balance: formatted };
  }

  async getTop10EthereumTokens(): Promise<Token[]> {
    const response = await axios.get(
      'https://api.coingecko.com/api/v3/coins/markets',
      {
        params: {
          vs_currency: 'usd',
          order: 'market_cap_desc',
          per_page: 100,
          page: 1,
          sparkline: false,
        },
      },
    );
    const data = response.data as FullToken[];

    return data.slice(0, 10).map(
      (token): Token => ({
        id: token.id,
        name: token.name,
        symbol: token.symbol.toUpperCase(),
        price_usd: token.current_price,
      }),
    );
  }

  private async getCoinIdFromSymbol(symbol: string): Promise<string> {
    const response = await axios.get(
      'https://api.coingecko.com/api/v3/coins/list',
    );

    const match = response.data.find(
      (coin: any) => coin.symbol.toLowerCase() === symbol.toLowerCase(),
    );

    if (!match) {
      throw new NotFoundException(`Symbol '${symbol}' not found on CoinGecko`);
    }

    return match.id;
  }

  async getTokenPrice(
    symbol: string,
  ): Promise<{ symbol: string; usd: number }> {
    const id = await this.getCoinIdFromSymbol(symbol);

    const priceRes = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price',
      {
        params: {
          ids: id,
          vs_currencies: 'usd',
        },
      },
    );

    const usd = priceRes.data[id]?.usd;
    if (usd === undefined) {
      throw new NotFoundException(`Price not available for symbol '${symbol}'`);
    }

    return {
      symbol: symbol.toUpperCase(),
      usd,
    };
  }
}

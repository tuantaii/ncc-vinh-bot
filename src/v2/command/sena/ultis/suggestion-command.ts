import * as fuzz from 'fuzzball';
import { VALID_COMMANDS } from '../constansts';

export function suggestCommand(
  input: string,
  threshold: number = 80,
  minThreshold: number = 50,
): string[] {
  if (!input.startsWith('*')) return [];
  const command = input.split(' ')[0];

  if (VALID_COMMANDS.includes(command)) return [];

  const cleanInput = command.slice(1);
  const cleanCommands = VALID_COMMANDS.map((cmd) => cmd.slice(1));

  const matches = fuzz.extract(cleanInput, cleanCommands, {
    scorer: fuzz.ratio,
    returnObjects: true,
  }) as { choice: string; score: number }[];

  const suggestions = matches
    .filter((match) => match.score >= minThreshold)
    .map((match) => `*${match.choice}`);

  return suggestions.slice(0, 3);
}

import { SenaCaculator } from './sena.caculator';

describe('SenaCaculator.calculateHandValue', () => {
  const cases = [
    { hand: [0, 3, 6], expected: 21 }, // A, 4, 7
    { hand: [0, 9, 1], expected: 13 }, // A, 10, 2
    { hand: [0, 9, 2], expected: 14 }, // A, 10, 3
    { hand: [0, 9, 8], expected: 20 }, // A, 10, 9
    { hand: [0, 12, 8], expected: 20 }, // A, K, 9
    { hand: [0, 12, 9], expected: 21 }, // A, K, 10
    { hand: [0, 11, 10], expected: 21 }, // A, Q, J
    { hand: [0, 5, 5], expected: 13 }, // A, 6, 6
    { hand: [0, 2, 8], expected: 13 }, // A, 3, 9
    { hand: [0, 4, 7], expected: 14 }, // A, 5, 8
    { hand: [0, 1, 9], expected: 13 }, // A, 2, 10
    { hand: [0, 7, 8], expected: 18 }, // A, 8, 9
    { hand: [0, 2, 3], expected: 17 }, // A, 3, 4
    { hand: [0, 2, 9], expected: 14 }, // A, 3, 10
  ];

  cases.forEach(({ hand, expected }, idx) => {
    it(`case ${idx + 1}: hand=${hand.join(',')} should return ${expected}`, () => {
      expect(SenaCaculator.calculateHandValue(hand)).toBe(expected);
    });
  });
});

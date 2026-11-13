import { parseQuickAdd } from '../lib/parseQuickAdd';

describe('parseQuickAdd', () => {
  it('parses "2kg rice"', () => {
    expect(parseQuickAdd('2kg rice')).toEqual({
      name: 'rice',
      quantity: 2,
      unit: 'kg',
    });
  });

  it('parses "rice 2kg"', () => {
    expect(parseQuickAdd('rice 2kg')).toEqual({
      name: 'rice',
      quantity: 2,
      unit: 'kg',
    });
  });

  it('parses "3 tomatoes"', () => {
    expect(parseQuickAdd('3 tomatoes')).toEqual({
      name: 'tomatoes',
      quantity: 3,
      unit: undefined,
    });
  });

  it('parses "tomatoes x3"', () => {
    expect(parseQuickAdd('tomatoes x3')).toEqual({
      name: 'tomatoes',
      quantity: 3,
      unit: undefined,
    });
  });

  it('parses plain item "rice"', () => {
    expect(parseQuickAdd('rice')).toEqual({
      name: 'rice',
      quantity: undefined,
      unit: undefined,
    });
  });

  it('parses decimals and units like "2.5 litres milk"', () => {
    expect(parseQuickAdd('2.5 litres milk')).toEqual({
      name: 'milk',
      quantity: 2.5,
      unit: 'l',
    });
  });

  it('parses "Garri 5 bags"', () => {
    expect(parseQuickAdd('Garri 5 bags')).toEqual({
      name: 'Garri',
      quantity: 5,
      unit: 'bag',
    });
  });
});

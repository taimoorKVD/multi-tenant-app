import { templateSchemaContainsReference } from './template-reference.util';

describe('templateSchemaContainsReference', () => {
  const buildItemField = (value: unknown) => ({
    id: 'item-field',
    name: 'selectedItem',
    optionSource: { type: 'dynamic', endpoint: 'items' },
    value,
  });

  it('finds a numeric item selected in a dynamic template field', () => {
    const schema = { sections: [{ fields: [buildItemField(42)] }] };
    expect(templateSchemaContainsReference(schema, 'items', [42])).toBe(true);
  });

  it('finds an object item selection by id', () => {
    const schema = { sections: [{ fields: [buildItemField({ id: 42, name: 'Rice' })] }] };
    expect(templateSchemaContainsReference(schema, 'items', [42])).toBe(true);
  });

  it('does not match an item selection when its id is unrelated', () => {
    const schema = { sections: [{ fields: [buildItemField(99)] }] };
    expect(templateSchemaContainsReference(schema, 'items', [42])).toBe(false);
  });

  it.each([
    ['users', 'users', 7],
    ['vendors', 'vendors', 8],
    ['job positions', 'jobpositions', 9],
    ['locations', 'locations', 10],
  ])('finds a linked %s reference', (_label, endpoint, id) => {
    const schema = {
      sections: [{
        fields: [{ optionSource: { endpoint }, value: id }],
      }],
    };
    expect(templateSchemaContainsReference(schema, endpoint as any, [id])).toBe(true);
  });

  it('handles circular template schema values safely', () => {
    const schema: any = {};
    schema.self = schema;
    expect(templateSchemaContainsReference(schema, 'items', [42])).toBe(false);
  });
});

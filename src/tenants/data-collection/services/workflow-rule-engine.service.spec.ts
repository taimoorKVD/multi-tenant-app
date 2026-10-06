import { WorkflowMatchMode, WorkflowSkipReason } from '../entities/enums';
import { WorkflowRuleEngineService } from './workflow-rule-engine.service';

describe('WorkflowRuleEngineService', () => {
  const engine = new WorkflowRuleEngineService();

  it('skips disabled rules without evaluating items', async () => {
    const result = await engine.evaluateRule(
      {},
      {
        id: 'logic_disabled',
        name: 'off',
        enabled: false,
        conditions: {
          match: WorkflowMatchMode.ALL,
          items: [{ id: '1', fieldId: 'fld_notes', operator: 'isNotEmpty', comparison: { type: 'fixed' } }],
        },
      },
      { fld_notes: 'hello' },
      {},
    );
    expect(result.matched).toBe(false);
    expect(result.skipReason).toBe(WorkflowSkipReason.DISABLED);
    expect(result.conditionResults).toEqual([]);
  });

  it('matches ALL vs ANY', async () => {
    const items = [
      { id: 'a', fieldId: 'fld_cost', operator: 'greaterThan', comparison: { type: 'fixed', value: 500 } },
      { id: 'b', fieldId: 'fld_cost', operator: 'equals', comparison: { type: 'field', fieldId: 'fld_quoted_cost' } },
    ];
    const answers = { fld_cost: 100, fld_quoted_cost: 100 };

    const all = await engine.evaluateRule(
      {},
      { id: 'all', name: 'all', enabled: true, conditions: { match: 'all', items } },
      answers,
      {},
    );
    const any = await engine.evaluateRule(
      {},
      { id: 'any', name: 'any', enabled: true, conditions: { match: 'any', items } },
      answers,
      {},
    );
    expect(all.matched).toBe(false);
    expect(any.matched).toBe(true);
  });

  it('compares relatedData using loaded records', async () => {
    jest.spyOn(engine, 'loadRelatedRecord').mockResolvedValue({
      fld_vendor_credit_limit: 50,
      vendor_name: 'ABC',
    });

    const result = await engine.evaluateRule(
      { tenantConnection: {} },
      {
        id: 'rel',
        name: 'budget',
        enabled: true,
        conditions: {
          match: 'all',
          items: [
            {
              id: 'rel_budget',
              fieldId: 'fld_budget',
              operator: 'greaterThan',
              comparison: {
                type: 'relatedData',
                sourceFieldId: 'fld_vendor',
                property: 'fld_vendor_credit_limit',
              },
            },
          ],
        },
      },
      { fld_budget: 80, fld_vendor: 3 },
      {
        sections: [
          {
            rows: [
              {
                fields: [
                  {
                    id: 'fld_vendor',
                    name: 'vendor',
                    optionSource: { endpoint: 'vendors' },
                  },
                ],
              },
            ],
          },
        ],
      },
    );

    expect(result.matched).toBe(true);
    expect(engine.loadRelatedRecord).toHaveBeenCalledWith({ tenantConnection: {} }, 'vendors', 3);
  });
});

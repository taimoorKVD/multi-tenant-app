/** Shared OpenAPI examples for template `schema.conditionalRules`. */
export const CONDITIONAL_RULES_SWAGGER_EXAMPLE = [
  {
    id: 'logic_numeric_or',
    name: 'Numeric operators × Fixed / Field / Related Data (match ANY)',
    enabled: true,
    conditions: {
      match: 'any',
      items: [
        {
          id: 'n_gt_fixed',
          fieldId: 'fld_cost',
          operator: 'greaterThan',
          comparison: { type: 'fixed', value: 500 },
        },
        {
          id: 'n_gt_field',
          fieldId: 'fld_cost',
          operator: 'greaterThan',
          comparison: { type: 'field', fieldId: 'fld_budget' },
        },
        {
          id: 'n_gt_related',
          fieldId: 'fld_cost',
          operator: 'greaterThan',
          comparison: {
            type: 'relatedData',
            sourceFieldId: 'fld_vendor',
            property: 'fld_vendor_credit_limit',
          },
        },
      ],
    },
    actions: [{ id: 'a_pr', type: 'purchaseRequest' }],
  },
  {
    id: 'logic_checkbox_unary',
    name: 'Checkbox unary (Fixed only)',
    enabled: true,
    conditions: {
      match: 'all',
      items: [
        {
          id: 'cb_on',
          fieldId: 'fld_needs_repair',
          operator: 'checked',
          comparison: { type: 'fixed' },
        },
      ],
    },
    actions: [
      { id: 'a_maint', type: 'maintenanceRequest' },
      { id: 'a_notify', type: 'sendNotification' },
    ],
  },
  {
    id: 'logic_disabled',
    name: 'Disabled rule must never fire',
    enabled: false,
    conditions: {
      match: 'all',
      items: [
        {
          id: 'off_1',
          fieldId: 'fld_notes',
          operator: 'isNotEmpty',
          comparison: { type: 'fixed' },
        },
      ],
    },
    actions: [{ id: 'a_maint_off', type: 'maintenanceRequest' }],
  },
];

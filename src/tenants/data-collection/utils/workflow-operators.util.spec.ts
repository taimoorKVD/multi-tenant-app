import { WorkflowConditionOperator } from '../entities/enums';
import {
  compareWorkflowValues,
  extractEntityId,
  pickRecordProperty,
} from './workflow-operators.util';

describe('compareWorkflowValues', () => {
  it('handles text operators', () => {
    expect(compareWorkflowValues(WorkflowConditionOperator.EQUALS, 'Urgent', 'urgent')).toBe(true);
    expect(compareWorkflowValues(WorkflowConditionOperator.NOT_EQUALS, 'open', 'Closed')).toBe(true);
    expect(compareWorkflowValues(WorkflowConditionOperator.CONTAINS, 'pipe leak today', 'leak')).toBe(true);
    expect(compareWorkflowValues(WorkflowConditionOperator.NOT_CONTAINS, 'notes', 'demo')).toBe(true);
    expect(compareWorkflowValues(WorkflowConditionOperator.STARTS_WITH, 'ops@company.com', 'ops@')).toBe(true);
    expect(compareWorkflowValues(WorkflowConditionOperator.ENDS_WITH, 'ops@company.com', '@company.com')).toBe(true);
  });

  it('handles numeric equals with string/number mix', () => {
    expect(compareWorkflowValues(WorkflowConditionOperator.EQUALS, 100, '100')).toBe(true);
    expect(compareWorkflowValues(WorkflowConditionOperator.GREATER_THAN, 600, '500')).toBe(true);
    expect(compareWorkflowValues(WorkflowConditionOperator.LESS_THAN_OR_EQUAL, 10, 10)).toBe(true);
  });

  it('handles dates and times', () => {
    expect(compareWorkflowValues(WorkflowConditionOperator.EQUALS, '2026-10-15', '2026-10-15')).toBe(true);
    expect(compareWorkflowValues(WorkflowConditionOperator.GREATER_THAN, '2026-10-15', '2026-10-01')).toBe(true);
    expect(compareWorkflowValues(WorkflowConditionOperator.GREATER_THAN, '09:00', '08:00')).toBe(true);
  });

  it('handles unary checkbox and empty', () => {
    expect(compareWorkflowValues(WorkflowConditionOperator.CHECKED, true, undefined)).toBe(true);
    expect(compareWorkflowValues(WorkflowConditionOperator.UNCHECKED, false, undefined)).toBe(true);
    expect(compareWorkflowValues(WorkflowConditionOperator.IS_EMPTY, '', undefined)).toBe(true);
    expect(compareWorkflowValues(WorkflowConditionOperator.IS_NOT_EMPTY, 'x', undefined)).toBe(true);
  });
});

describe('related helpers', () => {
  it('picks related properties by field id or system key', () => {
    const record = { fld_vendor_name: 'ABC Company', vendor_name: 'ABC Company', email: 'v@x.com' };
    expect(pickRecordProperty(record, 'fld_vendor_name')).toBe('ABC Company');
    expect(pickRecordProperty(record, 'email')).toBe('v@x.com');
  });

  it('extracts entity ids from primitives and objects', () => {
    expect(extractEntityId(12)).toBe(12);
    expect(extractEntityId('12')).toBe(12);
    expect(extractEntityId({ id: 9 })).toBe(9);
    expect(extractEntityId(null)).toBeNull();
  });
});

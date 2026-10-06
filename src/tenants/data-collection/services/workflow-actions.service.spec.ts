import { AssignmentType } from '../entities/enums';
import { WorkflowActionsService } from './workflow-actions.service';

jest.mock('../../../mail/utils/email-logo.util', () => ({
  prepareEmailLogo: jest.fn().mockResolvedValue({
    logoSrc: 'cid:logo',
    remoteUrl: 'https://example.com/logo.png',
    attachment: null,
  }),
  toNodemailerLogoAttachments: jest.fn().mockReturnValue([]),
}));

describe('WorkflowActionsService report.mode', () => {
  let service: WorkflowActionsService;
  let sendDirectSmtpMail: jest.SpyInstance;

  const recipients = [
    { id: 1, email: 'a@example.com', name: 'Alice' },
    { id: 2, email: 'b@example.com', name: 'Bob' },
  ];

  beforeEach(() => {
    service = new WorkflowActionsService();
    sendDirectSmtpMail = jest
      .spyOn(service as any, 'sendDirectSmtpMail')
      .mockResolvedValue({ status: 'sent', detail: 'ok' });
    jest.spyOn(service as any, 'resolveUser').mockResolvedValue({
      id: 9,
      email: 'submitter@example.com',
      name: 'Ahmed',
    });
    jest.spyOn(service, 'resolveReportRecipients').mockResolvedValue(recipients as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends one email per recipient when report.mode=individual', async () => {
    const result = await service.runAfterSubmit(
      { tenant: { subdomain: 'demo' } },
      {
        templateId: 1,
        templateName: 'Manager Report',
        assignmentId: 10,
        submissionId: 20,
        submittedBy: 9,
        schema: {
          report: { jobPosition: [4], users: null, mode: 'individual' },
        },
      },
    );

    expect(sendDirectSmtpMail).toHaveBeenCalledTimes(2);
    expect(sendDirectSmtpMail.mock.calls.map((c) => c[0].to).sort()).toEqual([
      'a@example.com',
      'b@example.com',
    ]);
    expect(result.actions[0]).toEqual(
      expect.objectContaining({
        type: 'notify',
        status: 'sent',
        mode: AssignmentType.INDIVIDUAL,
      }),
    );
    expect(result.actions[0].detail).toContain('mode=individual');
  });

  it('sends one shared group email when report.mode=shared', async () => {
    const result = await service.runAfterSubmit(
      { tenant: { subdomain: 'demo' } },
      {
        templateId: 1,
        templateName: 'Manager Report',
        assignmentId: 10,
        submissionId: 20,
        submittedBy: 9,
        schema: {
          report: { jobPosition: [4], users: null, mode: 'shared' },
        },
      },
    );

    expect(sendDirectSmtpMail).toHaveBeenCalledTimes(1);
    expect(sendDirectSmtpMail.mock.calls[0][0].to).toBe('a@example.com, b@example.com');
    expect(result.actions[0]).toEqual(
      expect.objectContaining({
        type: 'notify',
        status: 'sent',
        mode: AssignmentType.SHARED,
      }),
    );
    expect(result.actions[0].detail).toContain('mode=shared');
  });

  it('defaults report mode to individual when omitted', async () => {
    await service.runAfterSubmit(
      {},
      {
        templateId: 1,
        templateName: 'Form',
        assignmentId: 1,
        submissionId: 1,
        submittedBy: 9,
        schema: { report: { users: [1, 2] } },
      },
    );

    expect(sendDirectSmtpMail).toHaveBeenCalledTimes(2);
  });

  it('does not notify or create requests for disabled conditional rules', async () => {
    const result = await service.runAfterSubmit(
      {},
      {
        templateId: 1,
        templateName: 'Form',
        assignmentId: 1,
        submissionId: 1,
        submittedBy: 9,
        answers: { fld_notes: 'hello' },
        schema: {
          report: { users: [1] },
          conditionalRules: [
            {
              id: 'logic_disabled',
              name: 'off',
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
          ],
        },
      },
    );

    expect(sendDirectSmtpMail).not.toHaveBeenCalled();
    expect(result.actions.some((action) => action.type === 'maintenanceRequest')).toBe(false);
    expect(result.actions[0]).toEqual(
      expect.objectContaining({ type: 'rule', status: 'disabled' }),
    );
  });

  it('creates a notification portal row and emails report recipients for sendNotification', async () => {
    const create = jest.fn((row) => row);
    const save = jest.fn(async (row) => ({ id: 55, ...row }));
    const findOne = jest.fn().mockResolvedValue(null);
    const req = {
      tenant: { subdomain: 'demo' },
      tenantConnection: {
        getRepository: (entity: { name: string }) => {
          if (entity.name === 'DcManagerRequest') {
            return { create, save, findOne };
          }
          if (entity.name === 'Item') {
            return { findOne: jest.fn().mockResolvedValue(null) };
          }
          return { create: jest.fn(), save: jest.fn(), findOne: jest.fn() };
        },
      },
    };

    const result = await service.runAfterSubmit(req, {
      templateId: 1,
      templateName: 'Manager Report',
      assignmentId: 10,
      submissionId: 20,
      submittedBy: 9,
      templateVersionId: 6,
      answers: { fld_notes: 'urgent' },
      schema: {
        report: { users: [1], mode: 'individual' },
        conditionalRules: [
          {
            id: 'logic_notify',
            name: 'Current Quantity < Item Par',
            enabled: true,
            conditions: {
              match: 'all',
              items: [
                {
                  id: 'n1',
                  fieldId: 'fld_notes',
                  operator: 'isNotEmpty',
                  comparison: { type: 'fixed' },
                },
              ],
            },
            actions: [{ id: 'a_notify', type: 'sendNotification' }],
          },
        ],
      },
    });

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'notification',
        note: 'Current Quantity < Item Par',
        actionClientId: 'a_notify',
        ruleClientId: 'logic_notify',
      }),
    );
    expect(sendDirectSmtpMail).toHaveBeenCalled();
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'notificationRequest', status: 'created' }),
        expect.objectContaining({ type: 'notify', status: 'sent' }),
      ]),
    );
  });
});

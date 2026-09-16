import { AssignmentStatus, SubmissionStatus } from '../data-collection/entities';
import { DashboardService } from './dashboard.service';

describe('Tenant DashboardService', () => {
  const assignmentRepo = {
    count: jest.fn(),
    find: jest.fn(),
  };
  const submissionRepo = {
    find: jest.fn(),
  };
  const userRepo = {
    findOne: jest.fn(),
    count: jest.fn(),
  };
  const itemRepo = { count: jest.fn() };
  const vendorRepo = { count: jest.fn() };
  const formRepo = { count: jest.fn() };
  const dcTemplateRepo = { count: jest.fn() };
  const reportingGroupRepo = { find: jest.fn() };
  const auditRepo = { find: jest.fn() };

  const connection = {
    options: { database: 'tenant_brian' },
    getRepository: jest.fn((entity: { name?: string }) => {
      const name = entity?.name || '';
      if (name === 'User') return userRepo;
      if (name === 'DataCollectionAssignment') return assignmentRepo;
      if (name === 'DataCollectionSubmission') return submissionRepo;
      if (name === 'Item') return itemRepo;
      if (name === 'Vendor') return vendorRepo;
      if (name === 'Form') return formRepo;
      if (name === 'DataCollectionTemplate') return dcTemplateRepo;
      if (name === 'ReportingGroup') return reportingGroupRepo;
      if (name === 'FormAuditLog') return auditRepo;
      return {};
    }),
  };

  let service: DashboardService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DashboardService();
  });

  it('returns employee dashboard for tenant_user account type', async () => {
    const dueToday = new Date();
    dueToday.setUTCHours(0, 0, 0, 0);

    userRepo.findOne.mockResolvedValue({
      id: 10,
      name: 'Omais Ahmed',
      role: { name: 'Employee', permissions: [{ name: 'view-dc-assignment' }] },
    });

    assignmentRepo.count
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(1);

    assignmentRepo.find
      .mockResolvedValueOnce([
        {
          id: 41,
          templateId: 7,
          status: AssignmentStatus.PENDING,
          dueAt: dueToday,
          template: {
            name: 'Store Daily Checklist',
            status: 'active',
            isActive: true,
            deletedAt: null,
            schema: { category: 'Store Operations' },
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 42,
          updatedAt: new Date('2026-08-12T12:05:00.000Z'),
          template: {
            name: 'Inventory Report',
            status: 'active',
            isActive: true,
            deletedAt: null,
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 45,
          createdAt: new Date('2026-08-12T11:30:00.000Z'),
          template: {
            name: 'Store Weekly Audit',
            status: 'active',
            isActive: true,
            deletedAt: null,
          },
        },
      ]);

    submissionRepo.find.mockResolvedValue([
      {
        id: 12,
        assignmentId: 40,
        status: SubmissionStatus.SUBMITTED,
        submittedAt: new Date('2026-08-12T12:20:00.000Z'),
        updatedAt: new Date('2026-08-12T12:20:00.000Z'),
        assignment: { template: { name: 'Store Daily Checklist' } },
      },
    ]);

    const result = await service.getDashboard({
      tenantConnection: connection,
      tenantId: 'brian',
      user: { id: 10 },
    });
    const data = result.data as any;

    expect(result.success).toBe(true);
    expect(result.account_type).toBe('tenant_user');
    expect(data.welcome.firstName).toBe('Omais');
    expect(data.stats.myAssignments.value).toBe(8);
    expect(data.stats.inProgress.value).toBe(3);
    expect(data.stats.completed.value).toBe(12);
    expect(data.stats.overdue.value).toBe(1);
    expect(data.todaysAssignments).toHaveLength(1);
    expect(data.todaysAssignments[0].title).toBe('Store Daily Checklist');
    expect(data.todaysAssignments[0].dueLabel).toBe('Due Today');
    expect(data.todaysAssignments[0].priority).toBe('high');
    expect(data.recentActivity[0].type).toBe('submitted');

    const todayAssignmentsQuery = assignmentRepo.find.mock.calls[0][0];
    expect(todayAssignmentsQuery.where.dueAt).toBeDefined();
    expect(todayAssignmentsQuery.where.assigneeUserId).toBe(10);
  });

  it('returns admin ops dashboard for tenant_admin account type', async () => {
    userRepo.findOne.mockResolvedValue({
      id: 1,
      name: 'Admin User',
      role: { name: 'Admin', permissions: [{ name: 'create-user' }] },
    });
    userRepo.count.mockResolvedValue(48);
    itemRepo.count.mockResolvedValue(326);
    vendorRepo.count.mockResolvedValue(27);
    formRepo.count.mockResolvedValue(10);
    dcTemplateRepo.count.mockResolvedValue(9);
    auditRepo.find.mockResolvedValue([]);
    reportingGroupRepo.find.mockResolvedValue([]);

    const result = await service.getDashboard({
      tenantConnection: connection,
      tenantId: 'brian',
      user: { id: 1 },
    });
    const data = result.data as any;

    expect(result.success).toBe(true);
    expect(result.account_type).toBe('tenant_admin');
    expect(data.overview.totalUsers).toBe(48);
    expect(data.overview.totalForms).toBe(19);
    expect(data.welcome).toBeUndefined();
  });
});

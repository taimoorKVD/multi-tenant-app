import { ISeeder } from '../interfaces/seeder.interface';
import { MasterDataSource } from '../datasource';
import { JobPosition } from '../../master/job-position/entities';

export class JobPositionSeeder implements ISeeder {
  name = 'JobPositionSeeder';

  async run() {
    const jobRepo = MasterDataSource.getRepository(JobPosition);
    if (await jobRepo.count()) {
      console.log('⚠️  Job positions already exist. Skipping seeding.');
      return;
    }

    const jobPositions: Partial<JobPosition>[] = [
      {
        name: 'Restaurant Manager',
        description: 'Oversees daily operations, staff, and customer satisfaction.',
      },
      {
        name: 'Assistant Manager',
        description: 'Supports the manager in supervising shifts and training staff.',
      },
      {
        name: 'Head Chef',
        description: 'Leads kitchen operations, menu planning, and food preparation.',
      },
      {
        name: 'Sous Chef',
        description: 'Assists the head chef in managing kitchen staff and ensuring quality.',
      },
      {
        name: 'Line Cook',
        description: 'Prepares dishes according to recipes and ensures timely service.',
      },
      {
        name: 'Commis Chef',
        description: 'Supports chefs in food preparation, cleaning, and organisation.',
      },
      {
        name: 'Pastry Chef',
        description: 'Specialises in creating desserts, pastries, and baked goods.',
      },
      {
        name: 'Kitchen Porter',
        description: 'Cleans kitchen equipment and assists chefs with basic prep work.',
      },
      {
        name: 'Waiter / Waitress',
        description: 'Serves customers, takes orders, and delivers food and drinks.',
      },
      {
        name: 'Host / Hostess',
        description: 'Greets guests, manages reservations, and coordinates seating.',
      },
      {
        name: 'Bartender',
        description: 'Prepares and serves drinks, maintains bar stock and cleanliness.',
      },
      {
        name: 'Barback',
        description: 'Assists bartenders with restocking and cleaning the bar area.',
      },
      { name: 'Barista', description: 'Prepares coffee and speciality beverages for guests.' },
      {
        name: 'Cashier',
        description: 'Handles customer payments and operates the point-of-sale system.',
      },
      {
        name: 'Dishwasher',
        description: 'Cleans dishes, utensils, and kitchen equipment efficiently.',
      },
      { name: 'Cleaner', description: 'Maintains cleanliness of dining and kitchen areas.' },
      {
        name: 'Delivery Driver',
        description: 'Delivers food orders to customers promptly and safely.',
      },
      { name: 'Reservation Coordinator', description: 'Manages bookings and customer enquiries.' },
      {
        name: 'Inventory Clerk',
        description: 'Tracks stock levels and assists with supplier orders.',
      },
      {
        name: 'Purchasing Manager',
        description: 'Sources ingredients and negotiates with suppliers.',
      },
      {
        name: 'Maintenance Technician',
        description: 'Handles repairs and maintenance of restaurant equipment.',
      },
      { name: 'Security Guard', description: 'Ensures safety of guests, staff, and property.' },
      {
        name: 'Event Coordinator',
        description: 'Plans and manages private dining or special events.',
      },
      { name: 'HR Officer', description: 'Oversees staff recruitment, onboarding, and training.' },
      { name: 'Accountant', description: 'Manages restaurant finances, payroll, and reporting.' },
      {
        name: 'Marketing Executive',
        description: 'Promotes the restaurant and handles digital marketing efforts.',
      },
      {
        name: 'Sommelier',
        description: 'Advises customers on wine selection and manages wine inventory.',
      },
      {
        name: 'Food Runner',
        description: 'Delivers prepared dishes from kitchen to guests efficiently.',
      },
      {
        name: 'Cleaning Supervisor',
        description: 'Supervises cleaning staff and ensures hygiene standards.',
      },
      {
        name: 'Receptionist',
        description: 'Handles guest enquiries, reservations, and phone calls.',
      },
    ];

    await jobRepo.save(jobRepo.create(jobPositions as JobPosition[]));
    console.log('✅ Seeded 30 restaurant job positions successfully.');
  }
}

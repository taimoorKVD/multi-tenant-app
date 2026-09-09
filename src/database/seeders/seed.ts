import 'dotenv/config';

import {SeederRunner} from '../helpers/seeder-runner';
import {
  CitySeeder,
  CountrySeeder,
  JobPositionSeeder,
  LocationSeeder,
  PermissionSeeder,
  RoleSeeder,
  StateSeeder,
  UserSeeder,
  GlobalMailSettingSeeder,
  UserEmailTemplateSeeder,
  FormBuilderModulesSeeder,
  FormBuilderPermissionsSeeder,
  DataCollectionPermissionsSeeder,
  DataCollectionEmailTemplateSeeder,
  BillingPermissionsSeeder,
  BillingPlansSeeder,
  DataCollectionRestaurantTemplatesSeeder,
  ReportingCategoryPermissionsSeeder,
} from '../seeders';

(async () => {
  const runner = new SeederRunner([
    new PermissionSeeder(),
    new RoleSeeder(),
    new UserSeeder(),
    new JobPositionSeeder(),
    new LocationSeeder(),
    new CountrySeeder(),
    new StateSeeder(),
    new CitySeeder(),
    new GlobalMailSettingSeeder(),
    new UserEmailTemplateSeeder(),
    new FormBuilderModulesSeeder(),
    new FormBuilderPermissionsSeeder(),
    new DataCollectionPermissionsSeeder(),
    new DataCollectionEmailTemplateSeeder(),
    new BillingPermissionsSeeder(),
    new BillingPlansSeeder(),
    new DataCollectionRestaurantTemplatesSeeder(),
    new ReportingCategoryPermissionsSeeder(),
  ]);

  const shouldReset = process.argv.includes('--reset') || process.argv.includes('reset');

  if (shouldReset) {
    console.log('⚙️  Reset mode enabled: truncating and reseeding...');
    await runner.truncateAll();
  }

  await runner.run();
})();

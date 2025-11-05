export interface ISeeder {
  /** Unique name of the seeder */
  name: string;

  /** Run seeding logic */
  run(): Promise<void>;
}

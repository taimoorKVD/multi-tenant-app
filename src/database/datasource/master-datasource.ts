import {DataSource} from 'typeorm';
import {masterDatabaseConfig} from '../../config/master-database.config';

export const MasterDataSource = new DataSource(masterDatabaseConfig);

import type { DataSource } from './DataSource';
import { OpenProjectDataSource } from './OpenProjectDataSource';

/** Точка выбора источника данных. При необходимости заменить на mock. */
export const dataSource: DataSource = new OpenProjectDataSource();

import { registerModule } from '../../core/module-registry';
import { GanttView } from './GanttView';

registerModule({
  id: 'gantt',
  title: 'Диаграмма Ганта',
  navOrder: 10,
  route: '/gantt',
  Component: GanttView,
});

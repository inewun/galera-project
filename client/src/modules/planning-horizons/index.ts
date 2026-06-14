import { registerModule } from '../../core/module-registry';
import { PlanningHorizonsView } from './PlanningHorizonsView';

registerModule({
  id: 'planning-horizons',
  title: 'Планировщик работ',
  navOrder: 40,
  route: '/planning-horizons',
  Component: PlanningHorizonsView,
});

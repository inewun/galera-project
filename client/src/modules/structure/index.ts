import { registerModule } from '../../core/module-registry';
import { StructureView } from './StructureView';

registerModule({
  id: 'structure',
  title: 'Структура',
  navOrder: 20,
  route: '/structure',
  Component: StructureView,
});

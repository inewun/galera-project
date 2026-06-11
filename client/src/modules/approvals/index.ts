import { registerModule } from '../../core/module-registry';
import { ApprovalsView } from './ApprovalsView';

registerModule({
  id: 'approvals',
  title: 'Согласование',
  navOrder: 30,
  route: '/approvals',
  Component: ApprovalsView,
});

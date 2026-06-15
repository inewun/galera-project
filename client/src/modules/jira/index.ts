import { registerModule } from '../../core/module-registry';
import { JiraView } from './JiraView';

export function registerJiraModule() {
  registerModule({
    id: 'jira',
    title: 'Jira',
    navOrder: 50,
    route: '/jira',
    Component: JiraView,
  });
}

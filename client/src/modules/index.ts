import './structure';
import './approvals';
import './planning-horizons';
import { registerJiraModule } from './jira';

if (import.meta.env.VITE_ENABLE_JIRA === 'true') {
  registerJiraModule();
}

import { NavLink, Outlet } from 'react-router-dom';
import { getModules } from '../core/module-registry';

export function Layout() {
  const modules = getModules();

  return (
    <div className="layout">
      <aside className="layout__nav">
        <div className="layout__brand">
          <div className="layout__brand-mark" aria-hidden="true">
            <span>G</span>
          </div>
          <div>
            <div className="layout__brand-title">Galera Gantt</div>
            <div className="layout__brand-sub">планирование задач</div>
          </div>
        </div>

        <div className="layout__nav-section">
          <div className="layout__nav-title">Разделы</div>
          <NavLink to="/" end className="layout__nav-link">
            <span>Главная</span>
            <small>01</small>
          </NavLink>
          {modules.map((m, index) => (
            <NavLink key={m.id} to={m.route} className="layout__nav-link">
              <span>{m.title}</span>
              <small>{String(index + 2).padStart(2, '0')}</small>
            </NavLink>
          ))}
        </div>
      </aside>
      <div className="layout__main">
        <main className="layout__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

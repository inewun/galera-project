import { NavLink, Outlet } from 'react-router-dom';
import { getModules } from '../core/module-registry';

export function Layout() {
  const modules = getModules();

  return (
    <div className="layout">
      <nav className="layout__nav">
        <div className="layout__nav-title">OpenProject Gantt</div>
        <NavLink to="/" end className="layout__nav-link">
          Обзор
        </NavLink>
        {modules.map((m) => (
          <NavLink key={m.id} to={m.route} className="layout__nav-link">
            {m.title}
          </NavLink>
        ))}
      </nav>
      <main className="layout__content">
        <Outlet />
      </main>
    </div>
  );
}

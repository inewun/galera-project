import { NavLink, Outlet } from 'react-router-dom';
import { getModules } from '../core/module-registry';

export function Layout() {
  const modules = getModules();

  return (
    <div className="layout">
      <header className="layout__topbar">
        <div className="layout__brand">OpenProject Gantt</div>
      </header>
      <div className="layout__body">
        <nav className="layout__nav">
          <NavLink to="/" end className="layout__nav-link">
            Главная
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
    </div>
  );
}

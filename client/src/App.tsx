import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Overview } from './components/Overview';
import { getModules } from './core/module-registry';

export function App() {
  const modules = getModules();

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Overview />} />
          {modules.map((m) => (
            <Route key={m.id} path={m.route} element={<m.Component />} />
          ))}
          <Route path="*" element={<Overview />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

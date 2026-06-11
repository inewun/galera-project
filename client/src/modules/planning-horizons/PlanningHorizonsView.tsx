import { EmptyState } from '../../components/EmptyState';

export function PlanningHorizonsView() {
  return (
    <section className="module-placeholder">
      <h1 className="module-placeholder__title">Горизонты планирования</h1>
      <EmptyState message="Матрица планирования будет добавлена на следующем этапе" />
    </section>
  );
}

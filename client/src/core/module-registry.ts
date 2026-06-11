import type { ComponentType } from 'react';

export interface FeatureModule {
  id: string;
  title: string;
  navOrder: number;
  route: string;
  Component: ComponentType;
}

const registry: FeatureModule[] = [];

export function registerModule(m: FeatureModule) {
  registry.push(m);
}

export function getModules(): FeatureModule[] {
  return [...registry].sort((a, b) => a.navOrder - b.navOrder);
}

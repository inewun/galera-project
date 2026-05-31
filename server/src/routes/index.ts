import type { Express } from 'express';
import healthRouter from './health.js';
import workPackagesRouter from './workPackages.js';
import usersRouter from './users.js';
import groupsRouter from './groups.js';
import projectsRouter from './projects.js';
import hierarchyRouter from './hierarchy.js';
import writeStubsRouter from './writeStubs.js';

export function registerRoutes(app: Express): void {
  app.use('/api/health', healthRouter);
  app.use('/api/work-packages', workPackagesRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/groups', groupsRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/hierarchy', hierarchyRouter);
  app.use('/api', writeStubsRouter);
}
import { apiClient } from './client'
import type { Employee } from '../types'

export const getEmployees = () =>
  apiClient.get<Employee[]>('/employees').then(r => r.data)
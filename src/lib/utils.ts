import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: string | Date) {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function getStatusColor(status: string) {
  switch (status) {
    case 'completed': return 'text-green-600 bg-green-50 border-green-200'
    case 'in_progress': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    case 'problem': return 'text-red-600 bg-red-50 border-red-200'
    case 'not_started': return 'text-gray-800 bg-gray-50 border-gray-200'
    default: return 'text-gray-800 bg-gray-50 border-gray-200'
  }
}

export function getStatusLabel(status: string) {
  switch (status) {
    case 'completed': return 'Abgeschlossen'
    case 'in_progress': return 'In Bearbeitung'
    case 'problem': return 'Problem'
    case 'not_started': return 'Nicht gestartet'
    case 'active': return 'Aktiv'
    case 'paused': return 'Pausiert'
    case 'cancelled': return 'Abgebrochen'
    default: return status
  }
}

export function getStatusEmoji(status: string) {
  switch (status) {
    case 'completed': return 'ðŸŸ¢'
    case 'in_progress': return 'ðŸŸ¡'
    case 'problem': return 'ðŸ”´'
    case 'not_started': return 'âšª'
    default: return 'âšª'
  }
}

export function getRoleLabel(role: string) {
  switch (role) {
    case 'admin': return 'Administrator'
    case 'bauleiter': return 'Bauleiter'
    case 'projektleiter': return 'Projektleiter'
    case 'monteur': return 'Monteur'
    case 'buero': return 'Büro'
    default: return role
  }
}


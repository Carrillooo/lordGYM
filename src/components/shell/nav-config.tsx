import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  Home,
  LineChart,
  ListChecks,
  MessageSquare,
  Settings,
  Timer,
  TrendingUp,
  User,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';

export interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  /** `true` cuando la ruta sólo debe marcarse activa con coincidencia exacta. */
  exact?: boolean;
}

export const COACH_NAV: NavItem[] = [
  { href: '/coach', label: 'Inicio', icon: <Home className="h-[18px] w-[18px]" />, exact: true },
  { href: '/coach/players', label: 'Jugadores', icon: <Users className="h-[18px] w-[18px]" /> },
  { href: '/coach/workouts', label: 'Entrenamientos', icon: <ClipboardList className="h-[18px] w-[18px]" /> },
  { href: '/coach/programs', label: 'Programas', icon: <ListChecks className="h-[18px] w-[18px]" /> },
  { href: '/coach/calendar', label: 'Calendario', icon: <CalendarDays className="h-[18px] w-[18px]" /> },
  { href: '/coach/exercises', label: 'Ejercicios', icon: <Dumbbell className="h-[18px] w-[18px]" /> },
  { href: '/coach/progress', label: 'Progreso', icon: <TrendingUp className="h-[18px] w-[18px]" /> },
  { href: '/coach/tests', label: 'Tests', icon: <Timer className="h-[18px] w-[18px]" /> },
  { href: '/coach/stats', label: 'Estadísticas', icon: <BarChart3 className="h-[18px] w-[18px]" /> },
  { href: '/coach/messages', label: 'Mensajes', icon: <MessageSquare className="h-[18px] w-[18px]" /> },
  { href: '/coach/settings', label: 'Configuración', icon: <Settings className="h-[18px] w-[18px]" /> },
];

export const PLAYER_NAV: NavItem[] = [
  { href: '/player', label: 'Inicio', icon: <Home className="h-5 w-5" />, exact: true },
  { href: '/player/calendar', label: 'Calendario', icon: <CalendarDays className="h-5 w-5" /> },
  { href: '/player/today', label: 'Entrenar', icon: <Dumbbell className="h-5 w-5" /> },
  { href: '/player/progress', label: 'Progreso', icon: <LineChart className="h-5 w-5" /> },
  { href: '/player/profile', label: 'Perfil', icon: <User className="h-5 w-5" /> },
];

export function isActive(pathname: string, item: NavItem): boolean {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

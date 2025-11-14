import { MainLayoutComponent } from './layouts/main-layout/main-layout.component';
import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Dashboard } from './pages/dashboard/dashboard';
import { Reports } from './pages/reports/reports';
import { THVS } from './pages/thvs/thvs';
import { authGuard } from './auth/auth-guard';
import { Profile } from './pages/profile/profile';
import { SeverityRanges } from './pages/severity-ranges/severity-ranges';
import { Usage } from './usage/usage';
import { HazardsFeed } from './pages/hazards-feed/hazards-feed';
export const routes: Routes = [
  { path: '', component: Login },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: Dashboard, canActivate: [authGuard] },
      { path: 'profile', component: Profile, canActivate: [authGuard] },
      {
        path: 'severity-ranges',
        component: SeverityRanges,
        canActivate: [authGuard],
      },
      {
        path: 'reports/pan-india',
        component: Reports,
        canActivate: [authGuard],
      },
      {
        path: 'reports/circle-level',
        component: Reports,
        canActivate: [authGuard],
      },
      { path: 'reports/usage', component: Usage, canActivate: [authGuard] },
      { path: 'THVS', component: THVS, canActivate: [authGuard] },
      {
        path: 'hazards-feed',
        component: HazardsFeed,
        canActivate: [authGuard],
      },
    ],
  },
];

import { Component } from '@angular/core';
import { Header } from '../../components/header/header';
import { LeftPanel } from '../../components/left-panel/left-panel';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-main-layout',
  imports: [Header,LeftPanel, RouterModule],
  standalone: true,
  templateUrl: './main-layout.html',
  styleUrls: ['./main-layout.css']
})
export class MainLayoutComponent  {

}

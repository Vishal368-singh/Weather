import { Header } from '../../components/header/header';
import { LeftPanel } from '../../components/left-panel/left-panel';
import { RouterModule } from '@angular/router';
import { Component, EventEmitter, Output } from '@angular/core'; 

@Component({
  selector: 'app-main-layout',
  imports: [Header, LeftPanel, RouterModule],
  standalone: true,
  templateUrl: './main-layout.html',
  styleUrls: ['./main-layout.css'],
})
export class MainLayoutComponent {
  searchText: string = '';
  selectedCategory: string = '';

  @Output() searchEvent = new EventEmitter<any>();

  onSearch() {
    const data = {
      location: this.searchText,
      category: this.selectedCategory,
    };

    console.log('Search Data:', data);

    this.searchEvent.emit(data); // send to parent
  }
}

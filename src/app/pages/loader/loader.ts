import { Component, computed } from '@angular/core'; 
import { NgIf } from '@angular/common';
import { LoaderService } from './loader.service';

@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [NgIf],
  templateUrl: './loader.html',
  styleUrls: ['./loader.css']
})
export class Loader {

  loading = computed(() => this.loaderService.isLoading());

  constructor(private loaderService: LoaderService) {}
}

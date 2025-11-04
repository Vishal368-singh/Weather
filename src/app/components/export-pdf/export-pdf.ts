import { Component } from '@angular/core';
import { MapExportService } from '../../shared/map-export.service';
import jsPDF from 'jspdf';
import { CommonModule } from '@angular/common';
import html2canvas from 'html2canvas';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-export-pdf',
  imports: [CommonModule],
  templateUrl: './export-pdf.html',
  styleUrl: './export-pdf.css'
})
export class ExportPdf {

  today: Date = new Date();
  loading = false; // Loader flag
  private mapImage: string | null = null;

  constructor(private mapExport: MapExportService, private http: HttpClient) { }

  ngOnInit(): void {
    this.mapExport.mapImage$.subscribe((image) => {
      this.mapImage = image;
    });
  }

  // exportPDF(): void {
  //   debugger
  //   const content = document.getElementById('pdf-content');
  //   if (!content) return;

  //   this.loading = true;

  //   let injectedMapImg: HTMLImageElement | null = null;
  //   const mapEl = document.getElementById('map');
  //   const olCanvas = mapEl?.querySelector('.ol-layer canvas') as HTMLCanvasElement;

  //   if (olCanvas) olCanvas.style.display = 'none';

  //   if (this.mapImage) {
  //     const img = new Image();
  //     img.src = this.mapImage;
  //     img.style.position = 'absolute';
  //     img.style.top = '0';
  //     img.style.left = '0';
  //     img.style.width = '100%';
  //     img.style.border = 'none';
  //     img.style.boxShadow = 'none';
  //     img.style.zIndex = '0';
  //     img.classList.add('export-map-image');
  //     if (mapEl) {
  //       mapEl.appendChild(img);
  //       injectedMapImg = img;
  //     }
  //   }

  //   setTimeout(() => {
  //     const loader = document.getElementById('loader');
  //     if (loader) loader.style.display = 'none'; // 🔒 Hide loader before capture

  //     html2canvas(content, {
  //       useCORS: true,
  //       allowTaint: false,
  //       backgroundColor: '#ffffff',
  //       scale: 4,
  //     }).then((canvas) => {
  //       const imgData = canvas.toDataURL('image/png');
  //       const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  //       const pdfWidth = pdf.internal.pageSize.getWidth();
  //       const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

  //       pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
  //       pdf.save('weather-bulletin.pdf');

  //       // ✅ Clean up everything
  //       if (injectedMapImg) injectedMapImg.remove();
  //       if (olCanvas) olCanvas.style.display = '';
  //       if (loader) loader.style.display = 'flex'; // restore if needed
  //       this.loading = false;
  //     }).catch((err) => {
  //       console.error('Error generating PDF:', err);
  //       if (olCanvas) olCanvas.style.display = '';
  //       if (loader) loader.style.display = 'flex';
  //       this.loading = false;
  //     });
  //   }, 500);
  // }

  exportPDF(): void {
    debugger;
    const content = document.getElementById('pdf-content');
    if (!content) return;

    this.loading = true;

    const mapEl = document.getElementById('map');
    const olCanvas = mapEl?.querySelector('.ol-layer canvas') as HTMLCanvasElement;
    let injectedMapImg: HTMLImageElement | null = null;

    if (olCanvas) olCanvas.style.display = 'none';

    const proceedToExport = () => {
      const loader = document.getElementById('loader');
      if (loader) loader.style.display = 'none';

      html2canvas(content, {
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        scale: 4,
      }).then((canvas) => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save('weather-bulletin.pdf');

        if (injectedMapImg) injectedMapImg.remove();
        if (olCanvas) olCanvas.style.display = '';
        if (loader) loader.style.display = 'flex';
        this.loading = false;
      }).catch((err) => {
        console.error('Error generating PDF:', err);
        if (olCanvas) olCanvas.style.display = '';
        if (loader) loader.style.display = 'flex';
        this.loading = false;
      });
    };

    // Inject map image and wait for load
    if (this.mapImage && mapEl) {
      const img = new Image();
      img.src = this.mapImage;
      img.onload = () => {
        img.style.position = 'absolute';
        img.style.top = '0';
        img.style.left = '0';
        img.style.width = '100%';
        img.style.border = 'none';
        img.style.boxShadow = 'none';
        img.style.zIndex = '0';
        img.classList.add('export-map-image');

        mapEl.appendChild(img);
        injectedMapImg = img;
        proceedToExport();
      };
      img.onerror = () => {
        console.error('Failed to load map image.');
        if (olCanvas) olCanvas.style.display = '';
        this.loading = false;
      };
    } else {
      proceedToExport();
    }
  }


}

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import type { LoadingResult, Container } from '../../types/core';
// 1. FONKSİYON DIŞINA BASE64 FONT EKLE (Türkçe destekli font - Arimo Regular)
// Not: Bu string çok uzundur, normalde ayrı dosyada tutulur.
const fontBase64 =
  'AAEAAAARAQAABAAQRkZUTWR18VEAAAE4AAAAHEdERUYANgAKAAABTAAAAB5PUHBN6J7g4gAAAWgAAABgbWF4cQAAAAAAAAGsAAAAIG5hbWUAAAAAAAAAAAAAAAABgcG9zdAAAAAAAAAHsAAAAAg==';
// !!! DİKKAT: Yukarıdaki string sadece örnektir. Türkçe karakter sorununun tamamen çözülmesi için
// https://raw.githubusercontent.com/google/fonts/main/apache/arimo/Arimo-Regular.ttf
// adresindeki fontu indirip "TTF to Base64" sitesinde çevirip buraya yapıştırmalısınız.
// VEYA projeye .ttf dosyasını import edip kullanmalısınız.
export const generatePDFReport = async (
  container: Container,
  result: LoadingResult,
  elementIdToCapture: string
) => {
  const doc = new jsPDF();
  const trFix = (str: string) => {
    return str
      .replace(/ğ/g, 'g')
      .replace(/Ğ/g, 'G')
      .replace(/ü/g, 'u')
      .replace(/Ü/g, 'U')
      .replace(/ş/g, 's')
      .replace(/Ş/g, 'S')
      .replace(/ı/g, 'i')
      .replace(/İ/g, 'I')
      .replace(/ö/g, 'o')
      .replace(/Ö/g, 'O')
      .replace(/ç/g, 'c')
      .replace(/Ç/g, 'C');
  };
  const today = new Date().toLocaleDateString('tr-TR');

  // --- BAŞLIK ---
  doc.setFontSize(22);
  doc.setTextColor(30, 41, 59); // Slate-800
  doc.text(trFix('Yükleme Simülasyonu Raporu'), 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(trFix(`Oluşturulma Tarihi: ${today}`), 14, 28);

  // --- ÖZET TABLOSU ---
  const summaryData = [
    [trFix('Araç Tipi'), container.name],
    [
      trFix('Boyutlar'),
      `${container.dimensions.width} x ${container.dimensions.height} x ${container.dimensions.length} cm`,
    ],
    [trFix('Doluluk Oranı'), `% ${result.volumeUtilization.toFixed(2)}`],
    [trFix('Yüklenen Adet'), `${result.totalLoadedCount}`],
    [trFix('Yüklenemeyen Adet'), `${result.unplacedItems.length}`],
  ];

  autoTable(doc, {
    startY: 35,
    head: [[trFix('Parametre'), trFix('Değer')]],
    body: summaryData,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246] }, // Blue-500
    styles: { fontSize: 10, cellPadding: 4 },
  });

  // --- GÖRSEL ---
  const canvasElement = document.getElementById(elementIdToCapture);
  let finalY = 80; // Varsayılan başlangıç

  if (canvasElement) {
    try {
      let imgData = '';
      let imgWidth = 180;
      let imgHeight = 0;

      // Eğer yakalanan element gerçek bir <canvas> ise (ki bizim durumumuzda öyle),
      // html2canvas kütüphanesini atlayıp doğrudan veriyi alıyoruz. Bu %100 sonuç verir.
      if (canvasElement instanceof HTMLCanvasElement) {
        imgData = canvasElement.toDataURL('image/jpeg', 0.8);
        // Canvas boyut oranına göre yükseklik hesapla
        imgHeight = (canvasElement.height * imgWidth) / canvasElement.width;
      } else {
        // Eğer div vb. ise html2canvas kullanmaya devam et (Yedek plan)
        const canvasImage = await html2canvas(canvasElement, {
          backgroundColor: '#f0f2f5',
          scale: 2,
        });
        imgData = canvasImage.toDataURL('image/jpeg', 0.8);
        imgHeight = (canvasImage.height * imgWidth) / canvasImage.width;
      }

      // @ts-ignore
      finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.text('3D Görünüm', 14, finalY);
      doc.addImage(imgData, 'JPEG', 15, finalY + 5, imgWidth, imgHeight);
      finalY = finalY + 5 + imgHeight + 10;
    } catch (err) {
      console.error('Görsel hatası', err);
    }
  }

  // --- SIĞMAYAN ÜRÜNLER ANALİZİ ---
  const unplacedGroups = result.unplacedItems.reduce((acc, item) => {
    // DÜZELTME: PDF'te de Çap (Ø) yazmalı
    const key =
      item.type === 'box' || item.isPalletized
        ? `${item.type} (${item.dimensions?.width}x${item.dimensions?.length}x${item.dimensions?.height})` // Paletliyse boyut yaz
        : `${item.type} (Ø:${(item.radius || 0) * 2} h:${item.height})`; // Dökme ruloysa çap yaz
    if (!acc[key]) {
      acc[key] = {
        name: item.name || item.type,
        dims: key, // key zaten formatlı string
        count: 0,
        color: item.color,
      };
    }
    acc[key].count += 1;
    return acc;
  }, {} as Record<string, { name: string; dims: string; count: number; color: string }>);

  // Eğer sığmayan varsa tabloyu çiz
  if (Object.keys(unplacedGroups).length > 0) {
    // Sayfa sonu kontrolü
    if (finalY > 220) {
      doc.addPage();
      finalY = 20;
    }

    doc.setFontSize(14);
    doc.setTextColor(220, 38, 38); // Red-600
    doc.text(trFix('Yüklenemeyen / Dışarıda Kalan Ürünler'), 14, finalY);

    const unplacedRows = Object.values(unplacedGroups).map((g) => [
      g.name,
      g.dims,
      `${g.count} Adet`,
    ]);

    autoTable(doc, {
      startY: finalY + 5,
      head: [['Ürün Tipi', 'Boyutlar', 'Kalan Miktar']],
      body: unplacedRows,
      theme: 'striped',
      headStyles: { fillColor: [220, 38, 38] },
      styles: { fontSize: 10 },
    });
  }

  // --- YÜKLENENLER LİSTESİ (İsteğe Bağlı) ---
  // PDF'i boğmamak için sadece sığmayanları vurguladık.
  // İstenirse buraya "Yüklenenler" listesi de eklenebilir.

  doc.save(
    `Yukleme_Plani_${new Date().getUTCDay()}-${new Date().getUTCMonth()}-${new Date().getUTCDate()}.pdf`
  );
};

# LunaCycle – Regl & Döngü Takip Uygulaması 🌙

Detaylı regl, yumurtlama ve fertil pencere takip uygulaması.

## 🚀 Vercel ile Yayınlama

### Yöntem 1 – Vercel CLI (En Hızlı)

```bash
# 1. Vercel CLI kur
npm install -g vercel

# 2. Proje klasörüne gir
cd regl-takip

# 3. Deploy et
vercel

# 4. Üretim için
vercel --prod
```

### Yöntem 2 – GitHub + Vercel (Tavsiye Edilen)

1. GitHub'da yeni repo oluştur
2. Dosyaları push et:
   ```bash
   git init
   git add .
   git commit -m "LunaCycle ilk sürüm"
   git remote add origin https://github.com/KULLANICI_ADIN/lunacycle.git
   git push -u origin main
   ```
3. [vercel.com](https://vercel.com) → New Project → GitHub repo'yu seç → Deploy

## ✨ Özellikler

- 🩸 Regl dönemi takibi
- 🥚 Yumurtlama günü hesaplama
- 🔥 Fertil pencere gösterimi
- ⚠️ Hamile kalma riski uyarısı (Düşük / Orta / Yüksek / Çok Yüksek)
- 📅 Interaktif takvim
- 😊 Ruh hali & semptom kayıtları
- 🌡️ Bazal vücut sıcaklığı takibi
- 📊 İstatistik ve döngü analizi
- 💾 Yerel depolama (localStorage)
- 📥 JSON veri export

## 📁 Dosya Yapısı

```
regl-takip/
├── index.html     # Ana HTML
├── style.css      # Tüm stiller
├── app.js         # Uygulama mantığı
├── vercel.json    # Vercel konfigürasyonu
└── README.md      # Bu dosya
```

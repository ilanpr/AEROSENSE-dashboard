export const PROMPT_SUGGESTIONS = [
  "Kondisi udara hari ini",
  "Apa arti AQI 52?",
  "Jika PM2.5 tinggi?",
];

export function replyFor(question: string): string {
  const text = question.toLowerCase().trim();

  if (text.includes("aqi")) {
    return "AQI adalah indeks yang merangkum kondisi kualitas udara. Angka contoh hari ini adalah 52, kategori sedang. Artinya, sebagian besar orang dapat beraktivitas biasa, tetapi kelompok sensitif sebaiknya memantau kondisi di lokasi terdekat.";
  }

  if (text.includes("pm2.5") || text.includes("debu") || text.includes("partikel")) {
    return "PM2.5 adalah partikel halus di udara. Jika nilainya meningkat, kurangi aktivitas luar ruang yang lama, gunakan masker yang sesuai saat perlu keluar, dan perhatikan informasi dari layanan kesehatan setempat.";
  }

  if (text.includes("manyar")) {
    return "Node Manyar pada data contoh memiliki AQI 65 dan TVOC 221 ppb. Statusnya sedang dipantau. Cek peringatan terbaru sebelum berkegiatan di sekitar lokasi.";
  }

  if (text.includes("sidayu")) {
    return "Node Sidayu pada data contoh memiliki AQI 84 dan PM2.5 32,4 µg/m³. Batasi aktivitas luar ruang yang lama, terutama bagi anak-anak dan orang yang sensitif terhadap polusi.";
  }

  if (text.includes("co2") || text.includes("karbon")) {
    return "eCO₂ adalah perkiraan konsentrasi setara CO₂ dari sensor gas. Nilai ini tidak sama dengan jumlah emisi karbon perusahaan. Audit jejak karbon memerlukan metode dan data tambahan.";
  }

  if (text.includes("hari ini") || text.includes("kondisi") || text.includes("udara")) {
    return "Dalam data contoh hari ini, rata-rata AQI kawasan adalah 52 (sedang). Delapan node berkondisi baik dan dua titik, Manyar serta Sidayu, perlu perhatian. Pilih Peta sensor untuk melihat rincian tiap lokasi.";
  }

  return "Saya bisa membantu menjelaskan AQI, PM2.5, eCO₂, TVOC, status node, dan langkah umum saat udara memburuk. Coba tanyakan tentang kondisi hari ini, Manyar, atau Sidayu.";
}

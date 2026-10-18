import type { Node, NodeReading } from '@/types/node.types'
import type { Alert } from '@/types/alert.types'

/**
 * ============================================
 * Mock Data for AEROSENSE Dashboard
 * 10 Gresik Regional Sensor Nodes & Readings
 * ============================================
 */

export interface PrototypeNodeInfo {
  name: string
  code: string
  lat: number
  lng: number
  address: string
  aqi: number
  pm25: number
  eco2: number
  tvoc: number
  temperature: number
  humidity: number
  status: 'online' | 'warning' | 'offline'
  uiStatus: 'baik' | 'perhatian'
  lastUpdate: string
}

export const GRESIK_NODES_DATA: PrototypeNodeInfo[] = [
  {
    name: 'Cerme',
    code: 'AS-CRM-01',
    lat: -7.2280,
    lng: 112.5620,
    address: 'Kecamatan Cerme, Gresik',
    aqi: 38,
    pm25: 12.1,
    eco2: 552,
    tvoc: 74,
    temperature: 29.8,
    humidity: 72,
    status: 'online',
    uiStatus: 'baik',
    lastUpdate: '09.41 WIB',
  },
  {
    name: 'Gresik Kota',
    code: 'AS-GRK-02',
    lat: -7.1620,
    lng: 112.6540,
    address: 'Pusat Kota Gresik',
    aqi: 44,
    pm25: 15.2,
    eco2: 590,
    tvoc: 89,
    temperature: 30.2,
    humidity: 70,
    status: 'online',
    uiStatus: 'baik',
    lastUpdate: '09.41 WIB',
  },
  {
    name: 'Manyar',
    code: 'AS-MYR-03',
    lat: -7.1240,
    lng: 112.5970,
    address: 'Kawasan Industri Manyar',
    aqi: 65,
    pm25: 25.8,
    eco2: 688,
    tvoc: 221,
    temperature: 31.1,
    humidity: 68,
    status: 'warning',
    uiStatus: 'perhatian',
    lastUpdate: '09.41 WIB',
  },
  {
    name: 'Bungah',
    code: 'AS-BGH-04',
    lat: -7.0540,
    lng: 112.5710,
    address: 'Kecamatan Bungah',
    aqi: 41,
    pm25: 13.6,
    eco2: 568,
    tvoc: 81,
    temperature: 29.4,
    humidity: 74,
    status: 'online',
    uiStatus: 'baik',
    lastUpdate: '09.41 WIB',
  },
  {
    name: 'Sidayu',
    code: 'AS-SDY-05',
    lat: -6.9940,
    lng: 112.5620,
    address: 'Zona Buffer Industri Sidayu',
    aqi: 84,
    pm25: 32.4,
    eco2: 714,
    tvoc: 168,
    temperature: 31.5,
    humidity: 66,
    status: 'warning',
    uiStatus: 'perhatian',
    lastUpdate: '09.41 WIB',
  },
  {
    name: 'Driyorejo',
    code: 'AS-DRY-06',
    lat: -7.3480,
    lng: 112.6240,
    address: 'Perbatasan Gresik-Surabaya Selatan',
    aqi: 48,
    pm25: 16.8,
    eco2: 602,
    tvoc: 92,
    temperature: 30.7,
    humidity: 71,
    status: 'online',
    uiStatus: 'baik',
    lastUpdate: '09.41 WIB',
  },
  {
    name: 'Kebomas',
    code: 'AS-KBM-07',
    lat: -7.1720,
    lng: 112.6170,
    address: 'Kecamatan Kebomas',
    aqi: 43,
    pm25: 14.7,
    eco2: 584,
    tvoc: 86,
    temperature: 30.0,
    humidity: 73,
    status: 'online',
    uiStatus: 'baik',
    lastUpdate: '09.41 WIB',
  },
  {
    name: 'Menganti',
    code: 'AS-MGT-08',
    lat: -7.2760,
    lng: 112.5890,
    address: 'Kecamatan Menganti',
    aqi: 46,
    pm25: 15.9,
    eco2: 598,
    tvoc: 90,
    temperature: 30.3,
    humidity: 69,
    status: 'online',
    uiStatus: 'baik',
    lastUpdate: '09.41 WIB',
  },
  {
    name: 'Ujungpangkah',
    code: 'AS-UJP-09',
    lat: -6.9180,
    lng: 112.5490,
    address: 'Pesisir Ujungpangkah',
    aqi: 36,
    pm25: 11.8,
    eco2: 540,
    tvoc: 71,
    temperature: 29.6,
    humidity: 76,
    status: 'online',
    uiStatus: 'baik',
    lastUpdate: '09.41 WIB',
  },
  {
    name: 'Wringinanom',
    code: 'AS-WRN-10',
    lat: -7.3820,
    lng: 112.5280,
    address: 'Kecamatan Wringinanom',
    aqi: 47,
    pm25: 16.3,
    eco2: 606,
    tvoc: 95,
    temperature: 30.4,
    humidity: 70,
    status: 'online',
    uiStatus: 'baik',
    lastUpdate: '09.41 WIB',
  },
]

export const mockReadings: NodeReading[] = GRESIK_NODES_DATA.map((item, index) => ({
  id: `read-${index + 1}`,
  nodeId: item.code,
  pm25: item.pm25,
  tvoc: item.tvoc,
  eco2: item.eco2,
  temperature: item.temperature,
  humidity: item.humidity,
  aqi: item.aqi,
  quality: item.aqi <= 50 ? 'good' : 'moderate',
  timestamp: new Date().toISOString(),
  estimations: {
    eco2: {
      estimatedValue: item.eco2,
      correction: -15,
      confidence: 94.8,
    },
    tvoc: {
      estimatedValue: item.tvoc,
      correction: -8,
      confidence: 93.2,
    },
  },
}))

export const mockNodes: Node[] = GRESIK_NODES_DATA.map((item, index) => ({
  id: item.code,
  name: item.name,
  location: {
    lat: item.lat,
    lng: item.lng,
    address: item.address,
  },
  status: item.status,
  batteryLevel: 95 - index * 3,
  uptime: 99.8,
  latency: 22 + index * 4,
  createdAt: '2026-01-10T10:00:00Z',
  updatedAt: new Date().toISOString(),
  lastReading: mockReadings[index],
}))

export const mockAlerts: Alert[] = [
  {
    id: 'alert-1',
    timestamp: '09.25 WIB',
    nodeId: 'AS-SDY-05',
    nodeName: 'Sidayu',
    sensor: 'PM2.5',
    severity: 'warning',
    description: 'Partikel debu sedang meningkat (32,4 µg/m³). Anak-anak dan orang dengan masalah pernapasan sebaiknya membatasi aktivitas luar ruangan.',
    status: 'active',
    value: 32.4,
    threshold: 25.0,
  },
  {
    id: 'alert-2',
    timestamp: '08.50 WIB',
    nodeId: 'AS-MYR-03',
    nodeName: 'Manyar',
    sensor: 'TVOC',
    severity: 'warning',
    description: 'Nilai TVOC mendekati batas perhatian (221 ppb). Pantau perkembangan sebelum aktivitas di area terbuka berlangsung lama.',
    status: 'active',
    value: 221,
    threshold: 200,
  },
]

export const mockTrendData24h = [
  { time: '00.00', raw: 16.4, estimate: 15.7, threshold: 35 },
  { time: '02.00', raw: 15.0, estimate: 15.2, threshold: 35 },
  { time: '04.00', raw: 16.4, estimate: 14.5, threshold: 35 },
  { time: '06.00', raw: 12.4, estimate: 13.9, threshold: 35 },
  { time: '08.00', raw: 15.3, estimate: 14.3, threshold: 35 },
  { time: '10.00', raw: 13.8, estimate: 12.8, threshold: 35 },
  { time: '12.00', raw: 9.2,  estimate: 11.8, threshold: 35 },
  { time: '14.00', raw: 12.0, estimate: 11.1, threshold: 35 },
  { time: '16.00', raw: 7.0,  estimate: 10.2, threshold: 35 },
  { time: '18.00', raw: 10.4, estimate: 9.8,  threshold: 35 },
  { time: '20.00', raw: 8.5,  estimate: 10.2, threshold: 35 },
  { time: '22.00', raw: 12.3, estimate: 11.4, threshold: 35 },
  { time: '24.00', raw: 15.1, estimate: 14.6, threshold: 35 },
]

export const mockTrendData7d = [
  { time: 'Sen', raw: 15.1, estimate: 14.5, threshold: 35 },
  { time: 'Sel', raw: 13.0, estimate: 13.8, threshold: 35 },
  { time: 'Rab', raw: 14.1, estimate: 12.9, threshold: 35 },
  { time: 'Kam', raw: 8.5,  estimate: 11.9, threshold: 35 },
  { time: 'Jum', raw: 11.3, estimate: 11.8, threshold: 35 },
  { time: 'Sab', raw: 11.5, estimate: 12.1, threshold: 35 },
  { time: 'Min', raw: 9.0,  estimate: 9.8,  threshold: 35 },
]

export const SAMPLE_RECOMMENDATIONS = [
  'Kalau keluar rumah hari ini, cek kondisi udara di lokasi terdekat. Bawa masker sebagai langkah siap siaga.',
  'Semangat menjalani hari! Mulai dengan melihat kualitas udara sebelum berangkat, lalu pilih aktivitas yang paling nyaman.',
  'Jaga napas, jaga semangat. Saat udara terasa kurang nyaman, beri diri Anda waktu untuk beristirahat di dalam ruangan.',
  'Langkah kecil juga berarti: ingatkan keluarga untuk memeriksa kondisi udara sebelum beraktivitas di luar.',
  'Udara yang lebih sehat dimulai dari kebiasaan bersama. Terus pantau, saling peduli, dan tetap semangat!',
]

export const CHUNK = 32;
export const MAX_MAP_SIZE = 5000;
export const HEADWATER_GROVE_RADIUS = 16;
export const VERSION = 1;
export const HYDROLOGY_VERSIONS = Object.freeze([1, 2, 3, 4]);
export const LATEST_HYDROLOGY = HYDROLOGY_VERSIONS.at(-1);
export const TRAVERSAL_PROFILE = Object.freeze({
  tick: 1 / 30, wadeDepth: .15, swimDepth: 1, arrivalDistance: .14,
  walkSpeed: 4, wadeSpeed: 2.3, swimSpeed: 1.8, swimDrift: .55,
  groundGrade: .85, waterGrade: 1.2
});
export const DEFAULT = Object.freeze({
  seed: 1769, size: 1024, water: .42, relief: .64, climate: .50,
  vegetation: .68, rivers: .52, lakes: .55, settlements: .36,
  style: 'autumn', detail: 'balanced'
});
export const SETTINGS = {
  water: 'Proporção de água', relief: 'Intensidade do relevo', climate: 'Clima seco ↔ úmido',
  vegetation: 'Densidade vegetal', rivers: 'Quantidade de rios', lakes: 'Frequência de lagos',
  settlements: 'Densidade de povoados'
};
export const BIOMES = [
  { name: 'Águas abertas', color: '#347878', trees: [], density: 0 },
  { name: 'Margem arenosa', color: '#ba9a62', trees: [], density: 0 },
  { name: 'Pradaria', color: '#819254', trees: ['oak', 'birch'], density: .15 },
  { name: 'Floresta temperada', color: '#617c46', trees: ['oak', 'oak', 'birch', 'pine'], density: .57 },
  { name: 'Mata densa', color: '#4f6741', trees: ['oak', 'pine', 'pine', 'birch'], density: .83 },
  { name: 'Savana', color: '#a19450', trees: ['acacia'], density: .12 },
  { name: 'Região seca', color: '#9a7753', trees: ['acacia'], density: .03 },
  { name: 'Montanha', color: '#827b77', trees: ['pine'], density: .11 },
  { name: 'Tundra', color: '#b0b3a5', trees: ['pine'], density: .035 },
  { name: 'Neve', color: '#d4dad2', trees: [], density: 0 },
  { name: 'Mata ciliar', color: '#718947', trees: ['willow', 'willow', 'birch'], density: .38 },
  { name: 'Pântano', color: '#667b53', trees: ['willow', 'willow', 'oak'], density: .22 }
];
export const SPECIES = {
  oak: { name: 'Carvalho', height: 4.3, radius: 1.45, colors: ['#536332','#6e8139','#8a9a46','#ad9d4a'] },
  birch: { name: 'Bétula', height: 4.55, radius: 1, colors: ['#64652e','#8e8d3c','#b3a84e','#d0b75b'] },
  pine: { name: 'Pinheiro', height: 5.6, radius: 1.12, colors: ['#344e44','#46644d','#58805b','#789667'] },
  willow: { name: 'Salgueiro', height: 3.8, radius: 1.6, colors: ['#4f6636','#6e843c','#869b4a','#a5ac56'] },
  acacia: { name: 'Acácia', height: 3.2, radius: 1.48, colors: ['#696c3c','#868943','#a19e49','#ada251'] }
};
export const STRUCTURES = {
  cottage: { name: 'Casa de enxaimel', footprint: 2.6, floors: 1 },
  hall: { name: 'Salão comunal', footprint: 4.1, floors: 2 },
  manor: { name: 'Solar fortificado', footprint: 4.6, floors: 2 },
  chapel: { name: 'Capela de pedra', footprint: 4.1, floors: 1 },
  workshop: { name: 'Oficina', footprint: 3.25, floors: 1 },
  inn: { name: 'Estalagem', footprint: 3.8, floors: 2 },
  townhouse: { name: 'Sobrado', footprint: 3.2, floors: 2 },
  market: { name: 'Banca de mercado', footprint: 2.5, floors: 1 },
  cabin: { name: 'Cabana de lenhador', footprint: 2.1, floors: 1, cost: { wood: 3, stone: 2 } }
};
